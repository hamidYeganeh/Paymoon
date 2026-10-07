# آماده‌سازی استقرار Paymoon

وضعیت: پروژهٔ paymoon در workspace کاربر hamidyeganehs-projects موجود است. در 2026-10-07 ورود مرورگر به حساب درست انجام شد؛ PostgreSQL رایگان Neon با نام paymoon-staging-postgres و Blob عمومی paymoon-staging-media ساخته و وصل شدند. Redis رایگان redis-green-brush از قبل متصل بود. دیتابیس جداگانهٔ paymoon_staging با هر ۶ migration و vector 0.8.6 آماده است. تنظیمات برنامه فقط در Preview ذخیره می‌شوند؛ مشخصات deployment و URL بعد از ساخت آنلاین باید تأیید شود. اتصال افزونهٔ Vercel همچنان 403 دارد؛ مدیریت از داشبورد انجام می‌شود. هیچ کلید واقعی در Git یا راهنما نیست.

## معماری آنلاین

سه پروژه Next.js روی Vercel با Root Directory های `apps/marketplace`، `apps/seller` و `apps/admin`. گزینه Include source files outside Root Directory روشن باشد. نصب و build در vercel.json هر اپ تعریف شده است؛ Node 24 و pnpm مطابق packageManager ریشه.

API پروژه جدا با Root Directory `apps/api`، preset NestJS و entrypoint `src/main.ts` است. Vercel اکنون NestJS را به صورت یک Function پشتیبانی می‌کند. فایل vercel.json build وابستگی‌های workspace را هم اجرا می‌کند. اگر ابزار build میزبان decorator metadata را حفظ نکند، مسیر جایگزین کانتینر که خروجی tsc را اجرا می‌کند استفاده شود. اعتبارسنجی عملی این preset هنوز به استقرار آنلاین نیاز دارد.

worker یک پردازش دائمی BullMQ است؛ روی میزبان کانتینری مستقل اجرا شود. Function درخواست‌محور جایگزین worker موجود نیست. PostgreSQL دارای pgvector و Redis دارای اتصال TCP/TLS واقعی لازم است؛ HTTP-only Redis برای BullMQ کافی نیست. سرویس‌ها، backup، region و هزینه را بعداً انتخاب کنید.

## env وب

`NEXT_PUBLIC_API_URL=/api`

`COMMERCE_API_PROXY_URL=https://YOUR-API-HOST`

rewrite سمت سرور Next درخواست `/api/v1/...` را به API می‌فرستد؛ کوکی ورود از مبدأ همان وب‌اپ استفاده می‌شود، حتی وقتی seller و marketplace در زیردامنه‌های جدا vercel.app هستند. proxy باید مبدأ HTTPS واقعی و بدون userinfo باشد. این متغیر در cache hash Turbo ثبت شده است. این روش برای export استاتیک Capacitor فعال نیست.

## env API و worker

- `NODE_ENV=production`
- `COMMERCE_DATABASE_URL`: اتصال PostgreSQL آنلاین، SSL مطابق سرویس‌دهنده؛ افزونه vector باید نصب شود.
- `COMMERCE_REDIS_URL`: Redis TCP یا rediss، worker و API همان Redis؛ eviction روی noeviction، persistence فعال.
- `COMMERCE_API_PUBLIC_URL`: URL عمومی HTTPS API.
- `COMMERCE_CORS_ORIGINS`: مبدأهای دقیق marketplace/seller/admin و `https://localhost,http://localhost` برای Capacitor. Origin ورود وب پس از proxy هم باید در فهرست باشد.
- `COMMERCE_ADMIN_USER_IDS`: UUID مدیرهای پلتفرم؛ owner فروشگاه مدیر پلتفرم نیست.
- `COMMERCE_PAYMENT_MODE=disabled` برای محیط عملیاتی. برای staging از `COMMERCE_ENVIRONMENT=staging` و دیتابیس جدا استفاده کنید؛ اتصال درگاه واقعی هنوز پیاده نشده است.
- `COMMERCE_MEDIA_STORAGE=vercel_blob`، `BLOB_READ_WRITE_TOKEN` و `COMMERCE_MEDIA_PUBLIC_URL=https://YOUR_STORE.public.blob.vercel-storage.com`: تصاویر عمومی کاتالوگ در Blob؛ کلید فقط API و worker. بدون ذخیره‌سازی پایدار، API در Vercel عمداً شروع نمی‌شود.
- `PORT`: اختیاری، روی Vercel توسط میزبان تعیین می‌شود. worker از `COMMERCE_WORKER_PORT` استفاده می‌کند.
- `LOG_LEVEL=info`

بارگذاری مستقیم تصویر حداکثر ۳٬۰۰۰٬۰۰۰ بایت است تا JSON/base64 زیر محدودیت ۴.۵MB Functions بماند. تصاویر واردشده از CDN رسمی Meta در سرور خوانده می‌شوند و می‌توانند تا ۵MB باشند. `local` فقط توسعه است؛ کانتینر عملیاتی هم Blob را استفاده کند مگر volume قابل نوشتن برای رسانه تنظیم شده باشد.

## migration و اجرا

ابتدا در محیط امن دارای env صحیح:

```sh
pnpm install --frozen-lockfile
pnpm build
COMMERCE_DATABASE_URL=YOUR_DATABASE_URL pnpm db:migrate
```

migrations 0001 تا 0006 با قفل تراکنشی و checksum اجرا می‌شوند. 0006 جدول پسندها و پرسش‌ونظر محصول را اضافه می‌کند. به migration قبلاً اجراشده دست نزنید.

برای میزبان کانتینری، `.env.production` را محلی و خارج Git بسازید. `compose.production.yml` سرویس migration یک‌بار، API و worker را از env خارجی اجرا می‌کند:

```sh
docker compose -f compose.production.yml up -d --build
```

اگر API روی Vercel است، فقط migration و worker این compose اجرا شود. reverse proxy/TLS برای API کانتینری توسط میزبان تأمین می‌شود. Dockerfile با کاربر node اجرا می‌شود و .env، خروجی Android و node_modules محلی داخل build context قرار نمی‌گیرند.

## Meta و APK

در Meta Developers از Instagram API with Instagram Login برای حساب Professional مالک فروشگاه استفاده کنید. `INSTAGRAM_APP_ID`، `INSTAGRAM_APP_SECRET`، `INSTAGRAM_API_VERSION`، `INSTAGRAM_REDIRECT_URI=https://YOUR-API-HOST/v1/instagram/oauth/callback`، `INSTAGRAM_VERIFY_TOKEN` و `INSTAGRAM_TOKEN_ENCRYPTION_KEY` در API تنظیم شود. مسیر webhook را از `openapi.json` همین نسخه بردارید؛ endpoint برای verification و delivery باید عمومی باشد و حفاظت امضای Meta فعال بماند. redirect دقیق را در Meta ثبت کنید. `instagram_business_basic` برای خواندن رسانهٔ حساب متصل لازم است؛ دسترسی به همهٔ پست‌ها یا حساب‌های شخصی دیگران وجود ندارد. permissions و App Review را مطابق داشبورد Meta تکمیل کنید. هنوز تماس واقعی با Meta تست نشده است.

برای APK، `NEXT_PUBLIC_API_URL` باید URL کامل HTTPS API باشد؛ `/api` در build بومی رد می‌شود. APKهای توسعهٔ ارائه‌شده هنوز localhost را هدف می‌گیرند و برای سرور آنلاین باید دوباره build شوند.

## تأیید بعد از تنظیم سرویس‌ها

`/health/live`، `/health/ready` و `/openapi.json`؛ سپس ثبت‌نام/ورود از seller و marketplace، ساخت محصول و upload، سفارش و رزرو موجودی، کارکرد worker و expiry/outbox. callback/webhook Meta را با حساب تست Professional بررسی کنید. هیچ اتصال مالی یا تسویهٔ واقعی با این نسخه تأیید نمی‌شود.

منابع: [NestJS در Vercel](https://vercel.com/docs/frameworks/backend/nestjs)، [Functions limits](https://vercel.com/docs/functions/limitations)، [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).

## staging برای تست

فایل `.env.staging.example` قالب بدون کلید واقعی است. `COMMERCE_ENVIRONMENT=staging` در کنار `NODE_ENV=production` به build سرور اجازه می‌دهد پرداخت مصنوعی sandbox را برای تست فعال کند؛ وجه واقعی جابه‌جا نمی‌شود. برای جلوگیری از مخلوط‌شدن تست با دادهٔ عملیاتی، نام دیتابیس sandbox staging باید به `_staging` ختم شود؛ مثلاً `paymoon_staging`. در `COMMERCE_ENVIRONMENT=production` sandbox همچنان رد می‌شود. اگر دیتابیس هنوز نام جدا ندارد، `COMMERCE_PAYMENT_MODE=disabled` را نگه دارید.

از Storage در Vercel، PostgreSQL (مثلاً Neon با vector)، Redis Cloud و یک Blob عمومی را به همان پروژهٔ staging وصل کنید. اتصال Redis باید TCP/TLS و با noeviction باشد. اتصال خودکار بعضی providerها نام `DATABASE_URL`/`POSTGRES_URL` و `REDIS_URL` می‌سازد؛ readConfig اکنون این نام‌ها را به عنوان fallback می‌خواند. متغیرهای `COMMERCE_*` اگر تنظیم شده باشند اولویت دارند. REST URL از Upstash جایگزین Redis TCP نیست. برای Blob، `BLOB_READ_WRITE_TOKEN` توسط اتصال به پروژه اضافه می‌شود؛ نشانی عمومی Store را در `COMMERCE_MEDIA_PUBLIC_URL` بگذارید.

پس از وصل‌کردن سرویس‌ها migrationها در دیتابیس staging اجرا و deployment دوباره ساخته شود. worker همان env و همان سرویس‌های staging را روی میزبان دائمی استفاده می‌کند. Vercel این نسخهٔ worker را به صورت پردازش دائمی اجرا نمی‌کند. شناسهٔ workspace مورد درخواست کاربر `hamidyeganehs-projects` و پروژه `paymoon` است؛ هیچ کلید واقعی در فایل راهنما ثبت نشده است.

## سرویس‌های واقعیِ staging

Neon: `paymoon-staging-postgres`، Free، iad1؛ database `paymoon_staging`، migrationهای 0001 تا 0006 و pgvector 0.8.6 اجرا شده‌اند. URL به‌صورت Secret در Preview است. Blob: `paymoon-staging-media`، Public، iad1، `https://f1lbgobnbp37znrh.public.blob.vercel-storage.com`؛ برای تصویر عمومی محصول، نه اطلاعات خصوصی سفارش. Redis: `redis-green-brush`، Free 30MB، از قبل متصل به پروژه. noeviction و ماندگاری worker هنوز باید در اتصال آنلاین تأیید شوند.

بررسی خودکار مجوز ذخیرهٔ تنظیمات sandbox در محیط Production ورسل را رد کرد؛ به همین دلیل این نسخه در Preview منتشر می‌شود و شاخهٔ اصلی برای انتشار این تغییرها دست نمی‌خورد. اتصال خودکار providerها ممکن است متغیرهای خودِ سرویس را در Production هم ایجاد کرده باشد؛ تغییر تنظیمات برنامه و deployment این عامل به Preview محدود است.
