"use client";
import { InstagramDemo } from "./growth";
import { useRouter } from "next/navigation";
import { AppLink } from "../motion";
import { useEffect, useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import {
  useCommerce,
  useResource,
  useQuery,
  price,
  status,
  type Product,
  type Merchant,
  type Variant,
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
} from "./components";
import { SocialIcon } from "../social";
import { Avatar } from "../social-shell";
export function SellerDashboard() {
  const [tab, setTab] = useState("published");
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}` : null,
    d = useResource<{
      products: string;
      orders: string;
      customers: string;
      sales_minor: string;
    }>(base ? base + "/dashboard" : null),
    m = useResource<{ merchant: Merchant | null }>(
      base ? base + "/merchant" : null,
    );
  return (
    <Gate seller>
      <Panel
        title={c.org?.slug ?? "فروشگاه شما"}
        hideTitle
        className="seller-profile-summary"
      >
        <div className="profile-top">
          <Avatar
            name={m.data?.merchant?.display_name}
            src={m.data?.merchant?.avatar_url}
            size={88}
          />
          <div className="profile-stats">
            {[
              ["products", "محصول"],
              ["orders", "سفارش"],
              ["customers", "خریدار"],
            ].map(([key, label]) => (
              <div key={key}>
                <b>{d.data?.[key as "products"] ?? "—"}</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="profile-name-row">
          <h2>{m.data?.merchant?.display_name ?? c.org?.name}</h2>
          <span className="status-badge">
            {status(m.data?.merchant?.status ?? "draft")}
          </span>
        </div>
        <p>{m.data?.merchant?.bio || "فروشگاه اجتماعی شما"}</p>
        {!m.data?.merchant && (
          <AppLink className="primary" href="/onboarding/">
            تکمیل اطلاعات فروشگاه
          </AppLink>
        )}
        <div className="button-row">
          <AppLink href="/settings/shop/">ویرایش پروفایل</AppLink>
          <AppLink href="/instagram/">اتصال اینستاگرام</AppLink>
          <AppLink href="/products/new/">محصول جدید</AppLink>
        </div>
        <div className="sales-summary">
          <span>فروش ثبت‌شده</span>
          <b>{price(d.data?.sales_minor)}</b>
        </div>
        <ErrorBox message={d.error || m.error} />
        <div className="quick-actions">
          {[
            ["/inventory/", "bag", "موجودی"],
            ["/orders/", "send", "سفارش‌ها"],
            ["/team/", "user", "همکاران"],
            ["/ledger/", "grid", "مالی"],
          ].map(([href, icon, label]) => (
            <AppLink key={href} href={href!}>
              <span className="story-ring">
                <SocialIcon name={icon!} />
              </span>
              <small>{label}</small>
            </AppLink>
          ))}
        </div>
      </Panel>
      <div className="profile-tabs" role="tablist" aria-label="محصولات فروشگاه">
        {[
          ["published", "grid", "ویترین"],
          ["draft", "plus", "پیش‌نویس"],
          ["archived", "inventory", "بایگانی"],
        ].map(([value, icon, label]) => (
          <button
            role="tab"
            key={value}
            aria-selected={tab === value}
            onClick={() => setTab(value!)}
          >
            <SocialIcon name={icon!} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div
        key={tab}
        data-ssgoi-transition={"/seller-grid/" + tab}
        role="tabpanel"
        aria-label={
          tab === "published"
            ? "ویترین"
            : tab === "draft"
              ? "پیش‌نویس"
              : "بایگانی"
        }
      >
        {base && (
          <ProductList
            grid
            seller
            filterStatus={tab}
            path={base + "/products"}
          />
        )}
      </div>
    </Gate>
  );
}
export function Onboarding() {
  const router = useRouter();
  const c = useCommerce();
  return (
    <Gate>
      <Panel title="راه‌اندازی فروشگاه">
        <ol className="onboarding-steps">
          <li>ساخت فروشگاه</li>
          <li>اتصال اینستاگرام یا ثبت محصول</li>
          <li>بررسی و شروع فروش</li>
        </ol>
        <Form
          fields={[
            { name: "name", label: "نام فروشگاه", required: true },
            {
              name: "slug",
              label: "نشانی فروشگاه (حروف انگلیسی، عدد و خط تیره)",
              required: true,
              placeholder: "my-shop",
            },
            { name: "instagramHandle", label: "شناسهٔ اینستاگرام بدون @" },
          ]}
          label={c.org ? "تکمیل فروشگاه" : "ساخت فروشگاه"}
          initial={{ name: c.org?.name ?? "", slug: c.org?.slug ?? "" }}
          submit={async (v) => {
            const org =
              c.org ??
              (await c.request<{ id: string }>("/v1/organizations", "POST", {
                name: v.name,
                slug: v.slug,
              }));
            await c.request(`/v1/organizations/${org.id}/merchant`, "POST", {
              displayName: v.name,
              ...(v.instagramHandle
                ? { instagramHandle: v.instagramHandle }
                : {}),
            });
            await c.refresh();
            c.setOrg(org.id);
            router.push("/settings/shop/");
          }}
        />
        <p className="muted">
          فروشگاه برای انتشار عمومی باید توسط مدیریت بررسی شود. تا آن زمان
          می‌توانید محصولاتتان را آماده کنید.
        </p>
      </Panel>
    </Gate>
  );
}
export function SellerProducts() {
  const c = useCommerce();
  return (
    <Gate seller>
      <Panel
        title="محصولات"
        action={
          <AppLink className="text-link" href="/products/new/">
            + جدید
          </AppLink>
        }
      >
        <div className="button-row">
          <AppLink href="/instagram/">واردکردن پست‌ها</AppLink>
          <AppLink href="/inventory/">مدیریت موجودی</AppLink>
        </div>
        {c.org && (
          <ProductList
            grid
            seller
            path={`/v1/organizations/${c.org.id}/products`}
          />
        )}
      </Panel>
    </Gate>
  );
}
function variantFields(variants: Variant[]) {
  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    priceToman: String(BigInt(v.price_minor) / 10n),
    attributes: JSON.stringify(v.attributes),
  }));
}
export function ProductEditor({ create = false }: { create?: boolean }) {
  const router = useRouter();
  const c = useCommerce(),
    id = useQuery("id"),
    base = c.org ? `/v1/organizations/${c.org.id}/products` : null,
    r = useResource<Product>(!create && id && base ? base + "/" + id : null),
    categories = useResource<{ id: string; name: string }[]>("/v1/categories");
  const [media, setMedia] = useState<string[]>([]),
    [variants, setVariants] = useState([
      {
        id: undefined as string | undefined,
        sku: "",
        priceToman: "0",
        attributes: "{}",
      },
    ]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [ok, setOk] = useState("");
  useEffect(() => {
    if (r.data) {
      setMedia(r.data.media ?? []);
      setVariants(variantFields(r.data.variants));
    }
  }, [r.data]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!base) return;
    const f = new FormData(e.currentTarget);
    setError("");
    setOk("");
    setBusy(true);
    try {
      const rows = variants.map((v) => {
        const attributes = JSON.parse(v.attributes) as Record<string, string>;
        if (
          !attributes ||
          Array.isArray(attributes) ||
          Object.values(attributes).some((x) => typeof x !== "string")
        )
          throw new Error('ویژگی‌ها باید مثل {"رنگ":"مشکی"} باشند.');
        if (!/^\d+$/.test(v.priceToman))
          throw new Error("قیمت را با عدد صحیح انگلیسی وارد کنید.");
        return {
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku,
          priceMinor: (BigInt(v.priceToman) * 10n).toString(),
          attributes,
        };
      });
      const title = String(f.get("title")),
        description = String(f.get("description")),
        categoryId = String(f.get("categoryId") ?? "");
      let product = r.data;
      if (create) {
        product = await c.request<Product>(base, "POST", {
          title,
          ...(categoryId ? { categoryId } : {}),
          variants: rows.map(({ id: _id, ...rest }) => rest),
        });
      }
      if (!product) throw new Error("محصول پیدا نشد.");
      await c.request(base + "/" + product.id, "PUT", {
        version: product.version,
        title,
        description,
        media,
        categoryId: categoryId || null,
        variants: create
          ? rows.map((v, i) => ({ ...v, id: product!.variants[i]!.id }))
          : rows,
      });
      if (create) router.push("/product/?id=" + product.id);
      else {
        setOk("تغییرات ذخیره شد.");
        r.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت محصول");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (file.size > 3_000_000) {
      setError("حجم عکس باید کمتر از ۳ مگابایت باشد.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const mime =
        bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? "image/jpeg"
          : bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71
            ? "image/png"
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
                String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
              ? "image/webp"
              : null;
      if (!mime)
        throw new Error(
          "این فرمت عکس پشتیبانی نمی‌شود. عکس JPG، PNG یا WebP انتخاب کنید.",
        );
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]!);
        reader.onerror = () => reject(new Error("خواندن تصویر ناموفق بود"));
        reader.readAsDataURL(file);
      });
      const result = await c.request<{ url: string }>("/v1/media", "POST", {
        mime,
        base64,
      });
      setMedia((old) => [...old, result.url].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری تصویر");
    } finally {
      setUploading(false);
    }
  }
  return (
    <Gate seller>
      <Panel title={create ? "محصول جدید" : "ویرایش محصول"}>
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {(create || r.data) && (
          <>
            <form
              className="commerce-form"
              onSubmit={save}
              key={r.data?.version ?? "new"}
            >
              <label>
                نام محصول
                <input
                  required
                  name="title"
                  maxLength={200}
                  defaultValue={r.data?.title}
                />
              </label>
              <label>
                توضیحات
                <textarea
                  name="description"
                  maxLength={5000}
                  defaultValue={r.data?.description}
                />
              </label>
              <label>
                دسته‌بندی
                <select
                  name="categoryId"
                  defaultValue={r.data?.category_id ?? ""}
                >
                  <option value="">انتخاب دسته</option>
                  {categories.data?.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>تصاویر محصول</legend>
                <div className="editor-media">
                  {media.map((url, i) => (
                    <div key={url}>
                      <img src={url} alt={"تصویر " + (i + 1)} />
                      <button
                        type="button"
                        onClick={() =>
                          setMedia(media.filter((_, j) => j !== i))
                        }
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
                <label className="upload-label">
                  {uploading
                    ? "در حال بارگذاری…"
                    : "افزودن عکس (JPG، PNG، WebP)"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading || media.length >= 10}
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(e.target.files[0]);
                    }}
                  />
                </label>
              </fieldset>
              <fieldset>
                <legend>مدل‌ها، ویژگی‌ها و قیمت</legend>
                {variants.map((v, i) => (
                  <div className="variant-editor" key={i}>
                    <label>
                      کد کالا
                      <input
                        required
                        value={v.sku}
                        onChange={(e) =>
                          setVariants(
                            variants.map((x, j) =>
                              j === i ? { ...x, sku: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      قیمت (تومان)
                      <input
                        required
                        inputMode="numeric"
                        pattern="[0-9]+"
                        value={v.priceToman}
                        onChange={(e) =>
                          setVariants(
                            variants.map((x, j) =>
                              j === i
                                ? { ...x, priceToman: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    {["رنگ", "سایز"].map((name) => (
                      <label key={name}>
                        {name} (اختیاری)
                        <input
                          value={
                            (
                              JSON.parse(v.attributes) as Record<string, string>
                            )[name] ?? ""
                          }
                          onChange={(e) =>
                            setVariants(
                              variants.map((x, j) => {
                                if (j !== i) return x;
                                const attrs = JSON.parse(
                                  x.attributes,
                                ) as Record<string, string>;
                                if (e.target.value)
                                  attrs[name] = e.target.value;
                                else delete attrs[name];
                                return {
                                  ...x,
                                  attributes: JSON.stringify(attrs),
                                };
                              }),
                            )
                          }
                        />
                      </label>
                    ))}
                    {!v.id && variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVariants(variants.filter((_, j) => j !== i))
                        }
                      >
                        حذف مدل
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setVariants([
                      ...variants,
                      {
                        id: undefined,
                        sku: "",
                        priceToman: "0",
                        attributes: "{}",
                      },
                    ])
                  }
                >
                  + افزودن مدل
                </button>
              </fieldset>
              <ErrorBox message={error} />
              {ok && <p role="status">{ok}</p>}
              <button
                className="primary"
                disabled={busy || uploading}
                type="submit"
              >
                {busy ? "در حال ذخیره…" : "ذخیرهٔ محصول"}
              </button>
            </form>
            {r.data && (
              <>
                <p className="muted">
                  وضعیت: {status(r.data.status)} · بعد از تعیین موجودی،
                  می‌توانید محصول را منتشر کنید.
                </p>
                <div className="button-row">
                  <AppLink href="/inventory/">تنظیم موجودی</AppLink>
                  {r.data.source_media_id && (
                    <Action
                      run={() =>
                        c.request(
                          base + "/" + id + "/persist-instagram-images",
                          "POST",
                        )
                      }
                      done={r.reload}
                    >
                      نگهداری دائمی عکس‌های اینستاگرام
                    </Action>
                  )}
                  <Action
                    run={() =>
                      c.request(base + "/" + id + "/status", "POST", {
                        version: r.data!.version,
                        status:
                          r.data!.status === "published"
                            ? "archived"
                            : "published",
                      })
                    }
                    done={r.reload}
                  >
                    {r.data.status === "published"
                      ? "آرشیو محصول"
                      : "انتشار محصول"}
                  </Action>
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </Gate>
  );
}
export function InventoryPage() {
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/inventory` : null,
    r = useResource<(Variant & { variant_id: string })[]>(base);
  return (
    <Gate seller>
      <Panel title="موجودی انبار">
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {r.data?.length ? (
          <>
            <div className="inventory-table">
              <div className="table-heading">
                <span>کالا</span>
                <span>قابل فروش</span>
                <span>رزرو</span>
                <span>متعهد</span>
              </div>
              {r.data.map((v) => (
                <div className="table-row" key={v.variant_id}>
                  <b>{v.sku}</b>
                  <span>{v.available}</span>
                  <span>{v.reserved}</span>
                  <span>{v.committed}</span>
                </div>
              ))}
            </div>
            <h2>افزایش موجودی</h2>
            <Form
              fields={[
                {
                  name: "variantId",
                  label: "مدل کالا",
                  options: r.data.map((v) => ({
                    value: v.variant_id,
                    label: v.sku,
                  })),
                },
                {
                  name: "quantity",
                  label: "تعداد ورودی",
                  type: "number",
                  required: true,
                  min: 1,
                  max: 1000000,
                },
              ]}
              label="ثبت ورود به انبار"
              submit={(v) =>
                c.request(base + "/movements", "POST", {
                  variantId: v.variantId,
                  kind: "receive",
                  quantity: Number(v.quantity),
                })
              }
              onSuccess={r.reload}
            />
            <p className="muted">
              رزرو، تعهد و خروج کالا از مسیر سفارش به‌صورت خودکار انجام می‌شود.
            </p>
          </>
        ) : (
          <Empty>ابتدا یک محصول و مدل آن را ثبت کنید.</Empty>
        )}
      </Panel>
    </Gate>
  );
}
export function SellerOrders() {
  const c = useCommerce();
  return (
    <Gate seller>
      <Panel title="سفارش‌های فروشگاه">
        {c.org && <OrderList path={`/v1/organizations/${c.org.id}/orders`} />}
      </Panel>
    </Gate>
  );
}
type InstagramStatus = {
  configured: boolean;
  connection: {
    username: string;
    expires_at: string;
    scopes: string[];
    subscribed_fields: string[];
  } | null;
};
type InstagramMedia = {
  media_id: string;
  payload: {
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    children?: { data: { media_url?: string; thumbnail_url?: string }[] };
  };
};
export function InstagramPage() {
  const router = useRouter();
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/instagram` : null,
    r = useResource<InstagramStatus>(base),
    posts = useResource<InstagramMedia[]>(base ? base + "/media" : null);
  const [selected, setSelected] = useState<string[]>([]),
    [after, setAfter] = useState<string | undefined>(),
    [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    const refresh = () => r.reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  async function connect() {
    const result = await c.request<{ launchUrl: string }>(
      base + "/mobile-authorize",
      "POST",
    );
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: result.launchUrl });
      await Browser.addListener("browserFinished", () => {
        r.reload();
        posts.reload();
      });
    } else location.href = result.launchUrl;
  }
  async function sync() {
    const response = await c.request<{
      after?: string;
      imported?: number;
      count?: number;
    }>(base + "/media/sync", "POST", after ? { after } : {});
    setAfter(response.after);
    setSyncMessage(
      response.after
        ? "پست‌ها دریافت شدند؛ برای صفحهٔ بعد دوباره همگام‌سازی کنید."
        : "همگام‌سازی انجام شد.",
    );
    posts.reload();
  }
  return (
    <Gate seller>
      <Panel title="اینستاگرام فروشگاه">
        <InstagramDemo />
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {r.data && !r.data.configured && (
          <p className="notice-banner">
            اتصال پس از ثبت تنظیمات Meta در محیط سرور فعال می‌شود. محصول دستی را
            همین حالا می‌توانید بسازید.
          </p>
        )}
        {r.data?.connection ? (
          <>
            <div className="profile-top">
              <div className="avatar-large">
                <SocialIcon name="camera" />
              </div>
              <div>
                <b dir="ltr">@{r.data.connection.username}</b>
                <p className="status-badge">حساب متصل است</p>
              </div>
            </div>
            <p className="muted">
              با اجازهٔ صاحب حساب، پست‌های حساب حرفه‌ای او دریافت می‌شوند.
            </p>
            <div className="button-row">
              <Action run={sync}>همگام‌سازی {after ? "صفحهٔ بعد" : ""}</Action>
              <Action
                run={() => c.request(base + "/refresh", "POST")}
                done={r.reload}
              >
                تمدید اتصال
              </Action>
              <Action
                run={() => c.request(base!, "DELETE")}
                done={() => {
                  r.reload();
                  posts.reload();
                }}
              >
                قطع اتصال
              </Action>
            </div>
            <p role="status">{syncMessage}</p>
            <p className="muted">
              پست‌ها را انتخاب کنید. عنوان، توضیح و تصویر به پیش‌نویس می‌آید؛
              قیمت و موجودی را خودتان تعیین می‌کنید. عکس‌های Meta ممکن است منقضی
              شوند؛ برای انتشار پایدار عکس را بارگذاری کنید.
            </p>
            <ErrorBox message={posts.error} />
            <div className="instagram-grid">
              {posts.data?.map((p) => {
                const url =
                  p.payload.thumbnail_url ??
                  (p.payload.media_type === "IMAGE"
                    ? p.payload.media_url
                    : p.payload.children?.data[0]?.media_url);
                return (
                  <label
                    className={selected.includes(p.media_id) ? "selected" : ""}
                    key={p.media_id}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={
                          p.payload.caption?.slice(0, 100) || "پست اینستاگرام"
                        }
                      />
                    ) : (
                      <div className="image-empty">
                        <SocialIcon name="reels" />
                      </div>
                    )}
                    <input
                      type="checkbox"
                      checked={selected.includes(p.media_id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, p.media_id].slice(0, 25)
                            : selected.filter((x) => x !== p.media_id),
                        )
                      }
                    />
                    <span>
                      {p.payload.caption?.slice(0, 60) || "بدون کپشن"}
                    </span>
                  </label>
                );
              })}
            </div>
            {!posts.data?.length && (
              <Empty>هنوز پستی دریافت نشده است. همگام‌سازی را بزنید.</Empty>
            )}
            {selected.length > 0 && (
              <Action
                run={async () => {
                  await c.request(base + "/import", "POST", {
                    mediaIds: selected,
                  });
                  router.push("/products/");
                }}
              >
                ساخت پیش‌نویس از {selected.length} پست
              </Action>
            )}
            <details>
              <summary>اعلان‌های رسمی Meta</summary>
              <p>
                دسترسی مدیریت کامنت یا پیام باید در اپ Meta تأیید شده باشد.
                دریافت وب‌هوک به‌تنهایی صندوق پیام کامل نمی‌سازد.
              </p>
              <Action
                run={() =>
                  c.request(base + "/subscriptions", "POST", {
                    fields: ["comments"],
                  })
                }
              >
                فعال‌کردن اعلان کامنت
              </Action>
              <Action
                run={() =>
                  c.request(base + "/subscriptions", "POST", {
                    fields: ["messages", "messaging_postbacks"],
                  })
                }
              >
                فعال‌کردن اعلان پیام
              </Action>
            </details>
          </>
        ) : (
          r.data?.configured && (
            <Action run={connect}>اتصال حساب حرفه‌ای اینستاگرام</Action>
          )
        )}
        <AppLink className="text-link" href="/products/new/">
          ساخت محصول دستی
        </AppLink>
      </Panel>
    </Gate>
  );
}
export function ShopSettings() {
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/merchant` : null,
    r = useResource<{ merchant: Merchant | null }>(base);
  const m = r.data?.merchant;
  return (
    <Gate seller>
      <Panel title="پروفایل و ارسال فروشگاه">
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        {m ? (
          <>
            <Form
              key={m.id}
              initial={{
                displayName: m.display_name,
                bio: m.bio,
                shippingFeeToman: String(BigInt(m.shipping_fee_minor) / 10n),
                shippingDays: m.shipping_days,
                returnPolicy: m.return_policy,
              }}
              fields={[
                { name: "displayName", label: "نام فروشگاه", required: true },
                { name: "bio", label: "معرفی فروشگاه", type: "textarea" },
                {
                  name: "shippingFeeToman",
                  label: "هزینهٔ ارسال ثابت (تومان)",
                  type: "number",
                  min: 0,
                  required: true,
                },
                {
                  name: "shippingDays",
                  label: "زمان آماده‌سازی و ارسال (روز)",
                  type: "number",
                  min: 1,
                  max: 60,
                  required: true,
                },
                {
                  name: "returnPolicy",
                  label: "شرایط مرجوعی",
                  type: "textarea",
                },
              ]}
              submit={(v) =>
                c.request(base!, "PUT", {
                  displayName: v.displayName,
                  bio: v.bio,
                  shippingFeeMinor: (
                    BigInt(v.shippingFeeToman!) * 10n
                  ).toString(),
                  shippingDays: Number(v.shippingDays),
                  returnPolicy: v.returnPolicy,
                })
              }
              onSuccess={r.reload}
            />
            <p>وضعیت بررسی: {status(m.status)}</p>
            {["draft", "rejected"].includes(m.status) && (
              <Action
                run={() => c.request(base + "/submit", "POST")}
                done={r.reload}
              >
                ارسال فروشگاه برای بررسی
              </Action>
            )}
          </>
        ) : (
          !r.loading && (
            <AppLink className="primary" href="/onboarding/">
              تکمیل راه‌اندازی
            </AppLink>
          )
        )}
      </Panel>
    </Gate>
  );
}
export function TeamPage() {
  const c = useCommerce(),
    base = c.org ? `/v1/organizations/${c.org.id}/members` : null,
    r = useResource<{ user_id: string; email: string; role: string }[]>(base);
  return (
    <Gate seller>
      <Panel title="همکاران فروشگاه">
        <ErrorBox message={r.error} />
        {r.data?.map((m) => (
          <div className="commerce-row" key={m.user_id}>
            <div>
              <b dir="ltr">{m.email ?? m.user_id}</b>
              <small>{status(m.role)}</small>
            </div>
            {m.role !== "owner" && (
              <Action
                run={() => c.request(base + "/" + m.user_id, "DELETE")}
                done={r.reload}
              >
                حذف دسترسی
              </Action>
            )}
          </div>
        ))}
        <h2>افزودن یا تغییر دسترسی</h2>
        <Form
          fields={[
            {
              name: "email",
              label: "ایمیل حساب ثبت‌شدهٔ همکار",
              type: "email",
              required: true,
            },
            {
              name: "role",
              label: "نقش",
              options: [
                { value: "admin", label: "مدیر" },
                { value: "staff", label: "همکار" },
                { value: "viewer", label: "مشاهده‌گر" },
              ],
            },
          ]}
          label="ثبت دسترسی"
          submit={(v) => c.request(base + "/by-email", "POST", v)}
          onSuccess={r.reload}
        />
        <p className="muted">
          فقط مالک می‌تواند دسترسی بدهد. همکار باید قبلاً در پی‌مون حساب ساخته
          باشد.
        </p>
      </Panel>
    </Gate>
  );
}
export function LedgerPage() {
  const c = useCommerce(),
    r = useResource<
      {
        id: string;
        code: string;
        reference: string;
        debit: string;
        credit: string;
      }[]
    >(c.org ? `/v1/organizations/${c.org.id}/ledger` : null);
  return (
    <Gate seller>
      <Panel title="دفتر مالی">
        <ErrorBox message={r.error} />
        {r.loading && <Loading />}
        <p className="muted">
          ثبت‌های دوبل پرداخت. این صفحه ماندهٔ قابل برداشت یا تسویهٔ بانکی نیست.
        </p>
        {r.data?.length ? (
          r.data.map((x, i) => (
            <div className="commerce-row" key={x.id + x.code + i}>
              <div>
                <b>
                  {x.code === "sandbox_cash"
                    ? "وجه آزمایشی"
                    : "بستانکار فروشگاه"}
                </b>
                <small>{x.reference}</small>
              </div>
              <div>
                <p>بدهکار: {price(x.debit)}</p>
                <p>بستانکار: {price(x.credit)}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty>هنوز ثبت مالی وجود ندارد.</Empty>
        )}
      </Panel>
    </Gate>
  );
}
