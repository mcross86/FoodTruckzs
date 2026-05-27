import { ConflictError } from "../../shared/errors/app-error.js";

export const RFQ_STATUSES = [
  "draft",
  "submitted",
  "vendor_reviewing",
  "clarification_requested",
  "quote_in_progress",
  "quote_sent",
  "negotiation",
  "accepted",
  "agreement_pending",
  "agreement_signed",
  "deposit_paid",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type RfqStatus = (typeof RFQ_STATUSES)[number];

const allowedTransitions: Record<RfqStatus, RfqStatus[]> = {
  accepted: ["agreement_pending"],
  agreement_pending: ["agreement_signed", "cancelled"],
  agreement_signed: ["deposit_paid"],
  cancelled: [],
  clarification_requested: ["vendor_reviewing", "cancelled"],
  completed: [],
  confirmed: ["completed", "cancelled"],
  deposit_paid: ["confirmed"],
  draft: ["submitted"],
  negotiation: ["quote_sent", "accepted"],
  quote_in_progress: ["quote_sent"],
  quote_sent: ["negotiation", "accepted", "cancelled"],
  submitted: ["vendor_reviewing", "cancelled"],
  vendor_reviewing: ["clarification_requested", "quote_in_progress", "cancelled"],
};

export function canTransitionRfq(from: RfqStatus, to: RfqStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertRfqTransition(from: RfqStatus, to: RfqStatus): void {
  if (!canTransitionRfq(from, to)) {
    throw new ConflictError(`RFQ cannot move from ${from} to ${to}.`, {
      from,
      to,
    });
  }
}
