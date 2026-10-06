# Paymoon — Social Commerce Foundation

مونوریپوی pnpm + Turborepo برای بازار، پنل فروشنده و مدیریت. Node 24 تا 26؛ pnpm مطابق `packageManager`.

## ساختار

- `apps/marketplace`: Next.js، پورت 4100؛ صفحه اصلی و مسیر جست‌وجو.
- `apps/seller`: Next.js، پورت 4101؛ داشبورد، onboarding، محصولات، موجودی، سفارش‌ها و تنظیمات.
- `apps/admin`: Next.js، پورت 4102؛ پوسته مدیریت، فروشندگان و عملیات.
- `apps/api`: NestJS + Fastify، پورت 4000؛ Modular Monolith با ده دامنه مستقل.
- `apps/worker`: BullMQ، انتشار outbox و مصرف رویداد برای اعلان داخلی؛ health روی 4001.
- `apps/ai-service`: جای خالی اختیاری؛ هیچ سرویس AI اجرا نمی‌شود.
- `packages/{ui,db,auth,contracts,config,logger,events,validation,money,observability,testing}`: زیرساخت مشترک.
- `packages/{typescript-config,eslint-config}`: تنظیمات مشترک حفظ‌شده؛ Prettier در ریشه.

## اجرای محلی

```sh
pnpm install
cp .env.example .env
pnpm infra:up
pnpm build
pnpm db:migrate
pnpm dev
```

API و worker کد buildشده را در حالت watch اجرا می‌کنند؛ پس از تغییر TypeScript در ترمینال جدا `pnpm exec turbo run build --filter=@paymoon/commerce-api --filter=@paymoon/worker` اجرا کنید. Next.js تغییرات را مستقیم دنبال می‌کند.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

مستندات API: `http://localhost:4000/docs` و OpenAPI: `http://localhost:4000/openapi.json`.
Liveness: `/health/live`؛ readiness: `/health/ready` (PostgreSQL + Redis + وجود migration).

## تنظیمات محیط

`.env.example` مرجع است. `COMMERCE_DATABASE_URL` و `COMMERCE_REDIS_URL` ضروری‌اند. پورت API و worker، مبدأهای مجاز CORS و `LOG_LEVEL` قابل تنظیم‌اند. هیچ راز سروری نباید پیشوند `NEXT_PUBLIC_` داشته باشد. مقدارهای Compose صرفاً محلی‌اند.

`INSTAGRAM_APP_SECRET` و `INSTAGRAM_VERIFY_TOKEN` اختیاری‌اند؛ بدون آن‌ها webhook با 503 غیرفعال است. امضای HMAC روی raw body بررسی می‌شود. پیام در inbox با hash یکتا ثبت می‌شود؛ OAuth، import و پردازش واقعی Meta هنوز پیاده‌سازی نشده‌اند.

## دیتابیس و migration

PostgreSQL 17 با pgvector؛ schema مستقل `commerce`. فایل `packages/db/migrations/0001_commerce.sql` migration اولیه و `0002_journal_trigger.sql` اصلاح trigger مشترک journal/entry هستند. اجرای migrationها افزایشی و تراکنشی است. migration runner از advisory lock و checksum استفاده می‌کند. دیتابیس موجود حذف یا reset نمی‌شود؛ migration خودکار هنگام startup اجرا نمی‌شود.

Drizzle schema و client در `packages/db` هستند. SQL بازبینی‌شده مرجع migrationهاست؛ triggerهای دفتر کل و constraintهای تکمیلی را هنگام تولید migration بعدی حفظ کنید. `drizzle.config.ts` برای تولید/بازبینی diff آماده است؛ `push` را روی production اجرا نکنید. بردار فعلاً 1536 بعد دارد؛ انتخاب مدل و ایندکس برداری به فاز جست‌وجو موکول شده است.

برای تست یکپارچه، دیتابیس جدا با نام منتهی به `_test` بسازید، migration را با `COMMERCE_DATABASE_URL` آن اجرا کنید، سپس `COMMERCE_DATABASE_TEST_URL` و `COMMERCE_REDIS_TEST_URL` را تنظیم و `pnpm test` اجرا کنید. تست‌ها روی دیتابیس توسعه اجرا نمی‌شوند و داده آزمایشی را برای بررسی نگه می‌دارند. CI این وابستگی‌ها را فراهم می‌کند.

## قابلیت‌های foundation

- ثبت‌نام/ورود ایمیل و رمز با scrypt؛ session تصادفی 24ساعته، فقط hash توکن در دیتابیس؛ خروج و شناسایی کاربر.
- Bearer token در `Authorization`؛ نقش‌های owner/admin/staff/viewer و کنترل سازمان در هر مسیر. هیچ bootstrap عمومی برای platform admin وجود ندارد.
- ساخت سازمان و عضویت owner در یک تراکنش؛ تخصیص و لغو نقش اعضای موجود توسط owner؛ جلوگیری از حذف/تنزل مالک؛ onboarding فروشنده در وضعیت draft؛ تأیید هویت و تأیید فروشنده هنوز محصول عملیاتی نیست.
- محصول، variant، دسته‌بندی و موجودی با ثبت حرکت append-only؛ قفل سطری جلوی overselling همزمان را می‌گیرد.
- مبلغ صحیح IRR؛ مقدار در API رشته است تا precision از دست نرود. تبدیل تومان فقط در لایه نمایشِ آینده انجام شود.
- ماشین حالت سفارش و interface پرداخت؛ هیچ پرداخت واقعی یا خرید کامل فعلاً ارائه نمی‌شود.
- journal دوطرفه با کنترل جمع بدهکار/بستانکار در application و deferred trigger دیتابیس، کنترل tenant و ممنوعیت ویرایش/حذف سند.
- عملیات نوشتنی سازمان/فروشنده/محصول/موجودی نیازمند `Idempotency-Key` هستند. کلید 8 تا 128 کاراکتر، scope شامل actor و عملیات؛ استفاده با body متفاوت 409. نتیجه در همان تراکنش ذخیره می‌شود. retention فعلاً دائمی است.
- outbox در تراکنش کسب‌وکار؛ انتشار با `SKIP LOCKED` و jobId ثابت، مصرف با قفل و `processed_at` در PostgreSQL. تحویل at-least-once است؛ به exactly-once صف تکیه نکنید. jobهای ناموفق پس از 8 تلاش باقی می‌مانند؛ replay عملیاتی باید اضافه شود.
- logging ساختاریافته، request-id و traceparent؛ این پایهٔ correlation است، exporter کامل OpenTelemetry هنوز ندارد.
- rate limit مشترک روی Redis؛ برای پراکسی production تنها proxyهای معتبر را تنظیم کنید.

## گردش تست دستی API

1. `POST /v1/identity/register` با `email` و `password` (حداقل 12 کاراکتر).
2. توکن پاسخ را در `Authorization: Bearer ...` قرار دهید.
3. `POST /v1/organizations` با `name`, `slug` و `Idempotency-Key`.
4. `POST /v1/organizations/:org/merchant` با `displayName`.
5. `POST /v1/organizations/:org/products` با `title` و `variants: [{sku,priceMinor:"10000"}]`.
6. `POST /v1/organizations/:org/inventory/movements` با `variantId`, `kind: "receive"`, `quantity`؛ سپس reserve/commit/ship.
7. worker اعلان داخلی تولید می‌کند؛ `GET /v1/organizations/:org/notifications`.

فرانت‌اندها فعلاً shell هستند و فرم‌های عملیاتی به API متصل نشده‌اند؛ صفحه‌های admin هیچ داده خصوصی عرضه نمی‌کنند. پیش از اتصال باید session امن مرورگر/BFF و گارد admin پیاده‌سازی شوند.

## قدم بعدی

تکمیل یک برش end-to-end: اتصال ورود و onboarding پنل فروشنده به API، ایجاد محصول، رزرو زمان‌دار موجودی، order items، checkout با provider آزمایشی و callback تأییدشده، سپس ledger و ارسال. دعوت با ایمیل، انتقال مالکیت، بازیابی رمز، تأیید ایمیل و مدیریت sessionها نیز باید پیش از انتشار عمومی کامل شوند.

## Android و اتصال رسمی Instagram

marketplace و seller اکنون پوسته فارسی با الگوهای آشنای Instagram و پروژه Android مبتنی بر Capacitor دارند. `pnpm android:apk` هر دو APK آزمایشی را می‌سازد. راهنمای env، ثبت Meta app، endpointها، migration سوم، محدودیت‌های اتصال زنده و مراحل ساخت در [راهنمای Instagram و Android](docs/instagram-mobile.md) آمده است. فرم‌های frontend هنوز به API متصل نشده‌اند.
