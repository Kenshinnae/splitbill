import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR / dev assets when opening the app via ngrok (subdomain changes on free tier).
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
};

export default nextConfig;
