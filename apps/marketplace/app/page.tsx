import { SocialIcon } from "@paymoon/ui";
export default function Page() {
  return (
    <>
      <div className="stories">
        {[
          ["سبک شما", "user"],
          ["پوشاک", "grid"],
          ["خانه", "home"],
          ["اکسسوری", "bag"],
        ].map(([label, icon]) => (
          <a className="story" href="/search" key={label}>
            <span className="avatar">
              <SocialIcon name={icon!} />
            </span>
            {label}
          </a>
        ))}
      </div>
      <div className="feed-tabs">
        <strong>برای شما</strong>
        <a href="/search">کشف فروشگاه‌ها</a>
      </div>
      <section className="empty-feed">
        <div className="empty-icon">
          <SocialIcon name="bag" />
        </div>
        <h1>کشف‌های بعدی شما، همین‌جا</h1>
        <p>
          محصولات و فروشگاه‌ها بعد از انتشار در این فید نمایش داده می‌شوند. هنوز
          محصولی منتشر نشده است.
        </p>
        <a href="/search" className="button">
          جست‌وجوی محصولات
        </a>
      </section>
      <div className="notice">
        Paymoon در حال آماده‌سازی است. خرید و پرداخت هنوز فعال نیست.
      </div>
    </>
  );
}
