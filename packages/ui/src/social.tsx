"use client";
import { type ReactNode } from "react";
export function SocialIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
    bag: "M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2",
    user: "M4 21a8 8 0 0 1 16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 4v16M4 12h16",
    heart: "M12 21 3 12C-3 4 7-1 12 6 17-1 27 4 21 12Z",
    menu: "M4 6h16M4 12h16M4 18h16",
  };
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
export function SocialShell({
  seller = false,
  children,
  pathname = "/",
}: {
  seller?: boolean;
  children: ReactNode;
  pathname?: string;
}) {
  const path = pathname.replace(/\/$/, "") || "/";
  const links = seller
    ? [
        ["/", "user", "فروشگاه"],
        ["/products", "grid", "محصولات"],
        ["/onboarding", "plus", "شروع"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/settings", "menu", "تنظیمات"],
      ]
    : [
        ["/", "home", "خانه"],
        ["/search", "search", "جست‌وجو"],
        ["/saved", "heart", "ذخیره‌ها"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/profile", "user", "حساب من"],
      ];
  return (
    <div className="social-shell">
      <a className="skip" href="#main">
        رفتن به محتوا
      </a>
      <header className="topbar">
        <a href="/" className="wordmark" dir="ltr">
          paymoon<span>●</span>
        </a>
        <span className="app-label">{seller ? "فروشنده" : "کشف و خرید"}</span>
        <a
          className="icon-link"
          href={seller ? "/settings" : "/saved"}
          aria-label={seller ? "تنظیمات" : "ذخیره‌ها"}
        >
          <SocialIcon name={seller ? "menu" : "heart"} />
        </a>
      </header>
      <nav className="bottom-nav" aria-label="منوی اصلی">
        {links.map(([href, icon, label]) => (
          <a
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            <SocialIcon name={icon!} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <main id="main">{children}</main>
    </div>
  );
}
