import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const base = process.env.SETU_DIGILOCKER_BASE_URL!;
const headers = {
  "x-client-id": process.env.SETU_CLIENT_ID!,
  "x-client-secret": process.env.SETU_CLIENT_SECRET!,
  "x-product-instance-id": process.env.SETU_PRODUCT_INSTANCE_ID!
};

async function tryPath(path: string) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  console.log(`PATH ${path} STATUS ${res.status}`);
  console.log(text.slice(0, 800));
  console.log("---");
}

const reqId = process.argv[2] ?? "77ae13a1-8797-42f7-b910-83c08119756b";
await tryPath(`/api/digilocker/${reqId}`);
await tryPath(`/api/digilocker/${reqId}/status`);
