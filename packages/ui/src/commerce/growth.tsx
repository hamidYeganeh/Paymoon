"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  parseProductCsv,
  PRODUCT_CSV_HEADER,
  type ProductCsvRow,
  type Customer,
  type Coupon,
  type Campaign,
  type ReturnRequest,
  type StockAlert,
  type SalesReport,
} from "@paymoon/contracts";
import {
  useCommerce,
  useResource,
  price,
  date,
  status,
  type Order,
  type Merchant,
} from "./client";
import {
  Panel,
  Gate,
  Form,
  Action,
  Loading,
  ErrorBox,
  Empty,
} from "./components";
import { AppLink } from "../motion";
import { Avatar } from "../social-shell";
const segments = [
  { value: "all", label: "همهٔ مشتریان" },
  { value: "new", label: "جدید" },
  { value: "active", label: "فعال" },
  { value: "vip", label: "وفادار" },
  { value: "at_risk", label: "نیازمند توجه" },
];
const labelSegment = (s: string) =>
  segments.find((x) => x.value === s)?.label ?? s;
function GrowthLinks() {
  return (
    <div className="growth-links">
      {[
        ["/customers/", "مشتریان"],
        ["/discounts/", "تخفیف‌ها"],
        ["/campaigns/", "کمپین"],
        ["/reports/", "گزارش"],
        ["/imports/", "ورود گروهی"],
        ["/stock-alerts/", "کمبود موجودی"],
        ["/returns/", "مرجوعی"],
      ].map(([href, title]) => (
        <AppLink key={href} href={href!}>
          {title}
        </AppLink>
      ))}
    </div>
  );
}
export function CustomersPage() {
  const c = useCommerce(),
    [segment, setSegment] = useState("all"),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    [offset, setOffset] = useState(0);
  const base = c.org ? `/v1/organizations/${c.org.id}` : null;
  const list = useResource<Customer[]>(
    base
      ? `${base}/customers?segment=${segment}&q=${encodeURIComponent(q)}&offset=${offset}`
      : null,
  );
  const detail = useResource<Customer & { orders: Order[] }>(
    base && selected ? `${base}/customers/${selected}` : null,
  );
  useEffect(() => {
    setSelected("");
    setOffset(0);
  }, [c.org?.id]);
  return (
    <Gate seller>
      <Panel title="مشتریان فروشگاه">
        <GrowthLinks />
        <p className="muted">
          خریدها و یادداشت‌ها فقط مربوط به همین فروشگاه‌اند. وفادار: دست‌کم ۳
          خرید پرداخت‌شده؛ نیازمند توجه: بیش از ۶۰ روز از آخرین خرید.
        </p>
        <div className="filter-row">
          <input
            aria-label="جست‌وجوی مشتری با ایمیل"
            placeholder="جست‌وجوی مشتری"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
          <select
            aria-label="گروه مشتری"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              setOffset(0);
            }}
          >
            {segments.map((x) => (
              <option value={x.value} key={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <ErrorBox message={list.error} />
        {list.loading ? (
          <Loading />
        ) : list.data?.length ? (
          list.data.map((x) => (
            <button
              className="customer-card"
              key={x.buyer_id}
              onClick={() => setSelected(x.buyer_id)}
            >
              <span>
                <strong dir="ltr">{x.email}</strong>
                <small>
                  {labelSegment(x.segment)} · {x.paid_orders} خرید
                </small>
              </span>
              <b>{price(x.lifetime_minor)}</b>
            </button>
          ))
        ) : (
          <Empty>مشتریان پس از اولین سفارش اینجا نمایش داده می‌شوند.</Empty>
        )}
        <div className="pagination">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            قبلی
          </button>
          <button
            disabled={(list.data?.length ?? 0) < 50 || offset >= 10000}
            onClick={() => setOffset(offset + 50)}
          >
            بعدی
          </button>
        </div>
        {selected && (
          <section className="ticket">
            <h2>پروندهٔ مشتری</h2>
            <ErrorBox message={detail.error} />
            {detail.loading ? (
              <Loading />
            ) : (
              detail.data && (
                <>
                  <p dir="ltr">{detail.data.email}</p>
                  <p>
                    آخرین خرید:{" "}
                    {detail.data.last_purchase
                      ? date(detail.data.last_purchase)
                      : "هنوز پرداخت نشده"}
                  </p>
                  <Form
                    key={`${c.org?.id}:${selected}:${detail.data.note}`}
                    fields={[
                      {
                        name: "note",
                        label: "یادداشت خصوصی فروشگاه",
                        type: "textarea",
                      },
                    ]}
                    initial={{ note: detail.data.note ?? "" }}
                    submit={(v) =>
                      c.request(`${base}/customers/${selected}/note`, "PUT", v)
                    }
                    onSuccess={detail.reload}
                  />
                  <h3>۵۰ سفارش آخر</h3>
                  {detail.data.orders.map((x) => (
                    <div className="commerce-row" key={x.id}>
                      <AppLink href={`/order/?id=${x.id}`}>
                        #{x.id.slice(0, 8)} · {status(x.status)}
                      </AppLink>
                      <b>{price(x.amount_minor)}</b>
                    </div>
                  ))}
                </>
              )
            )}
          </section>
        )}
      </Panel>
    </Gate>
  );
}
export function DiscountsPage() {
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/coupons` : null,
    r = useResource<Coupon[]>(base);
  return (
    <Gate seller>
      <Panel title="کدهای تخفیف">
        <GrowthLinks />
        <p className="muted">
          تخفیف روی مبلغ کالاها اعمال می‌شود. سفارش پرداخت‌نشده تا پایان مهلت،
          ظرفیت کد را رزرو می‌کند؛ پس از لغو ظرفیت آزاد است.
        </p>
        <Form
          fields={[
            { name: "code", label: "کد (حروف انگلیسی و عدد)", required: true },
            {
              name: "kind",
              label: "نوع تخفیف",
              options: [
                { value: "percent", label: "درصدی" },
                { value: "fixed", label: "مبلغ ثابت به تومان" },
              ],
            },
            {
              name: "value",
              label: "درصد یا مبلغ به تومان",
              type: "number",
              min: 1,
              required: true,
            },
            {
              name: "minimum",
              label: "حداقل خرید به تومان",
              type: "number",
              min: 0,
            },
            {
              name: "cap",
              label: "سقف تخفیف به تومان (اختیاری)",
              type: "number",
              min: 1,
            },
            {
              name: "usage",
              label: "حداکثر دفعات استفاده",
              type: "number",
              min: 1,
              max: 1000000,
              required: true,
            },
            {
              name: "perCustomer",
              label: "حداکثر برای هر مشتری",
              type: "number",
              min: 1,
              max: 1000,
              required: true,
            },
            {
              name: "end",
              label: "تاریخ پایان",
              type: "datetime-local",
              required: true,
            },
          ]}
          initial={{
            kind: "percent",
            value: 10,
            minimum: 0,
            usage: 100,
            perCustomer: 1,
          }}
          label="ساخت کد تخفیف"
          submit={(v) =>
            c.request(base!, "POST", {
              code: v.code,
              kind: v.kind,
              value:
                v.kind === "fixed"
                  ? (BigInt(v.value!) * 10n).toString()
                  : v.value,
              minimumMinor: (BigInt(v.minimum || "0") * 10n).toString(),
              ...(v.cap
                ? { maximumDiscountMinor: (BigInt(v.cap) * 10n).toString() }
                : {}),
              usageLimit: Number(v.usage),
              perCustomerLimit: Number(v.perCustomer),
              endsAt: new Date(v.end!).toISOString(),
            })
          }
          onSuccess={r.reload}
        />
        <ErrorBox message={r.error} />
        {r.data?.map((x) => (
          <article className="ticket" key={x.id}>
            <div className="commerce-row">
              <strong dir="ltr">{x.code}</strong>
              <span>
                {x.kind === "percent" ? `${x.value}٪` : price(x.value)}
              </span>
            </div>
            <p>
              {x.used} استفاده از {x.usage_limit} · پایان {date(x.ends_at)}
            </p>
            <Action
              run={() =>
                c.request(`${base}/${x.id}`, "PUT", { active: !x.active })
              }
              done={r.reload}
            >
              {x.active ? "غیرفعال‌کردن" : "فعال‌کردن"}
            </Action>
          </article>
        ))}
      </Panel>
    </Gate>
  );
}
export function CampaignsPage() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/campaigns` : null,
    r = useResource<Campaign[]>(base);
  return (
    <Gate seller>
      <Panel title="کمپین برای مشتریان">
        <GrowthLinks />
        <p className="notice-banner">
          این نسخه پیام را در اعلان‌های Paymoon مشتری قرار می‌دهد. پیامک، ایمیل
          یا دایرکت ارسال نمی‌شود. حداکثر ۵۰۰ مشتری دارای خرید پرداخت‌شده در هر
          کمپین.
        </p>
        <Form
          fields={[
            {
              name: "title",
              label: "عنوان پیام",
              required: true,
              minLength: 3,
            },
            {
              name: "body",
              label: "متن پیام",
              type: "textarea",
              required: true,
              minLength: 3,
            },
            { name: "segment", label: "مخاطبان", options: segments },
          ]}
          label="ارسال اعلان داخل پی‌مون"
          submit={async (v) => {
            const payload = JSON.stringify({ base, v });
            if (attempt.current?.payload !== payload)
              attempt.current = { payload, key: crypto.randomUUID() };
            const result = await c.request(
              base!,
              "POST",
              v,
              attempt.current.key,
            );
            attempt.current = null;
            return result;
          }}
          onSuccess={r.reload}
        />
        <ErrorBox message={r.error} />
        {r.data?.map((x) => (
          <article className="ticket" key={x.id}>
            <h2>{x.title}</h2>
            <p>{x.body}</p>
            <small>
              {labelSegment(x.segment)} · {x.recipient_count} مخاطب ·{" "}
              {date(x.created_at)}
            </small>
          </article>
        ))}
      </Panel>
    </Gate>
  );
}
export function ReportsPage() {
  const c = useCommerce(),
    [days, setDays] = useState("30"),
    r = useResource<SalesReport>(
      c.org ? `/v1/organizations/${c.org.id}/reports?days=${days}` : null,
    );
  return (
    <Gate seller>
      <Panel title="گزارش فروش">
        <GrowthLinks />
        <select
          aria-label="بازه گزارش"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          {[
            ["7", "۷ روز"],
            ["30", "۳۰ روز"],
            ["90", "۹۰ روز"],
            ["365", "یک سال"],
          ].map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <ErrorBox message={r.error} />
        {r.loading ? (
          <Loading />
        ) : (
          r.data && (
            <>
              <div className="metric-grid">
                {[
                  [
                    price(r.data.summary.revenue_minor),
                    "مجموع سفارش‌های پرداخت‌شده",
                  ],
                  [r.data.summary.paid_orders, "سفارش پرداخت‌شده"],
                  [r.data.summary.customers, "مشتری"],
                  [price(r.data.summary.discount_minor), "تخفیف استفاده‌شده"],
                ].map(([v, t]) => (
                  <div key={t}>
                    <b>{v}</b>
                    <small>{t}</small>
                  </div>
                ))}
              </div>
              <p className="muted">
                آمار بر اساس تاریخ ثبت سفارش است. مبلغ شامل ارسال و پس از تخفیف
                است؛ سود و تسویهٔ بانکی محسوب نمی‌شود. پرداخت‌ها در محیط فعلی
                آزمایشی‌اند.
              </p>
              <h2>فروش روزانه</h2>
              <div className="sales-bars">
                {r.data.daily.map((x) => (
                  <div className="sales-day" key={x.day}>
                    <span>
                      {new Date(x.day + "T12:00:00+03:30").toLocaleDateString(
                        "fa-IR",
                      )}
                    </span>
                    <meter
                      min={0}
                      max={Math.max(
                        1,
                        ...r.data!.daily.map((x) => Number(x.revenue_minor)),
                      )}
                      value={Number(x.revenue_minor)}
                    />
                    <b>{price(x.revenue_minor)}</b>
                  </div>
                ))}
              </div>
              {!r.data.daily.length && (
                <Empty>هنوز سفارشی در این بازه ثبت نشده است.</Empty>
              )}
              <h2>مدل‌های پرفروش</h2>
              {r.data.top.map((x) => (
                <div className="commerce-row" key={x.variant_id}>
                  <span>
                    {x.title}
                    <small>{x.quantity} عدد</small>
                  </span>
                  <b>{price(x.gross_minor)}</b>
                </div>
              ))}
              <small className="muted">
                فروش ناخالص کالا پیش از کسر تخفیف؛ شامل ارسال نیست.
              </small>
              <h2>وضعیت سفارش‌ها</h2>
              {r.data.statuses.map((x) => (
                <div className="commerce-row" key={x.status}>
                  <b>{status(x.status)}</b>
                  <span>{x.count}</span>
                </div>
              ))}
            </>
          )
        )}
      </Panel>
    </Gate>
  );
}
export function ImportsPage() {
  const c = useCommerce(),
    [csv, setCsv] = useState(""),
    [rows, setRows] = useState<ProductCsvRow[]>([]),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const importKey = useRef<{ csv: string; org: string; key: string } | null>(
    null,
  );
  function preview(value: string) {
    setCsv(value);
    setSuccess("");
    try {
      setRows(parseProductCsv(value));
      setError("");
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  return (
    <Gate seller>
      <Panel title="ورود گروهی محصولات">
        <GrowthLinks />
        <p>
          فایل CSV با UTF-8 را از Excel خروجی بگیرید. ردیف‌هایی با عنوان یکسان،
          مدل‌های یک محصول می‌شوند. قیمت‌ها به تومان‌اند و محصول‌ها پیش‌نویس
          می‌مانند.
        </p>
        <button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [
                  "\uFEFF" +
                    PRODUCT_CSV_HEADER +
                    '\n"محصول نمونه","توضیح",SKU-001,150000,5,,کرم,M\n',
                ],
                { type: "text/csv;charset=utf-8" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "paymoon-products.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          دریافت قالب نمونه
        </button>
        <label className="standalone-label">
          انتخاب فایل
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 1000000) {
                  setError("فایل بیش از یک مگابایت است.");
                  return;
                }
                void f.text().then(preview);
              }
            }}
          />
        </label>
        <label className="standalone-label">
          یا متن CSV
          <textarea
            dir="ltr"
            value={csv}
            onChange={(e) => preview(e.target.value)}
            placeholder={PRODUCT_CSV_HEADER}
          />
        </label>
        <ErrorBox message={error} />
        {rows.length > 0 && (
          <>
            <p>
              {rows.length} مدل آمادهٔ ورود؛{" "}
              {new Set(rows.map((x) => x.title)).size} محصول
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>محصول</th>
                    <th>SKU</th>
                    <th>قیمت</th>
                    <th>موجودی</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((x) => (
                    <tr key={x.sku}>
                      <td>{x.title}</td>
                      <td dir="ltr">{x.sku}</td>
                      <td>{price((BigInt(x.priceToman) * 10n).toString())}</td>
                      <td>{x.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                if (
                  importKey.current?.csv !== csv ||
                  importKey.current?.org !== c.org!.id
                )
                  importKey.current = {
                    csv,
                    org: c.org!.id,
                    key: crypto.randomUUID(),
                  };
                void c
                  .request<{ products: unknown[]; variants: number }>(
                    `/v1/organizations/${c.org!.id}/products/import-csv`,
                    "POST",
                    { csv },
                    importKey.current.key,
                  )
                  .then((x) => {
                    importKey.current = null;
                    setSuccess(
                      `${x.products.length} محصول و ${x.variants} مدل وارد شدند.`,
                    );
                    setRows([]);
                    setCsv("");
                  })
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "در حال ورود…" : "ورود به پیش‌نویس‌ها"}
            </button>
          </>
        )}
        <p role="status">{success}</p>
        <AppLink href="/products/">دیدن محصولات</AppLink>
        <p className="muted">
          فایل حداکثر ۱۰۰ ردیف دارد. SKU موجود بازنویسی نمی‌شود؛ در صورت تداخل،
          کل ورود لغو می‌شود. اتصال مستقیم WooCommerce هنوز فعال نیست.
        </p>
      </Panel>
    </Gate>
  );
}
export function StockAlertsPage() {
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/inventory` : null,
    r = useResource<StockAlert[]>(base ? base + "/alerts" : null);
  return (
    <Gate seller>
      <Panel title="کالاهای رو به اتمام">
        <GrowthLinks />
        <ErrorBox message={r.error} />
        {r.loading ? (
          <Loading />
        ) : r.data?.length ? (
          r.data.map((x) => (
            <article className="ticket" key={x.variant_id}>
              <h2>{x.title}</h2>
              <p>
                {x.sku} · موجودی قابل فروش: {x.available}
              </p>
              <Form
                fields={[
                  {
                    name: "threshold",
                    label: "هشدار وقتی موجودی به این عدد رسید",
                    type: "number",
                    min: 0,
                    max: 1000000,
                    required: true,
                  },
                ]}
                initial={{ threshold: x.low_stock_threshold }}
                submit={(v) =>
                  c.request(`${base}/${x.variant_id}/threshold`, "PUT", {
                    threshold: Number(v.threshold),
                  })
                }
                onSuccess={r.reload}
              />
            </article>
          ))
        ) : (
          <Empty>موجودی هیچ کالایی کمتر از حد هشدار نیست.</Empty>
        )}
        <AppLink href="/inventory/">ثبت ورود کالا و مدیریت موجودی</AppLink>
      </Panel>
    </Gate>
  );
}
export function ReturnsPage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce(),
    base = seller
      ? c.org
        ? `/v1/organizations/${c.org.id}/returns`
        : null
      : c.user
        ? "/v1/me/returns"
        : null,
    r = useResource<ReturnRequest[]>(base);
  const labels: Record<string, string> = {
    requested: "در انتظار بررسی",
    approved: "تأیید بازگشت کالا",
    rejected: "ردشده",
    received: "کالا دریافت شد",
  };
  return (
    <Gate seller={seller}>
      <Panel title="درخواست‌های مرجوعی">
        {seller && <GrowthLinks />}
        <p className="notice-banner">
          این بخش درخواست و هماهنگی بازگشت کالا را ثبت می‌کند. تأیید درخواست یا
          دریافت کالا، بازپرداخت بانکی یا افزایش خودکار موجودی انجام نمی‌دهد.
        </p>
        <ErrorBox message={r.error} />
        {r.data?.length ? (
          r.data.map((x) => (
            <article className="ticket" key={x.id}>
              <AppLink href={"/order/?id=" + x.order_id}>
                سفارش #{x.order_id.slice(0, 8)}
              </AppLink>
              <p>{x.reason}</p>
              <span className="status-badge">{labels[x.status]}</span>
              {x.seller_reply && <p>{x.seller_reply}</p>}
              {seller && ["requested", "approved"].includes(x.status) && (
                <Form
                  key={x.status}
                  fields={[
                    {
                      name: "reply",
                      label: "پاسخ و دستور بازگشت کالا",
                      type: "textarea",
                      minLength: 3,
                      required: true,
                    },
                    {
                      name: "status",
                      label: "تصمیم",
                      options:
                        x.status === "requested"
                          ? [
                              { value: "approved", label: "تأیید بازگشت" },
                              { value: "rejected", label: "رد درخواست" },
                            ]
                          : [{ value: "received", label: "کالا دریافت شد" }],
                    },
                  ]}
                  submit={(v) => c.request(`${base}/${x.id}`, "PUT", v)}
                  onSuccess={r.reload}
                />
              )}
            </article>
          ))
        ) : (
          <Empty>
            هنوز درخواست مرجوعی ثبت نشده است. از صفحهٔ سفارش ارسال‌شده یا
            تحویل‌شده درخواست بدهید.
          </Empty>
        )}
      </Panel>
    </Gate>
  );
}
export function InvoicePage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce(),
    id = useSearchParams().get("id"),
    r = useResource<Order>(
      id && (seller ? c.org : c.user)
        ? seller
          ? `/v1/organizations/${c.org!.id}/orders/${id}`
          : `/v1/me/orders/${id}`
        : null,
    );
  return (
    <Gate seller={seller}>
      <Panel title="فاکتور سفارش">
        <ErrorBox message={r.error} />
        {r.data && (
          <div className="invoice">
            <div className="invoice-head">
              <h2>Paymoon</h2>
              <button className="no-print" onClick={() => window.print()}>
                چاپ / ذخیرهٔ PDF
              </button>
            </div>
            <p>
              شماره: <span dir="ltr">{r.data.id}</span>
            </p>
            <p>
              {date(r.data.created_at)} · {status(r.data.status)}
            </p>
            <p>
              {r.data.shipping_address.recipient} ·{" "}
              {r.data.shipping_address.city} · {r.data.shipping_address.address}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>کالا</th>
                    <th>تعداد</th>
                    <th>قیمت واحد</th>
                    <th>جمع</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.items.map((x) => (
                    <tr key={x.id}>
                      <td>
                        {x.title}
                        <small>{x.sku}</small>
                      </td>
                      <td>{x.quantity}</td>
                      <td>{price(x.unit_price_minor)}</td>
                      <td>
                        {price(
                          (
                            BigInt(x.unit_price_minor) * BigInt(x.quantity)
                          ).toString(),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>ارسال: {price(r.data.shipping_fee_minor ?? "0")}</p>
            <p>
              تخفیف: {price(r.data.discount_minor ?? "0")} {r.data.coupon_code}
            </p>
            <div className="total-line">
              <b>مبلغ نهایی</b>
              <strong>{price(r.data.amount_minor)}</strong>
            </div>
            <p className="muted">
              خلاصهٔ سفارش Paymoon؛ صورتحساب رسمی مالیاتی نیست. پرداخت sandbox
              وجه واقعی جابه‌جا نمی‌کند.
            </p>
          </div>
        )}
      </Panel>
    </Gate>
  );
}
export function InstagramDemo() {
  const c = useCommerce(),
    router = useRouter(),
    base = c.org ? `/v1/organizations/${c.org.id}/demo/instagram` : null,
    r = useResource<{
      demo: true;
      posts: {
        id: string;
        title: string;
        description: string;
        imageUrl: string;
      }[];
    }>(base),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected([]), [c.org?.id]);
  if (!r.data) return null;
  return (
    <details className="demo-import">
      <summary>آزمایش ایمپورت بدون اتصال Meta</summary>
      <p className="notice-banner">
        این پست‌ها نمونهٔ Paymoon هستند و از Instagram دریافت نشده‌اند. پیش‌نویس
        با قیمت و موجودی صفر ساخته می‌شود؛ خودت آن‌ها را تکمیل می‌کنی.
      </p>
      <div className="instagram-grid">
        {r.data.posts.map((p) => (
          <label
            className={selected.includes(p.id) ? "selected" : ""}
            key={p.id}
          >
            <img src={p.imageUrl} alt={p.title} />
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, p.id]
                    : selected.filter((x) => x !== p.id),
                )
              }
            />
            <span>{p.title}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <Action
          run={async () => {
            await c.request(base + "/import", "POST", { postIds: selected });
            router.push("/products/");
          }}
        >
          ساخت پیش‌نویس آزمایشی
        </Action>
      )}
    </details>
  );
}
export function ShopsPage() {
  const [q, setQ] = useState(""),
    [sort, setSort] = useState("newest"),
    [offset, setOffset] = useState(0),
    r = useResource<Merchant[]>(
      `/v1/discovery/shops?q=${encodeURIComponent(q)}&sort=${sort}&offset=${offset}`,
    );
  return (
    <Panel title="کشف فروشگاه‌ها">
      <div className="filter-row">
        <input
          aria-label="جست‌وجوی فروشگاه"
          placeholder="نام فروشگاه یا معرفی آن"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <select
          aria-label="ترتیب فروشگاه‌ها"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setOffset(0);
          }}
        >
          <option value="newest">تازه‌ترین</option>
          <option value="popular">بیشترین دنبال‌کننده</option>
        </select>
      </div>
      <ErrorBox message={r.error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.length ? (
        <div className="shop-directory">
          {r.data.map((m) => (
            <AppLink
              className="shop-directory-card"
              key={m.id}
              href={"/shop/?slug=" + m.slug}
            >
              <Avatar name={m.display_name} size={64} />
              <h2>{m.display_name}</h2>
              <p>{m.bio}</p>
              <small>
                {m.product_count} محصول · ارسال حدود {m.shipping_days} روز
              </small>
              <span className="status-badge">فروشگاه تأییدشده</span>
            </AppLink>
          ))}
        </div>
      ) : (
        <Empty>فروشگاهی با این جست‌وجو پیدا نشد.</Empty>
      )}
      <div className="pagination">
        <button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          قبلی
        </button>
        <button
          disabled={(r.data?.length ?? 0) < 25 || offset >= 10000}
          onClick={() => setOffset(offset + 25)}
        >
          بعدی
        </button>
      </div>
    </Panel>
  );
}
