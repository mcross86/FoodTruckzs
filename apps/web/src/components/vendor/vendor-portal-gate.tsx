"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { useVendorAuthSession } from "@/lib/auth-session";

type VendorPortalGateProps = {
  children: ReactNode;
};

export function VendorPortalGate({ children }: VendorPortalGateProps) {
  const session = useVendorAuthSession();
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

    if (!session.accessToken.trim()) {
      router.replace(ROUTES.vendor.login);
    }
  }, [router, session.accessToken, sessionChecked]);

  if (!sessionChecked || !session.accessToken.trim()) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", margin: "48px auto", maxWidth: 520 }}>
        <p style={{ color: "#c5cbe0" }}>Checking vendor session…</p>
      </main>
    );
  }

  return <>{children}</>;
}
