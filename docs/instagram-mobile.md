# Instagram و اپ‌های Android

## وضعیت فعلی

اتصال رسمی Instagram API with Instagram Login در backend پیاده‌سازی شده است: شروع OAuth، callback یک‌بارمصرف متصل به مرورگر و session، بررسی دوباره نقش سازمان، ذخیره توکن رمز‌شده با AES-256-GCM، دریافت پروفایل و یک صفحه رسانه، تمدید توکن، اشتراک webhook و قطع اتصال. scope پیش‌فرض فقط `instagram_business_basic` است. پیام و کامنت فقط با scope مربوط می‌توانند subscribe شوند؛ ارسال پیام، انتشار محتوا و تبدیل خودکار پست به محصول پیاده نشده‌اند.

اپ Meta و دامنه هنوز وجود ندارند؛ اتصال زنده آزمایش نشده است. آزمون‌های adapter با پاسخ شبیه‌سازی‌شده اجرا می‌شوند؛ مسیر OAuth، RBAC و رمزنگاری با PostgreSQL واقعی محلی بررسی شده‌اند. API خاموش می‌ماند تا تنظیمات کامل وارد شوند.

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

مسیر verify و ingest وب‌هوک در OpenAPI مشخص است. امضای HMAC روی raw body بررسی و inbox تکراری حذف می‌شود. worker بر اساس account ID متصل، هر entry را به سازمان صحیح اختصاص داده و رویداد outbox می‌سازد. حساب ناشناس به سازمانی نسبت داده نمی‌شود. inbox خام فعلاً برای پردازش نگه داشته می‌شود؛ retention و حذف داده قبل از production ضروری است.

### migration

`0003_instagram_connections.sql` شامل OAuth state، connection، media و deliveries است؛ با `pnpm db:migrate` روی دیتابیس هدف اعمال می‌شود. migrationهای قبلی تغییر نکرده‌اند.

## Android با Capacitor 8

اپ‌های marketplace و seller خروجی static مستقل را داخل APK بسته‌بندی می‌کنند. صفحه‌ها برای بازشدن به دامنه نیاز ندارند. شناسه‌های فعلی `com.paymoon.marketplace` و `com.paymoon.seller` هستند. API راه دور و احراز هویت UI هنوز وصل نشده‌اند؛ این خروجی پوسته قابل نصب است، نه فروشگاه عملیاتی.

پیش‌نیاز: Node مطابق پروژه، JDK 21 و Android SDK 36. مسیر JDK را در `JAVA_HOME` و مسیر SDK را در `ANDROID_HOME` مشخص کنید.

```sh
pnpm install --frozen-lockfile
pnpm android:apk
# یا یک اپ
pnpm exec turbo run android:apk --filter=@paymoon/seller
```

خروجی هر اپ: `apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk`.
برای انتشار، keystore خصوصی، امضای release و versioning لازم است؛ build فعلی debug است. CI ساخت debug و artifact برای هر دو اپ دارد. build افزونه‌های Gradle به‌ازای هر اپ جدا شده تا pnpm shared node_modules موجب race نشود.

ورود Meta در APK هنوز UI ندارد: کوکی OAuth متعلق به مرورگر شروع‌کننده است؛ انتقال کور URL از WebView به مرورگر دیگر صحیح نیست. گام بعد باید ورود سیستم‌مرورگر با یک launch ticket کوتاه‌عمر، callback و Verified App Links و بازگشت امن را همراه دامنه واقعی تکمیل کند. Secret و access token هرگز داخل APK قرار نمی‌گیرند.

## UI/UX

پوسته فارسی و RTL با نوار پایین پنج‌گزینه‌ای، فید آماده دریافت محصولات، میان‌برهای دایره‌ای، پروفایل فروشگاه، آمار خالی، تب محصولات و مسیر onboarding ساخته شده است. اطلاعات ساختگی نمایش داده نمی‌شود. رنگ برند Paymoon حفظ شده؛ قابلیت‌های آماده‌نشده به‌روشنی مشخص‌اند. این مرحله شامل فرم‌های عملیاتی و checkout نیست.

مراجع مشاهده‌شده در Mobbin:

- [فید Instagram](https://mobbin.com/screens/f95624c3-820d-4009-bb0b-59a53f3ba585)
- [پروفایل Instagram](https://mobbin.com/screens/1120c055-cac5-4b38-979b-ad38dc506ea7)

منابع فنی:

- [مجموعه رسمی Meta در Postman](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
- [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)
- [محیط Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Next static export](https://nextjs.org/docs/app/guides/static-exports)
