"use client";
import { usePathname } from "next/navigation";
import { RouteView, SocialShell } from "@paymoon/ui";
import type { ReactNode } from "react";
export function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <SocialShell seller={false} pathname={usePathname()}>
      <RouteView>{children}</RouteView>
    </SocialShell>
  );
}
