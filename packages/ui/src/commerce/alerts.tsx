"use client";
import type { ProductAlert } from "@paymoon/contracts";
import { AppLink } from "../motion";
import { useCommerce, useResource, price } from "./client";
import {
  Panel,
  Gate,
  Form,
  Action,
  ErrorBox,
  Loading,
  Empty,
} from "./components";
export function ProductAlertControls({ productId }: { productId: string }) {
  const c = useCommerce();
  return (
    <details className="product-watch">
      <summary>خبرم کن: قیمت دلخواه یا موجود شدن</summary>
      <p className="muted">
        اعلان داخل پی‌مون برای اولین مدل موجود با قیمت دلخواه ارسال می‌شود؛ رزرو
        کالا نیست. هر درخواست یک بار خبر می‌دهد.
      </p>
      {c.user ? (
        <>
          <Action
            run={() =>
              c.request("/v1/me/product-alerts", "POST", {
                productId,
                kind: "restock",
              })
            }
          >
            خبرم کن وقتی موجود شد
          </Action>
          <Form
            fields={[
              {
                name: "target",
                label: "حداکثر قیمت دلخواه (تومان)",
                type: "number",
                required: true,
                min: 1,
                max: 9999999999999,
              },
            ]}
            label="ثبت هشدار قیمت"
            submit={(v) =>
              c.request("/v1/me/product-alerts", "POST", {
                productId,
                kind: "price",
                targetMinor: (BigInt(v.target!) * 10n).toString(),
              })
            }
          />
          <AppLink href="/alerts/">مدیریت درخواست‌ها</AppLink>
        </>
      ) : (
        <AppLink className="text-link" href="/login/">
          برای ثبت درخواست وارد شو
        </AppLink>
      )}
    </details>
  );
}
export function ProductAlertsPage() {
  const c = useCommerce(),
    r = useResource<ProductAlert[]>(c.user ? "/v1/me/product-alerts" : null);
  return (
    <Gate>
      <Panel title="خبرم کن">
        <p className="muted">
          هشدار قیمت و موجودی در فعالیت‌ها نمایش داده می‌شود. قیمت و موجودی ممکن
          است پس از ارسال اعلان تغییر کنند.
        </p>
        <ErrorBox message={r.error} />
        {r.loading ? (
          <Loading />
        ) : r.data?.length ? (
          r.data.map((a) => (
            <article className="commerce-row" key={a.id}>
              <div>
                <AppLink href={"/product/?id=" + a.product_id}>
                  {a.title}
                </AppLink>
                <p>
                  {a.kind === "restock"
                    ? "وقتی موجود شد"
                    : "وقتی قیمت رسید به " + price(a.target_minor ?? "0")}
                </p>
                <small>
                  {a.active
                    ? "در انتظار"
                    : a.notified_at
                      ? "خبر داده شد"
                      : "لغوشده"}
                </small>
              </div>
              {a.active && (
                <Action
                  run={() =>
                    c.request("/v1/me/product-alerts/" + a.id, "DELETE")
                  }
                  done={r.reload}
                >
                  لغو درخواست
                </Action>
              )}
            </article>
          ))
        ) : (
          <Empty>از صفحهٔ کالا، هشدار قیمت یا موجودی ثبت کن.</Empty>
        )}
      </Panel>
    </Gate>
  );
}
