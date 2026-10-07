import { CommerceProvider, MotionProvider, RouteView } from "@paymoon/ui";
import type { ReactNode } from "react";
import { Shell } from "@paymoon/ui";
import "./globals.css";
import "@paymoon/ui/design-system.css";
export const metadata = {
  title: "Paymoon | مدیریت",
  description: "Social commerce foundation",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <CommerceProvider
          apiUrl={process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}
        >
          <MotionProvider>
            <Shell
              title="مدیریت"
              links={[
                { href: "/", label: "نمای کلی" },
                { href: "/merchants", label: "فروشندگان" },
                { href: "/operations", label: "عملیات" },
                { href: "/orders", label: "سفارش‌ها" },
                { href: "/support", label: "پشتیبانی" },
                { href: "/analytics", label: "گزارش محصول" },
                { href: "/login", label: "ورود" },
              ]}
            >
              <RouteView>{children}</RouteView>
            </Shell>
          </MotionProvider>
        </CommerceProvider>
      </body>
    </html>
  );
}
