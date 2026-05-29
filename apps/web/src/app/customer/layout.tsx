"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CustomerPortalGate } from "@/components/customer/customer-portal-gate";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/customer/login")) {
    return children;
  }

  return <CustomerPortalGate>{children}</CustomerPortalGate>;
}
