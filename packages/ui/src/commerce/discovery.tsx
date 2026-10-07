"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCommerce, useResource, price, type Product } from "./client";
import { Panel, ErrorBox, Loading, Empty } from "./components";
import { AppLink } from "../motion";
export function LinkSearchPage() {
  const c = useCommerce(),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Product[] | null>(null);
  return (
    <Panel title="پیدا کردن پست در پی‌مون">
      <p>
        لینک پستی را وارد کن که فروشندهٔ متصل قبلاً به محصول منتشرشده تبدیل کرده
        است. پست‌های دلخواه حساب‌های دیگر دریافت نمی‌شوند.
      </p>
      <form
        className="commerce-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          void c
            .request<Product[]>(
              "/v1/discovery/instagram-link?url=" + encodeURIComponent(url),
            )
            .then(setResult)
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          لینک پست یا Reel
          <input
            dir="ltr"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/…/"
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "در حال جست‌وجو…" : "پیدا کن"}
        </button>
      </form>
      <ErrorBox message={error} />
      {result?.length
        ? result.map((p) => (
            <AppLink
              className="commerce-row"
              key={p.id}
              href={"/product/?id=" + p.id}
            >
              <span>{p.title}</span>
              <span>{p.display_name}</span>
            </AppLink>
          ))
        : result && (
            <Empty>محصول منتشرشده‌ای با این لینک در پی‌مون پیدا نشد.</Empty>
          )}
    </Panel>
  );
}
export function SimilarPage() {
  const id = useSearchParams().get("id"),
    r = useResource<
      (Product & { shipping_days: number; shipping_fee_minor: string })[]
    >(id ? `/v1/discovery/products/${id}/similar` : null);
  return (
    <Panel title="گزینه‌های هم‌دسته">
      <p className="muted">
        این کالاها از همان دسته‌اند؛ یکسان‌بودن مدل یا برندشان تأیید نشده است.
        قیمت و زمان ارسال را کنار هم ببین.
      </p>
      <ErrorBox message={r.error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.length ? (
        <div className="shop-directory">
          {r.data.map((p) => (
            <AppLink
              className="shop-directory-card"
              key={p.id}
              href={"/product/?id=" + p.id}
            >
              {p.media[0] && (
                <img className="compare-image" src={p.media[0]} alt={p.title} />
              )}
              <h2>{p.title}</h2>
              <span>{p.display_name}</span>
              <b>{price(p.price_minor)}</b>
              <small>
                ارسال حدود {p.shipping_days} روز · هزینه{" "}
                {price(p.shipping_fee_minor)}
              </small>
            </AppLink>
          ))}
        </div>
      ) : (
        <Empty>گزینهٔ دیگری در این دسته موجود نیست.</Empty>
      )}
    </Panel>
  );
}
