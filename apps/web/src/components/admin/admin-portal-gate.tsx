"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { useAdminAuthSession } from "@/lib/auth-session";

type AdminPortalGateProps = {
  children: ReactNode;
};

export function AdminPortalGate({ children }: AdminPortalGateProps) {
  const session = useAdminAuthSession();
  const router = useRouter();
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
    // Run once on mount after persona snapshot hydrates from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;

    if (!session.accessToken.trim() || !session.hasAdminAccess) {
      router.replace(ROUTES.admin.login);
    }
  }, [router, session.accessToken, session.hasAdminAccess, sessionChecked]);

  if (!sessionChecked || !session.accessToken.trim() || !session.hasAdminAccess) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", margin: "48px auto", maxWidth: 520 }}>
        <p style={{ color: "#c5cbe0" }}>Checking admin session…</p>
      </main>
    );
  }

  return <>{children}</>;
}
