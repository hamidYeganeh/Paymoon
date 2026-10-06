import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.paymoon.seller",
  appName: "Paymoon Seller",
  webDir: "out",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
