import { SocialIcon } from "@paymoon/ui";
export default function Page() {
  return (
    <>
      <h1>فروشگاه شما</h1>
      <div className="profile-head">
        <div className="avatar">
          <SocialIcon name="user" />
        </div>
        <div className="stats">
          {["محصول", "سفارش", "مشتری"].map((x) => (
            <div key={x}>
              <strong>—</strong>
              <span>{x}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="profile-bio">
        <strong>داستان فروشگاهت را شروع کن</strong>
        <p>محصولات، موجودی و سفارش‌ها؛ همه در یک جا.</p>
      </div>
      <div className="profile-actions">
        <a href="/onboarding" className="button">
          راه‌اندازی فروشگاه
        </a>
        <a href="/settings" className="button secondary">
          تنظیمات فروشگاه
        </a>
      </div>
      <div className="notice">
        هنوز فروشگاهی متصل نشده است؛ آمار پس از اتصال نمایش داده می‌شود.
      </div>
      <div className="stories">
        <a className="story" href="/products">
          <span className="avatar">
            <SocialIcon name="plus" />
          </span>
          محصولات
        </a>
        <a className="story" href="/inventory">
          <span className="avatar">
            <SocialIcon name="grid" />
          </span>
          موجودی
        </a>
        <a className="story" href="/settings">
          <span className="avatar">
            <SocialIcon name="user" />
          </span>
          اینستاگرام
        </a>
      </div>
      <div className="grid-tabs">
        <a href="/products" aria-label="شبکه محصولات">
          <SocialIcon name="grid" />
        </a>
        <a href="/orders" aria-label="سفارش‌ها">
          <SocialIcon name="bag" />
        </a>
      </div>
      <section className="empty-feed">
        <div className="empty-icon">
          <SocialIcon name="plus" />
        </div>
        <h2>جای اولین محصول شما</h2>
        <p>
          بعد از راه‌اندازی، محصولات فروشگاه در این بخش کنار هم قرار می‌گیرند.
        </p>
        <a href="/onboarding" className="button secondary">
          شروع راه‌اندازی
        </a>
      </section>
    </>
  );
}
