"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { customerSignedOutStorageKey, useCustomerAuthSession } from "@/lib/auth-session";
import { setPlanGuestMode } from "@/lib/plan-guest-mode";

type CustomerPlanGatewayProps = {
  nextHref: string;
  returnTo: string;
};

const continueButtonStyle = {
  background: "#ffe66d",
  border: "none",
  borderRadius: 16,
  color: "#171b2a",
  cursor: "pointer",
  fontWeight: 800,
  padding: "12px 18px",
  textDecoration: "none",
} as const;

export function CustomerPlanGateway({ nextHref, returnTo }: CustomerPlanGatewayProps) {
  const router = useRouter();
  const session = useCustomerAuthSession();

  useEffect(() => {
    if (
      session.user &&
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(customerSignedOutStorageKey) === "1"
    ) {
      void session.logout();
      return;
    }

    if (!session.user) {
      return;
    }

    setPlanGuestMode(false);
    router.replace(ROUTES.customer.dashboard);
  }, [router, session.user]);

  function continueAsGuest() {
    setPlanGuestMode(true);
    router.push(nextHref);
  }

  if (session.user) {
    return (
      <p style={{ color: "#c5cbe0", margin: 0 }}>Opening your customer dashboard…</p>
    );
  }

  return (
    <>
      <p>
        <Link href={returnTo}>← Back</Link>
      </p>

      <header style={{ marginBottom: 20 }}>
        <p style={{ color: "#c785ff", fontWeight: 800, margin: "0 0 6px" }}>
          PLANNING AN EVENT
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Customer sign-in</h1>
        <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
          Sign in or create a free profile to save your catering request and receive quotes. You can
          also continue as a guest and build your event details first.
        </p>
      </header>

      <AuthSessionPanel
        requireCustomer
        session={session}
        showDevConnectionTools={false}
        title="Customer account"
      />

      <section
        style={{
          background: "rgba(255, 230, 109, 0.1)",
          border: "1px solid rgba(255, 230, 109, 0.35)",
          borderRadius: 18,
          display: "grid",
          gap: 12,
          marginTop: 20,
          padding: 18,
        }}
      >
        <p style={{ color: "#ffe66d", fontWeight: 800, margin: 0 }}>
          Prefer to explore first?
        </p>
        <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
          You can continue as a guest and fill in event details without signing in. A customer
          profile is required before you submit your RFQ so operators know who to quote and how to
          reach you.
        </p>
        <button
          onClick={continueAsGuest}
          style={{
            ...continueButtonStyle,
            background: "rgba(255, 255, 255, 0.1)",
            color: "#f8fafc",
          }}
          type="button"
        >
          Continue as guest
        </button>
      </section>

      <p style={{ color: "#8f96ac", fontSize: 14, marginTop: 24 }}>
        Already submitted a request?{" "}
        <Link href={ROUTES.customer.dashboard}>Open customer dashboard</Link>
      </p>
    </>
  );
}
