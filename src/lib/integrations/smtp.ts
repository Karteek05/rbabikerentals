import net from "node:net";
import tls from "node:tls";

type MailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to send email.`);
  }
  return value;
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function escapeSubject(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

function escapeLeadingDots(value: string) {
  return value.replace(/(^|\r?\n)\./g, "$1..");
}

class SmtpSession {
  private buffer = "";

  constructor(private socket: net.Socket | tls.TLSSocket) {}

  waitFor(expected: number | number[]) {
    const allowed = Array.isArray(expected) ? expected : [expected];
    return new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const last = lines.at(-1);
        if (!last || !/^\d{3} /.test(last)) return;

        this.socket.off("data", onData);
        this.socket.off("error", onError);
        this.buffer = "";

        const code = Number(last.slice(0, 3));
        if (allowed.includes(code)) {
          resolve(lines.join("\n"));
        } else {
          reject(new Error(`SMTP command failed: ${lines.join(" | ")}`));
        }
      };

      const onError = (error: Error) => {
        this.socket.off("data", onData);
        reject(error);
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }

  async command(line: string, expected: number | number[]) {
    this.socket.write(`${line}\r\n`);
    return this.waitFor(expected);
  }

  replaceSocket(socket: tls.TLSSocket) {
    this.socket = socket;
  }

  end() {
    this.socket.end();
  }
}

async function connectSmtp(host: string, port: number) {
  const socket =
    port === 465
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });

  await new Promise<void>((resolve, reject) => {
    socket.once(port === 465 ? "secureConnect" : "connect", resolve);
    socket.once("error", reject);
  });

  return new SmtpSession(socket);
}

export async function sendSmtpMail(params: MailParams) {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = requireEnv("EMAIL_FROM");

  const session = await connectSmtp(host, port);
  try {
    await session.waitFor(220);
    await session.command(`EHLO ${process.env.APP_BASE_URL || "localhost"}`, 250);

    if (port !== 465) {
      await session.command("STARTTLS", 220);
      const secureSocket = tls.connect({
        socket: (session as unknown as { socket: net.Socket }).socket,
        servername: host
      });
      await new Promise<void>((resolve, reject) => {
        secureSocket.once("secureConnect", resolve);
        secureSocket.once("error", reject);
      });
      session.replaceSocket(secureSocket);
      await session.command(`EHLO ${process.env.APP_BASE_URL || "localhost"}`, 250);
    }

    await session.command("AUTH LOGIN", 334);
    await session.command(encodeBase64(user), 334);
    await session.command(encodeBase64(pass), 235);
    await session.command(`MAIL FROM:<${from}>`, 250);
    await session.command(`RCPT TO:<${params.to}>`, [250, 251]);
    await session.command("DATA", 354);

    const messageBody = params.html
      ? [
          `Content-Type: multipart/alternative; boundary="rba-mail-boundary"`,
          "",
          "--rba-mail-boundary",
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          params.text,
          "--rba-mail-boundary",
          "Content-Type: text/html; charset=UTF-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          params.html,
          "--rba-mail-boundary--"
        ].join("\r\n")
      : [
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          params.text
        ].join("\r\n");

    const body = escapeLeadingDots([
      `From: ${from}`,
      `To: ${params.to}`,
      `Subject: ${escapeSubject(params.subject)}`,
      "MIME-Version: 1.0",
      messageBody
    ].join("\r\n"));

    await session.command(`${body}\r\n.`, 250);
    await session.command("QUIT", 221);
  } finally {
    session.end();
  }
}
