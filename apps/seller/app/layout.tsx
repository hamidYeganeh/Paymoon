import { CommerceProvider, MotionProvider } from "@paymoon/ui";
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
  title: "Paymoon | پنل فروشنده",
  description: "Social commerce foundation",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <CommerceProvider
          apiUrl={process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}
        >
          <MotionProvider seller={true}>
            <MobileLifecycle />
            <SocialLayout>{children}</SocialLayout>
          </MotionProvider>
        </CommerceProvider>
      </body>
    </html>
  );
}
