export type PlanDraft = {
  eventType: string;
  eventDate: string;
  eventLocation: string;
  guestCount: string;
  cuisines: string;
  budgetMin: string;
  budgetMax: string;
  trucksDesired: string;
  serviceDurationHours: string;
  specialRequirements: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export const PLAN_DRAFT_STORAGE_KEY = "ftz-plan-draft-v1";

export const emptyPlanDraft = (): PlanDraft => ({
  budgetMax: "",
  budgetMin: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  cuisines: "",
  eventDate: "",
  eventLocation: "",
  eventType: "",
  guestCount: "",
  serviceDurationHours: "",
  specialRequirements: "",
  trucksDesired: "1",
});

export function readPlanDraft(): PlanDraft {
  if (typeof window === "undefined") {
    return emptyPlanDraft();
  }

  try {
    const raw = window.localStorage.getItem(PLAN_DRAFT_STORAGE_KEY);
    if (!raw) return emptyPlanDraft();
    return { ...emptyPlanDraft(), ...(JSON.parse(raw) as Partial<PlanDraft>) };
  } catch {
    return emptyPlanDraft();
  }
}

export function writePlanDraft(draft: PlanDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

/** @deprecated Plan flow uses unified RFQ draft storage (`foodtruckzs.rfqDraft.v1`). */
export function planDraftToRfqSearchParams(draft: PlanDraft): URLSearchParams {
  const params = new URLSearchParams();
  params.set("from", "/plan/review");
  if (draft.eventType) params.set("eventType", draft.eventType);
  if (draft.eventDate) params.set("eventDate", draft.eventDate);
  if (draft.eventLocation) params.set("serviceArea", draft.eventLocation);
  if (draft.guestCount) params.set("guestCount", draft.guestCount);
  if (draft.cuisines) params.set("cuisine", draft.cuisines);
  if (draft.budgetMin) params.set("budgetMinCents", String(Number(draft.budgetMin) * 100));
  if (draft.budgetMax) params.set("budgetMaxCents", String(Number(draft.budgetMax) * 100));
  return params;
}
