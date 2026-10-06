import { MobileLifecycle } from "./mobile-lifecycle";
import type { ReactNode } from "react";
import { SocialLayout } from "./social-layout";
import "./globals.css";
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};
export const metadata = {
  title: "Paymoon | بازار",
  description: "Social commerce foundation",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <MobileLifecycle />
        <SocialLayout>{children}</SocialLayout>
      </body>
    </html>
  );
}
