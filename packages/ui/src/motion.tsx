"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { Ssgoi, type SsgoiConfig } from "@ssgoi/react";
import { drill, sheet, slide, zoom } from "@ssgoi/react/view-transitions";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { SocialIcon } from "./icons";
export { default as AppLink } from "next/link";
export type Theme = "light" | "dark" | "system";
const Appearance = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });
export const useAppearance = () => useContext(Appearance);
export function MotionProvider({
  children,
  seller = false,
}: {
  children: ReactNode;
  seller?: boolean;
}) {
  const [reduced, setReduced] = useState(false),
    [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    const saved = localStorage.getItem("paymoon.theme");
    if (saved === "light" || saved === "dark" || saved === "system")
      setThemeState(saved);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.style.colorScheme =
        document.documentElement.dataset.theme;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const config = useMemo<SsgoiConfig>(
    () => ({
      transitions: reduced
        ? []
        : [
            ...(!seller
              ? [
                  {
                    from: ["/search", "/saved", "/shop/*"],
                    to: "/product/*",
                    transition: zoom({ type: "static" }),
                  },
                ]
              : []),
            {
              ordered: [
                "/seller-grid/published",
                "/seller-grid/draft",
                "/seller-grid/archived",
              ],
              transition: slide(),
              preserveScroll: "shared",
            },
            { on: "/products/new", transition: sheet() },
            { on: "/comments/*", transition: sheet() },
            {
              on: [
                "/product/*",
                "/shop/*",
                "/order/*",
                "/checkout",
                "/addresses",
                "/following",
                "/instagram",
                "/team",
                "/ledger",
                "/support",
                "/settings/**",
                "/login",
                "/register",
                "/returns/**",
                "/messages/**",
              ],
              transition: drill(),
            },
            {
              ordered: seller ? ["/", "/products"] : ["/profile", "/saved"],
              preserveScroll: "shared",
              transition: slide(),
            },
          ],
    }),
    [reduced, seller],
  );
  return (
    <Appearance.Provider
      value={{
        theme,
        setTheme: (value) => {
          localStorage.setItem("paymoon.theme", value);
          setThemeState(value);
        },
      }}
    >
      <Ssgoi config={config}>{children}</Ssgoi>
    </Appearance.Provider>
  );
}
function ResolvedRoute({ children }: { children: ReactNode }) {
  const pathname = (usePathname() || "/").replace(/\/$/, "") || "/",
    params = useSearchParams();
  const value =
    pathname === "/shop"
      ? params.get("slug")
      : ["/product", "/order", "/comments"].includes(pathname)
        ? params.get("id")
        : null;
  const id = value ? `${pathname}/${encodeURIComponent(value)}` : pathname;
  return (
    <div key={id} data-ssgoi-transition={id} className="route-view">
      {children}
    </div>
  );
}
export function RouteView({ children }: { children: ReactNode }) {
  return (
    <div className="route-stage">
      <Suspense
        fallback={
          <div
            className="route-skeleton"
            role="status"
            aria-label="در حال بارگذاری صفحه"
          />
        }
      >
        <ResolvedRoute>{children}</ResolvedRoute>
      </Suspense>
    </div>
  );
}
export function BackButton({
  fallback = "/",
  className = "icon-link",
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      className={className}
      aria-label="بازگشت"
      onClick={() => {
        if (history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <SocialIcon name="chevron" />
    </button>
  );
}
