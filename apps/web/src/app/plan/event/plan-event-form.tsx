"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { PlanStepper } from "@/components/plan/plan-stepper";
import { emptyPlanDraft, readPlanDraft, writePlanDraft, type PlanDraft } from "@/lib/plan-draft";

const eventTypes = [
  "Wedding",
  "Corporate lunch",
  "Office catering",
  "Birthday",
  "Festival",
  "School event",
  "Private party",
  "Community event",
  "Other",
];

export function PlanEventForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<PlanDraft>(emptyPlanDraft);

  useEffect(() => {
    setDraft(readPlanDraft());
  }, []);

  function update<K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    writePlanDraft(draft);
    router.push(ROUTES.plan.preferences);
  }

  return (
    <form onSubmit={handleContinue}>
      <PlanStepper activeIndex={0} />
      <PlanFormPanel title="Step 1 — Event basics">
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Tell operators when and where your event happens. You can continue without signing in.
        </p>
        <PlanField label="Event type">
          <select
            onChange={(event) => update("eventType", event.target.value)}
            required
            value={draft.eventType}
          >
            <option value="">Select event type</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </PlanField>
        <PlanField label="Event date">
          <input
            onChange={(event) => update("eventDate", event.target.value)}
            required
            type="date"
            value={draft.eventDate}
          />
        </PlanField>
        <PlanField label="Event location (city, venue, or address)">
          <input
            onChange={(event) => update("eventLocation", event.target.value)}
            placeholder="Atlanta, GA or venue address"
            required
            value={draft.eventLocation}
          />
        </PlanField>
        <PlanField label="Estimated guest count">
          <input
            min="1"
            onChange={(event) => update("guestCount", event.target.value)}
            placeholder="150"
            required
            type="number"
            value={draft.guestCount}
          />
        </PlanField>
        <button type="submit">Continue to preferences</button>
      </PlanFormPanel>
    </form>
  );
}
