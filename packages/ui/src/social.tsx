"use client";
import { useState } from "react";
import { SocialIcon } from "./icons";
import { AppLink } from "./motion";
export { SocialIcon } from "./icons";
export { SocialShell } from "./social-shell";
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
          <AppLink
            className="text-link"
            href={seller ? "/products/new" : "/cart"}
          >
            {seller ? "راه‌اندازی فروشگاه" : "کشف محصولات"}
          </AppLink>
        </div>
        <div className="profile-actions">
          <AppLink
            className="button secondary"
            href={seller ? "/settings" : "/search"}
          >
            {seller ? "ویرایش فروشگاه" : "کشف فروشگاه‌ها"}
          </AppLink>
          <AppLink
            className="button secondary"
            href={seller ? "/preview" : "/saved"}
          >
            {seller ? "پیش‌نمایش ظاهر" : "ذخیره‌شده"}
          </AppLink>
        </div>
        {seller && (
          <AppLink className="professional-row" href="/onboarding">
            <strong>داشبورد حرفه‌ای</strong>
            <span>راه‌اندازی و مدیریت فروشگاه</span>
          </AppLink>
        )}
        <div className="highlights">
          <AppLink className="story" href={seller ? "/onboarding" : "/saved"}>
            <span className="highlight-new">
              <SocialIcon name="plus" />
            </span>
            <span>جدید</span>
          </AppLink>
          {seller && (
            <AppLink className="story" href="/inventory">
              <span className="highlight-new">
                <SocialIcon name="bag" />
              </span>
              <span>موجودی</span>
            </AppLink>
          )}
        </div>
      </section>
      <div className="grid-tabs">
        <AppLink
          href={seller ? "/products" : "/saved"}
          className="selected"
          aria-label="شبکه محصولات"
        >
          <SocialIcon name="grid" />
        </AppLink>
        <AppLink href="/orders" aria-label="سفارش‌ها">
          <SocialIcon name="bag" />
        </AppLink>
        <AppLink
          href={seller ? "/settings" : "/search"}
          aria-label="فروشگاه‌ها"
        >
          <SocialIcon name="tag" />
        </AppLink>
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
        <AppLink
          className="text-link"
          href={seller ? "/products/new" : "/cart"}
        >
          {seller ? "افزودن اولین محصول" : "کشف محصولات"}
        </AppLink>
      </section>
    </>
  );
}
export function StoryStrip({ seller = false }: { seller?: boolean }) {
  return (
    <div className="stories">
      <AppLink className="story" href={seller ? "/" : "/profile"}>
        <span className="own-story">
          <SocialIcon name="user" />
          <span className="avatar-add">+</span>
        </span>
        <span>حساب شما</span>
      </AppLink>
      {[
        ["پوشاک", "grid"],
        ["خانه", "home"],
        ["اکسسوری", "bag"],
        ["کشف بیشتر", "search"],
      ].map(([label, icon]) => (
        <AppLink
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
        </AppLink>
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
        <div className="post-art">
          <img src="/assets/mug.png" alt="ماگ سرامیکی نمونهٔ طراحی" />
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
          <AppLink
            className="icon-link"
            href={seller ? "/products" : "/search"}
            aria-label="کشف محصولات"
          >
            <SocialIcon name="search" />
          </AppLink>
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
            <b dir="ltr">paymoon.studio</b> جزئیات ساده، حس خوبِ خانه. عکس
            نمونهٔ طراحی.
          </p>
          <span className="muted">
            این نمونه قابل خرید نیست؛ پسند و ذخیره فقط در همین صفحه آزمایشی‌اند.
          </span>
        </div>
      </article>
      <div className="preview-grid" aria-label="شبکهٔ تصاویر نمونه">
        {["jacket", "sneaker", "mug", "mug", "jacket", "sneaker"].map(
          (asset, i) => (
            <AppLink key={i} href={seller ? "/products/" : "/search/"}>
              <img
                src={`/assets/${asset}.png`}
                alt="تصویر نمونهٔ طراحی، قابل خرید نیست"
                loading="lazy"
              />
            </AppLink>
          ),
        )}
      </div>
    </>
  );
}
