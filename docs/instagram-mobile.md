# Instagram و اپ‌های Android

## وضعیت فعلی

اتصال رسمی Instagram API with Instagram Login در backend پیاده‌سازی شده است: شروع OAuth، callback یک‌بارمصرف متصل به مرورگر و session، بررسی دوباره نقش سازمان، ذخیره توکن رمز‌شده با AES-256-GCM، دریافت پروفایل و یک صفحه رسانه، تمدید توکن، اشتراک webhook و قطع اتصال. scope پیش‌فرض فقط `instagram_business_basic` است. پیام و کامنت فقط با scope مربوط می‌توانند subscribe شوند؛ ارسال پیام و انتشار محتوا پیاده نشده‌اند. پست تصویری دریافت‌شده می‌تواند به پیش‌نویس محصول تبدیل شود؛ قیمت و موجودی را فروشنده وارد می‌کند.

callback عمومی در https://paymoon.vercel.app آماده است. App ID، Secret و نسخهٔ API هنوز توسط مالک تنظیم نشده‌اند؛ اتصال زنده آزمایش نشده است. آزمون‌های adapter با پاسخ شبیه‌سازی‌شده اجرا می‌شوند؛ مسیر OAuth، RBAC و رمزنگاری با PostgreSQL واقعی محلی بررسی شده‌اند. API خاموش می‌ماند تا تنظیمات کامل وارد شوند.

### تنظیمات server

- `INSTAGRAM_APP_ID`: شناسه Instagram App در Meta Developers.
- `INSTAGRAM_APP_SECRET`: secret همان اپ؛ فقط در env سرور.
- `INSTAGRAM_API_VERSION`: نسخه پشتیبانی‌شده انتخاب‌شده در داشبورد Meta، با قالب `vNN.0`؛ پیش‌فرض ندارد.
- `INSTAGRAM_REDIRECT_URI`: آدرس HTTPS دقیق `/v1/instagram/oauth/callback`؛ باید عیناً در Meta ثبت شود.
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: ۳۲ بایت تصادفی به شکل ۶۴ کاراکتر hex؛ برای نمونه با `openssl rand -hex 32`. تغییر آن بدون migration توکن‌ها باعث نیاز به اتصال مجدد می‌شود.
- `INSTAGRAM_VERIFY_TOKEN`: مقدار تصادفی مشترک بین تنظیمات webhook Meta و سرور.
- `INSTAGRAM_SCOPES`: پیش‌فرض `instagram_business_basic`. فقط در صورت نیاز و تایید Meta، `instagram_business_manage_comments` و `instagram_business_manage_messages` اضافه شوند.

این API برای حساب‌های Professional (Business/Creator) است. ثبت اپ Meta از پروژه Android و شناسه بسته Capacitor مستقل است. قبل از عرضه عمومی: ثبت اپ، HTTPS عمومی، تست با حساب مجاز، App Review/دسترسی لازم، سیاست حریم خصوصی، حذف داده و deauthorization و سیاست نگهداری inbox باید تکمیل شوند. دامنه شخصی برای ساخت APK لازم نیست؛ برای اتصال واقعی callback HTTPS در دسترس Meta لازم است.

### مسیرها

همه مسیرهای سازمان نیازمند session و RBAC هستند:

- `POST /v1/organizations/:org/instagram/authorize`: برگرداندن URL ورود و تنظیم کوکی امن. کلاینت وب باید درخواست را با credentials در همان مرورگری که OAuth را باز می‌کند اجرا کند.
- `GET /v1/instagram/oauth/callback`: مصرف state، exchange کد و ثبت حساب؛ پاسخ JSON بدون توکن.
- `GET /v1/organizations/:org/instagram`: وضعیت بدون اطلاعات محرمانه.
- `POST /v1/organizations/:org/instagram/media/sync`: دریافت یک صفحه، cursor بعدی در پاسخ؛ pagination به انتخاب کلاینت.
- `GET /v1/organizations/:org/instagram/media`: رسانه‌های ذخیره‌شده همان سازمان.
- `POST /v1/organizations/:org/instagram/refresh`: تمدید توکن معتبر پس از حداقل ۲۴ ساعت.
- `POST /v1/organizations/:org/instagram/subscriptions`: اشتراک فیلدهای مجاز webhook.
- `DELETE /v1/organizations/:org/instagram`: لغو دسترسی و حذف اتصال/رسانه‌های محلی.

مسیر verify و ingest وب‌هوک در OpenAPI مشخص است. امضای HMAC روی raw body بررسی و inbox تکراری حذف می‌شود. worker بر اساس account ID متصل، هر entry را به سازمان صحیح اختصاص داده و رویداد outbox می‌سازد. حساب ناشناس به سازمانی نسبت داده نمی‌شود. inbox پردازش‌شده پس از ۳۰ روز در batch نگهداری پاک می‌شود؛ inbox پردازش‌نشده برای retry نگه داشته می‌شود. مسیرهای رسمی حذف داده و deauthorization برای عرضه عمومی هنوز باید تکمیل شوند.

### migration

`0003_instagram_connections.sql` شامل OAuth state، connection، media و deliveries است؛ با `pnpm db:migrate` روی دیتابیس هدف اعمال می‌شود. migrationهای قبلی تغییر نکرده‌اند.

## Android با Capacitor 8

اپ‌های marketplace و seller خروجی static مستقل را داخل APK بسته‌بندی می‌کنند. صفحه‌ها برای بازشدن به دامنه نیاز ندارند. شناسه‌های فعلی `com.paymoon.marketplace` و `com.paymoon.seller` هستند. API راه دور، ورود و گردش کار فروشگاه به UI وصل‌اند. APKهای آنلاین با https://paymoon.vercel.app ساخته شده‌اند؛ نصب روی دستگاه واقعی هنوز تأیید نشده است.

پیش‌نیاز: Node مطابق پروژه، JDK 21 و Android SDK 36. مسیر JDK را در `JAVA_HOME` و مسیر SDK را در `ANDROID_HOME` مشخص کنید.

```sh
pnpm install --frozen-lockfile
pnpm android:apk
# یا یک اپ
pnpm exec turbo run android:apk --filter=@paymoon/seller
```

خروجی هر اپ: `apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk`.
برای انتشار، keystore خصوصی، امضای release و versioning لازم است؛ build فعلی debug است. CI ساخت debug و artifact برای هر دو اپ دارد. build افزونه‌های Gradle به‌ازای هر اپ جدا شده تا pnpm shared node_modules موجب race نشود.

ورود Meta در وب و APK از launch ticket یک‌بارمصرف ۵دقیقه‌ای و مرورگر سیستم روی مبدأ API استفاده می‌کند تا کوکی OAuth در همان مرورگر callback باقی بماند. callback فعلاً از کاربر می‌خواهد به اپ برگردد و صفحه را تازه کند؛ Verified App Links و بازگشت خودکار به اپ هنوز پیاده نشده‌اند. Secret و access token هرگز داخل APK قرار نمی‌گیرند.

## UI/UX

پوسته فارسی و RTL با نوار پایین پنج‌گزینه‌ای، فید آماده دریافت محصولات، میان‌برهای دایره‌ای، پروفایل فروشگاه، آمار خالی، تب محصولات و مسیر onboarding ساخته شده است. اطلاعات ساختگی نمایش داده نمی‌شود. رنگ برند Paymoon حفظ شده؛ قابلیت‌های آماده‌نشده به‌روشنی مشخص‌اند. فرم‌های محصول، موجودی، سفارش و checkout به API وصل شده‌اند؛ پرداخت فعلاً sandbox است.

مراجع مشاهده‌شده در Mobbin:

- [فید Instagram](https://mobbin.com/screens/f95624c3-820d-4009-bb0b-59a53f3ba585)
- [پروفایل Instagram](https://mobbin.com/screens/1120c055-cac5-4b38-979b-ad38dc506ea7)

منابع فنی:

- [مجموعه رسمی Meta در Postman](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
- [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)
- [محیط Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Next static export](https://nextjs.org/docs/app/guides/static-exports)

## تنظیم فعلی Vercel

- OAuth redirect: `https://paymoon.vercel.app/v1/instagram/oauth/callback`
- Webhook: `https://paymoon.vercel.app/v1/instagram/webhook`
- وب‌اپ فروشنده: `https://paymoon-seller.vercel.app/instagram`

مالک باید URLها را در Meta ثبت و `INSTAGRAM_APP_ID`، `INSTAGRAM_APP_SECRET` و `INSTAGRAM_API_VERSION` را در env API ذخیره کند؛ سپس API دوباره منتشر شود. کلیدها و access token را در چت یا Git قرار ندهید. Verify token و کلید رمزگذاری از قبل سمت سرور تنظیم شده‌اند. کلید رمزگذاری موجود را بدون مهاجرت توکن‌ها عوض نکنید. واردکردن پست خودتان ابتدا با حساب Professional دارای نقش مناسب در اپ تست می‌شود؛ دسترسی عمومی به بررسی‌های Meta وابسته است.

برای پردازش webhook و اعلان‌ها در Vercel رایگان، `docs/serverless-jobs.md` را ببینید. هیچ cron روزانه‌ای تضمین پردازش در دقیقهٔ دقیق نمی‌دهد.
