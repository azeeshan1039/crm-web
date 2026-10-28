import type { NextConfig } from "next";

// Flask API (../crm/app.py). Override with CRM_API=http://host:port if needed.
const API = process.env.CRM_API || "http://127.0.0.1:5050";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
