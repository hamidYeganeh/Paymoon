import type { ReactNode } from "react";
export function Shell({
  title,
  children,
  links = [],
}: {
  title: string;
  children: ReactNode;
  links?: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="shell">
      <header>
        <strong>Paymoon</strong>
        <span>{title}</span>
      </header>
      <div className="workspace">
        <nav aria-label="منوی اصلی">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <main>{children}</main>
      </div>
      <footer>زیرساخت تجارت فروشگاه‌های اجتماعی</footer>
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export {
  SocialShell,
  SocialIcon,
  ProfileView,
  StoryStrip,
  DesignPreview,
} from "./social";
