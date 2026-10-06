import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@paymoon/ui"],
  poweredByHeader: false,
  ...(process.env.CAPACITOR_BUILD === "1"
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};
export default config;
