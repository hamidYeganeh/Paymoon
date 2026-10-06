import Link from "next/link";
export default function Page() {
  return (
    <>
      <h1>راه‌اندازی فروشگاه</h1>
      <p>سه قدم تا آماده‌شدن ویترین شما</p>
      <ol className="checklist">
        <li>
          <strong>حساب و مشخصات فروشگاه</strong>
          <p>نام فروشگاه و اعضای تیم را مشخص کنید.</p>
        </li>
        <li>
          <strong>اتصال اینستاگرام</strong>
          <p>حساب حرفه‌ای خود را از مسیر رسمی اینستاگرام متصل کنید.</p>
        </li>
        <li>
          <strong>اولین محصول</strong>
          <p>عکس، قیمت و موجودی را وارد کنید.</p>
        </li>
      </ol>
      <div className="notice">
        فرم ثبت فروشگاه هنوز فعال نیست. این صفحه مسیر راه‌اندازی را نشان می‌دهد.
      </div>
      <Link href="/" className="button secondary">
        بازگشت به فروشگاه
      </Link>
    </>
  );
}
