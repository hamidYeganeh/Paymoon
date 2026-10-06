"use client";
import { useState, type ReactNode } from "react";
export function SocialIcon({
  name,
  filled = false,
}: {
  name: string;
  filled?: boolean;
}) {
  const paths: Record<string, string> = {
    home: "m3 10 9-8 9 8v11h-6v-7H9v7H3Z",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    grid: "M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18",
    bag: "M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2",
    user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 4v16M4 12h16",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    menu: "M3 5h18M3 12h18M3 19h18",
    send: "m22 2-8 20-4-9-8-4ZM10 13 22 2",
    bookmark: "M5 3h14v19l-7-5-7 5Z",
    comment: "M21 11.5a9.5 9.5 0 1 0-4 7.8l5 2-1.8-5a9.5 9.5 0 0 0 .8-4.8Z",
    camera: "M3 6h4l2-3h6l2 3h4v15H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    reels: "M3 8h18M3 3h18v18H3ZM7 3l4 5M14 3l4 5M10 12l5 3-5 3Z",
    chevron: "m9 5 7 7-7 7",
    down: "m7 10 5 5 5-5",
    tag: "M3 5h7l11 11-5 5L3 8ZM7 8h.01",
    more: "M4 12h.01M12 12h.01M20 12h.01",
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
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
        ["/saved", "bookmark", "ذخیره‌ها"],
        ["/orders", "bag", "سفارش‌ها"],
        ["/profile", "user", "حساب من"],
      ];
  const titles: Record<string, string> = {
    "/search": "جست‌وجو",
    "/saved": "ذخیره‌شده",
    "/orders": "سفارش‌ها",
    "/profile": "حساب من",
    "/products": "محصولات",
    "/inventory": "موجودی",
    "/settings": "تنظیمات و فعالیت",
    "/onboarding": "راه‌اندازی فروشگاه",
    "/preview": "پیش‌نمایش طراحی",
  };
  return (
    <div className="social-shell">
      <a className="skip" href="#main">
        رفتن به محتوا
      </a>
      <header className="topbar">
        {path === "/" ? (
          <>
            <a
              className="icon-link"
              href={seller ? "/onboarding" : "/search"}
              aria-label={seller ? "ایجاد فروشگاه" : "کشف محصولات"}
            >
              <SocialIcon name="plus" />
            </a>
            <a
              className={seller ? "account-title" : "wordmark"}
              href="/"
              dir="ltr"
            >
              {seller ? "your_store" : "Paymoon"}
              <SocialIcon name="down" />
            </a>
            <a
              className="icon-link"
              href={seller ? "/settings" : "/saved"}
              aria-label={seller ? "تنظیمات" : "ذخیره‌ها"}
            >
              <SocialIcon name={seller ? "menu" : "heart"} />
            </a>
          </>
        ) : (
          <>
            <a className="icon-link" href="/" aria-label="بازگشت به خانه">
              <SocialIcon name="chevron" />
            </a>
            <strong className="page-title">{titles[path] ?? "Paymoon"}</strong>
          </>
        )}
      </header>
      <nav className="bottom-nav" aria-label="منوی اصلی">
        {links.map(([href, icon, label]) => (
          <a
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={path === href ? "page" : undefined}
          >
            <span className={icon === "user" ? "nav-avatar" : ""}>
              <SocialIcon
                name={icon!}
                filled={path === href && icon === "home"}
              />
            </span>
            <span className="sr-only">{label}</span>
          </a>
        ))}
      </nav>
      <main
        id="main"
        className={
          path === "/" || path === "/preview" ? "edge-content" : "page-content"
        }
      >
        {children}
      </main>
    </div>
  );
}
export function ProfileView({ seller = false }: { seller?: boolean }) {
  return (
    <>
      <section className="profile-body">
        <div className="profile-head">
          <div className="profile-avatar">
            <SocialIcon name="user" />
            <span className="avatar-add">+</span>
          </div>
          <div className="profile-info">
            <strong>{seller ? "فروشگاه شما" : "حساب شما"}</strong>
            <div className="stats">
              {[
                seller ? "محصول" : "ذخیره",
                "سفارش",
                seller ? "مشتری" : "فروشگاه",
              ].map((label) => (
                <div key={label}>
                  <strong>۰</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="profile-bio">
          <strong>
            {seller ? "ویترین شما در Paymoon" : "کشف کن. ذخیره کن. خرید کن."}
          </strong>
          <p>
            {seller
              ? "به فروشگاه شما خوش آمدید"
              : "محصولات و فروشگاه‌های مورد علاقهٔ شما"}
          </p>
          <a className="text-link" href={seller ? "/onboarding" : "/search"}>
            {seller ? "راه‌اندازی فروشگاه" : "کشف محصولات"}
          </a>
        </div>
        <div className="profile-actions">
          <a
            className="button secondary"
            href={seller ? "/settings" : "/search"}
          >
            {seller ? "ویرایش فروشگاه" : "کشف فروشگاه‌ها"}
          </a>
          <a className="button secondary" href={seller ? "/preview" : "/saved"}>
            {seller ? "پیش‌نمایش ظاهر" : "ذخیره‌شده"}
          </a>
        </div>
        {seller && (
          <a className="professional-row" href="/onboarding">
            <strong>داشبورد حرفه‌ای</strong>
            <span>راه‌اندازی و مدیریت فروشگاه</span>
          </a>
        )}
        <div className="highlights">
          <a className="story" href={seller ? "/onboarding" : "/saved"}>
            <span className="highlight-new">
              <SocialIcon name="plus" />
            </span>
            <span>جدید</span>
          </a>
          {seller && (
            <a className="story" href="/inventory">
              <span className="highlight-new">
                <SocialIcon name="bag" />
              </span>
              <span>موجودی</span>
            </a>
          )}
        </div>
      </section>
      <div className="grid-tabs">
        <a
          href={seller ? "/products" : "/saved"}
          className="selected"
          aria-label="شبکه محصولات"
        >
          <SocialIcon name="grid" />
        </a>
        <a href="/orders" aria-label="سفارش‌ها">
          <SocialIcon name="bag" />
        </a>
        <a href={seller ? "/settings" : "/search"} aria-label="فروشگاه‌ها">
          <SocialIcon name="tag" />
        </a>
      </div>
      <section className="empty-feed">
        <div className="empty-icon">
          <SocialIcon name="camera" />
        </div>
        <h1>
          {seller ? "اولین محصولت را به اشتراک بگذار" : "هنوز چیزی اینجا نیست"}
        </h1>
        <p>
          {seller
            ? "وقتی محصولاتت را اضافه کنی، در ویترین نمایش داده می‌شوند."
            : "محصولات ذخیره‌شدهٔ شما اینجا نمایش داده می‌شوند."}
        </p>
        <a className="text-link" href={seller ? "/onboarding" : "/search"}>
          {seller ? "افزودن اولین محصول" : "کشف محصولات"}
        </a>
      </section>
    </>
  );
}
export function StoryStrip({ seller = false }: { seller?: boolean }) {
  return (
    <div className="stories">
      <a className="story" href={seller ? "/" : "/profile"}>
        <span className="own-story">
          <SocialIcon name="user" />
          <span className="avatar-add">+</span>
        </span>
        <span>حساب شما</span>
      </a>
      {[
        ["پوشاک", "grid"],
        ["خانه", "home"],
        ["اکسسوری", "bag"],
        ["کشف بیشتر", "search"],
      ].map(([label, icon]) => (
        <a
          className="story"
          href={seller ? "/products" : "/search"}
          key={label}
        >
          <span className="story-ring">
            <span>
              <SocialIcon name={icon!} />
            </span>
          </span>
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}
export function DesignPreview({ seller = false }: { seller?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="demo-label">
        پیش‌نمایش طراحی · محصول و فروشگاه نمونه هستند
      </div>
      <StoryStrip seller={seller} />
      <article className="feed-post">
        <div className="post-header">
          <div className="small-avatar">P</div>
          <div>
            <strong dir="ltr">paymoon.studio</strong>
            <span>مجموعهٔ نمونه</span>
          </div>
          <span className="post-demo">نمونه</span>
        </div>
        <div
          className="post-art"
          role="img"
          aria-label="تصویر نمونهٔ یک گلدان سفالی"
        >
          <svg viewBox="0 0 400 450" aria-hidden="true">
            <defs>
              <linearGradient id="vase" x1="0" x2="1">
                <stop stopColor="#a96842" />
                <stop offset=".45" stopColor="#dda57d" />
                <stop offset="1" stopColor="#96512f" />
              </linearGradient>
            </defs>
            <path fill="#e8e0d3" d="M0 0h400v450H0z" />
            <path fill="#d2c3af" d="M0 330h400v120H0z" />
            <ellipse cx="213" cy="367" rx="115" ry="18" fill="#b9a68f" />
            <path
              d="M201 230q-35-90 15-170m-10 100q55-25 65-65m-67 80q-60-20-69-60"
              fill="none"
              stroke="#6b7653"
              strokeWidth="4"
            />
            <path
              d="M213 96q-50-32-10-54 25 13 10 54m-14 71q-54-7-58-42 40-10 58 42m20-28q60-8 51-43-44-8-51 43"
              fill="#7b8665"
            />
            <path
              d="M162 212h76v55c0 22 35 30 35 61 0 52-146 52-146 0 0-31 35-39 35-61Z"
              fill="url(#vase)"
            />
            <ellipse cx="200" cy="212" rx="38" ry="7" fill="#814728" />
          </svg>
        </div>
        <div className="post-actions">
          <button
            className={liked ? "icon-link liked" : "icon-link"}
            onClick={() => setLiked(!liked)}
            aria-label="پسندیدن نمونه"
            aria-pressed={liked}
          >
            <SocialIcon name="heart" filled={liked} />
          </button>
          <a
            className="icon-link"
            href={seller ? "/products" : "/search"}
            aria-label="کشف محصولات"
          >
            <SocialIcon name="search" />
          </a>
          <button
            className="icon-link save-action"
            onClick={() => setSaved(!saved)}
            aria-label="ذخیره نمونه"
            aria-pressed={saved}
          >
            <SocialIcon name="bookmark" filled={saved} />
          </button>
        </div>
        <div className="post-caption">
          <strong>
            {liked ? "۱ پسند آزمایشی" : "اولین نفری باش که می‌پسندد"}
          </strong>
          <p>
            <b dir="ltr">paymoon.studio</b> جزئیات ساده، حس خوبِ خانه.
          </p>
          <span className="muted">
            این نمونه قابل خرید نیست؛ پسند و ذخیره فقط در همین صفحه آزمایشی‌اند.
          </span>
        </div>
      </article>
    </>
  );
}
