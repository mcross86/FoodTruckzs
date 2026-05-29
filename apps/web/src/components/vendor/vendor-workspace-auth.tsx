"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { type AuthSessionState, useVendorAuthSession } from "@/lib/auth-session";

type VendorWorkspaceAuthProps = {
  session?: AuthSessionState;
};

export function vendorWorkspaceGateMessage(session: AuthSessionState): string | null {
  if (!session.accessToken.trim()) {
    return "Sign in to your vendor workspace to continue.";
  }

  if (!session.activeVendorId.trim()) {
    return "Your vendor owner account is signed in, but no food truck profile is linked yet. Finish vendor registration or operational setup first.";
  }

  return null;
}

/** Login / registration auth panel. Signed-in vendor pages use VendorPortalGate instead. */
export function VendorWorkspaceAuth({ session: sessionProp }: VendorWorkspaceAuthProps) {
  const sessionFromHook = useVendorAuthSession();
  const session = sessionProp ?? sessionFromHook;
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  const canEnterDashboard =
    session.accessToken.trim() !== "" &&
    session.hasVendorAccess &&
    session.activeVendorId.trim() !== "";

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
    // Validate stored session once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionChecked || !canEnterDashboard) return;
    router.replace(ROUTES.vendor.dashboard);
  }, [canEnterDashboard, router, sessionChecked]);

  if (!sessionChecked) {
    return <p style={{ color: "#c5cbe0", margin: 0 }}>Checking vendor session…</p>;
  }

  if (canEnterDashboard) {
    return <p style={{ color: "#c5cbe0", margin: 0 }}>Opening vendor dashboard…</p>;
  }

  return (
    <AuthSessionPanel
      requireVendor
      session={session}
      showDevConnectionTools={false}
      title="Vendor account"
    />
  );
}
