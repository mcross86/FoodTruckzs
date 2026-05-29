"use client";

import { useEffect } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { accountLabel, useCustomerAuthSession } from "@/lib/auth-session";
import { setPlanGuestMode } from "@/lib/plan-guest-mode";

type PlanAccountStepProps = {
  onSignedIn: () => void;
};

export function PlanAccountStep({ onSignedIn }: PlanAccountStepProps) {
  const session = useCustomerAuthSession();

  useEffect(() => {
    if (!session.user || session.isAuthLoading) return;

    setPlanGuestMode(false);
    onSignedIn();
  }, [onSignedIn, session.isAuthLoading, session.user]);

  if (session.user) {
    return (
      <section
        style={{
          background: "rgba(37, 41, 58, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 18,
          display: "grid",
          gap: 12,
          padding: 18,
        }}
      >
        <p style={{ color: "#9cf579", fontWeight: 800, margin: 0 }}>
          Signed in as {accountLabel({ user: session.user })}
        </p>
        <p style={{ color: "#c5cbe0", margin: 0 }}>Continuing to review…</p>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <header>
        <p style={{ color: "#c785ff", fontWeight: 800, margin: "0 0 6px" }}>PLANNING AN EVENT</p>
        <h2 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Sign in to submit your request</h2>
        <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
          A free customer profile is required before you submit your RFQ so operators know who to
          quote and how to reach you. Sign in or create a profile to continue.
        </p>
      </header>

      <AuthSessionPanel
        requireCustomer
        session={session}
        showDevConnectionTools={false}
        title="Customer account"
      />
    </section>
  );
}
