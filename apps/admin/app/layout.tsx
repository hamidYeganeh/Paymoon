import type { ReactNode } from "react";
import { Shell } from "@paymoon/ui";
import "./globals.css";
export const metadata = {
  title: "Paymoon | مدیریت",
  description: "Social commerce foundation",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Shell
          title="مدیریت"
          links={[
            { href: "/", label: "نمای کلی" },
            { href: "/merchants", label: "فروشندگان" },
            { href: "/operations", label: "عملیات" },
          ]}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
