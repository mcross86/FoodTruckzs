import { PLAN_DRAFT_STORAGE_KEY, type PlanDraft } from "./plan-draft";

/** Matches `draftStorageKey` in rfq-wizard. */
export const RFQ_DRAFT_STORAGE_KEY = "foodtruckzs.rfqDraft.v1";

export type RfqSearchSeed = {
  budgetMaxCents?: string;
  budgetMinCents?: string;
  cuisine?: string;
  eventDate?: string;
  eventType?: string;
  guestCount?: string;
  serviceArea?: string;
};

export function migrateLegacyPlanDraft(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PLAN_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const plan = JSON.parse(raw) as PlanDraft;
    window.localStorage.removeItem(PLAN_DRAFT_STORAGE_KEY);

    return {
      budget: {
        budgetMaxDollars: plan.budgetMax || "",
        budgetMinDollars: plan.budgetMin || "",
      },
      eventBasics: {
        eventDate: plan.eventDate || "",
        eventName: plan.eventType ? `${plan.eventType} event` : "",
        eventType: plan.eventType || "",
        estimatedHeadcount: plan.guestCount || "",
      },
      foodRequirements: {
        cuisinesText: plan.cuisines || "",
      },
      serviceStyle: {
        serviceEndTime: plan.serviceDurationHours
          ? addHours(plan.eventDate, plan.serviceDurationHours)
          : undefined,
      },
      specialNotes: plan.specialRequirements || "",
      venue: {
        city: parseCityFromLocation(plan.eventLocation),
        line1: plan.eventLocation || "",
        venueName: plan.eventLocation || "",
      },
    };
  } catch {
    return null;
  }
}

function parseCityFromLocation(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(",").map((part) => part.trim());
  return parts[0] ?? trimmed;
}

function addHours(_date: string, hours: string): string | undefined {
  const duration = Number.parseFloat(hours);
  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  const startHour = 12;
  const endHour = Math.min(23, startHour + Math.round(duration));
  return `${String(endHour).padStart(2, "0")}:00`;
}

export function applySearchSeedToDraft<T extends Record<string, unknown>>(
  draft: T,
  seed: RfqSearchSeed,
): T {
  const eventBasics = { ...(draft.eventBasics as Record<string, unknown>) };
  const foodRequirements = { ...(draft.foodRequirements as Record<string, unknown>) };
  const budget = { ...(draft.budget as Record<string, unknown>) };
  const venue = { ...(draft.venue as Record<string, unknown>) };

  if (seed.eventType) {
    eventBasics.eventType = seed.eventType;
    if (!eventBasics.eventName) eventBasics.eventName = `${seed.eventType} event`;
  }
  if (seed.eventDate) eventBasics.eventDate = seed.eventDate;
  if (seed.guestCount) eventBasics.estimatedHeadcount = seed.guestCount;
  if (seed.cuisine) foodRequirements.cuisinesText = seed.cuisine;
  if (seed.serviceArea) {
    venue.city = parseCityFromLocation(seed.serviceArea);
    venue.line1 = seed.serviceArea;
    venue.venueName = seed.serviceArea;
  }
  if (seed.budgetMinCents) {
    const cents = Number.parseInt(seed.budgetMinCents, 10);
    if (Number.isFinite(cents)) budget.budgetMinDollars = String(Math.round(cents / 100));
  }
  if (seed.budgetMaxCents) {
    const cents = Number.parseInt(seed.budgetMaxCents, 10);
    if (Number.isFinite(cents)) budget.budgetMaxDollars = String(Math.round(cents / 100));
  }

  return {
    ...draft,
    budget,
    eventBasics,
    foodRequirements,
    venue,
  };
}
