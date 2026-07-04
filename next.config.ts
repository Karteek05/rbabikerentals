import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";
const razorpayHosts = "https://*.razorpay.com";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}https://checkout.razorpay.com https://cdn.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https:",
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    razorpayHosts,
    "https://dg.setu.co",
    isDev ? "ws: wss:" : null
  ]
    .filter(Boolean)
    .join(" "),
  `frame-src 'self' ${razorpayHosts} https://www.openstreetmap.org`,
  `form-action 'self' ${razorpayHosts}`
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
