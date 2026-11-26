import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_MODE === "1" ? ".next-e2e" : ".next",
  async headers() {
    return [{
      source: "/dang-:mode(nhap|ky)",
      has: [{ type: "host", value: "localhost" }],
      headers: [{ key: "Referrer-Policy", value: "no-referrer-when-downgrade" }],
    }];
  },
};

export default nextConfig;
