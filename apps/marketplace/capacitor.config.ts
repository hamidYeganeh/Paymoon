import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.paymoon.marketplace",
  appName: "Paymoon Marketplace",
  webDir: "out",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
