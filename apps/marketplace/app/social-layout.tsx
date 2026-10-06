"use client";
import { usePathname } from "next/navigation";
import { SocialShell } from "@paymoon/ui";
import type { ReactNode } from "react";
export function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <SocialShell seller={false} pathname={usePathname()}>
      {children}
    </SocialShell>
  );
}
