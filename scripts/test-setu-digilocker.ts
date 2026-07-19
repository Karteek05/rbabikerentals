import { loadEnvConfig } from "@next/env";
import { createDigilockerRequest } from "@/lib/integrations/setu-digilocker";

loadEnvConfig(process.cwd());

async function main() {
  const result = await createDigilockerRequest();
  console.log(
    JSON.stringify(
      {
        ok: true,
        id: result.id ?? result.requestId ?? null,
        status: result.status ?? null,
        url: result.url ?? null,
        validUpto: result.validUpto ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "unknown";
  console.error(JSON.stringify({ ok: false, code, message }, null, 2));
  process.exit(1);
});
