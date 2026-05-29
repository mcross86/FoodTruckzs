"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { VendorPortalGate } from "@/components/vendor/vendor-portal-gate";

const PUBLIC_VENDOR_PATHS = [ROUTES.vendor.login, ROUTES.vendor.register] as const;

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  if (PUBLIC_VENDOR_PATHS.includes(pathname as (typeof PUBLIC_VENDOR_PATHS)[number])) {
    return children;
  }

  return <VendorPortalGate>{children}</VendorPortalGate>;
}
