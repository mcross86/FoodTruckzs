"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { useCustomerAuthSession } from "@/lib/auth-session";

type CustomerPortalGateProps = {
  children: ReactNode;
};

export function CustomerPortalGate({ children }: CustomerPortalGateProps) {
  const session = useCustomerAuthSession();
  const router = useRouter();
  const pathname = usePathname() ?? ROUTES.customer.dashboard;
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (session.accessToken.trim()) {
        await session.refreshMe();
      }
      if (!cancelled) {
        setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;

    if (!session.accessToken.trim() || !session.user) {
      const next = pathname.startsWith("/customer") ? pathname : ROUTES.customer.dashboard;
      router.replace(`${ROUTES.customer.login}?${new URLSearchParams({ next }).toString()}`);
    }
  }, [pathname, router, session.accessToken, session.user, sessionChecked]);

  if (!sessionChecked || !session.accessToken.trim() || !session.user) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", margin: "48px auto", maxWidth: 520 }}>
        <p style={{ color: "#c5cbe0" }}>Checking customer session…</p>
      </main>
    );
  }

  return <>{children}</>;
}
