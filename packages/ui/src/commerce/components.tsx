"use client";
import { useRouter } from "next/navigation";
import { AppLink } from "../motion";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  useCommerce,
  primePublicProduct,
  useResource,
  price,
  status,
  type Product,
  type Order,
} from "./client";
import { SocialIcon } from "../icons";
import { Avatar } from "../social-shell";
export function Panel({
  title,
  children,
  action,
  hideTitle = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  hideTitle?: boolean;
  className?: string;
}) {
  return (
    <section className={"commerce-panel " + className}>
      <div className={hideTitle ? "sr-only" : "section-title"}>
        <h1>{title}</h1>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p className="error-message" role="alert">
      {message}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div
      className="ig-skeletons"
      role="status"
      aria-label="در حال دریافت اطلاعات"
    >
      <span className="sr-only">در حال دریافت اطلاعات…</span>
      <div className="ig-skeleton-card" aria-hidden="true">
        <div className="ig-skeleton-line short" />
        <div className="ig-skeleton-photo" />
        <div className="ig-skeleton-line" />
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="commerce-empty">
      <SocialIcon name="camera" size={56} />
      {children}
    </div>
  );
}
export function Gate({
  children,
  seller = false,
}: {
  children: ReactNode;
  seller?: boolean;
}) {
  const { ready, user, org, sessionError, refresh } = useCommerce();
  if (!ready) return <Loading />;
  if (sessionError)
    return (
      <Empty>
        <ErrorBox message={sessionError} />
        <Action run={refresh}>تلاش دوباره</Action>
      </Empty>
    );
  if (!user)
    return (
      <Empty>
        <h2>به پی‌مون خوش آمدید</h2>
        <p>برای ادامه وارد حساب خود شوید.</p>
        <AppLink className="primary" href="/login/">
          ورود
        </AppLink>
        <AppLink href="/register/">ساخت حساب</AppLink>
      </Empty>
    );
  if (seller && !org)
    return (
      <Empty>
        <h2>فروشگاهتان را بسازید</h2>
        <p>نام فروشگاه و نشانی آن را ثبت کنید؛ بعد محصولات را اضافه کنید.</p>
        <AppLink className="primary" href="/onboarding/">
          شروع فروشندگی
        </AppLink>
      </Empty>
    );
  return <>{children}</>;
}
export function Action({
  children,
  run,
  done,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  done?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState(false);
  return (
    <>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          setOk(false);
          void run()
            .then(() => {
              setOk(true);
              done?.();
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "لطفاً صبر کنید…" : children}
      </button>
      <ErrorBox message={error} />
      {ok && <small role="status">انجام شد.</small>}
    </>
  );
}
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
};
export function Form({
  fields,
  initial = {},
  submit,
  label = "ذخیره",
  onSuccess,
}: {
  fields: Field[];
  initial?: Record<string, string | number>;
  submit: (values: Record<string, string>) => Promise<unknown>;
  label?: string;
  onSuccess?: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ok, setOk] = useState(false);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setError("");
    setOk(false);
    setBusy(true);
    try {
      await submit(values);
      setOk(true);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت اطلاعات");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="commerce-form" onSubmit={send}>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.options ? (
            <select
              name={f.name}
              defaultValue={initial[f.name]}
              required={f.required}
            >
              {f.options.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              defaultValue={initial[f.name]}
              required={f.required}
              placeholder={f.placeholder}
            />
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={initial[f.name]}
              required={f.required}
              min={f.min}
              max={f.max}
              minLength={f.minLength}
              placeholder={f.placeholder}
              autoComplete={
                f.name === "password"
                  ? "current-password"
                  : f.name === "email"
                    ? "email"
                    : "off"
              }
            />
          )}
        </label>
      ))}
      <ErrorBox message={error} />
      {ok && (
        <p role="status" className="success-message">
          ثبت شد.
        </p>
      )}
      <button className="primary" disabled={busy} type="submit">
        {busy ? "در حال ثبت…" : label}
      </button>
    </form>
  );
}
export function ProductCard({
  product,
  compact = false,
  seller = false,
}: {
  product: Product;
  compact?: boolean;
  seller?: boolean;
}) {
  const { request, user } = useCommerce(),
    router = useRouter();
  const [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!seller) primePublicProduct(product);
  }, [product, seller]);
  const savedItems = useResource<Product[]>(
    user && !seller ? "/v1/me/saved" : null,
  );
  useEffect(() => {
    setSaved(!!savedItems.data?.some((p) => p.id === product.id));
  }, [savedItems.data, product.id]);
  const likes = useResource<{ product_id: string }[]>(
    user && !seller ? "/v1/me/likes" : null,
  );
  const [liked, setLiked] = useState(false);
  useEffect(
    () => setLiked(!!likes.data?.some((p) => p.product_id === product.id)),
    [likes.data, product.id],
  );
  const href = `/product/?id=${product.id}`;
  if (compact)
    return (
      <AppLink
        className="product-tile"
        href={href}
        aria-label={`${product.title} — ${price(product.price_minor ?? product.variants?.[0]?.price_minor)}`}
      >
        {product.media?.[0] ? (
          <img
            src={product.media[0]}
            alt={product.title}
            loading="lazy"
            data-zoom-exit-key={product.id}
          />
        ) : (
          <div className="image-empty">
            <SocialIcon name="grid" />
          </div>
        )}
        <strong>{product.title}</strong>
        <span>
          {seller
            ? status(product.status)
            : price(product.price_minor ?? product.variants?.[0]?.price_minor)}
        </span>
      </AppLink>
    );
  return (
    <article className="commerce-post">
      <div className="post-user">
        <Avatar name={product.display_name ?? product.title} size={32} />
        <AppLink href={`/shop/?slug=${product.merchant_slug}`}>
          {product.display_name}
        </AppLink>
      </div>
      <AppLink href={href}>
        {product.media?.[0] ? (
          <img
            className="post-image"
            src={product.media[0]}
            alt={product.title}
            loading="lazy"
          />
        ) : (
          <div className="image-empty" />
        )}
      </AppLink>
      <div className="post-actions">
        <button
          aria-label={liked ? "حذف پسند" : "پسندیدن محصول"}
          aria-pressed={liked}
          className={liked ? "liked" : ""}
          onClick={() => {
            if (!user) {
              router.push("/login/");
              return;
            }
            void request(`/v1/me/likes/${product.id}`, liked ? "DELETE" : "PUT")
              .then(() => setLiked(!liked))
              .catch((e) => setError(e.message));
          }}
        >
          <SocialIcon name="heart" filled={liked} />
        </button>
        <AppLink href={href} aria-label="دیدن محصول">
          <SocialIcon name="bag" />
        </AppLink>
        <AppLink href={`/comments/?id=${product.id}`} aria-label="پرسش و نظر">
          <SocialIcon name="comment" />
        </AppLink>
        <button
          aria-label="اشتراک‌گذاری محصول"
          onClick={() => {
            const url = new URL(href, location.origin).href;
            void (
              navigator.share
                ? navigator.share({ title: product.title, url })
                : navigator.clipboard.writeText(url)
            ).catch(() =>
              setError("امکان اشتراک‌گذاری در این مرورگر وجود ندارد."),
            );
          }}
        >
          <SocialIcon name="send" />
        </button>
        <button
          className={saved ? "is-active save-action" : "save-action"}
          aria-label={saved ? "حذف از ذخیره‌ها" : "ذخیرهٔ محصول"}
          onClick={() => {
            if (!user) {
              router.push("/login/");
              return;
            }
            void request(`/v1/me/saved/${product.id}`, saved ? "DELETE" : "PUT")
              .then(() => setSaved(!saved))
              .catch((e) => setError(e.message));
          }}
        >
          <SocialIcon name="bookmark" filled={saved} />
        </button>
      </div>
      <div className="post-copy">
        <strong>{price(product.price_minor)}</strong>
        <p>
          <AppLink href={href}>
            <b>{product.title}</b>
          </AppLink>{" "}
          {product.description?.slice(0, 180)}
        </p>
        <span className="muted">
          {Number(product.available) > 0 ? "موجود و آمادهٔ سفارش" : "ناموجود"} ·
          ارسال {product.display_name}
        </span>
        <ErrorBox message={error} />
      </div>
    </article>
  );
}
export function ProductList({
  path,
  filterStatus,
  onCount,
  grid = false,
  seller = false,
}: {
  path: string;
  filterStatus?: string;
  onCount?: (count: number) => void;
  grid?: boolean;
  seller?: boolean;
}) {
  const r = useResource<Product[]>(path);
  const products = r.data?.filter(
    (p) => !filterStatus || p.status === filterStatus,
  );
  useEffect(() => {
    onCount?.(r.data?.length ?? 0);
  }, [r.data, onCount]);
  return (
    <>
      <ErrorBox message={r.error} />
      {r.error && <button onClick={r.reload}>تلاش دوباره</button>}
      {r.loading ? (
        <Loading />
      ) : products?.length ? (
        <div className={grid ? "product-grid" : "product-feed"}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              compact={grid}
              seller={seller}
            />
          ))}
        </div>
      ) : (
        !r.error && (
          <Empty>
            <h2>هنوز محصولی اینجا نیست</h2>
            <p>
              {seller
                ? "یک محصول بسازید یا پست‌های فروشگاهتان را از اینستاگرام وارد کنید."
                : "با اضافه‌شدن محصولات فروشگاه‌های تأییدشده، این صفحه پر می‌شود."}
            </p>
            {seller && (
              <AppLink className="primary" href="/products/new/">
                محصول جدید
              </AppLink>
            )}
          </Empty>
        )
      )}
    </>
  );
}
export function OrderList({ path }: { path: string }) {
  const r = useResource<Order[]>(path);
  return (
    <>
      <ErrorBox message={r.error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.length ? (
        <div className="row-list">
          {r.data.map((o) => (
            <AppLink
              className="commerce-row"
              key={o.id}
              href={`/order/?id=${o.id}`}
            >
              <div>
                <b>سفارش {o.id.slice(0, 8)}</b>
                <small>{status(o.status)}</small>
              </div>
              <strong>{price(o.amount_minor)}</strong>
            </AppLink>
          ))}
        </div>
      ) : (
        <Empty>هنوز سفارشی ثبت نشده است.</Empty>
      )}
    </>
  );
}
