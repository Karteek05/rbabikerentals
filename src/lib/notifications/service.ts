import nodemailer from "nodemailer";
import { getVehicleDisplayName, formatBookingReference } from "@/lib/fleet/display";
import { insertNotificationJob } from "@/lib/data/repository";
import { getSupabaseServiceClient } from "@/lib/db/supabase-client";
import type { NotificationJob } from "@/lib/types/domain";
import { newId } from "@/lib/utils/ids";

type NotificationPayload = Record<string, unknown>;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP credentials not fully configured. Emails will only be logged.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user,
      pass
    }
  });
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || "noreply@rbabikerentals.com";

  if (!transporter) {
    console.log("========== EMAIL MOCK ==========");
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (Text): \n${text}`);
    if (html) console.log(`Body (HTML): \n${html}`);
    console.log("================================");
    return;
  }

  try {
    // In development, always log the email so we can see OTPs easily even if SMTP fails
    if (process.env.NODE_ENV === "development") {
      console.log("========== EMAIL DEV LOG ==========");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body (Text): \n${text}`);
      console.log("===================================");
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });
    console.log(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error("Error sending email via SMTP:", error);
    // We don't throw the error in development so it doesn't crash background tasks,
    // allowing the user to still use the OTP printed in the console.
    if (process.env.NODE_ENV !== "development") {
      throw error;
    }
  }
}

export async function resolveUserNotificationEmail(
  userId: string,
  fallbackEmail?: string | null
) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: authUser } = await supabase
      .from("user")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    return authUser?.email ?? fallbackEmail ?? null;
  } catch (error) {
    console.error("Failed to resolve notification email:", error);
    return fallbackEmail ?? null;
  }
}

export async function sendResetPasswordEmail(email: string, resetLink: string) {
  const text = `Hi there,\n\nYou requested a password reset. Please click the link below to set a new password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nRBA Bike Rentals Team`;
  const html = `<p>Hi there,</p><p>You requested a password reset. Please click the link below to set a new password:</p><p><a href="${resetLink}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p><p>Thanks,<br>RBA Bike Rentals Team</p>`;

  await sendEmail({
    to: email,
    subject: "Reset your RBA Bike Rentals Password",
    text,
    html
  });
}

export async function sendOtpEmail(email: string, otp: string) {
  const text = `Hi there,\n\nYour verification code is: ${otp}\n\nThis code will expire shortly. Please enter it to verify your email address.\n\nThanks,\nRBA Bike Rentals Team`;
  const html = `<p>Hi there,</p><p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px;padding:10px;background:#f5f5f5;border-radius:4px;display:inline-block;margin:10px 0;">${otp}</strong></p><p>This code will expire shortly. Please enter it to verify your email address.</p><p>Thanks,<br>RBA Bike Rentals Team</p>`;

  await sendEmail({
    to: email,
    subject: "Verify your email address - RBA Bike Rentals",
    text,
    html
  });
}

export async function sendBookingConfirmationEmail(email: string, bookingDetails: any) {
  const pickupTime = new Date(bookingDetails.pickup_at).toLocaleString("en-IN");
  const dropTime = new Date(bookingDetails.drop_at).toLocaleString("en-IN");
  const status = String(bookingDetails.status ?? "pending").replace(/_/g, " ");
  const vehicleName = getVehicleDisplayName(
    String(bookingDetails.vehicle_id ?? ""),
    bookingDetails.vehicle
  );
  const bookingRef = formatBookingReference(String(bookingDetails.id ?? ""));

  await sendEmail({
    to: email,
    subject: `Booking request received - ${vehicleName}`,
    text: paragraph([
      "We received your RBA booking request.",
      "",
      `Vehicle: ${vehicleName}`,
      `Booking reference: ${bookingRef}`,
      `Status: ${status}`,
      `Pickup: ${pickupTime}`,
      `Drop: ${dropTime}`,
      "",
      "Your booking is ready for payment now. Complete checkout from My Bookings to confirm your ride.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "Booking request received",
      intro: "Your booking is ready for payment. Complete checkout from My Bookings to confirm your ride.",
      rows: [
        ["Vehicle", vehicleName],
        ["Booking reference", bookingRef],
        ["Status", status],
        ["Pickup", pickupTime],
        ["Drop", dropTime]
      ],
      closing: "Complete payment from My Bookings to confirm your ride."
    })
  });
}

export async function sendBookingApprovedEmail(email: string, bookingDetails: any, paymentLink: string) {
  const vehicleName = getVehicleDisplayName(
    String(bookingDetails.vehicle_id ?? ""),
    bookingDetails.vehicle
  );
  const bookingRef = formatBookingReference(String(bookingDetails.id ?? ""));

  await sendEmail({
    to: email,
    subject: `Payment ready - ${vehicleName}`,
    text: paragraph([
      "Your RBA booking is ready for payment.",
      "",
      `Vehicle: ${vehicleName}`,
      `Booking reference: ${bookingRef}`,
      `Complete payment: ${paymentLink}`,
      "",
      "You can also pay from My Bookings on the website.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "Payment ready",
      intro: "Complete payment to confirm your scooter booking.",
      rows: [
        ["Vehicle", vehicleName],
        ["Booking reference", bookingRef]
      ],
      cta: { label: "Pay now", url: paymentLink },
      closing: "You can also open My Bookings on the website to pay with UPI, card, or netbanking."
    })
  });
}

export async function sendBookingRejectedEmail(email: string, bookingDetails: any) {
  const vehicleName = getVehicleDisplayName(
    String(bookingDetails.vehicle_id ?? ""),
    bookingDetails.vehicle
  );
  const bookingRef = formatBookingReference(String(bookingDetails.id ?? ""));

  await sendEmail({
    to: email,
    subject: `Booking update - ${vehicleName}`,
    text: paragraph([
      "We could not approve your booking request at this time.",
      "",
      `Vehicle: ${vehicleName}`,
      `Booking reference: ${bookingRef}`,
      "",
      "You are welcome to try again later or contact support if you believe this is a mistake.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "Booking not approved",
      intro: "We could not approve your booking request at this time.",
      rows: [
        ["Vehicle", vehicleName],
        ["Booking reference", bookingRef]
      ],
      closing: "You can submit a new booking request from the website when you are ready."
    })
  });
}

function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

function missingSmtpEnv() {
  return ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"].filter((key) => !process.env[key]);
}

function formatMoney(value: unknown) {
  return typeof value === "number" ? `Rs. ${value.toLocaleString("en-IN")}` : "the payable amount";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function renderEmailHtml(params: {
  title: string;
  intro: string;
  rows: Array<[string, string]>;
  cta?: { label: string; url: string };
  closing: string;
}) {
  const rows = params.rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:#68707d;font-size:13px;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;color:#111820;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  const cta = params.cta
    ? `<a href="${escapeHtml(params.cta.url)}" style="display:inline-block;margin-top:22px;border-radius:999px;background:#c78310;color:#ffffff;padding:13px 22px;font-size:14px;font-weight:800;text-decoration:none;">${escapeHtml(params.cta.label)}</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#111820;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(params.intro)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e6ddcd;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:22px 26px;background:#101820;color:#ffffff;">
                <div style="font-size:20px;font-weight:900;letter-spacing:.2px;">RBA<span style="color:#d29422;">.</span></div>
                <div style="margin-top:4px;color:#c9d0d8;font-size:12px;">Bengaluru Bike Rentals</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 26px;">
                <h1 style="margin:0 0 12px;color:#111820;font-size:24px;line-height:1.2;">${escapeHtml(params.title)}</h1>
                <p style="margin:0 0 22px;color:#3c4652;font-size:15px;line-height:1.6;">${escapeHtml(params.intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ece5da;border-bottom:1px solid #ece5da;">
                  ${rows}
                </table>
                ${cta}
                <p style="margin:24px 0 0;color:#3c4652;font-size:14px;line-height:1.6;">${escapeHtml(params.closing)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;background:#fbf8f1;color:#68707d;font-size:12px;line-height:1.5;">
                This is an automated update from RBA Bike Rentals. If you did not request this booking, reply to this email so the team can review it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildUserEmail(params: {
  templateKey: string;
  payload: NotificationPayload;
}) {
  if (params.templateKey === "booking_approved_pay_now") {
    const paymentUrl = String(params.payload.payment_url ?? "");
    const amount = formatMoney(params.payload.total_payable);
    const bookingId = String(params.payload.booking_id ?? "");
    const vehicleId = String(params.payload.vehicle_id ?? "");
    const vehicleName = getVehicleDisplayName(vehicleId);
    const text = paragraph([
      "Your RBA booking is ready for payment.",
      "",
      "Your booking is ready for payment. Complete checkout to confirm your ride.",
      "",
      `Booking ID: ${bookingId}`,
      `Vehicle: ${vehicleName}`,
      `Amount due: ${amount}`,
      paymentUrl ? `Complete payment: ${paymentUrl}` : "",
      "",
      "After payment is received, our team will coordinate pickup details with you.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]);

    return {
      subject: "Your RBA booking is ready for payment",
      text,
      html: renderEmailHtml({
        title: "Payment ready",
        intro: "Your booking is ready for payment. Complete checkout to confirm your ride.",
        rows: [
          ["Booking ID", bookingId],
          ["Vehicle", vehicleName],
          ["Amount due", amount]
        ],
        cta: paymentUrl ? { label: "Complete payment", url: paymentUrl } : undefined,
        closing: "After payment is received, our team will coordinate pickup details with you."
      })
    };
  }

  if (params.templateKey === "booking_submitted") {
    const bookingId = String(params.payload.booking_id ?? "");
    const vehicleId = String(params.payload.vehicle_id ?? "");
    const vehicleName = getVehicleDisplayName(vehicleId);
    const text = paragraph([
      "We received your RBA booking request.",
      "",
      `Booking ID: ${bookingId}`,
      `Vehicle: ${vehicleName}`,
      "",
      "Your booking is ready for payment now. Complete checkout from My Bookings to confirm your ride.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]);

    return {
      subject: "We received your RBA booking request",
      text,
      html: renderEmailHtml({
        title: "Booking request received",
        intro: "Your booking is ready for payment. Complete checkout to confirm your ride.",
        rows: [
          ["Booking ID", bookingId],
          ["Vehicle", vehicleName]
        ],
        closing: "Complete checkout from My Bookings to confirm your ride."
      })
    };
  }

  if (params.templateKey === "booking_rejected") {
    const bookingId = String(params.payload.booking_id ?? "");
    const vehicleId = String(params.payload.vehicle_id ?? "");
    const vehicleName = getVehicleDisplayName(vehicleId);
    const reason = String(params.payload.reason ?? "The booking could not be approved.");
    const text = paragraph([
      "Your RBA booking could not be approved.",
      "",
      `Booking ID: ${bookingId}`,
      `Vehicle: ${vehicleName}`,
      `Reason: ${reason}`,
      "",
      "You can place a new booking request with a different vehicle, date, or pickup window.",
      "",
      "Regards,",
      "RBA Bike Rentals"
    ]);

    return {
      subject: "Update on your RBA booking request",
      text,
      html: renderEmailHtml({
        title: "Booking request update",
        intro: "Your booking request could not be approved in its current form.",
        rows: [
          ["Booking ID", bookingId],
          ["Vehicle", vehicleName],
          ["Reason", reason]
        ],
        closing: "You can place a new booking request with a different vehicle, date, or pickup window."
      })
    };
  }

  if (params.templateKey === "partner_application_approved") {
    const loginUrl = String(params.payload.login_url ?? "");
    const partnerName = String(params.payload.partner_name ?? "Partner");
    return {
      subject: "Your RBA partner application is approved",
      text: paragraph([
        `Hi ${partnerName},`,
        "",
        "Your partner application has been approved.",
        loginUrl ? `Sign in: ${loginUrl}` : "",
        "",
        "RBA Bike Rentals"
      ]),
      html: renderEmailHtml({
        title: "Partner application approved",
        intro: "Your partner application has been approved.",
        rows: [["Partner", partnerName]],
        cta: loginUrl ? { label: "Sign in", url: loginUrl } : undefined,
        closing: "Our team will assign vehicles to your fleet."
      })
    };
  }

  if (params.templateKey === "partner_application_rejected") {
    const reason = String(params.payload.reason ?? "Application not approved.");
    const reapplyUrl = String(params.payload.reapply_url ?? "");
    return {
      subject: "Update on your RBA partner application",
      text: paragraph([
        "Your partner application was not approved at this time.",
        "",
        `Reason: ${reason}`,
        reapplyUrl ? `Re-apply: ${reapplyUrl}` : "",
        "",
        "RBA Bike Rentals"
      ]),
      html: renderEmailHtml({
        title: "Partner application update",
        intro: "Your partner application was not approved at this time.",
        rows: [["Reason", reason]],
        cta: reapplyUrl ? { label: "Apply again", url: reapplyUrl } : undefined,
        closing: "You can submit a new application when you are ready."
      })
    };
  }

  return null;
}

export async function sendBookingSubmittedAdminEmail(
  adminEmail: string,
  details: {
    booking_id: string;
    booking_ref: string;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    vehicle_name: string;
    pickup_at: string;
    drop_at: string;
    pickup_zone?: string | null;
    pickup_address?: string | null;
    total_payable: number;
    admin_url: string;
  }
) {
  const pickupTime = new Date(details.pickup_at).toLocaleString("en-IN");
  const dropTime = new Date(details.drop_at).toLocaleString("en-IN");
  const amount = formatMoney(details.total_payable);
  const pickupLocation =
    [details.pickup_zone, details.pickup_address].filter(Boolean).join(" — ") || "—";

  await sendEmail({
    to: adminEmail,
    subject: `New booking request — ${details.vehicle_name} (${details.booking_ref})`,
    text: paragraph([
      "A customer submitted a new bike rental request.",
      "",
      `Customer: ${details.customer_name}`,
      `Email: ${details.customer_email ?? "—"}`,
      `Phone: ${details.customer_phone ?? "—"}`,
      `Vehicle: ${details.vehicle_name}`,
      `Booking reference: ${details.booking_ref}`,
      `Pickup: ${pickupTime}`,
      `Drop: ${dropTime}`,
      `Pickup location: ${pickupLocation}`,
      `Quoted amount: ${amount}`,
      "",
      `Review booking details: ${details.admin_url}`,
      "",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "New booking request",
      intro: "A customer submitted a bike rental request that needs admin review.",
      rows: [
        ["Customer", details.customer_name],
        ["Email", details.customer_email ?? "—"],
        ["Phone", details.customer_phone ?? "—"],
        ["Vehicle", details.vehicle_name],
        ["Booking reference", details.booking_ref],
        ["Pickup", pickupTime],
        ["Drop", dropTime],
        ["Pickup location", pickupLocation],
        ["Quoted amount", amount]
      ],
      cta: { label: "Review booking", url: details.admin_url },
      closing: "The customer can complete payment from My Bookings."
    })
  });
}

export async function sendPartnerApplicationSubmittedEmail(
  adminEmail: string,
  details: {
    name: string;
    email?: string | null;
    phone?: string | null;
    business_name?: string | null;
    applied_at?: string | null;
    admin_url: string;
  }
) {
  const appliedAt = details.applied_at
    ? new Date(details.applied_at).toLocaleString("en-IN")
    : "—";

  await sendEmail({
    to: adminEmail,
    subject: `New partner application — ${details.name}`,
    text: paragraph([
      "A new partner application was submitted.",
      "",
      `Name: ${details.name}`,
      `Email: ${details.email ?? "—"}`,
      `Phone: ${details.phone ?? "—"}`,
      `Business: ${details.business_name ?? "—"}`,
      `Applied: ${appliedAt}`,
      `Review: ${details.admin_url}`,
      "",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "New partner application",
      intro: "A partner application is waiting for admin review.",
      rows: [
        ["Name", details.name],
        ["Email", details.email ?? "—"],
        ["Phone", details.phone ?? "—"],
        ["Business", details.business_name ?? "—"],
        ["Applied", appliedAt]
      ],
      cta: { label: "Review application", url: details.admin_url },
      closing: "Approve the application before the partner can access the dashboard."
    })
  });
}

export async function sendPartnerApplicationApprovedEmail(
  email: string,
  details: { partner_name: string; login_url: string }
) {
  await sendEmail({
    to: email,
    subject: "Your RBA partner application is approved",
    text: paragraph([
      `Hi ${details.partner_name},`,
      "",
      "Your partner application has been approved.",
      "",
      `Sign in: ${details.login_url}`,
      "",
      "Our team will assign vehicles to your fleet. You can track bookings and revenue once vehicles are live.",
      "",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "Partner application approved",
      intro: "Your partner application has been approved. You can now sign in to the partner dashboard.",
      rows: [["Partner", details.partner_name]],
      cta: { label: "Sign in to partner dashboard", url: details.login_url },
      closing: "Our team will assign vehicles to your fleet. You will see them under Vehicles once they are live."
    })
  });
}

export async function sendPartnerApplicationRejectedEmail(
  email: string,
  details: { partner_name: string; reason: string; reapply_url: string }
) {
  await sendEmail({
    to: email,
    subject: "Update on your RBA partner application",
    text: paragraph([
      `Hi ${details.partner_name},`,
      "",
      "Your partner application was not approved at this time.",
      "",
      `Reason: ${details.reason}`,
      "",
      `You may submit a new application: ${details.reapply_url}`,
      "",
      "RBA Bike Rentals"
    ]),
    html: renderEmailHtml({
      title: "Partner application update",
      intro: "Your partner application was not approved at this time.",
      rows: [
        ["Partner", details.partner_name],
        ["Reason", details.reason]
      ],
      cta: { label: "Submit a new application", url: details.reapply_url },
      closing: "You can update your details and apply again when you are ready."
    })
  });
}

async function enqueue(
  channel: NotificationJob["channel"],
  params: {
    templateKey: string;
    recipient: string;
    payload: NotificationPayload;
  }
) {
  return insertNotificationJob({
    id: newId("notif"),
    channel,
    template_key: params.templateKey,
    recipient: params.recipient,
    payload: params.payload,
    status: "queued",
    created_at: new Date().toISOString()
  });
}

export async function notifyUser(params: {
  userId: string;
  email?: string | null;
  templateKey: string;
  payload: NotificationPayload;
}) {
  const recipient = params.email || params.userId;
  const jobs: Array<Promise<unknown>> = [
    enqueue("email", {
      templateKey: params.templateKey,
      recipient,
      payload: params.payload
    }),
    enqueue("in_app", {
      templateKey: params.templateKey,
      recipient: params.userId,
      payload: params.payload
    })
  ];

  const email = buildUserEmail(params);
  if (email && params.email) {
    const missing = missingSmtpEnv();
    if (missing.length) {
      jobs.push(
        enqueue("email", {
          templateKey: `${params.templateKey}_smtp_skipped`,
          recipient,
          payload: {
            ...params.payload,
            missing_env: missing
          }
        })
      );
    } else if (smtpReady()) {
      jobs.push(
        sendEmail({
          to: params.email,
          subject: email.subject,
          text: email.text,
          html: email.html
        })
          .then(() =>
            enqueue("email", {
              templateKey: `${params.templateKey}_smtp_sent`,
              recipient,
              payload: params.payload
            })
          )
          .catch((error) => {
            const message = error instanceof Error ? error.message : "SMTP send failed";
            console.error("SMTP send failed", {
              templateKey: params.templateKey,
              recipient,
              error: message
            });
            return enqueue("email", {
              templateKey: `${params.templateKey}_smtp_failed`,
              recipient,
              payload: {
                ...params.payload,
                error: message
              }
            });
          })
      );
    }
  }

  return Promise.all(jobs);
}

export async function notifyAdmin(params: {
  templateKey: string;
  payload: NotificationPayload;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin_ops_team";
  return Promise.all([
    enqueue("email", {
      templateKey: params.templateKey,
      recipient: adminEmail,
      payload: params.payload
    }),
    enqueue("in_app", {
      templateKey: params.templateKey,
      recipient: "admin_ops_team",
      payload: params.payload
    })
  ]);
}
