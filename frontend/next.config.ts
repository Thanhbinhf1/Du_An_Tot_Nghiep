import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/dang-:mode(nhap|ky)",
      has: [{ type: "host", value: "localhost" }],
      headers: [{ key: "Referrer-Policy", value: "no-referrer-when-downgrade" }],
    }];
  },
};

export default nextConfig;
