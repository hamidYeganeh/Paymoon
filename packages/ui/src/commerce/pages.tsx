"use client";
import { CommentsPage } from "./comments";
import { AppLink, useAppearance } from "../motion";
import { SocialIcon } from "../icons";
import {
  useCommerce,
  useResource,
  price,
  status,
  type Merchant,
  type Ticket,
  type Order,
} from "./client";
import {
  Panel,
  Gate,
  Form,
  Action,
  ErrorBox,
  Loading,
  Empty,
} from "./components";
import {
  AuthPage,
  Browse,
  ProductDetail,
  ShopPage,
  CartPage,
  AddressesPage,
  OrderPage,
  AccountPage,
  NotificationsPage,
  SupportPage,
  CustomerOrders,
  SavedPage,
} from "./marketplace";
import {
  SellerDashboard,
  Onboarding,
  SellerProducts,
  ProductEditor,
  InventoryPage,
  SellerOrders,
  InstagramPage,
  ShopSettings,
  TeamPage,
  LedgerPage,
} from "./seller";
export function SettingsPage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce();
  const appearance = useAppearance();
  return (
    <Gate>
      <Panel title="تنظیمات و فعالیت">
        <h2>ظاهر برنامه</h2>
        <div className="theme-options">
          {(["light", "dark", "system"] as const).map((theme) => (
            <button
              key={theme}
              aria-pressed={appearance.theme === theme}
              onClick={() => appearance.setTheme(theme)}
            >
              <SocialIcon
                name={
                  theme === "light"
                    ? "sun"
                    : theme === "dark"
                      ? "moon"
                      : "monitor"
                }
              />
              {theme === "light" ? "روشن" : theme === "dark" ? "تیره" : "سیستم"}
            </button>
          ))}
        </div>
        {seller && (
          <>
            <label className="standalone-label">
              فروشگاه فعال
              <select
                value={c.org?.id ?? ""}
                onChange={(e) => c.setOrg(e.target.value)}
              >
                {c.orgs.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name} — {status(o.role)}
                  </option>
                ))}
              </select>
            </label>
            <div className="menu-list">
              {[
                ["/settings/shop/", "پروفایل، ارسال و مرجوعی"],
                ["/onboarding/", "تکمیل راه‌اندازی"],
                ["/instagram/", "حساب اینستاگرام"],
                ["/team/", "دسترسی همکاران"],
                ["/inventory/", "موجودی انبار"],
                ["/ledger/", "گزارش مالی"],
                ["/notifications/", "فعالیت فروشگاه"],
              ].map(([href, title]) => (
                <AppLink key={href} href={href!}>
                  {title}
                  <SocialIcon name="chevron" />
                </AppLink>
              ))}
            </div>
          </>
        )}
        <div className="menu-list">
          {[
            ["/support/", "پشتیبانی"],
            ["/help/", "راهنمای پی‌مون"],
            ["/privacy/", "حریم خصوصی"],
            ["/terms/", "شرایط استفاده"],
          ].map(([href, title]) => (
            <AppLink key={href} href={href!}>
              {title}
              <SocialIcon name="chevron" />
            </AppLink>
          ))}
        </div>
        <p className="muted" dir="ltr">
          {c.user?.email}
        </p>
        <Action run={c.logout}>خروج از حساب</Action>
      </Panel>
    </Gate>
  );
}
export function InfoPage({
  page,
  seller = false,
}: {
  page: string;
  seller?: boolean;
}) {
  return (
    <Panel
      title={
        page === "help"
          ? "راهنمای پی‌مون"
          : page === "privacy"
            ? "حریم خصوصی"
            : "شرایط استفاده"
      }
    >
      {page === "help" ? (
        <>
          {seller ? (
            <>
              <h2>فروشگاهتان را آماده کنید</h2>
              <p>
                نام و نشانی فروشگاه را ثبت کنید، معرفی و شرایط ارسال را تکمیل
                کنید و درخواست بررسی بدهید.
              </p>
              <h2>محصول را اضافه کنید</h2>
              <p>
                از «محصول جدید» عکس، توضیح، مدل و قیمت را ثبت کنید. یا حساب
                حرفه‌ای اینستاگرام خودتان را متصل کنید، پست‌ها را دریافت و به
                پیش‌نویس تبدیل کنید. قیمت و موجودی از کپشن قطعی استخراج نمی‌شود.
              </p>
              <h2>منتشر کنید و سفارش بفرستید</h2>
              <p>
                در انبار، ورودی کالا را ثبت کنید. پس از تأیید فروشگاه، محصول را
                منتشر کنید. سفارش پرداخت‌شده را آماده کنید و کد رهگیری ارسال را
                ثبت کنید.
              </p>
            </>
          ) : (
            <>
              <h2>پیدا کنید و سفارش بدهید</h2>
              <p>
                محصولات فروشگاه‌های تأییدشده را ببینید، مدل مناسب را انتخاب کنید
                و به سبد اضافه کنید. هر سبد متعلق به یک فروشگاه است.
              </p>
              <h2>نشانی و پیگیری</h2>
              <p>
                پس از ورود، نشانی را ثبت و سفارش را بسازید. مهلت پرداخت ۳۰ دقیقه
                است. وضعیت و کد رهگیری در سفارش‌های من نمایش داده می‌شود.
              </p>
              <h2>تجربهٔ خرید</h2>
              <p>
                بعد از دریافت، سفارش را تأیید کنید و نظر بدهید. برای مشکل سفارش،
                از همان صفحه درخواست پشتیبانی ثبت کنید.
              </p>
            </>
          )}
          <AppLink className="text-link" href="/support/">
            ارتباط با پشتیبانی
          </AppLink>
        </>
      ) : page === "privacy" ? (
        <>
          <p>
            ایمیل برای ورود، نشانی و شماره تماس برای ارسال سفارش، و سابقهٔ سفارش
            برای پیگیری ذخیره می‌شود. فروشنده فقط اطلاعات ارسال سفارش‌های
            فروشگاه خودش را می‌بیند.
          </p>
          <p>
            اتصال اینستاگرام با رضایت صاحب حساب و مجوزهای رسمی انجام می‌شود.
            توکن Meta در سرور رمزنگاری می‌شود؛ با قطع اتصال، توکن و رسانه‌های
            همگام‌شدهٔ اتصال حذف می‌شوند.
          </p>
          <p>
            رویدادهای محصول با شناسهٔ داخلی و بدون رمز، توکن، نشانی یا متن پیام
            در پایگاه دادهٔ خود پی‌مون ثبت می‌شوند. داده‌ای به سرویس تحلیل
            بیرونی ارسال نمی‌شود.
          </p>
          <p>
            برای اصلاح یا درخواست حذف اطلاعات با پشتیبانی تماس بگیرید. پیش از
            عرضهٔ عمومی، مشخصات مسئول داده و سیاست نگهداری باید توسط بهره‌بردار
            تکمیل شود.
          </p>
        </>
      ) : (
        <>
          <p>
            قیمت‌ها به تومان نمایش داده می‌شوند و در سیستم به ریال ثبت می‌شوند.
            شرایط ارسال و مرجوعی هر فروشگاه در صفحهٔ آن مشخص است.
          </p>
          <p>
            سفارش فقط پس از تأیید پرداخت آمادهٔ ارسال است. گزینهٔ پرداخت آزمایشی
            هیچ وجهی جابه‌جا نمی‌کند و مخصوص محیط توسعه است.
          </p>
          <p>
            فروشنده باید حق استفاده از تصاویر و محتوای واردشده را داشته باشد.
            اتصال اینستاگرام اجازهٔ دسترسی به همهٔ حساب‌ها یا پست‌های دیگران
            نمی‌دهد.
          </p>
          <p>
            این نسخه برای آزمایش محصول است. حفاظت مالی خریدار، تسویهٔ بانکی و
            رسیدگی رسمی به اختلاف پس از راه‌اندازی عملیاتی سرویس اعلام خواهند
            شد.
          </p>
        </>
      )}
    </Panel>
  );
}
export function FollowingPage() {
  const c = useCommerce(),
    r = useResource<Merchant[]>(c.user ? "/v1/me/following" : null);
  return (
    <Gate>
      <Panel title="فروشگاه‌های دنبال‌شده">
        <ErrorBox message={r.error} />
        {r.data?.length ? (
          r.data.map((m) => (
            <div className="commerce-row" key={m.id}>
              <AppLink href={"/shop/?slug=" + m.slug}>{m.display_name}</AppLink>
              <Action
                run={() => c.request("/v1/me/following/" + m.id, "DELETE")}
                done={r.reload}
              >
                لغو دنبال‌کردن
              </Action>
            </div>
          ))
        ) : (
          <Empty>
            از صفحهٔ فروشگاه، فروشگاه‌های مورد علاقه‌تان را دنبال کنید.
          </Empty>
        )}
      </Panel>
    </Gate>
  );
}
function AdminPage({ page }: { page: string }) {
  const c = useCommerce();
  const endpoint = page === "home" ? "overview" : page;
  const r = useResource<unknown>(c.user ? "/v1/admin/" + endpoint : null);
  return (
    <Gate>
      <Panel
        title={
          {
            home: "مدیریت پی‌مون",
            merchants: "بررسی فروشندگان",
            orders: "سفارش‌ها",
            operations: "وضعیت عملیات",
            support: "درخواست‌های پشتیبانی",
            analytics: "رفتار محصول",
          }[page] ?? page
        }
      >
        <div className="menu-list admin-menu">
          {[
            ["/", "نمای کلی"],
            ["/merchants/", "فروشندگان"],
            ["/orders/", "سفارش‌ها"],
            ["/operations/", "عملیات"],
            ["/support/", "پشتیبانی"],
            ["/analytics/", "گزارش محصول"],
          ].map(([href, title]) => (
            <AppLink href={href!} key={href}>
              {title}
            </AppLink>
          ))}
        </div>
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {r.data !== null && (
          <>
            {page === "home" ? (
              <div className="metric-grid">
                {Object.entries(r.data as Record<string, string>).map(
                  ([k, v]) => (
                    <div key={k}>
                      <b>{v}</b>
                      <small>
                        {{
                          users: "کاربران",
                          merchants: "فروشگاه‌ها",
                          orders: "سفارش‌ها",
                          products: "محصولات",
                        }[k] ?? k}
                      </small>
                    </div>
                  ),
                )}
              </div>
            ) : page === "merchants" ? (
              (r.data as Merchant[]).map((m) => (
                <article className="ticket" key={m.id}>
                  <h2>{m.display_name}</h2>
                  <p>{m.bio}</p>
                  <span className="status-badge">{status(m.status)}</span>
                  <div className="button-row">
                    {["submitted", "approved", "rejected"].includes(
                      m.status,
                    ) && (
                      <>
                        <Action
                          run={() =>
                            c.request("/v1/admin/merchants/" + m.id, "PUT", {
                              status: "approved",
                            })
                          }
                          done={r.reload}
                        >
                          تأیید فروشگاه
                        </Action>
                        <Action
                          run={() =>
                            c.request("/v1/admin/merchants/" + m.id, "PUT", {
                              status: "rejected",
                            })
                          }
                          done={r.reload}
                        >
                          درخواست اصلاح
                        </Action>
                      </>
                    )}
                  </div>
                </article>
              ))
            ) : page === "orders" ? (
              (r.data as Order[]).map((o) => (
                <div className="commerce-row" key={o.id}>
                  <div>
                    <b>#{o.id.slice(0, 8)}</b>
                    <p>{status(o.status)}</p>
                  </div>
                  <strong>{price(o.amount_minor)}</strong>
                </div>
              ))
            ) : page === "support" ? (
              (r.data as Ticket[]).map((t) => (
                <article className="ticket" key={t.id}>
                  <h2>{t.subject}</h2>
                  <p>{t.body}</p>
                  <Form
                    fields={[
                      {
                        name: "reply",
                        label: "پاسخ به کاربر",
                        type: "textarea",
                        required: true,
                      },
                      {
                        name: "status",
                        label: "وضعیت",
                        options: [
                          { value: "resolved", label: "پاسخ داده‌شده" },
                          { value: "open", label: "باز" },
                        ],
                      },
                    ]}
                    initial={{ reply: t.reply ?? "", status: t.status }}
                    submit={(v) =>
                      c.request("/v1/admin/support/" + t.id, "PUT", v)
                    }
                    onSuccess={r.reload}
                  />
                </article>
              ))
            ) : page === "analytics" ? (
              (r.data as { name: string; count: number }[]).map((e) => (
                <div className="commerce-row" key={e.name}>
                  <b dir="ltr">{e.name}</b>
                  <span>{e.count}</span>
                </div>
              ))
            ) : (
              <OperationData
                value={
                  r.data as {
                    outbox: {
                      id: string;
                      topic: string;
                      published_at: string;
                      processed_at: string;
                    }[];
                    inbox: { id: string; status: string }[];
                  }
                }
              />
            )}
          </>
        )}
      </Panel>
    </Gate>
  );
}
function OperationData({
  value,
}: {
  value: {
    outbox: {
      id: string;
      topic: string;
      published_at: string;
      processed_at: string;
    }[];
    inbox: { id: string; status: string }[];
  };
}) {
  return (
    <>
      <h2>رویدادهای خروجی</h2>
      {value.outbox.map((e) => (
        <div className="commerce-row" key={e.id}>
          <b dir="ltr">{e.topic}</b>
          <span>
            {e.processed_at
              ? "پردازش‌شده"
              : e.published_at
                ? "در صف"
                : "آمادهٔ ارسال"}
          </span>
        </div>
      ))}
      <h2>وب‌هوک اینستاگرام</h2>
      {value.inbox.map((e) => (
        <div className="commerce-row" key={e.id}>
          <span>{e.id.slice(0, 8)}</span>
          <span>{e.status}</span>
        </div>
      ))}
    </>
  );
}
export function CommercePage({
  page,
  app,
}: {
  page: string;
  app: "marketplace" | "seller" | "admin";
}) {
  const seller = app === "seller";
  if (page === "login" || page === "register")
    return <AuthPage register={page === "register"} seller={seller} />;
  if (["help", "terms", "privacy"].includes(page))
    return <InfoPage page={page} seller={seller} />;
  if (page === "comments") return <CommentsPage />;
  if (page === "settings") return <SettingsPage seller={seller} />;
  if (app === "admin") return <AdminPage page={page} />;
  if (page === "order") return <OrderPage seller={seller} />;
  if (page === "notifications") return <NotificationsPage seller={seller} />;
  if (page === "support") return <SupportPage />;
  if (seller) {
    switch (page) {
      case "home":
      case "profile":
        return <SellerDashboard />;
      case "onboarding":
        return <Onboarding />;
      case "products":
        return <SellerProducts />;
      case "product":
        return <ProductEditor />;
      case "products/new":
        return <ProductEditor create />;
      case "inventory":
        return <InventoryPage />;
      case "orders":
        return <SellerOrders />;
      case "instagram":
        return <InstagramPage />;
      case "settings/shop":
        return <ShopSettings />;
      case "team":
        return <TeamPage />;
      case "ledger":
        return <LedgerPage />;
    }
  } else {
    switch (page) {
      case "home":
        return <Browse />;
      case "search":
        return <Browse search />;
      case "product":
        return <ProductDetail />;
      case "shop":
        return <ShopPage />;
      case "cart":
        return <CartPage />;
      case "checkout":
        return <CartPage checkout />;
      case "addresses":
        return <AddressesPage />;
      case "orders":
        return <CustomerOrders />;
      case "saved":
        return <SavedPage />;
      case "profile":
        return <AccountPage />;
      case "following":
        return <FollowingPage />;
    }
  }
  return <Empty>صفحه پیدا نشد.</Empty>;
}
