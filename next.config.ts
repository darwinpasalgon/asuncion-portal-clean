import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{
      source: "/portal/admin/class-schedules",
      destination: "/portal/admin/schedules",
      permanent: true,
    }];
  },
};

export default nextConfig;
