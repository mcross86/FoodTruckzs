"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { readPlanDraft, writePlanDraft, type PlanDraft } from "@/lib/plan-draft";

export function PlanPreferencesForm() {
  const router = useRouter();
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

  function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    writePlanDraft(draft);
    router.push(ROUTES.plan.account);
  }

  return (
    <form onSubmit={handleContinue}>
      <PlanStepper activeIndex={1} />
      <PlanFormPanel title="Step 2 — Catering preferences">
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Help vendors understand menu direction, budget, and service scope before they quote.
        </p>
        <PlanField label="Cuisine preferences">
          <input
            onChange={(event) => update("cuisines", event.target.value)}
            placeholder="Tacos, BBQ, vegetarian options"
            value={draft.cuisines}
          />
        </PlanField>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <PlanField label="Budget min (USD)">
            <input
              min="0"
              onChange={(event) => update("budgetMin", event.target.value)}
              placeholder="1500"
              type="number"
              value={draft.budgetMin}
            />
          </PlanField>
          <PlanField label="Budget max (USD)">
            <input
              min="0"
              onChange={(event) => update("budgetMax", event.target.value)}
              placeholder="4000"
              type="number"
              value={draft.budgetMax}
            />
          </PlanField>
        </div>
        <PlanField label="Number of trucks desired">
          <input
            min="1"
            onChange={(event) => update("trucksDesired", event.target.value)}
            type="number"
            value={draft.trucksDesired}
          />
        </PlanField>
        <PlanField label="Service duration (hours)">
          <input
            min="1"
            onChange={(event) => update("serviceDurationHours", event.target.value)}
            placeholder="3"
            type="number"
            value={draft.serviceDurationHours}
          />
        </PlanField>
        <PlanField label="Special requirements">
          <textarea
            onChange={(event) => update("specialRequirements", event.target.value)}
            placeholder="Dietary needs, alcohol service, power access, indoor backup..."
            rows={4}
            value={draft.specialRequirements}
          />
        </PlanField>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href={ROUTES.plan.event}
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
          <button type="submit">Continue</button>
        </div>
      </PlanFormPanel>
    </form>
  );
}
