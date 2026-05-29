import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import { assertRfqTransition } from "../rfqs/rfq-state-machine.js";
import type {
  CalendarEventRow,
  SchedulingAgreementContext,
  SchedulingRepository,
  VendorOperatingSettingsRow,
} from "./scheduling.repository.js";
import type {
  CalendarEventType,
  CalendarView,
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
} from "./scheduling.dto.js";
import { calendarEventTypes } from "./scheduling.dto.js";
import { expandRecurringManualEvents } from "./scheduling.recurrence.js";

export type CalendarWarning = {
  code: "hard_conflict" | "overlap_warning" | "tight_setup_travel_buffer";
  eventIds: string[];
  isHard: boolean;
  message: string;
  severity: "conflict" | "warning";
};

export type CalendarEventResult = {
  cateringEventId: string | null;
  endsAt: Date;
  id: string;
  isBlocking: boolean;
  location: string | null;
  notes: string | null;
  source: string;
  startsAt: Date;
  status: string;
  title: string;
  type: string;
  warnings: CalendarWarning[];
};

export type CalendarViewResult = {
  events: CalendarEventResult[];
  groups: {
    date: string;
    eventIds: string[];
  }[];
  range: {
    startsFrom: Date;
    startsTo: Date;
  };
  vendorId: string;
  view: CalendarView;
  warnings: CalendarWarning[];
};

export type CreateCalendarEventResult = {
  event: CalendarEventResult;
  events?: CalendarEventResult[];
  recurrence?: {
    frequency: "weekly" | "biweekly";
    occurrencesCreated: number;
  };
  warnings: CalendarWarning[];
};

export type EventOperationsDetailResult = {
  agreement: {
    id: string | null;
    signedAt: Date | null;
    signedDocumentFileId: string | null;
    status: string | null;
  };
  agreedMenu: {
    lineItems: {
      description: string | null;
      name: string;
      quantity: number;
      totalAmountCents: number;
      type: string;
      unit: string;
    }[];
    menuSummary: string | null;
    serviceStyle: unknown;
  };
  calendarEvent: CalendarEventResult;
  contacts: {
    customer: Record<string, unknown> | null;
    onsite: {
      name: string | null;
      phone: string | null;
    };
  };
  documents: {
    agreementDownloadPath: string | null;
    agreementId: string | null;
    currentVersionId: string | null;
    documentFileId: string | null;
    signedDocumentFileId: string | null;
  };
  equipmentChecklist: {
    item: string;
    notes: string | null;
    quantity: number | null;
    required: boolean;
    status: "pending";
  }[];
  internalNotes: string | null;
  paymentStatus: {
    paidCents: number;
    payments: {
      amountCents: number;
      id: string;
      status: string;
      type: string;
    }[];
    schedule: {
      amountCents: number;
      dueAt: Date | null;
      id: string;
      label: string;
      paidAt: Date | null;
      status: string;
      type: string;
    }[];
    totalCents: number;
  };
  prepNotes: string[];
  runSheetStatus: "confirmed_catering" | "manual_event";
  staffingNotes: string[];
  venueLogistics: {
    address: {
      city: string;
      country: string;
      line1: string;
      line2: string | null;
      postalCode: string | null;
      state: string;
    } | null;
    details: Record<string, unknown>;
    eventEndsAt: Date;
    eventStartsAt: Date;
    guestCount: number | null;
    serviceWindow: {
      endsAt: unknown;
      startsAt: unknown;
    };
  };
  warnings: CalendarWarning[];
};

export type SchedulingService = {
  confirmAgreementAfterDeposit: (
    agreementId: string,
    options?: { paymentId?: string | null },
  ) => Promise<ConfirmedCalendarEventResult>;
  createManualEvent: (
    ctx: RequestContext,
    vendorId: string,
    input: CreateCalendarEventDto,
  ) => Promise<CreateCalendarEventResult>;
  getEventOperationsDetail: (
    ctx: RequestContext,
    vendorId: string,
    eventId: string,
  ) => Promise<EventOperationsDetailResult>;
  listCalendarEvents: (
    ctx: RequestContext,
    vendorId: string,
    query: ListCalendarEventsQueryDto,
  ) => Promise<CalendarViewResult>;
};

export type SchedulingServiceDeps = {
  repository: SchedulingRepository;
};

export type ConfirmedCalendarEventResult = {
  calendarEvent: CalendarEventResult;
  cateringEventId: string;
  created: boolean;
  warnings: CalendarWarning[];
};

type ConfirmEventRepository = Pick<
  SchedulingRepository,
  | "createAuditLog"
  | "createCalendarEvent"
  | "createCateringEvent"
  | "createOutboxEvent"
  | "createStatusHistory"
  | "findConfirmedCateringEventByAgreementId"
  | "findOperatingSettingsByVendorId"
  | "listRangeEventsForConflict"
  | "updateRfqStatus"
>;

type ConfirmEventContext = Pick<SchedulingAgreementContext, "agreement" | "rfq" | "vendor"> & {
  paymentScheduleItems: Pick<
    SchedulingAgreementContext["paymentScheduleItems"][number],
    "amountCents" | "status" | "type"
  >[];
};

function now(): Date {
  return new Date();
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function hasActiveVendorMembership(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function assertVendorRead(ctx: RequestContext, vendorId: string): void {
  if (isAdmin(ctx) || hasActiveVendorMembership(ctx, vendorId)) {
    return;
  }

  throw new AuthorizationError("Vendor access is required for this calendar.");
}

function assertValidDateRange(startsAt: Date, endsAt: Date): void {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ValidationError("Calendar event dates must be valid ISO datetimes.");
  }

  if (startsAt >= endsAt) {
    throw new ValidationError("Calendar event start time must be before end time.");
  }
}

function assertCalendarRange(startsFrom: Date, startsTo: Date): void {
  assertValidDateRange(startsFrom, startsTo);

  const rangeDays = (startsTo.getTime() - startsFrom.getTime()) / (24 * 60 * 60 * 1_000);
  if (rangeDays > 180) {
    throw new ValidationError("Calendar date range cannot exceed 180 days for MVP.");
  }
}

function parseTypes(value: string | undefined): CalendarEventType[] {
  if (!value) return [];

  const types = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const invalid = types.filter((type) => !(calendarEventTypes as readonly string[]).includes(type));

  if (invalid.length > 0) {
    throw new ValidationError("Calendar event type filter contains unsupported values.", {
      invalid,
    });
  }

  return types as CalendarEventType[];
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function minutes(value: number): number {
  return value * 60 * 1_000;
}

function eventOverlaps(
  left: Pick<CalendarEventRow, "endsAt" | "startsAt">,
  right: Pick<CalendarEventRow, "endsAt" | "startsAt">,
): boolean {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}

function isHardBlockingEvent(event: CalendarEventRow): boolean {
  if (event.status === "cancelled") {
    return false;
  }

  return (
    event.type === "confirmed_catering" ||
    event.type === "blocked_time" ||
    event.status === "blocking" ||
    event.isBlocking
  );
}

function bufferMinutes(settings: VendorOperatingSettingsRow | null): number {
  return (settings?.defaultSetupMinutes ?? 60) + (settings?.defaultTravelBufferMinutes ?? 30);
}

function warningForHardConflict(event: CalendarEventRow, candidateId?: string): CalendarWarning {
  return {
    code: "hard_conflict",
    eventIds: candidateId ? [candidateId, event.id] : [event.id],
    isHard: true,
    message: `Overlaps with blocking calendar event "${event.title}".`,
    severity: "conflict",
  };
}

function warningForSoftOverlap(event: CalendarEventRow, candidateId?: string): CalendarWarning {
  return {
    code: "overlap_warning",
    eventIds: candidateId ? [candidateId, event.id] : [event.id],
    isHard: false,
    message: `Overlaps with non-blocking calendar event "${event.title}".`,
    severity: "warning",
  };
}

function warningForBuffer(event: CalendarEventRow, candidateId?: string): CalendarWarning {
  return {
    code: "tight_setup_travel_buffer",
    eventIds: candidateId ? [candidateId, event.id] : [event.id],
    isHard: false,
    message: `Leaves less than the configured setup/travel buffer around "${event.title}".`,
    severity: "warning",
  };
}

export function detectWarningsForCandidate(
  candidate: Pick<CalendarEventRow, "endsAt" | "id" | "startsAt">,
  events: CalendarEventRow[],
  settings: VendorOperatingSettingsRow | null,
): CalendarWarning[] {
  const buffer = bufferMinutes(settings);
  const bufferedCandidate = {
    endsAt: new Date(candidate.endsAt.getTime() + minutes(buffer)),
    startsAt: new Date(candidate.startsAt.getTime() - minutes(buffer)),
  };

  return events
    .filter((event) => event.id !== candidate.id && event.status !== "cancelled")
    .flatMap((event) => {
      if (eventOverlaps(candidate, event)) {
        return [
          isHardBlockingEvent(event)
            ? warningForHardConflict(event, candidate.id)
            : warningForSoftOverlap(event, candidate.id),
        ];
      }

      if (eventOverlaps(bufferedCandidate, event)) {
        return [warningForBuffer(event, candidate.id)];
      }

      return [];
    });
}

function toCalendarEventResult(
  event: CalendarEventRow,
  warnings: CalendarWarning[] = [],
): CalendarEventResult {
  return {
    cateringEventId: event.cateringEventId,
    endsAt: event.endsAt,
    id: event.id,
    isBlocking: event.isBlocking,
    location: event.location,
    notes: event.notes,
    source: event.source,
    startsAt: event.startsAt,
    status: event.status,
    title: event.title,
    type: event.type,
    warnings,
  };
}

function hasRequiredDepositSatisfied(context: ConfirmEventContext): boolean {
  const requiredDeposits = context.paymentScheduleItems.filter(
    (item) => item.type === "deposit" && item.amountCents > 0,
  );

  return requiredDeposits.length === 0 || requiredDeposits.every((item) => item.status === "paid");
}

function assertCanConfirmContext(context: ConfirmEventContext): void {
  if (context.agreement.status !== "signed") {
    throw new ConflictError("Agreement must be signed before confirming a catering event.", {
      status: context.agreement.status,
    });
  }

  if (context.vendor.status !== "active" || context.vendor.deletedAt !== null) {
    throw new ConflictError("Vendor must remain active before confirming a catering event.", {
      status: context.vendor.status,
    });
  }

  if (!hasRequiredDepositSatisfied(context)) {
    throw new BusinessRuleError("Required deposit conditions are not satisfied.");
  }

  assertValidDateRange(context.rfq.startsAt, context.rfq.endsAt);
}

export async function confirmCateringEventFromContext(
  repo: ConfirmEventRepository,
  context: ConfirmEventContext,
  options: { confirmedAt: Date; paymentId?: string | null },
): Promise<ConfirmedCalendarEventResult> {
  assertCanConfirmContext(context);

  const existing = await repo.findConfirmedCateringEventByAgreementId(context.agreement.id);
  const settings = await repo.findOperatingSettingsByVendorId(context.agreement.vendorId);

  if (existing) {
    const relatedEvents = await repo.listRangeEventsForConflict(
      existing.calendarEvent.vendorId,
      new Date(existing.calendarEvent.startsAt.getTime() - minutes(bufferMinutes(settings))),
      new Date(existing.calendarEvent.endsAt.getTime() + minutes(bufferMinutes(settings))),
    );
    const warnings = detectWarningsForCandidate(existing.calendarEvent, relatedEvents, settings);
    return {
      calendarEvent: toCalendarEventResult(existing.calendarEvent, warnings),
      cateringEventId: existing.cateringEvent.id,
      created: false,
      warnings,
    };
  }

  const relatedEvents = await repo.listRangeEventsForConflict(
    context.agreement.vendorId,
    new Date(context.rfq.startsAt.getTime() - minutes(bufferMinutes(settings))),
    new Date(context.rfq.endsAt.getTime() + minutes(bufferMinutes(settings))),
  );
  const candidate = {
    endsAt: context.rfq.endsAt,
    id: "new-confirmed-event",
    startsAt: context.rfq.startsAt,
  };
  const warnings = detectWarningsForCandidate(candidate, relatedEvents, settings);
  const timestamp = options.confirmedAt;

  const cateringEvent = await repo.createCateringEvent({
    agreementId: context.agreement.id,
    customerUserId: context.agreement.customerUserId,
    endsAt: context.rfq.endsAt,
    rfqId: context.rfq.id,
    source: "agreement_deposit",
    startsAt: context.rfq.startsAt,
    status: "confirmed",
    title: context.rfq.eventName,
    updatedAt: timestamp,
    vendorId: context.agreement.vendorId,
    venueAddressId: context.rfq.venueAddressId,
  });
  const calendarEvent = await repo.createCalendarEvent({
    cateringEventId: cateringEvent.id,
    endsAt: context.rfq.endsAt,
    isBlocking: true,
    source: "system_deposit_confirmation",
    startsAt: context.rfq.startsAt,
    status: "confirmed",
    title: context.rfq.eventName,
    type: "confirmed_catering",
    updatedAt: timestamp,
    vendorId: context.agreement.vendorId,
    venueAddressId: context.rfq.venueAddressId,
  });

  if (context.rfq.status === "deposit_paid") {
    assertRfqTransition(context.rfq.status, "confirmed");
    await repo.updateRfqStatus(context.rfq.id, "confirmed", timestamp);
    await repo.createStatusHistory({
      actorUserId: null,
      fromStatus: "deposit_paid",
      metadata: {
        calendarEventId: calendarEvent.id,
        cateringEventId: cateringEvent.id,
        paymentId: options.paymentId ?? null,
        warnings,
      },
      reason: "Confirmed catering event created after required deposit conditions were satisfied.",
      rfqId: context.rfq.id,
      toStatus: "confirmed",
    });
  }

  await repo.createAuditLog({
    action: "calendar.confirmed_event_created",
    actorRole: "system",
    actorUserId: null,
    entityId: calendarEvent.id,
    entityType: "calendar_event",
    newState: {
      agreementId: context.agreement.id,
      cateringEventId: cateringEvent.id,
      status: "confirmed",
      warnings,
    },
    previousState: null,
    requestId: null,
    vendorId: context.agreement.vendorId,
  });
  await repo.createOutboxEvent({
    aggregateId: calendarEvent.id,
    aggregateType: "calendar_event",
    eventType: "calendar.confirmed_event_created",
    payload: {
      agreementId: context.agreement.id,
      calendarEventId: calendarEvent.id,
      cateringEventId: cateringEvent.id,
      conflictWarningCount: warnings.filter((warning) => warning.isHard).length,
      rfqId: context.rfq.id,
      vendorId: context.agreement.vendorId,
    },
    requestId: null,
  });

  return {
    calendarEvent: toCalendarEventResult(calendarEvent, warnings),
    cateringEventId: cateringEvent.id,
    created: true,
    warnings,
  };
}

function sectionsFor(
  context: SchedulingAgreementContext | null,
): Record<string, Record<string, unknown>> {
  if (!context) return {};

  return Object.fromEntries(
    context.requirements.map((requirement) => [requirement.label, requirement.details]),
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (candidate): candidate is Record<string, unknown> =>
          candidate !== null && typeof candidate === "object" && !Array.isArray(candidate),
      )
    : [];
}

function buildOperationsDetail(
  record: {
    agreementContext: SchedulingAgreementContext | null;
    calendarEvent: CalendarEventRow;
    cateringEvent: unknown;
    operatingSettings: VendorOperatingSettingsRow | null;
  },
  warnings: CalendarWarning[],
): EventOperationsDetailResult {
  const context = record.agreementContext;
  const sections = sectionsFor(context);
  const eventBasics = sections.event_basics ?? {};
  const venue = sections.venue_logistics ?? {};
  const service = sections.service_style ?? {};
  const equipment = sections.equipment ?? {};
  const notes = sections.attachments_and_notes ?? {};
  const equipmentRequests = arrayOfRecords(equipment.requests);
  const paymentSchedule = context?.paymentScheduleItems ?? [];
  const payments = context?.payments ?? [];
  const paidCents = paymentSchedule
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + item.amountCents, 0);
  const totalCents = paymentSchedule.reduce((total, item) => total + item.amountCents, 0);
  const staffingLineItems =
    context?.lineItems.filter((lineItem) => lineItem.type === "staffing") ?? [];

  return {
    agreement: {
      id: context?.agreement.id ?? null,
      signedAt: context?.agreement.signedAt ?? null,
      signedDocumentFileId: context?.agreement.signedDocumentFileId ?? null,
      status: context?.agreement.status ?? null,
    },
    agreedMenu: {
      lineItems:
        context?.lineItems
          .filter((lineItem) => !lineItem.isInternal)
          .map((lineItem) => ({
            description: lineItem.description,
            name: lineItem.name,
            quantity: lineItem.quantity,
            totalAmountCents: lineItem.totalAmountCents,
            type: lineItem.type,
            unit: lineItem.unit,
          })) ?? [],
      menuSummary: context?.quoteRevision.menuSummary ?? null,
      serviceStyle: context?.quoteRevision.serviceStyle ?? service.desiredServiceStyle ?? null,
    },
    calendarEvent: toCalendarEventResult(record.calendarEvent, warnings),
    contacts: {
      customer:
        eventBasics.primaryContact &&
        typeof eventBasics.primaryContact === "object" &&
        !Array.isArray(eventBasics.primaryContact)
          ? (eventBasics.primaryContact as Record<string, unknown>)
          : null,
      onsite: {
        name: stringOrNull(venue.onsiteContactName),
        phone: stringOrNull(venue.onsiteContactPhone),
      },
    },
    documents: {
      agreementDownloadPath: context?.agreement.id
        ? `/api/v1/agreements/${context.agreement.id}/download-url`
        : null,
      agreementId: context?.agreement.id ?? null,
      currentVersionId: context?.agreement.currentVersionId ?? null,
      documentFileId:
        context?.agreement.documentFileId ?? context?.currentVersion?.documentFileId ?? null,
      signedDocumentFileId: context?.agreement.signedDocumentFileId ?? null,
    },
    equipmentChecklist: equipmentRequests.map((request) => ({
      item: String(request.item ?? "Equipment item"),
      notes: stringOrNull(request.notes),
      quantity: typeof request.quantity === "number" ? request.quantity : null,
      required: request.required === true,
      status: "pending",
    })),
    internalNotes: record.calendarEvent.notes,
    paymentStatus: {
      paidCents,
      payments: payments.map((payment) => ({
        amountCents: payment.amountCents,
        id: payment.id,
        status: payment.status,
        type: payment.type,
      })),
      schedule: paymentSchedule.map((item) => ({
        amountCents: item.amountCents,
        dueAt: item.dueAt,
        id: item.id,
        label: item.label,
        paidAt: item.paidAt,
        status: item.status,
        type: item.type,
      })),
      totalCents,
    },
    prepNotes: [
      ...(context?.quoteRevision.assumptions ?? []),
      ...(context?.quoteRevision.exclusions.map((exclusion) => `Exclusion: ${exclusion}`) ?? []),
      ...(stringOrNull(notes.specialNotes)
        ? [`Special notes: ${stringOrNull(notes.specialNotes)}`]
        : []),
    ],
    runSheetStatus: context ? "confirmed_catering" : "manual_event",
    staffingNotes: [
      ...staffingLineItems.map(
        (lineItem) => `${lineItem.name}: ${lineItem.description ?? "staffing line item"}`,
      ),
      ...(service.servingStaffNeeded ? ["Serving staff requested."] : []),
      ...(service.cashierNeeded ? ["Cashier support requested."] : []),
      ...(service.cleanupStaffNeeded ? ["Cleanup staff requested."] : []),
    ],
    venueLogistics: {
      address: context?.address
        ? {
            city: context.address.city,
            country: context.address.country,
            line1: context.address.line1,
            line2: context.address.line2,
            postalCode: context.address.postalCode,
            state: context.address.state,
          }
        : null,
      details: venue,
      eventEndsAt: record.calendarEvent.endsAt,
      eventStartsAt: record.calendarEvent.startsAt,
      guestCount: context?.rfq.estimatedHeadcount ?? null,
      serviceWindow: {
        endsAt: service.serviceEndsAt ?? null,
        startsAt: service.serviceStartsAt ?? null,
      },
    },
    warnings,
  };
}

export function createSchedulingService(deps: SchedulingServiceDeps): SchedulingService {
  const { repository } = deps;

  return {
    async confirmAgreementAfterDeposit(agreementId, options = {}) {
      const context = await repository.findAgreementContextByAgreementId(agreementId);
      if (!context) {
        throw new NotFoundError("Agreement was not found for scheduling confirmation.");
      }

      return repository.transaction(async (repo) =>
        confirmCateringEventFromContext(repo, context, {
          confirmedAt: now(),
          paymentId: options.paymentId,
        }),
      );
    },

    async createManualEvent(ctx, vendorId, input) {
      assertVendorRead(ctx, vendorId);
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      assertValidDateRange(startsAt, endsAt);

      const vendor = await repository.findVendorById(vendorId);
      if (!vendor) {
        throw new NotFoundError("Vendor was not found.");
      }

      const occurrences = input.recurrence
        ? expandRecurringManualEvents(startsAt, endsAt, input.recurrence)
        : [{ endsAt, startsAt }];

      const createdAt = now();
      const defaultBlocking = input.type === "blocked_time" || input.type === "manual_booking";
      const isBlocking = input.isBlocking ?? defaultBlocking;
      const status = input.status ?? (isBlocking ? "blocking" : "confirmed");
      const settings = await repository.findOperatingSettingsByVendorId(vendorId);

      const rangeStart = Math.min(...occurrences.map((slot) => slot.startsAt.getTime()));
      const rangeEnd = Math.max(...occurrences.map((slot) => slot.endsAt.getTime()));
      const relatedEvents = await repository.listRangeEventsForConflict(
        vendorId,
        new Date(rangeStart - minutes(bufferMinutes(settings))),
        new Date(rangeEnd + minutes(bufferMinutes(settings))),
      );

      const createdEvents: CalendarEventRow[] = [];
      const allWarnings: CalendarWarning[] = [];

      for (const occurrence of occurrences) {
        const candidate = { endsAt: occurrence.endsAt, id: "new-manual-event", startsAt: occurrence.startsAt };
        const warnings = detectWarningsForCandidate(candidate, relatedEvents, settings);
        allWarnings.push(...warnings);

        const event = await repository.createCalendarEvent({
          createdByUserId: ctx.userId,
          endsAt: occurrence.endsAt,
          isBlocking,
          location: input.location,
          notes: input.notes,
          source: "manual",
          startsAt: occurrence.startsAt,
          status,
          title: input.title,
          type: input.type,
          updatedAt: createdAt,
          vendorId,
        });

        createdEvents.push(event);
        relatedEvents.push(event);
      }

      const primary = createdEvents[0]!;
      const primaryWarnings = detectWarningsForCandidate(primary, relatedEvents, settings);

      await repository.createAuditLog({
        action: "calendar.manual_event_created",
        actorRole: "vendor_user",
        actorUserId: ctx.userId ?? null,
        entityId: primary.id,
        entityType: "calendar_event",
        newState: {
          isBlocking: primary.isBlocking,
          occurrencesCreated: createdEvents.length,
          recurrence: input.recurrence ?? null,
          status: primary.status,
          type: primary.type,
          warnings: allWarnings,
        },
        previousState: null,
        requestId: ctx.requestId,
        vendorId,
      });

      const eventResults = createdEvents.map((event) =>
        toCalendarEventResult(
          event,
          detectWarningsForCandidate(event, relatedEvents, settings),
        ),
      );

      return {
        event: eventResults[0]!,
        events: eventResults.length > 1 ? eventResults : undefined,
        recurrence: input.recurrence
          ? {
              frequency: input.recurrence.frequency,
              occurrencesCreated: createdEvents.length,
            }
          : undefined,
        warnings: primaryWarnings,
      };
    },

    async listCalendarEvents(ctx, vendorId, query) {
      assertVendorRead(ctx, vendorId);
      const startsFrom = new Date(query.startsFrom);
      const startsTo = new Date(query.startsTo);
      assertCalendarRange(startsFrom, startsTo);

      const vendor = await repository.findVendorById(vendorId);
      if (!vendor) {
        throw new NotFoundError("Vendor was not found.");
      }

      const types = parseTypes(query.types);
      const [events, settings] = await Promise.all([
        repository.listCalendarEvents(vendorId, startsFrom, startsTo, types),
        repository.findOperatingSettingsByVendorId(vendorId),
      ]);
      const eventsWithWarnings = events.map((event) =>
        toCalendarEventResult(event, detectWarningsForCandidate(event, events, settings)),
      );
      const warnings = eventsWithWarnings.flatMap((event) => event.warnings);
      const groups = [...new Set(events.map((event) => dateKey(event.startsAt)))].map((date) => ({
        date,
        eventIds: events
          .filter((event) => dateKey(event.startsAt) === date)
          .map((event) => event.id),
      }));

      return {
        events: eventsWithWarnings,
        groups,
        range: {
          startsFrom,
          startsTo,
        },
        vendorId,
        view: query.view,
        warnings,
      };
    },

    async getEventOperationsDetail(ctx, vendorId, eventId) {
      assertVendorRead(ctx, vendorId);
      const record = await repository.findCalendarEventDetailById(vendorId, eventId);
      if (!record) {
        throw new NotFoundError("Calendar event was not found.");
      }

      const relatedEvents = await repository.listRangeEventsForConflict(
        vendorId,
        new Date(
          record.calendarEvent.startsAt.getTime() -
            minutes(bufferMinutes(record.operatingSettings)),
        ),
        new Date(
          record.calendarEvent.endsAt.getTime() + minutes(bufferMinutes(record.operatingSettings)),
        ),
      );
      const warnings = detectWarningsForCandidate(
        record.calendarEvent,
        relatedEvents,
        record.operatingSettings,
      );

      return buildOperationsDetail(record, warnings);
    },
  };
}
