import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { calculateAgreementFeeCents } from "../../modules/billing/billing-calculation.js";
import {
  calculatePaymentScheduleTotals,
  calculateQuoteTotals,
} from "../../modules/quotes/quote-calculation.js";
import {
  assertRfqTransition,
  canTransitionRfq,
  type RfqStatus,
} from "../../modules/rfqs/rfq-state-machine.js";
import { detectWarningsForCandidate } from "../../modules/scheduling/scheduling.service.js";
import type { CalendarEventRow } from "../../modules/scheduling/scheduling.repository.js";
import { requireGlobalRole } from "../../shared/auth/require-role.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";

const allowedTransitions: Array<[RfqStatus, RfqStatus]> = [
  ["draft", "submitted"],
  ["submitted", "vendor_reviewing"],
  ["vendor_reviewing", "clarification_requested"],
  ["vendor_reviewing", "quote_in_progress"],
  ["clarification_requested", "vendor_reviewing"],
  ["quote_in_progress", "quote_sent"],
  ["quote_sent", "negotiation"],
  ["quote_sent", "accepted"],
  ["negotiation", "quote_sent"],
  ["accepted", "agreement_pending"],
  ["agreement_pending", "agreement_signed"],
  ["agreement_signed", "deposit_paid"],
  ["deposit_paid", "confirmed"],
  ["confirmed", "completed"],
  ["confirmed", "cancelled"],
];

function requestWithContext(ctx: Partial<RequestContext>, params: Record<string, unknown> = {}) {
  return {
    params,
    requestContext: {
      globalRoles: [],
      requestId: "req_unit_policy",
      vendorMemberships: [],
      ...ctx,
    },
  } as FastifyRequest;
}

function calendarEvent(overrides: Partial<CalendarEventRow>): CalendarEventRow {
  return {
    cateringEventId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: null,
    endsAt: new Date("2026-06-01T18:00:00.000Z"),
    id: crypto.randomUUID(),
    isBlocking: false,
    location: null,
    notes: null,
    source: "manual",
    startsAt: new Date("2026-06-01T16:00:00.000Z"),
    status: "confirmed",
    title: "Existing event",
    type: "food_truck_location",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    vendorId: crypto.randomUUID(),
    ...overrides,
  } as CalendarEventRow;
}

describe("production-critical domain rules", () => {
  it("keeps RFQ lifecycle transitions explicit and rejects invalid jumps", () => {
    for (const [from, to] of allowedTransitions) {
      expect(canTransitionRfq(from, to), `${from} -> ${to}`).toBe(true);
      expect(() => assertRfqTransition(from, to)).not.toThrow();
    }

    expect(canTransitionRfq("cancelled", "quote_sent")).toBe(false);
    expect(() => assertRfqTransition("cancelled", "quote_sent")).toThrow(
      "RFQ cannot move from cancelled to quote_sent.",
    );
    expect(canTransitionRfq("agreement_signed", "confirmed")).toBe(false);
  });

  it("calculates customer-visible quote totals and ignores internal line items", () => {
    const totals = calculateQuoteTotals([
      { quantity: 100, type: "food", unitAmountCents: 1_500 },
      { quantity: 1, type: "service", unitAmountCents: 20_000 },
      { quantity: 1, type: "tax", unitAmountCents: 12_000 },
      { quantity: 1, type: "discount", unitAmountCents: 5_000 },
      { isInternal: true, quantity: 1, type: "fee", unitAmountCents: 999_999 },
    ]);

    expect(totals).toMatchObject({
      feesCents: 20_000,
      subtotalCents: 145_000,
      taxCents: 12_000,
      totalCents: 177_000,
    });
    expect(totals.lineItems.find((item) => item.type === "discount")?.totalAmountCents).toBe(
      -5_000,
    );
  });

  it("calculates payment schedule totals separately from platform billing", () => {
    expect(
      calculatePaymentScheduleTotals([
        { amountCents: 50_000, type: "deposit" },
        { amountCents: 125_000, type: "final_balance" },
      ]),
    ).toEqual({
      depositCents: 50_000,
      itemCount: 2,
      totalCents: 175_000,
    });
  });

  it("calculates platform agreement fees in basis points with no amount cap", () => {
    expect(calculateAgreementFeeCents(185_000, 750)).toBe(13_875);
    expect(calculateAgreementFeeCents(100_000_000, 750)).toBe(7_500_000);
    expect(calculateAgreementFeeCents(99_999, 250)).toBe(2_500);
  });

  it("detects hard conflicts, soft overlaps, and setup/travel buffer warnings", () => {
    const candidate = {
      endsAt: new Date("2026-06-01T18:00:00.000Z"),
      id: "candidate-event",
      startsAt: new Date("2026-06-01T16:00:00.000Z"),
    };
    const warnings = detectWarningsForCandidate(
      candidate,
      [
        calendarEvent({
          endsAt: new Date("2026-06-01T17:00:00.000Z"),
          isBlocking: true,
          startsAt: new Date("2026-06-01T15:00:00.000Z"),
          title: "Blocked prep",
          type: "blocked_time",
        }),
        calendarEvent({
          endsAt: new Date("2026-06-01T19:00:00.000Z"),
          startsAt: new Date("2026-06-01T17:30:00.000Z"),
          title: "Public vending",
          type: "food_truck_location",
        }),
        calendarEvent({
          endsAt: new Date("2026-06-01T15:30:00.000Z"),
          startsAt: new Date("2026-06-01T14:30:00.000Z"),
          title: "Nearby festival",
          type: "festival",
        }),
      ],
      {
        defaultSetupMinutes: 30,
        defaultTravelBufferMinutes: 30,
      } as never,
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      "hard_conflict",
      "overlap_warning",
      "tight_setup_travel_buffer",
    ]);
    expect(warnings.find((warning) => warning.code === "hard_conflict")?.isHard).toBe(true);
  });

  it("enforces global and vendor authorization policy helpers", async () => {
    const reply = {} as FastifyReply;
    const requireAdmin = requireGlobalRole(["platform_admin"]);
    const requireOwner = requireVendorMembership({ allowedRoles: ["owner"] });

    await expect(
      requireAdmin(requestWithContext({ userId: "user-1", globalRoles: ["customer"] }), reply),
    ).rejects.toMatchObject({ code: "ROLE_ACCESS_DENIED", httpStatus: 403 });
    await expect(
      requireOwner(
        requestWithContext(
          {
            userId: "user-1",
            vendorMemberships: [{ role: "viewer", status: "active", vendorId: "vendor-1" }],
          },
          { vendorId: "vendor-1" },
        ),
        reply,
      ),
    ).rejects.toMatchObject({ code: "VENDOR_ACCESS_DENIED", httpStatus: 403 });

    await expect(
      requireAdmin(
        requestWithContext({ userId: "admin-1", globalRoles: ["platform_admin"] }),
        reply,
      ),
    ).resolves.toBeUndefined();

    const vendorRequest = requestWithContext(
      {
        userId: "owner-1",
        vendorMemberships: [{ role: "owner", status: "active", vendorId: "vendor-1" }],
      },
      { vendorId: "vendor-1" },
    );
    await expect(requireOwner(vendorRequest, reply)).resolves.toBeUndefined();
    expect(vendorRequest.requestContext.activeVendorId).toBe("vendor-1");
  });
});
