"use client";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import type { User, Org, CartItem } from "@paymoon/contracts";
export type {
  User,
  Org,
  Variant,
  Product,
  Merchant,
  Address,
  Order,
  Ticket,
  Notice,
  CartItem,
} from "@paymoon/contracts";
class ApiFailure extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
type Client = {
  request: <T>(
    path: string,
    method?: string,
    body?: unknown,
    key?: string,
  ) => Promise<T>;
  user: User | null;
  ready: boolean;
  org: Org | null;
  orgs: Org[];
  setOrg: (id: string) => void;
  refresh: () => Promise<void>;
  login: (email: string, password: string, register: boolean) => Promise<void>;
  logout: () => Promise<void>;
  cart: CartItem[];
  setCart: (items: CartItem[]) => void;
  apiUrl: string;
  sessionError: string;
};
const Context = createContext<Client | null>(null);
export const price = (value: string | number = "0") =>
  `${new Intl.NumberFormat("fa-IR").format(BigInt(String(value || 0)) / 10n)} تومان`;
export const date = (value: string) =>
  new Date(value).toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export const status = (value: string) =>
  ({
    draft: "پیش‌نویس",
    published: "منتشرشده",
    archived: "آرشیو",
    pending_payment: "در انتظار پرداخت",
    paid: "پرداخت‌شده",
    fulfilling: "در حال آماده‌سازی",
    shipped: "ارسال‌شده",
    completed: "تحویل‌شده",
    cancelled: "لغوشده",
    refunded: "بازپرداخت‌شده",
    submitted: "در انتظار بررسی",
    approved: "تأییدشده",
    rejected: "نیازمند اصلاح",
    open: "باز",
    resolved: "پاسخ داده‌شده",
    owner: "مالک",
    admin: "مدیر",
    staff: "همکار",
    viewer: "مشاهده‌گر",
  })[value] ?? value;
export function CommerceProvider({
  children,
  apiUrl,
}: {
  children: ReactNode;
  apiUrl: string;
}) {
  const [authReady, setAuthReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [orgs, setOrgs] = useState<Org[]>([]),
    [orgId, setOrgId] = useState(""),
    [cart, setCartState] = useState<CartItem[]>([]),
    [token, setToken] = useState<string | null>(null);
  const native = Capacitor.isNativePlatform();
  const request = useCallback(
    async <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      key?: string,
    ): Promise<T> => {
      const res = await fetch(apiUrl.replace(/\/$/, "") + path, {
        method,
        credentials: "include",
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-Paymoon-Client": native ? "native" : "web",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(method === "POST"
            ? { "Idempotency-Key": key ?? crypto.randomUUID() }
            : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }).catch(() => {
        throw new ApiFailure(
          0,
          "ارتباط با پی‌مون برقرار نشد. اتصال اینترنت یا دسترسی سرور را بررسی کنید.",
        );
      });
      const data = await res
        .json()
        .catch(() => ({ message: "پاسخ سرور قابل خواندن نیست" }));
      if (!res.ok) {
        const messages: Record<number, string> = {
          400: "اطلاعات واردشده معتبر نیست؛ موارد فرم را بررسی کنید.",
          401: "برای ادامه وارد حساب شوید.",
          403: "اجازهٔ انجام این کار را ندارید.",
          404: "این مورد پیدا نشد.",
          409: "اطلاعات تغییر کرده یا موجودی کافی نیست. صفحه را تازه کنید.",
          422: "این تغییر با اطلاعات ثبت‌شده سازگار نیست.",
          429: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
          503: "سرویس هنوز تنظیم نشده یا موقتاً در دسترس نیست.",
        };
        throw new ApiFailure(
          res.status,
          messages[res.status] ?? `خطا در ارتباط با سرور (${res.status})`,
        );
      }
      return data as T;
    },
    [apiUrl, native, token],
  );
  const refresh = useCallback(async () => {
    setSessionError("");
    try {
      const u = await request<User>("/v1/identity/me");
      setUser(u);
      const list = await request<Org[]>("/v1/organizations");
      setOrgs(list);
      const stored = localStorage.getItem("paymoon.org");
      setOrgId(list.find((x) => x.id === stored)?.id ?? list[0]?.id ?? "");
    } catch (e) {
      if (e instanceof ApiFailure && e.statusCode === 401) {
        setUser(null);
        setOrgs([]);
        setOrgId("");
      } else
        setSessionError(
          e instanceof Error ? e.message : "دریافت اطلاعات حساب ناموفق بود.",
        );
    }
  }, [request]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (native) {
        const { SecureStorage } =
          await import("@aparajita/capacitor-secure-storage");
        const v = await SecureStorage.get("paymoon.session");
        if (active) setToken(typeof v === "string" ? v : null);
      }
      if (active) setReady(true);
    })().catch(() => setReady(true));
    return () => {
      active = false;
    };
  }, [native]);
  useEffect(() => {
    if (ready) void refresh().finally(() => setAuthReady(true));
  }, [ready, refresh]);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("paymoon.cart") ?? "[]",
      ) as CartItem[];
      if (Array.isArray(value))
        setCartState(
          value
            .filter(
              (x) =>
                typeof x.variantId === "string" &&
                Number.isInteger(x.quantity) &&
                x.quantity > 0,
            )
            .slice(0, 50),
        );
    } catch {
      setCartState([]);
    }
  }, []);
  const setCart = (items: CartItem[]) => {
    setCartState(items);
    localStorage.setItem("paymoon.cart", JSON.stringify(items));
  };
  const setOrg = (id: string) => {
    setOrgId(id);
    localStorage.setItem("paymoon.org", id);
  };
  const login = async (email: string, password: string, register: boolean) => {
    const result = await request<{ token?: string; user: User }>(
      "/v1/identity/" + (register ? "register" : "login"),
      "POST",
      { email, password },
    );
    if (native && result.token) {
      const { SecureStorage } =
        await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.set("paymoon.session", result.token);
      setToken(result.token);
    }
    setUser(result.user);
    setSessionError("");
    if (!native) await refresh();
  };
  const logout = async () => {
    await request("/v1/identity/session", "DELETE");
    if (native) {
      const { SecureStorage } =
        await import("@aparajita/capacitor-secure-storage");
      await SecureStorage.remove("paymoon.session");
    }
    setToken(null);
    setUser(null);
    setOrgs([]);
    setOrgId("");
    setCart([]);
  };
  return (
    <Context.Provider
      value={{
        request,
        user,
        ready: authReady,
        org: orgs.find((x) => x.id === orgId) ?? null,
        orgs,
        setOrg,
        refresh,
        login,
        logout,
        cart,
        setCart,
        apiUrl,
        sessionError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCommerce() {
  const c = useContext(Context);
  if (!c) throw new Error("CommerceProvider missing");
  return c;
}
const pendingReads = new WeakMap<object, Map<string, Promise<unknown>>>();
const publicProducts = new Map<string, unknown>();
export function primePublicProduct(
  product: import("@paymoon/contracts").Product,
) {
  publicProducts.set("/v1/marketplace/products/" + product.id, {
    ...product,
    variants: product.variants ?? [],
  });
  if (publicProducts.size > 100)
    publicProducts.delete(publicProducts.keys().next().value!);
}
export function useResource<T>(path: string | null) {
  const { request } = useCommerce();
  const [data, setData] = useState<T | null>(() =>
      path ? ((publicProducts.get(path) as T) ?? null) : null,
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!path),
    [version, setVersion] = useState(0);
  const previousPath = useRef<string | null>(null);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    let active = true;
    if (!path) {
      setData(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    if (previousPath.current !== path)
      setData((publicProducts.get(path) as T) ?? null);
    previousPath.current = path;
    let group = pendingReads.get(request);
    if (!group) {
      group = new Map();
      pendingReads.set(request, group);
    }
    let pending = group.get(path) as Promise<T> | undefined;
    if (!pending) {
      pending = request<T>(path);
      group.set(path, pending);
      void pending.finally(() => group!.delete(path)).catch(() => {});
    }
    void pending
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, request, version]);
  return { data, error, loading, reload };
}
export function useQuery(name: string) {
  return useSearchParams().get(name) ?? "";
}
