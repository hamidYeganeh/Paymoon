"use client";
import { ProductAlertControls } from "./alerts";
import { useRouter } from "next/navigation";
import { AppLink } from "../motion";
import { useState, useRef, useEffect } from "react";
import {
  useCommerce,
  useResource,
  useQuery,
  price,
  status,
  date,
  type Product,
  type Merchant,
  type Address,
  type Order,
  type Ticket,
  type Notice,
} from "./client";
import {
  Panel,
  Gate,
  Form,
  Action,
  ErrorBox,
  Loading,
  Empty,
  ProductList,
  OrderList,
  type Field,
} from "./components";
import { ShopSuggestions } from "../social-shell";
import { SocialIcon } from "../social";
const addressFields: Field[] = [
  { name: "label", label: "عنوان نشانی", required: true, placeholder: "خانه" },
  { name: "recipient", label: "نام گیرنده", required: true },
  {
    name: "phone",
    label: "شماره همراه (با اعداد انگلیسی)",
    type: "tel",
    required: true,
  },
  { name: "province", label: "استان", required: true },
  { name: "city", label: "شهر", required: true },
  { name: "postalCode", label: "کد پستی ده‌رقمی", required: true },
  { name: "address", label: "نشانی کامل", type: "textarea", required: true },
];
export function AuthPage({
  register = false,
  seller = false,
}: {
  register?: boolean;
  seller?: boolean;
}) {
  const c = useCommerce(),
    router = useRouter();
  return (
    <div className="auth-page">
      <Panel title={register ? "ساخت حساب پی‌مون" : "ورود به پی‌مون"}>
        <div className="auth-brand">Paymoon</div>
        <p className="muted">
          {seller
            ? "فروشگاه اجتماعی شما، یک‌جا."
            : "چیزی که دوست دارید را پیدا کنید."}
        </p>
        <Form
          fields={[
            { name: "email", label: "ایمیل", type: "email", required: true },
            {
              name: "password",
              label: "رمز عبور (حداقل ۱۲ کاراکتر)",
              type: "password",
              required: true,
              minLength: 12,
            },
          ]}
          label={register ? "ساخت حساب" : "ورود"}
          submit={async (v) => {
            await c.login(v.email!, v.password!, register);
            router.push(seller ? "/" : "/profile/");
          }}
        />
        <p>
          {register ? "حساب دارید؟" : "تازه به پی‌مون آمده‌اید؟"}{" "}
          <AppLink
            className="text-link"
            href={register ? "/login/" : "/register/"}
          >
            {register ? "ورود" : "ساخت حساب"}
          </AppLink>
        </p>
        <p className="muted">
          با ادامه، <AppLink href="/terms/">شرایط استفاده</AppLink> و{" "}
          <AppLink href="/privacy/">حریم خصوصی</AppLink> را می‌پذیرید.
        </p>
      </Panel>
    </div>
  );
}
export function Browse({ search = false }: { search?: boolean }) {
  const [q, setQ] = useState(""),
    [inStock, setInStock] = useState(false),
    [minimum, setMinimum] = useState(""),
    [maximum, setMaximum] = useState(""),
    [sort, setSort] = useState("newest"),
    [category, setCategory] = useState(""),
    [offset, setOffset] = useState(0),
    [count, setCount] = useState(0);
  const categories =
    useResource<{ id: string; name: string; slug: string }[]>("/v1/categories");
  return (
    <>
      {search && (
        <Panel title="پیداش کن">
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setQ(String(data.get("q") ?? ""));
              setOffset(0);
            }}
          >
            <SocialIcon name="search" />
            <input
              name="q"
              aria-label="نام محصول"
              placeholder="جست‌وجوی محصول…"
            />
            <button type="submit">جست‌وجو</button>
          </form>
          <div className="filter-row">
            <select
              aria-label="دسته‌بندی"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">همهٔ دسته‌ها</option>
              {categories.data?.map((x) => (
                <option key={x.id} value={x.slug}>
                  {x.name}
                </option>
              ))}
            </select>
            <select
              aria-label="مرتب‌سازی"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">تازه‌ترین</option>
              <option value="price_asc">ارزان‌ترین</option>
              <option value="price_desc">گران‌ترین</option>
            </select>
          </div>
          <div className="filter-row">
            <label>
              از قیمت (تومان)
              <input
                type="number"
                min="0"
                value={minimum}
                onChange={(e) => {
                  setMinimum(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label>
              تا قیمت (تومان)
              <input
                type="number"
                min="0"
                value={maximum}
                onChange={(e) => {
                  setMaximum(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label className="check-filter">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  setInStock(e.target.checked);
                  setOffset(0);
                }}
              />
              فقط موجود
            </label>
            <AppLink href="/shops/">کشف فروشگاه‌ها</AppLink>
            <AppLink href="/link-search/">جست‌وجوی لینک پست</AppLink>
          </div>
        </Panel>
      )}
      {!search && <ShopSuggestions tray />}
      <ProductList
        onCount={setCount}
        grid={search}
        path={`/v1/marketplace/products?q=${encodeURIComponent(q)}&sort=${sort}${category ? "&category=" + category : ""}&offset=${offset}&inStock=${inStock}${minimum ? "&minPrice=" + minimum : ""}${maximum ? "&maxPrice=" + maximum : ""}`}
      />
      <div className="pagination">
        <button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          قبلی
        </button>
        <span>{new Intl.NumberFormat("fa").format(offset / 25 + 1)}</span>
        <button disabled={count < 25} onClick={() => setOffset(offset + 25)}>
          بعدی
        </button>
      </div>
    </>
  );
}
export function ProductDetail() {
  const id = useQuery("id"),
    r = useResource<Product>(id ? "/v1/marketplace/products/" + id : null);
  const c = useCommerce();
  const [variantId, setVariantId] = useState(""),
    [message, setMessage] = useState("");
  const p = r.data;
  const v = p?.variants?.find((x) => x.id === variantId) ?? p?.variants?.[0];
  return (
    <Panel title="جزئیات محصول">
      <ErrorBox message={r.error} />
      {r.loading && !p && <Loading />}
      {p && (
        <>
          <div className="media-carousel">
            {p.media?.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`${p.title} — عکس ${i + 1}`}
                data-zoom-enter-key={i === 0 ? p.id : undefined}
              />
            ))}
          </div>
          <AppLink
            className="text-link"
            href={`/shop/?slug=${p.merchant_slug}`}
          >
            {p.display_name}
          </AppLink>
          <h2>{p.title}</h2>
          <AppLink className="text-link" href={"/similar/?id=" + p.id}>
            گزینه‌های هم‌دسته و هزینهٔ ارسال
          </AppLink>
          <p className="preserve-lines">{p.description}</p>
          <label className="standalone-label">
            انتخاب مدل
            <select
              value={v?.id ?? ""}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {p.variants?.map((x) => (
                <option key={x.id} value={x.id}>
                  {Object.values(x.attributes).join(" / ") || x.sku} —{" "}
                  {price(x.price_minor)}
                </option>
              ))}
            </select>
          </label>
          <strong className="product-price">{price(v?.price_minor)}</strong>
          <p className="muted">{v?.available ?? 0} عدد موجود</p>
          <button
            className="primary"
            disabled={!v?.available}
            onClick={() => {
              if (!v) return;
              if (c.cart.some((x) => x.organizationId !== p.organization_id)) {
                setMessage(
                  "هر سبد برای یک فروشگاه است. سبد فعلی را تکمیل یا خالی کنید.",
                );
                return;
              }
              const old = c.cart.find((x) => x.variantId === v.id);
              if (old && old.quantity >= v.available) {
                setMessage("تعداد انتخاب‌شده از موجودی بیشتر است.");
                return;
              }
              c.setCart(
                old
                  ? c.cart.map((x) =>
                      x.variantId === v.id
                        ? { ...x, quantity: x.quantity + 1 }
                        : x,
                    )
                  : [
                      ...c.cart,
                      {
                        variantId: v.id,
                        productId: p.id,
                        organizationId: p.organization_id,
                        title: p.title,
                        sku: v.sku,
                        priceMinor: v.price_minor,
                        image: p.media?.[0] ?? "",
                        quantity: 1,
                      },
                    ],
              );
              setMessage("به سبد خرید اضافه شد.");
            }}
          >
            افزودن به سبد
          </button>
          <p role="status">
            {message} <AppLink href="/cart/">دیدن سبد</AppLink>
          </p>
          <ProductAlertControls productId={p.id} />
          <Action run={() => c.request("/v1/me/saved/" + p.id, "PUT")}>
            ذخیرهٔ محصول
          </Action>
        </>
      )}
    </Panel>
  );
}
export function ShopPage() {
  const c = useCommerce();
  const slug = useQuery("slug");
  const r = useResource<Merchant>(
      slug ? "/v1/marketplace/merchants/" + encodeURIComponent(slug) : null,
    ),
    reviews = useResource<{ id: string; rating: number; body: string }[]>(
      slug
        ? "/v1/marketplace/merchants/" + encodeURIComponent(slug) + "/reviews"
        : null,
    );
  return (
    <>
      <Panel title="فروشگاه">
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {r.data && (
          <>
            <div className="profile-top">
              <div className="avatar-large">
                {r.data.display_name.slice(0, 1)}
              </div>
              <div>
                <h2>{r.data.display_name}</h2>
                <span className="status-badge">فروشگاه تأییدشده</span>
                <p>{r.data.product_count} محصول</p>
              </div>
            </div>
            <p>{r.data.bio}</p>
            <AppLink
              className="text-link"
              href={"/messages/?merchant=" + r.data.id}
            >
              پیام به فروشگاه
            </AppLink>
            <p className="muted">
              ارسال: {r.data.shipping_days} روز ·{" "}
              {price(r.data.shipping_fee_minor)}
            </p>
            <details>
              <summary>شرایط مرجوعی فروشگاه</summary>
              <p>
                {r.data.return_policy ||
                  "برای شرایط مرجوعی با پشتیبانی هماهنگ کنید."}
              </p>
            </details>
            <Action
              run={() => c.request("/v1/me/following/" + r.data!.id, "PUT")}
            >
              دنبال‌کردن فروشگاه
            </Action>
          </>
        )}
      </Panel>
      {slug && (
        <ProductList
          grid
          path={"/v1/marketplace/products?merchant=" + encodeURIComponent(slug)}
        />
      )}
      <Panel title="نظر خریداران">
        {reviews.data?.length ? (
          reviews.data.map((x) => (
            <article className="commerce-row" key={x.id}>
              <b>{"★".repeat(x.rating)}</b>
              <p>{x.body}</p>
            </article>
          ))
        ) : (
          <p className="muted">هنوز نظری ثبت نشده است.</p>
        )}
      </Panel>
    </>
  );
}
export function CartPage({ checkout = false }: { checkout?: boolean }) {
  const router = useRouter();
  const c = useCommerce(),
    addresses = useResource<Address[]>(
      checkout && c.user ? "/v1/me/addresses" : null,
    );
  const [couponCode, setCouponCode] = useState("");
  const [addressId, setAddressId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const checkoutKey = useRef(crypto.randomUUID());
  useEffect(() => {
    checkoutKey.current = crypto.randomUUID();
  }, [c.cart, addressId, couponCode]);
  const total = c.cart.reduce(
    (t, x) => t + BigInt(x.priceMinor) * BigInt(x.quantity),
    0n,
  );
  const content = (
    <Panel title={checkout ? "ثبت سفارش" : "سبد خرید"}>
      {!c.cart.length ? (
        <Empty>
          سبد شما خالی است. <AppLink href="/search/">دیدن محصولات</AppLink>
        </Empty>
      ) : (
        <>
          <div className="row-list">
            {c.cart.map((x) => (
              <div className="cart-row" key={x.variantId}>
                {x.image && <img src={x.image} alt={x.title} />}
                <div>
                  <AppLink href={`/product/?id=${x.productId}`}>
                    <b>{x.title}</b>
                  </AppLink>
                  <small>
                    {x.sku} · {price(x.priceMinor)}
                  </small>
                  <input
                    aria-label={`تعداد ${x.title}`}
                    type="number"
                    min="1"
                    max="100"
                    value={x.quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 100)
                        c.setCart(
                          c.cart.map((v) =>
                            v.variantId === x.variantId
                              ? { ...v, quantity: n }
                              : v,
                          ),
                        );
                    }}
                  />
                </div>
                <button
                  aria-label={`حذف ${x.title}`}
                  onClick={() =>
                    c.setCart(c.cart.filter((v) => v.variantId !== x.variantId))
                  }
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
          <div className="total-line">
            <span>مجموع کالاها</span>
            <b>{price(total.toString())}</b>
          </div>
          <p className="muted">
            هزینهٔ ارسال و قیمت نهایی هنگام ثبت سفارش محاسبه می‌شود. موجودی تا
            ثبت سفارش رزرو نمی‌شود.
          </p>
          {checkout ? (
            <>
              <label className="standalone-label">
                کد تخفیف (اختیاری)
                <input
                  dir="ltr"
                  value={couponCode}
                  maxLength={32}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
              </label>
              <ErrorBox message={addresses.error} />
              <label className="standalone-label">
                نشانی ارسال
                <select
                  value={addressId || addresses.data?.[0]?.id || ""}
                  onChange={(e) => setAddressId(e.target.value)}
                >
                  {addresses.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.city}، {a.address}
                    </option>
                  ))}
                </select>
              </label>
              <AppLink className="text-link" href="/addresses/">
                افزودن نشانی
              </AppLink>
              <ErrorBox message={error} />
              <button
                className="primary"
                disabled={busy || !addresses.data?.length}
                onClick={() => {
                  setBusy(true);
                  setError("");
                  void c
                    .request<Order>(
                      "/v1/me/checkout",
                      "POST",
                      {
                        addressId: addressId || addresses.data?.[0]?.id,
                        ...(couponCode.trim()
                          ? { couponCode: couponCode.trim() }
                          : {}),
                        items: c.cart.map((x) => ({
                          variantId: x.variantId,
                          quantity: x.quantity,
                        })),
                      },
                      checkoutKey.current,
                    )
                    .then((o) => {
                      c.setCart([]);
                      router.push("/order/?id=" + o.id);
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "در حال ثبت…" : "ثبت سفارش و مشاهدهٔ پرداخت"}
              </button>
            </>
          ) : (
            <AppLink className="primary" href="/checkout/">
              ادامه و انتخاب نشانی
            </AppLink>
          )}
        </>
      )}
    </Panel>
  );
  return checkout ? <Gate>{content}</Gate> : content;
}
export function AddressesPage() {
  const c = useCommerce(),
    r = useResource<Address[]>(c.user ? "/v1/me/addresses" : null);
  return (
    <Gate>
      <Panel title="نشانی‌های من">
        <ErrorBox message={r.error} />
        {r.data?.map((a) => (
          <div className="commerce-row" key={a.id}>
            <div>
              <b>
                {a.label} · {a.recipient}
              </b>
              <p>
                {a.city}، {a.address}
              </p>
              <small>
                {a.phone} · {a.postal_code}
              </small>
            </div>
            <Action
              run={() => c.request("/v1/me/addresses/" + a.id, "DELETE")}
              done={r.reload}
            >
              حذف
            </Action>
          </div>
        ))}
        <h2>نشانی جدید</h2>
        <Form
          fields={addressFields}
          submit={(v) => c.request("/v1/me/addresses", "POST", v)}
          onSuccess={r.reload}
        />
        <AppLink className="text-link" href="/checkout/">
          بازگشت به ثبت سفارش
        </AppLink>
      </Panel>
    </Gate>
  );
}
export function OrderPage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce(),
    id = useQuery("id"),
    path = seller
      ? c.org
        ? `/v1/organizations/${c.org.id}/orders/${id}`
        : null
      : `/v1/me/orders/${id}`;
  const r = useResource<Order>(id && c.user ? path : null),
    o = r.data;
  return (
    <Gate seller={seller}>
      <Panel title="پیگیری سفارش">
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {o && (
          <>
            <div className="order-heading">
              <b>#{o.id.slice(0, 8)}</b>
              <span className="status-badge">{status(o.status)}</span>
            </div>
            <div className="order-timeline">
              {[
                "pending_payment",
                "paid",
                "fulfilling",
                "shipped",
                "completed",
              ].map((s, i) => (
                <span
                  className={
                    [
                      "pending_payment",
                      "paid",
                      "fulfilling",
                      "shipped",
                      "completed",
                    ].indexOf(o.status) >= i
                      ? "done"
                      : ""
                  }
                  key={s}
                >
                  {status(s)}
                </span>
              ))}
            </div>
            <p>{date(o.created_at)}</p>
            <div className="button-row">
              <AppLink href={"/invoice/?id=" + o.id}>فاکتور و چاپ</AppLink>
              <AppLink href="/returns/">درخواست‌های مرجوعی</AppLink>
            </div>
            {!seller && ["shipped", "completed"].includes(o.status) && (
              <details className="ticket">
                <summary>درخواست مرجوعی این سفارش</summary>
                <Form
                  fields={[
                    {
                      name: "reason",
                      label: "دلیل و شرح مشکل",
                      type: "textarea",
                      minLength: 5,
                      required: true,
                    },
                  ]}
                  label="ثبت درخواست"
                  submit={(v) =>
                    c.request(`/v1/me/orders/${o.id}/return`, "POST", v)
                  }
                />
              </details>
            )}
            {o.discount_minor && BigInt(o.discount_minor) > 0n && (
              <p>
                تخفیف {o.coupon_code}: {price(o.discount_minor)}
              </p>
            )}
            {o.items?.map((x) => (
              <div key={x.id} className="commerce-row">
                <span>
                  {x.title} · {x.sku} × {x.quantity}
                </span>
                <b>
                  {price(
                    (
                      BigInt(x.unit_price_minor) * BigInt(x.quantity)
                    ).toString(),
                  )}
                </b>
              </div>
            ))}
            <div className="total-line">
              <span>مبلغ نهایی با ارسال</span>
              <b>{price(o.amount_minor)}</b>
            </div>
            <p>
              {o.shipping_address?.recipient} · {o.shipping_address?.city}،{" "}
              {o.shipping_address?.address}
            </p>
            {o.tracking_code && (
              <p>
                ارسال با {o.carrier} · کد رهگیری:{" "}
                <b dir="ltr">{o.tracking_code}</b>
              </p>
            )}
            {seller ? (
              <>
                {o.status === "paid" && (
                  <Action
                    run={() => c.request(path + "/fulfill", "POST")}
                    done={r.reload}
                  >
                    شروع آماده‌سازی
                  </Action>
                )}
                {o.status === "fulfilling" && (
                  <Form
                    fields={[
                      { name: "carrier", label: "شرکت ارسال", required: true },
                      {
                        name: "trackingCode",
                        label: "کد رهگیری",
                        required: true,
                      },
                    ]}
                    label="ثبت ارسال"
                    submit={(v) => c.request(path + "/ship", "POST", v)}
                    onSuccess={r.reload}
                  />
                )}
              </>
            ) : (
              <>
                {o.status === "pending_payment" && (
                  <>
                    <p className="muted">مهلت پرداخت: {date(o.expires_at)}</p>
                    {o.paymentMode === "sandbox" ? (
                      <>
                        <p className="sandbox-banner">
                          پرداخت آزمایشی است و پولی جابه‌جا نمی‌شود.
                        </p>
                        <Action
                          run={() =>
                            c.request(path + "/sandbox-payment", "POST")
                          }
                          done={r.reload}
                        >
                          پرداخت آزمایشی
                        </Action>
                      </>
                    ) : (
                      <p className="notice-banner">
                        پرداخت آنلاین پس از اتصال درگاه فعال می‌شود.
                      </p>
                    )}
                    <Action
                      run={() => c.request(path + "/cancel", "POST")}
                      done={r.reload}
                    >
                      لغو سفارش و آزادکردن موجودی
                    </Action>
                  </>
                )}
                {o.status === "shipped" && (
                  <Action
                    run={() => c.request(path + "/complete", "POST")}
                    done={r.reload}
                  >
                    سفارش را دریافت کردم
                  </Action>
                )}
                {o.status === "completed" && (
                  <Form
                    fields={[
                      {
                        name: "rating",
                        label: "امتیاز",
                        options: [5, 4, 3, 2, 1].map((x) => ({
                          value: String(x),
                          label: x + " از ۵",
                        })),
                      },
                      {
                        name: "body",
                        label: "تجربهٔ خرید شما",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                    label="ثبت نظر"
                    submit={(v) =>
                      c.request(path + "/review", "POST", {
                        rating: Number(v.rating),
                        body: v.body,
                      })
                    }
                  />
                )}
                <AppLink className="text-link" href={"/support/?order=" + o.id}>
                  پشتیبانی این سفارش
                </AppLink>
              </>
            )}
          </>
        )}
      </Panel>
    </Gate>
  );
}
export function AccountPage() {
  const c = useCommerce();
  return (
    <Gate>
      <Panel title="حساب من">
        <div className="profile-top">
          <div className="avatar-large">
            <SocialIcon name="user" />
          </div>
          <div>
            <b dir="ltr">{c.user?.email}</b>
            <p className="muted">همراه شما در خرید از فروشگاه‌های اجتماعی</p>
          </div>
        </div>
        <div className="menu-list">
          {[
            ["/orders/", "سفارش‌های من"],
            ["/cart/", "سبد خرید"],
            ["/saved/", "ذخیره‌شده‌ها"],
            ["/following/", "فروشگاه‌های دنبال‌شده"],
            ["/addresses/", "نشانی‌ها"],
            ["/notifications/", "فعالیت و اعلان‌ها"],
            ["/support/", "پشتیبانی"],
            ["/settings/", "تنظیمات"],
            ["/help/", "راهنمای استفاده"],
          ].map(([href, title]) => (
            <AppLink key={href} href={href!}>
              {title}
              <SocialIcon name="chevron" />
            </AppLink>
          ))}
        </div>
        <Action run={c.logout}>خروج از حساب</Action>
      </Panel>
    </Gate>
  );
}
export function NotificationsPage({ seller = false }: { seller?: boolean }) {
  const c = useCommerce(),
    r = useResource<Notice[]>(
      c.user
        ? seller
          ? c.org
            ? `/v1/organizations/${c.org.id}/notifications`
            : null
          : "/v1/me/notifications"
        : null,
    );
  const labels: Record<string, string> = {
    "order.created": "سفارش شما ثبت شد",
    "order.paid": "پرداخت سفارش تأیید شد",
    "order.shipped": "سفارش شما ارسال شد",
    "order.cancelled": "سفارش لغو شد",
    "order.transitioned": "وضعیت سفارش تغییر کرد",
    "product.created": "محصول جدید ثبت شد",
    "inventory.changed": "موجودی به‌روز شد",
    "instagram.connected": "اینستاگرام متصل شد",
    "instagram.webhook.received": "فعالیت جدید اینستاگرام",
    "merchant.created": "فروشگاه ساخته شد",
  };
  return (
    <Gate seller={seller}>
      <Panel title="فعالیت‌ها">
        <ErrorBox message={r.error} />
        {r.loading ? (
          <Loading />
        ) : r.data?.length ? (
          r.data.map((n) => (
            <div className="commerce-row" key={n.id}>
              <div>
                <b>{n.title ?? labels[n.kind] ?? n.kind}</b>
                {n.body && <p>{n.body}</p>}
                <small>{date(n.created_at)}</small>
                {n.product_id && (
                  <AppLink
                    className="text-link"
                    href={"/product/?id=" + n.product_id}
                  >
                    دیدن کالا
                  </AppLink>
                )}
                {n.order_id && (
                  <AppLink
                    className="text-link"
                    href={"/order/?id=" + n.order_id}
                  >
                    دیدن سفارش
                  </AppLink>
                )}
              </div>
              {!seller && !n.read_at && (
                <Action
                  run={() =>
                    c.request(`/v1/me/notifications/${n.id}/read`, "PUT")
                  }
                  done={r.reload}
                >
                  خواندم
                </Action>
              )}
            </div>
          ))
        ) : (
          <Empty>هنوز فعالیتی ثبت نشده است.</Empty>
        )}
      </Panel>
    </Gate>
  );
}
export function SupportPage() {
  const c = useCommerce(),
    id = useQuery("order"),
    r = useResource<Ticket[]>(c.user ? "/v1/me/support" : null);
  return (
    <Gate>
      <Panel title="پشتیبانی">
        <p className="muted">
          سؤال یا مشکلتان را بنویسید؛ پاسخ در همین صفحه نمایش داده می‌شود.
        </p>
        <Form
          fields={[
            { name: "subject", label: "موضوع", required: true },
            {
              name: "body",
              label: "شرح درخواست",
              type: "textarea",
              required: true,
            },
          ]}
          label="ارسال درخواست"
          submit={(v) =>
            c.request("/v1/me/support", "POST", {
              ...v,
              ...(id ? { orderId: id } : {}),
            })
          }
          onSuccess={r.reload}
        />
        <ErrorBox message={r.error} />
        {r.data?.map((t) => (
          <article className="ticket" key={t.id}>
            <div className="section-title">
              <b>{t.subject}</b>
              <span>{status(t.status)}</span>
            </div>
            <p>{t.body}</p>
            {t.reply && <blockquote>{t.reply}</blockquote>}
            <small>{date(t.created_at)}</small>
          </article>
        ))}
      </Panel>
    </Gate>
  );
}
export function CustomerOrders() {
  const c = useCommerce();
  return (
    <Gate>
      <Panel title="سفارش‌های من">
        {c.user && <OrderList path="/v1/me/orders" />}
      </Panel>
    </Gate>
  );
}
export function SavedPage() {
  const c = useCommerce();
  return (
    <Gate>
      <Panel title="ذخیره‌شده‌ها">
        {c.user && <ProductList grid path="/v1/me/saved" />}
      </Panel>
    </Gate>
  );
}
