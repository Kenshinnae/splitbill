import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-SplitBill-Release", value: "startup-recovery-20260905" }],
      },
      ...["/sw.js", "/firebase-config.json", "/api/public-config"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      })),
    ];
  },
  // Allow HMR / dev assets when opening the app via ngrok (subdomain changes on free tier).
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
};

export default nextConfig;
