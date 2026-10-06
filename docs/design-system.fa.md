# دیزاین سیستم Paymoon با مرجع Instagram

اجزای مشترک در `packages/ui/src/social.tsx` و توکن‌ها و stylesheet مشترک در `packages/ui/src/social.css` قرار دارند؛ marketplace و seller یک منبع طراحی دارند.

- زمینه سفید، متن مشکی، متن ثانویه خاکستری و خط جداکننده ظریف.
- دکمه‌های آبی و خاکستری؛ حذف سبز و کارت‌های داشبورد قبلی.
- هدر ۵۴ پیکسل و نوار پایین ۵۲ پیکسل، با safe area اندروید.
- نوار پایین بدون برچسب دیداری، همراه نام قابل خواندن برای screen reader و حالت فعال.
- حلقه‌های گرادیانی و آواتارهای دایره‌ای، پروفایل فشرده، آمار و تب‌های شبکه.
- اجزای مشترک: SocialShell، SocialIcon، ProfileView، StoryStrip و DesignPreview.
- `/preview` در هر دو اپ نمونهٔ مشخصاً آزمایشی فید را نشان می‌دهد؛ پسند و ذخیره در همین صفحه کار می‌کنند و به حساب واقعی متصل نیستند.
- تصویر گلدان نمونه به‌صورت SVG محلی ساخته شده است؛ هیچ محتوای خصوصی یا تصویر استخراج‌شده از Instagram داخل APK قرار ندارد.
- نام Paymoon حفظ شده است. فونت فارسی و راست‌به‌چپ و محتوای commerce اقتباس شده‌اند؛ این پیاده‌سازی کپی پیکسل‌به‌پیکسل همهٔ صفحات Instagram نیست.

مراجع مشاهده‌شده:

- [فید Instagram در Mobbin](https://mobbin.com/screens/818f771e-c4f5-4b2c-aefd-c1ce598b4aed)
- [پروفایل Instagram در Mobbin](https://mobbin.com/screens/1120c055-cac5-4b38-979b-ad38dc506ea7)

اتصال زنده Instagram همچنان نیازمند Instagram App ID/Secret، نسخه API، callback HTTPS و تنظیمات webhook است. اطلاعات محرمانه فقط در env سرور وارد می‌شوند، نه در چت یا APK.
