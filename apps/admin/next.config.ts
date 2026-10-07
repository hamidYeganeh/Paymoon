import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
let publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!publicApiUrl) {
  try {
    publicApiUrl = readFileSync(resolve(process.cwd(), "../../.env"), "utf8")
      .match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {}
}
const proxyUrl = process.env.COMMERCE_API_PROXY_URL;
if (
  proxyUrl &&
  (!/^https:\/\//.test(proxyUrl) ||
    new URL(proxyUrl).username ||
    new URL(proxyUrl).password)
)
  throw new Error("API proxy requires a public HTTPS origin");
if (process.env.CAPACITOR_BUILD === "1" && publicApiUrl?.startsWith("/"))
  throw new Error("Capacitor requires an absolute API URL");
if (publicApiUrl === "/api" && !proxyUrl)
  throw new Error("Relative API URL requires COMMERCE_API_PROXY_URL");
const config: NextConfig = {
  ...(proxyUrl && process.env.CAPACITOR_BUILD !== "1"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: proxyUrl!.replace(/\/$/, "") + "/:path*",
            },
          ];
        },
      }
    : {}),
  env: { NEXT_PUBLIC_API_URL: publicApiUrl || "http://localhost:4000" },
  transpilePackages: ["@paymoon/ui"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
