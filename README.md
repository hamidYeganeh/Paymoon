# Paymoon — Social Commerce

مونوریپوی pnpm + Turborepo برای بازار، فروشنده و مدیریت؛ با API مستقل NestJS و خروجی Android برای marketplace و seller. Node 24 تا 26 و pnpm مطابق `packageManager`.

جریان اصلی محصول اکنون به API متصل است: ورود، راه‌اندازی فروشگاه، محصول و مدل، موجودی، سبد و سفارش، پیگیری و پشتیبانی. اتصال رسمی Instagram برای دریافت پست‌های حساب حرفه‌ای مجاز و تبدیل آن‌ها به پیش‌نویس آماده است؛ اتصال زنده بدون تنظیم اپ Meta و دامنهٔ HTTPS آزمایش نشده است.

[گزارش کامل فارسی، امکانات، envها، migrationها و محدودیت‌ها](docs/product-release.fa.md) مرجع نسخهٔ فعلی است. تصمیم‌های معماری در `docs/adr/` و طرح رویدادهای محصول در `.telemetry/` قرار دارند.

## ساختار

- `apps/marketplace`: Next.js، پورت 4100؛ فید، جست‌وجو، محصول، فروشگاه، ذخیره‌ها، سبد، نشانی، سفارش و حساب.
- `apps/seller`: Next.js، پورت 4101؛ داشبورد، onboarding، محصولات، انبار، سفارش، Instagram، تیم، دفتر مالی و تنظیمات.
- `apps/admin`: Next.js، پورت 4102؛ تأیید فروشگاه، سفارش، پشتیبانی، عملیات و گزارش رویدادها.
- `apps/api`: NestJS + Fastify، پورت 4000؛ Modular Monolith با دامنه‌های identity، organizations، merchants، catalog، inventory، orders، payments، ledger، instagram و notifications.
- `apps/worker`: BullMQ؛ outbox/inbox، اعلان‌ها، انقضای رزرو سفارش و نگهداری رویدادها؛ health روی 4001.
- `apps/ai-service`: scaffold اختیاری؛ سرویس AI فعال نیست.
- `packages/{ui,db,auth,contracts,config,logger,events,validation,money,observability,testing}`: کد مشترک.
- `packages/{typescript-config,eslint-config}`: تنظیمات مشترک؛ Prettier در ریشه.

## اجرای محلی

```sh
pnpm install --frozen-lockfile
# فقط اگر .env ندارید:
cp .env.example .env
pnpm infra:up
pnpm build
pnpm db:migrate
pnpm dev
```

API و worker خروجی buildشده را در حالت watch اجرا می‌کنند. پس از تغییر TypeScript آن‌ها، در ترمینال جدا `pnpm exec turbo run build --filter=@paymoon/commerce-api --filter=@paymoon/worker` اجرا کنید. Next.js تغییرات frontend را مستقیم دنبال می‌کند.

Swagger: `http://localhost:4000/docs`؛ OpenAPI: `http://localhost:4000/openapi.json`؛ liveness: `/health/live` و readiness: `/health/ready`.

## بررسی‌ها

```sh
pnpm lint
pnpm typecheck
pnpm build
# پس از فراهم‌کردن و migrate کردن دیتابیس جداگانهٔ تست:
COMMERCE_DATABASE_TEST_URL='postgresql://.../paymoon_test' \
COMMERCE_REDIS_TEST_URL='redis://localhost:56379/1' pnpm test
```

دیتابیس تست باید نام منتهی به `_test` داشته باشد. تست‌های یکپارچه بدون envهای تست skip می‌شوند؛ CI دیتابیس و Redis جداگانه فراهم می‌کند. دادهٔ آزمایشی برای بررسی باقی می‌ماند.

## پایداری و دسترسی

- PostgreSQL 17 + pgvector و Drizzle؛ migrationهای SQL با checksum و advisory lock اجرا می‌شوند. migration اعمال‌شده را ویرایش نکنید؛ startup دیتابیس را reset یا migrate نمی‌کند.
- وب: نشست HttpOnly، کنترل Origin و هدر درخواست برای تغییرات. Android: Bearer token در Secure Storage بومی. نقش سازمان جای دسترسی مدیر پلتفرم را نمی‌گیرد؛ مدیر با `COMMERCE_ADMIN_USER_IDS` تعیین می‌شود.
- مبلغ صحیح IRR در سرور و رشته در API؛ نمایش تومان در UI. قیمت و هزینهٔ ارسال checkout در سرور محاسبه می‌شوند.
- Idempotency، قفل سطری، رزرو زمان‌دار، حرکت موجودی و outbox تراکنشی. ارسال صف at-least-once است و مصرف تکرارناپذیر انجام می‌شود.
- دفتر کل دوبل با trigger جمع بدهکار/بستانکار و اسناد غیرقابل ویرایش. پرداخت واقعی فعال نیست؛ sandbox فقط با تنظیم صریح در محیط توسعه/تست فعال می‌شود.
- rate limit Redis، گزارش ساختاریافته، request-id و traceparent؛ exporter کامل OpenTelemetry هنوز ندارد.
- تصاویر در پوشهٔ پایدار `COMMERCE_MEDIA_DIR` ذخیره می‌شوند. توکن Meta سروری و رمزنگاری‌شده است؛ هیچ secret نباید پیشوند `NEXT_PUBLIC_` داشته باشد.

## Android و Meta

```sh
JAVA_HOME=/path/to/jdk-21 ANDROID_HOME=/path/to/android-sdk pnpm android:apk
```

APK آزمایشی در `apps/<app>/android/app/build/outputs/apk/debug/` است. API پیش‌فرض localhost روی گوشی به رایانه وصل نمی‌شود؛ بعد از تنظیم API عمومی HTTPS و `NEXT_PUBLIC_API_URL`، APK را دوباره بسازید. خروجی انتشار نیازمند کلید امضای انتشار است.

برای Instagram، envهای App ID/Secret، redirect، نسخهٔ API، scopeها، کلید رمزنگاری و verify token را طبق [گزارش نسخه](docs/product-release.fa.md) و `.env.example` تنظیم کنید. import فقط برای محتوای حساب حرفه‌ای متصل و مجاز است. webhook کامنت/پیام به مجوزهای مربوط نیاز دارد؛ صندوق کامل پیام و ارسال پاسخ هنوز پیاده نشده‌اند.

قدم بعدی: اجرای HTTPS و تست حساب حرفه‌ای واقعی، سپس اتصال و تست درگاه واقعی. حفاظت مالی، تسویه، بازپرداخت، OTP/بازیابی رمز و زیرساخت انتشار عمومی در محدودهٔ نسخهٔ فعلی کامل نشده‌اند.
