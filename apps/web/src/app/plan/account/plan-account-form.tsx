"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { PlanFormPanel } from "@/components/plan/plan-form-panel";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { useAuthSession } from "@/lib/auth-session";
import { readPlanDraft } from "@/lib/plan-draft";

export function PlanAccountForm() {
  const router = useRouter();
  const session = useAuthSession();
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const draft = readPlanDraft();
    setHasDraft(Boolean(draft.eventType && draft.eventDate && draft.guestCount));
  }, []);

  return (
    <div>
      <PlanStepper activeIndex={2} />
      <PlanFormPanel title="Step 3 — Create your account">
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Create your free account to submit your request and receive quotes from food trucks.
          Google and Apple sign-in are planned; email and password work today.
        </p>
        {!hasDraft ? (
          <section style={{ background: "#ff9d66", borderRadius: 16, padding: 14 }}>
            <p style={{ color: "#171b2a", margin: 0 }}>
              Complete event basics first so your draft is saved.
            </p>
            <Link href={ROUTES.plan.event} style={{ color: "#171b2a", fontWeight: 800 }}>
              Go to event basics
            </Link>
          </section>
        ) : null}
        <AuthSessionPanel requireCustomer session={session} title="Customer account" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href={ROUTES.plan.preferences}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: 999,
              color: "#f8fafc",
              fontWeight: 700,
              padding: "10px 14px",
            }}
          >
            Back
          </Link>
          <button
            disabled={!session.user}
            onClick={() => router.push(ROUTES.plan.review)}
            type="button"
          >
            Continue to review
          </button>
        </div>
      </PlanFormPanel>
    </div>
  );
}
