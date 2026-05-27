"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isGatewayPath } from "@foodtruckzs/shared";

import { AppShell } from "./app-shell";
import { GatewayShell } from "./gateway-shell";

export function ShellRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const useGateway = isGatewayPath(pathname);

  if (useGateway) {
    return <GatewayShell>{children}</GatewayShell>;
  }

  return <AppShell>{children}</AppShell>;
}
