"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppLink, BackButton, useAppearance } from "./motion";
import { SocialIcon } from "./icons";
import {
  useCommerce,
  useResource,
  type Merchant,
  type Notice,
} from "./commerce/client";
export function Avatar({
  name = "",
  src,
  size = 40,
  ring = false,
}: {
  name?: string;
  src?: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={"ig-avatar" + (ring ? " has-ring" : "")}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <SocialIcon name="user" size={Math.round(size * 0.7)} />
      )}
    </span>
  );
}
export function ShopSuggestions({ tray = false }: { tray?: boolean }) {
  const shops = useResource<Merchant[]>("/v1/marketplace/merchants");
  if (!shops.data?.length) return null;
  return (
    <div className={tray ? "shops-tray" : "suggested-shops"}>
      {!tray && (
        <div className="aside-heading">
          <strong>فروشگاه‌هایی برای شما</strong>
          <AppLink href="/search">دیدن همه</AppLink>
        </div>
      )}
      {shops.data.slice(0, tray ? 10 : 5).map((shop) => (
        <AppLink
          href={`/shop/?slug=${shop.slug}`}
          key={shop.id}
          className={tray ? "shop-story" : "suggested-shop"}
        >
          <Avatar
            name={shop.display_name}
            src={shop.avatar_url}
            size={tray ? 68 : 38}
            ring={tray}
          />
          <span>
            <strong>{shop.display_name}</strong>
            {!tray && <small>فروشگاه تأییدشده</small>}
          </span>
          {!tray && <span className="text-link">ببین</span>}
        </AppLink>
      ))}
    </div>
  );
}
const titles: Record<string, string> = {
  "/search": "جست‌وجو",
  "/comments": "پرسش و نظر",
  "/saved": "ذخیره‌شده‌ها",
  "/orders": "سفارش‌ها",
  "/profile": "حساب من",
  "/products": "محصولات",
  "/products/new": "محصول جدید",
  "/product": "محصول",
  "/order": "پیگیری سفارش",
  "/inventory": "موجودی",
  "/settings": "تنظیمات و فعالیت",
  "/settings/shop": "ویرایش پروفایل",
  "/onboarding": "راه‌اندازی فروشگاه",
  "/instagram": "اینستاگرام",
  "/notifications": "فعالیت‌ها",
  "/cart": "سبد خرید",
  "/checkout": "ثبت سفارش",
  "/addresses": "نشانی‌ها",
  "/shop": "فروشگاه",
  "/following": "دنبال‌شده‌ها",
  "/support": "پشتیبانی",
  "/team": "همکاران",
  "/ledger": "مالی",
  "/login": "ورود",
  "/register": "ساخت حساب",
  "/privacy": "حریم خصوصی",
  "/terms": "شرایط استفاده",
  "/help": "راهنما",
  "/returns": "مرجوعی و اختلاف",
  "/messages": "پیام‌ها",
};
export function SocialShell({
  seller = false,
  children,
  pathname = "/",
  accountName,
}: {
  seller?: boolean;
  children: ReactNode;
  pathname?: string;
  accountName?: string;
}) {
  const path = pathname.replace(/\/$/, "") || "/",
    c = useCommerce(),
    { theme, setTheme } = useAppearance(),
    [menu, setMenu] = useState(false),
    menuRef = useRef<HTMLDivElement>(null);
  const notices = useResource<Notice[]>(c.user ? "/v1/me/notifications" : null),
    unread = notices.data?.filter((n) => !n.read_at).length || 0;
  const links = seller
    ? [
        ["/", "user", "فروشگاه"],
        ["/products", "grid", "محصولات"],
        ["/products/new", "plus", "ایجاد"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/settings", "menu", "تنظیمات"],
      ]
    : [
        ["/", "home", "خانه"],
        ["/search", "explore", "کاوش"],
        ["/saved", "bookmark", "ذخیره‌ها"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/profile", "user", "پروفایل"],
      ];
  const desktop = seller
    ? [
        ["/", "user", "فروشگاه"],
        ["/products", "grid", "محصولات"],
        ["/inventory", "inventory", "موجودی"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/instagram", "instagram", "اینستاگرام"],
        ["/notifications", "heart", "اعلان‌ها"],
        ["/products/new", "plus", "ایجاد محصول"],
        ["/ledger", "ledger", "دفتر مالی"],
        ["/team", "team", "همکاران"],
      ]
    : [
        ["/", "home", "خانه"],
        ["/search", "search", "جست‌وجو"],
        ["/following", "explore", "دنبال‌شده‌ها"],
        ["/notifications", "heart", "اعلان‌ها"],
        ["/saved", "bookmark", "ذخیره‌ها"],
        ["/cart", "bag", "سبد خرید"],
        ["/orders", "inventory", "سفارش‌ها"],
        ["/profile", "user", "پروفایل"],
      ];
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href + "/"));
  return (
    <div
      className={
        "social-shell " +
        (seller ? "seller-shell" : "marketplace-shell") +
        (path === "/" && !seller ? " feed-shell" : "")
      }
    >
      <a className="skip" href="#main">
        رفتن به محتوا
      </a>
      <aside className="desktop-nav">
        <AppLink className="desktop-wordmark" href="/" aria-label="خانه پی‌مون">
          Paymoon
        </AppLink>
        <nav aria-label="منوی دسکتاپ">
          {desktop.map(([href, icon, label]) => (
            <AppLink
              key={href}
              href={href!}
              scroll={false}
              title={label}
              aria-current={isActive(href!) ? "page" : undefined}
            >
              <SocialIcon
                name={icon!}
                filled={
                  isActive(href!) &&
                  ["home", "heart", "bookmark", "user"].includes(icon!)
                }
              />
              <span>{label}</span>
              {href === "/notifications" && unread > 0 && (
                <span className="notification-dot">{Math.min(unread, 99)}</span>
              )}
              {href === "/cart" && c.cart.length > 0 && (
                <span className="notification-dot">{c.cart.length}</span>
              )}
            </AppLink>
          ))}
        </nav>
        <div className="desktop-nav-footer" ref={menuRef}>
          <button
            aria-expanded={menu}
            aria-controls="account-menu"
            onClick={() => setMenu(!menu)}
          >
            <SocialIcon name="menu" />
            <span>بیشتر</span>
          </button>
          {menu && (
            <div className="account-menu" id="account-menu">
              <AppLink href="/settings">
                <SocialIcon name="menu" />
                تنظیمات و فعالیت
              </AppLink>
              <AppLink href="/support">
                <SocialIcon name="comment" />
                پشتیبانی
              </AppLink>
              <div className="theme-options" aria-label="ظاهر اپ">
                {(["light", "dark", "system"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={theme === value}
                    onClick={() => setTheme(value)}
                    title={
                      { light: "روشن", dark: "تیره", system: "سیستم" }[value]
                    }
                  >
                    <SocialIcon
                      name={
                        { light: "sun", dark: "moon", system: "monitor" }[value]
                      }
                    />
                  </button>
                ))}
              </div>
              {c.user ? (
                <button
                  onClick={() => void c.logout().then(() => setMenu(false))}
                >
                  خروج از حساب
                </button>
              ) : (
                <AppLink href="/login">ورود / ساخت حساب</AppLink>
              )}
            </div>
          )}
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          {path === "/" ? (
            <>
              <AppLink
                className="icon-link"
                href={seller ? "/products/new" : "/cart"}
                aria-label={seller ? "افزودن محصول" : "سبد خرید"}
              >
                <SocialIcon name="plus" />
                {!seller && c.cart.length > 0 && (
                  <span className="mobile-dot" />
                )}
              </AppLink>
              <AppLink
                className={seller ? "account-title" : "wordmark"}
                href={seller ? "/settings" : "/"}
                dir="ltr"
              >
                {seller ? accountName || "فروشگاه" : "Paymoon"}
                {seller && <SocialIcon name="down" />}
              </AppLink>
              <AppLink
                className="icon-link"
                href={seller ? "/settings" : "/notifications"}
                aria-label={seller ? "تنظیمات" : "فعالیت‌ها"}
              >
                <SocialIcon name={seller ? "menu" : "heart"} />
                {!seller && unread > 0 && <span className="mobile-dot" />}
              </AppLink>
            </>
          ) : (
            <>
              <BackButton />
              <strong className="page-title">
                {titles[path] || "Paymoon"}
              </strong>
              {["/product", "/shop"].includes(path) && (
                <AppLink
                  className="icon-link"
                  href="/cart"
                  aria-label="سبد خرید"
                >
                  <SocialIcon name="bag" />
                </AppLink>
              )}
            </>
          )}
        </header>
        <div className="desktop-page-heading">
          <h1>
            {path === "/"
              ? seller
                ? accountName || "فروشگاه شما"
                : "برای شما"
              : titles[path] || "Paymoon"}
          </h1>
          <AppLink
            href={seller ? "/products/new" : "/cart"}
            className="icon-link"
            aria-label={seller ? "محصول جدید" : "سبد خرید"}
          >
            <SocialIcon name={seller ? "plus" : "bag"} />
          </AppLink>
        </div>
        <div className="app-content-layout">
          <main
            id="main"
            className={
              path === "/" || path === "/preview"
                ? "edge-content"
                : "page-content"
            }
          >
            {children}
          </main>
          {path === "/" && !seller && (
            <aside className="desktop-context">
              <div className="signed-in-row">
                <Avatar name={c.user?.email} />
                <span>
                  <strong>
                    {c.user
                      ? c.user.email.split("@")[0]
                      : "به پی‌مون خوش آمدید"}
                  </strong>
                  <small>
                    {c.user ? "حساب شما" : "فروشگاه بعدی‌تان را پیدا کنید"}
                  </small>
                </span>
                <AppLink
                  className="text-link"
                  href={c.user ? "/profile" : "/login"}
                >
                  {c.user ? "پروفایل" : "ورود"}
                </AppLink>
              </div>
              <ShopSuggestions />
              <div className="aside-footnote">
                <AppLink href="/help">راهنما</AppLink> ·{" "}
                <AppLink href="/privacy">حریم خصوصی</AppLink> ·{" "}
                <AppLink href="/terms">شرایط استفاده</AppLink>
                <p>© Paymoon</p>
              </div>
            </aside>
          )}
        </div>
      </div>
      <nav className="bottom-nav" aria-label="منوی اصلی">
        {links.map(([href, icon, label]) => (
          <AppLink
            key={href}
            href={href!}
            scroll={false}
            aria-label={label}
            title={label}
            aria-current={isActive(href!) ? "page" : undefined}
          >
            <SocialIcon
              name={icon!}
              filled={
                isActive(href!) && ["home", "user", "bookmark"].includes(icon!)
              }
            />
            <span className="sr-only">{label}</span>
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
