# آزمایش محدود BoxAPI

این ابزار مستقل از اتصال Meta و دیتابیس Paymoon است. فقط برای بررسی دریافت یک پست و دایرکت روی پیج آزمایشی استفاده شود؛ محصولی ایجاد نمی‌کند و پاسخ خودکار ارسال نمی‌کند.

## دامنهٔ موجود Vercel

در بررسی ۱۰ اکتبر ۲۰۲۶، حساب Vercel به نام `hamidyeganeh` تأیید شد و دامنهٔ `paymoon.vercel.app` برای پروژهٔ API معتبر بود. گیرندهٔ API در استقرار `dpl_9ogFL8QWJD3rKKS8FzGunAM8MXYq` با وضعیت READY منتشر شد. درخواست عمومی `GET /health/ready` پاسخ `200` و `{"status":"ok"}` داد. `POST /boxapi/webhook` و `GET /boxapi/test-status` تا تنظیم متغیرهای تست پاسخ `503` با پیام `BoxAPI test disabled` می‌دهند.

فرم BoxAPI با دامنهٔ `https://paymoon.vercel.app`، وبهوک `https://paymoon.vercel.app/boxapi/webhook` و بازگشت به پنل خود BoxAPI فعال شد. پنل ۷ روز تست و ظرفیت یک پیج نشان داد؛ در زمان فعال‌سازی هیچ پیجی متصل نبود. تست واقعی پست و دایرکت هنوز تأیید نشده است.

با تأیید کاربر، Webhook Secret ساخته شد و متغیرهای سروری سرویس در Vercel ذخیره شدند. یک نسخهٔ محلی فقط برای تست در `.local/boxapi-test.env` با مجوز `600` قرار دارد و توسط Git نادیده گرفته می‌شود. درخواست واقعی `GET /service/accounts` به سرویس BoxAPI پاسخ `200` و آرایهٔ خالی داد؛ اعتبار کلید سرویس تأیید شد. کاربر نام `startease.agency` را برای آزمایش انتخاب کرد و استفاده از همان حساب واردشده با نام کاربری `hamidrezayeganeh82` را تأیید کرد. پس از مسیر حساب حرفه‌ای و OAuth، درخواست `GET /service/accounts` پاسخ `200` و یک پیج با همین نام کاربری و UUID واقعی داد. UUID در متغیر سروری Vercel ذخیره شد و استقرار `dpl_9h5VY6VvtqKt2bT57XEMxAXYLAxL` برای اعمال آن آغاز شد. استقرار جدید READY شد. `GET /health/ready` پاسخ 200، وضعیت تست با توکن پاسخ 200 و درخواست وبهوک بدون امضا پاسخ 401 داد. درخواست واقعی `list_posts` پاسخ 202 گرفت؛ سپس رویداد امضاشدهٔ `action.list_posts` در Vercel با `action_success: true` دریافت شد. پنل BoxAPI نیز نتیجهٔ موفق با `data: []` و `error: null` نشان داد؛ فهرست پست‌ها خالی بود. دریافت و پاسخ دایرکت هنوز آزمایش نشده؛ منتظر پیام «تست Paymoon» از حساب دوم هستیم.

گیرندهٔ منتشرشده به این چهار متغیر سروری نیاز دارد: `BOXAPI_WEBHOOK_SECRET`، `BOXAPI_TEST_ACCOUNT_ID` (UUID پیج BoxAPI)، `BOXAPI_TEST_STATUS_TOKEN` (تصادفی، حداقل ۳۲ نویسه)، `BOXAPI_TEST_EXPIRES_AT` (ISO UTC). پس از تغییر env باید دوباره منتشر شود. این گیرنده مستقل از مسیر Meta است؛ فقط رویدادهای همان پیج با HMAC و زمان معتبر را می‌پذیرد. حداکثر ۲۰ خلاصهٔ رویداد بدون متن پیام و اطلاعات شخصی به مدت یک ساعت در Redis نگه می‌دارد. برای مشاهدهٔ خلاصه‌ها، مسیر `/boxapi/test-status` به `Authorization: Bearer <BOXAPI_TEST_STATUS_TOKEN>` نیاز دارد. با پایان مهلت، مسیر دوباره غیرفعال می‌شود.

## آماده‌سازی

1. در پنل BoxAPI سرویس رسمی اینستاگرام را فعال و پیج آزمایشی را از مسیر ورود رسمی متصل کنید. هنگام اعطای دسترسی، مجوزها را بررسی کنید.
2. Base URL اختصاصی سرویس، API Key، UUID پیج متصل و Webhook Secret را از پنل دریافت کنید. کلیدها را در فایل نادیده‌گرفته‌شدهٔ `.env.local` نگه دارید؛ آن‌ها را در چت یا مخزن قرار ندهید.
3. متغیرهای زیر را به همان فایل اضافه کنید (Base URL را از پنل بردارید؛ دامنهٔ صفحهٔ داشبورد جای آن نیست):

```dotenv
BOXAPI_BASE_URL=https://YOUR_SERVICE_HOST
BOXAPI_API_KEY=
BOXAPI_TEST_ACCOUNT_ID=
BOXAPI_WEBHOOK_SECRET=
```

4. گیرنده را اجرا کنید:

```sh
node --env-file=.env.local tooling/scripts/boxapi-test.mjs listen
```

آدرس محلی `http://127.0.0.1:4199/boxapi/webhook` باید از طریق دامنهٔ HTTPS تست و reverse proxy قابل دسترسی شود. آدرس نهایی را در پنل ثبت کنید و Webhook Secret را فعال کنید. بدون دامنهٔ تست، آزمایش زنده آماده نیست. ابزار فقط POST امضاشده و رویدادهای همان پیج را می‌پذیرد و متن پیام یا اطلاعات خصوصی را چاپ نمی‌کند.

## تست زنده

```sh
node --env-file=.env.local tooling/scripts/boxapi-test.mjs posts
```

دریافت HTTP موفق فقط پذیرش درخواست است. نتیجهٔ پست به صورت رویداد `action.list_posts` از وبهوک می‌آید؛ موفقیت نهایی و محتوای پست را در لاگ سرویس BoxAPI بررسی کنید.

از یک حساب آزمایشی به پیج تست پیام بدهید؛ گیرنده باید رویداد `messaging` را نمایش دهد. برای پاسخ ثابت آزمایشی، شناسهٔ فرستنده را از `data.messaging[].sender.id` در لاگ پنل بردارید و فقط برای همان حساب تست تنظیم کنید:

```dotenv
BOXAPI_TEST_RECIPIENT_ID=
BOXAPI_SEND_TEST_REPLY=true
```

```sh
node --env-file=.env.local tooling/scripts/boxapi-test.mjs reply
```

تحویل پیام را در حساب گیرنده بررسی کنید. گیرنده رویدادها را در حافظه تا ده دقیقه تکرارزدایی می‌کند؛ با راه‌اندازی مجدد این حافظه پاک می‌شود. این ابزار اتصال کامل محصول یا صف پایدار نیست.

## بررسی محلی

```sh
node --test tooling/scripts/boxapi-test.test.mjs
```

منابع: [احراز هویت](https://boxapi.ir/docs/instagram/dm/authentication/)، [وبهوک](https://boxapi.ir/docs/instagram/dm/webhook/)، [پست‌ها](https://boxapi.ir/docs/instagram/dm/user-posts/)، [ارسال پیام](https://boxapi.ir/docs/instagram/dm/send-message/).
