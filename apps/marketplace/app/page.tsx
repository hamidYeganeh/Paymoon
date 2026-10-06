import { SocialIcon, StoryStrip } from "@paymoon/ui";
export default function Page() {
  return (
    <>
      <StoryStrip />
      <section className="empty-feed">
        <div className="empty-icon">
          <SocialIcon name="camera" />
        </div>
        <h1>به Paymoon خوش آمدید</h1>
        <p>
          اینجا محصولات و فروشگاه‌هایی را می‌بینید که دوست دارید. اولین کشف شما
          از همین‌جا شروع می‌شود.
        </p>
        <a className="button" href="/search">
          کشف فروشگاه‌ها
        </a>
      </section>
      <p className="quiet-note">
        هنوز محصولی منتشر نشده است. خرید فعلاً فعال نیست.
      </p>
      <p className="quiet-note">
        <a href="/preview" className="text-link">
          دیدن نمونهٔ ظاهر فید
        </a>
      </p>
    </>
  );
}
