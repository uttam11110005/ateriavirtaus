import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets phones on the same Wi-Fi load the dev server by the Mac's LAN address.
  allowedDevOrigins: ["192.168.1.188", "*.local"],
};

export default nextConfig;
