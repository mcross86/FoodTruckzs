import { ROUTES } from "@foodtruckzs/shared";

import { readPlanDraft, type PlanDraft } from "@/lib/plan-draft";
import { RFQ_DRAFT_STORAGE_KEY } from "@/lib/rfq-draft-hydration";
import { rfqApiRequest, type RfqDetail } from "@/lib/rfq-api";

export const LOCAL_DRAFT_RFQ_ID = "local-draft";

const VENDOR_RESPONSE_STATUSES = new Set([
  "clarification_requested",
  "negotiation",
  "quote_sent",
]);

const PAYMENT_ACTION_STATUSES = new Set(["accepted", "agreement_pending", "agreement_signed"]);

const WAITING_ON_VENDOR_STATUSES = new Set([
  "deposit_paid",
  "confirmed",
  "completed",
  "cancelled",
  "quote_in_progress",
  "submitted",
  "vendor_reviewing",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rfqDraftHasProgress(raw: string): boolean {
  try {
    const draft = JSON.parse(raw) as Record<string, unknown>;
    const eventBasics = draft.eventBasics as Record<string, unknown> | undefined;
    const review = draft.review as Record<string, unknown> | undefined;

    if (text(draft.targetVendorIdsText)) return true;
    if (text(eventBasics?.eventName)) return true;
    if (text(eventBasics?.estimatedHeadcount)) return true;
    if (review?.communicationAcknowledged === true || review?.quoteAcknowledged === true) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function planDraftHasProgress(plan: PlanDraft): boolean {
  return Boolean(
    plan.eventType.trim() ||
      plan.eventDate.trim() ||
      plan.eventLocation.trim() ||
      plan.guestCount.trim() ||
      plan.cuisines.trim(),
  );
}

function parseBudgetDollars(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function eventDateTimeIso(eventDate: string, time: string, fallbackHour: number): string {
  const datePart = text(eventDate) || new Date().toISOString().slice(0, 10);
  const timePart = text(time) || `${String(fallbackHour).padStart(2, "0")}:00`;
  const parsed = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function emptyRfqDetailShell(overrides: Partial<RfqDetail>): RfqDetail {
  return {
    address: null,
    attachments: [],
    completenessScore: 0,
    completenessStatus: "needs_review",
    event: {
      endsAt: new Date().toISOString(),
      estimatedHeadcount: 0,
      eventName: "Catering request in progress",
      eventType: "Event",
      indoorOutdoor: "outdoor",
      startsAt: new Date().toISOString(),
      timezone: "America/New_York",
    },
    messages: [],
    requirements: {},
    rfqId: LOCAL_DRAFT_RFQ_ID,
    rfqNumber: 0,
    riskFlags: [],
    status: "draft",
    statusHistory: [],
    threads: [],
    unreadMessageCount: 0,
    vendorTargets: [],
    ...overrides,
  };
}

function rfqWizardDraftToDetail(draft: Record<string, unknown>): RfqDetail {
  const eventBasics = (draft.eventBasics as Record<string, unknown> | undefined) ?? {};
  const venue = (draft.venue as Record<string, unknown> | undefined) ?? {};
  const budget = (draft.budget as Record<string, unknown> | undefined) ?? {};
  const eventName =
    text(eventBasics.eventName) ||
    (text(eventBasics.eventType) ? `${text(eventBasics.eventType)} event` : "Catering request in progress");
  const headcount = Number.parseInt(text(eventBasics.estimatedHeadcount), 10);
  const budgetMinCents = parseBudgetDollars(text(budget.budgetMinDollars));
  const budgetMaxCents = parseBudgetDollars(text(budget.budgetMaxDollars));

  return emptyRfqDetailShell({
    address: text(venue.city)
      ? {
          city: text(venue.city),
          country: text(venue.country) || "US",
          line1: text(venue.line1) || text(venue.venueName) || "Venue TBD",
          line2: text(venue.line2) || null,
          postalCode: text(venue.postalCode) || null,
          state: text(venue.state) || "",
        }
      : null,
    event: {
      endsAt: eventDateTimeIso(text(eventBasics.eventDate), text(eventBasics.endTime), 15),
      estimatedHeadcount: Number.isFinite(headcount) ? headcount : 0,
      eventName,
      eventType: text(eventBasics.eventType) || "Event",
      indoorOutdoor: text(venue.indoorOutdoor) || "outdoor",
      startsAt: eventDateTimeIso(text(eventBasics.eventDate), text(eventBasics.startTime), 11),
      timezone: text(eventBasics.timezone) || "America/New_York",
    },
    requirements: {
      budget: {
        ...(budgetMinCents !== null ? { budgetMinCents } : {}),
        ...(budgetMaxCents !== null ? { budgetMaxCents } : {}),
      },
    },
  });
}

function legacyPlanDraftToDetail(plan: PlanDraft): RfqDetail {
  const eventName = plan.eventType.trim()
    ? `${plan.eventType.trim()} event`
    : "Catering request in progress";
  const headcount = Number.parseInt(plan.guestCount.trim(), 10);
  const city = plan.eventLocation.split(",")[0]?.trim() ?? "";
  const budgetMinCents = parseBudgetDollars(plan.budgetMin);
  const budgetMaxCents = parseBudgetDollars(plan.budgetMax);

  return emptyRfqDetailShell({
    address: city
      ? {
          city,
          country: "US",
          line1: plan.eventLocation.trim() || "Venue TBD",
          line2: null,
          postalCode: null,
          state: "",
        }
      : null,
    event: {
      endsAt: eventDateTimeIso(plan.eventDate, "", 15),
      estimatedHeadcount: Number.isFinite(headcount) ? headcount : 0,
      eventName,
      eventType: plan.eventType.trim() || "Event",
      indoorOutdoor: "outdoor",
      startsAt: eventDateTimeIso(plan.eventDate, "", 11),
      timezone: "America/New_York",
    },
    requirements: {
      budget: {
        ...(budgetMinCents !== null ? { budgetMinCents } : {}),
        ...(budgetMaxCents !== null ? { budgetMaxCents } : {}),
      },
    },
  });
}

/** Local plan / RFQ wizard draft that has not been submitted yet. */
export function readLocalDraftAsRfqDetail(): RfqDetail | null {
  if (typeof window === "undefined") return null;

  const storedRfqDraft = window.localStorage.getItem(RFQ_DRAFT_STORAGE_KEY);
  if (storedRfqDraft && rfqDraftHasProgress(storedRfqDraft)) {
    try {
      return rfqWizardDraftToDetail(JSON.parse(storedRfqDraft) as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  const plan = readPlanDraft();
  if (planDraftHasProgress(plan)) {
    return legacyPlanDraftToDetail(plan);
  }

  return null;
}

export function hasUnsubmittedRfqDraft(): boolean {
  return readLocalDraftAsRfqDetail() !== null;
}

export function localDraftContinueHref(): string {
  if (typeof window === "undefined") {
    return ROUTES.plan.event;
  }

  const storedRfqDraft = window.localStorage.getItem(RFQ_DRAFT_STORAGE_KEY);
  if (storedRfqDraft) {
    try {
      const draft = JSON.parse(storedRfqDraft) as Record<string, unknown>;
      const review = draft.review as Record<string, unknown> | undefined;
      if (review?.communicationAcknowledged || review?.quoteAcknowledged) {
        return ROUTES.plan.review;
      }
    } catch {
      // fall through
    }
  }

  return ROUTES.plan.event;
}

export function isLocalDraftRfq(rfqId: string): boolean {
  return rfqId === LOCAL_DRAFT_RFQ_ID;
}

/** Prepend the browser draft as a Draft row when it is not yet on the server. */
export function mergeCustomerRfqsWithLocalDraft(rfqs: RfqDetail[]): RfqDetail[] {
  const localDraft = readLocalDraftAsRfqDetail();
  if (!localDraft) {
    return rfqs;
  }

  return [localDraft, ...rfqs];
}

export function rfqNeedsCustomerAction(rfq: RfqDetail): boolean {
  if (WAITING_ON_VENDOR_STATUSES.has(rfq.status)) {
    return false;
  }

  if (rfq.status === "draft") {
    return true;
  }

  if (rfq.unreadMessageCount > 0) {
    return true;
  }

  if (VENDOR_RESPONSE_STATUSES.has(rfq.status)) {
    return true;
  }

  if (PAYMENT_ACTION_STATUSES.has(rfq.status)) {
    return true;
  }

  return false;
}

export function countCustomerRfqPendingActions(rfqs: RfqDetail[]): number {
  return mergeCustomerRfqsWithLocalDraft(rfqs).filter((rfq) => rfqNeedsCustomerAction(rfq)).length;
}

export async function fetchCustomerRfqs(apiBaseUrl: string, accessToken: string): Promise<RfqDetail[]> {
  if (!accessToken.trim()) {
    return [];
  }

  const result = await rfqApiRequest<RfqDetail[]>({
    apiBaseUrl,
    path: "/api/v1/customers/me/rfqs",
    token: accessToken,
  });

  return result.ok && result.data ? result.data : [];
}

export async function customerHasRfqInProgress(
  apiBaseUrl: string,
  accessToken: string,
): Promise<boolean> {
  const rfqs = await fetchCustomerRfqs(apiBaseUrl, accessToken);
  return countCustomerRfqPendingActions(rfqs) > 0;
}
