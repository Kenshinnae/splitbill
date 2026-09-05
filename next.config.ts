import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hostinger's reverse proxy/CDN handles compression. Avoid a second streaming
  // compression layer between Next's static-file server and the proxy.
  compress: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-SplitBill-Release", value: "proxy-compression-20260906" }],
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
