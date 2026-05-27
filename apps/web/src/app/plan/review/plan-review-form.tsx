"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { useAuthSession } from "@/lib/auth-session";
import {
  planDraftToRfqSearchParams,
  readPlanDraft,
  writePlanDraft,
  type PlanDraft,
} from "@/lib/plan-draft";

export function PlanReviewForm() {
  const router = useRouter();
  const session = useAuthSession();
  const [draft, setDraft] = useState<PlanDraft | null>(null);

  useEffect(() => {
    setDraft(readPlanDraft());
  }, []);

  if (!draft) {
    return <p style={{ color: "#c5cbe0" }}>Loading...</p>;
  }

  function update<K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function openFullRfqWizard() {
    if (!draft) return;
    writePlanDraft(draft);
    const params = planDraftToRfqSearchParams(draft);
    router.push(`${ROUTES.rfq.start}?${params.toString()}`);
  }

  return (
    <div>
      <PlanStepper activeIndex={3} />
      <PlanFormPanel title="Step 4 — Review and submit">
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Confirm your event packet. The full RFQ wizard captures venue logistics, service style,
          and equipment details operators need for accurate quotes.
        </p>
        <dl style={{ color: "#c5cbe0", display: "grid", gap: 8, margin: 0 }}>
          <div>
            <dt style={{ color: "#f8fafc", fontWeight: 800 }}>Event</dt>
            <dd style={{ margin: 0 }}>
              {draft.eventType || "—"} · {draft.eventDate || "—"} · {draft.guestCount || "—"} guests
            </dd>
          </div>
          <div>
            <dt style={{ color: "#f8fafc", fontWeight: 800 }}>Location</dt>
            <dd style={{ margin: 0 }}>{draft.eventLocation || "—"}</dd>
          </div>
          <div>
            <dt style={{ color: "#f8fafc", fontWeight: 800 }}>Preferences</dt>
            <dd style={{ margin: 0 }}>
              {draft.cuisines || "Any"} · ${draft.budgetMin || "?"}–${draft.budgetMax || "?"} ·{" "}
              {draft.trucksDesired} truck(s) · {draft.serviceDurationHours || "?"}h
            </dd>
          </div>
        </dl>
        <PlanField label="Contact name">
          <input
            onChange={(event) => update("contactName", event.target.value)}
            value={draft.contactName}
          />
        </PlanField>
        <PlanField label="Contact email">
          <input
            onChange={(event) => update("contactEmail", event.target.value)}
            type="email"
            value={draft.contactEmail}
          />
        </PlanField>
        <PlanField label="Contact phone">
          <input
            onChange={(event) => update("contactPhone", event.target.value)}
            value={draft.contactPhone}
          />
        </PlanField>
        {!session.user ? (
          <section style={{ background: "#ff9d66", borderRadius: 16, padding: 14 }}>
            <p style={{ color: "#171b2a", margin: "0 0 8px" }}>
              Sign in before submitting. Your plan draft is saved in this browser.
            </p>
            <Link href={ROUTES.plan.account} style={{ color: "#171b2a", fontWeight: 800 }}>
              Go to account step
            </Link>
          </section>
        ) : (
          <p style={{ color: "#9cf579", fontWeight: 800, margin: 0 }}>
            Signed in as {session.user.email}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href={ROUTES.plan.account}
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
          <button disabled={!session.user} onClick={openFullRfqWizard} type="button">
            Complete details & submit RFQ
          </button>
        </div>
      </PlanFormPanel>
    </div>
  );
}
