"use client";
import { usePathname } from "next/navigation";
import { RouteView, SocialShell, useCommerce } from "@paymoon/ui";
import type { ReactNode } from "react";
export function SocialLayout({ children }: { children: ReactNode }) {
  const { org } = useCommerce();
  return (
    <SocialShell accountName={org?.slug} seller={true} pathname={usePathname()}>
      <RouteView>{children}</RouteView>
    </SocialShell>
  );
}
