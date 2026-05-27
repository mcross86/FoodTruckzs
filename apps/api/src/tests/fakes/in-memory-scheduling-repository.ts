import { randomUUID } from "node:crypto";

import type {
  agreementVersions,
  auditLogs,
  calendarEvents,
  cateringEvents,
  outboxEvents,
  payments,
  rfqStatusHistory,
} from "../../db/schema/index.js";
import type { RfqStatus } from "../../modules/rfqs/rfq-state-machine.js";
import type {
  CalendarEventDetailRecord,
  ConfirmedCateringEventRecord,
  SchedulingAgreementContext,
  SchedulingRepository,
} from "../../modules/scheduling/scheduling.repository.js";
import type { CalendarEventType } from "../../modules/scheduling/scheduling.dto.js";
import type { InMemoryAgreementRepository } from "./in-memory-agreement-repository.js";
import type { InMemoryQuoteRepository } from "./in-memory-quote-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AgreementVersionRow = typeof agreementVersions.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type CalendarEventRow = typeof calendarEvents.$inferSelect;
type CateringEventRow = typeof cateringEvents.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemorySchedulingRepository implements SchedulingRepository {
  readonly calendarEvents = new Map<string, CalendarEventRow>();
  readonly cateringEvents = new Map<string, CateringEventRow>();
  private paymentRows: ReadonlyMap<string, PaymentRow> = new Map();

  constructor(
    private readonly agreementRepository: InMemoryAgreementRepository,
    private readonly quoteRepository: InMemoryQuoteRepository,
    private readonly rfqRepository: InMemoryRfqRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
  ) {}

  connectPayments(paymentRows: ReadonlyMap<string, PaymentRow>): void {
    this.paymentRows = paymentRows;
  }

  async findVendorById(vendorId: string) {
    return this.vendorRepository.findVendorById(vendorId);
  }

  async findOperatingSettingsByVendorId(vendorId: string) {
    return this.vendorRepository.operatingSettings.get(vendorId) ?? null;
  }

  async listCalendarEvents(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
    types: CalendarEventType[] = [],
  ): Promise<CalendarEventRow[]> {
    return [...this.calendarEvents.values()]
      .filter(
        (event) =>
          event.vendorId === vendorId &&
          event.deletedAt === null &&
          event.startsAt < startsTo &&
          event.endsAt > startsFrom &&
          (types.length === 0 || types.includes(event.type)),
      )
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  }

  async listRangeEventsForConflict(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ): Promise<CalendarEventRow[]> {
    return this.listCalendarEvents(vendorId, startsFrom, startsTo);
  }

  async createCalendarEvent(input: typeof calendarEvents.$inferInsert): Promise<CalendarEventRow> {
    const createdAt = now();
    const event: CalendarEventRow = {
      cateringEventId: input.cateringEventId ?? null,
      createdAt,
      createdByUserId: input.createdByUserId ?? null,
      deletedAt: null,
      endsAt: input.endsAt,
      id: randomUUID(),
      isBlocking: input.isBlocking ?? false,
      location: input.location ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      startsAt: input.startsAt,
      status: input.status ?? "tentative",
      title: input.title,
      type: input.type,
      updatedAt: input.updatedAt ?? createdAt,
      vendorId: input.vendorId,
      venueAddressId: input.venueAddressId ?? null,
    };
    this.calendarEvents.set(event.id, event);
    return event;
  }

  async createCateringEvent(input: typeof cateringEvents.$inferInsert): Promise<CateringEventRow> {
    const createdAt = now();
    const event: CateringEventRow = {
      agreementId: input.agreementId ?? null,
      createdAt,
      customerUserId: input.customerUserId ?? null,
      deletedAt: null,
      endsAt: input.endsAt,
      id: randomUUID(),
      rfqId: input.rfqId ?? null,
      source: input.source ?? "agreement",
      startsAt: input.startsAt,
      status: input.status ?? "pending_deposit",
      title: input.title,
      updatedAt: input.updatedAt ?? createdAt,
      vendorId: input.vendorId,
      venueAddressId: input.venueAddressId ?? null,
    };
    this.cateringEvents.set(event.id, event);
    return event;
  }

  async findConfirmedCateringEventByAgreementId(
    agreementId: string,
  ): Promise<ConfirmedCateringEventRecord | null> {
    const cateringEvent = [...this.cateringEvents.values()].find(
      (event) => event.agreementId === agreementId && event.deletedAt === null,
    );

    if (!cateringEvent) return null;

    const calendarEvent = [...this.calendarEvents.values()].find(
      (event) => event.cateringEventId === cateringEvent.id && event.deletedAt === null,
    );

    return calendarEvent ? { calendarEvent, cateringEvent } : null;
  }

  async findCalendarEventDetailById(
    vendorId: string,
    eventId: string,
  ): Promise<CalendarEventDetailRecord | null> {
    const calendarEvent = this.calendarEvents.get(eventId);

    if (!calendarEvent || calendarEvent.vendorId !== vendorId || calendarEvent.deletedAt !== null) {
      return null;
    }

    const cateringEvent = calendarEvent.cateringEventId
      ? (this.cateringEvents.get(calendarEvent.cateringEventId) ?? null)
      : null;

    return {
      agreementContext: cateringEvent?.agreementId
        ? await this.findAgreementContextByAgreementId(cateringEvent.agreementId)
        : null,
      calendarEvent,
      cateringEvent,
      operatingSettings: await this.findOperatingSettingsByVendorId(vendorId),
    };
  }

  async findAgreementContextByAgreementId(
    agreementId: string,
  ): Promise<SchedulingAgreementContext | null> {
    const agreement = this.agreementRepository.agreements.get(agreementId);
    if (!agreement || agreement.deletedAt !== null) return null;

    const rfq = this.rfqRepository.rfqs.get(agreement.rfqId);
    const quote = this.quoteRepository.quotes.get(agreement.quoteId);
    const quoteRevision = this.quoteRepository.revisions.get(agreement.quoteRevisionId);
    const vendor = this.vendorRepository.vendors.get(agreement.vendorId);

    if (!rfq || !quote || !quoteRevision || !vendor) return null;

    const versions = [...this.agreementRepository.versions.values()]
      .filter((version) => version.agreementId === agreement.id)
      .sort((left, right) => left.versionNumber - right.versionNumber);
    const currentVersion =
      versions.find((version) => version.id === agreement.currentVersionId) ??
      (null as AgreementVersionRow | null);

    return {
      address: rfq.venueAddressId
        ? (this.rfqRepository.addresses.get(rfq.venueAddressId) ?? null)
        : null,
      agreement,
      currentVersion,
      lineItems: [...this.quoteRepository.lineItems.values()]
        .filter((lineItem) => lineItem.quoteRevisionId === quoteRevision.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      paymentScheduleItems: [...this.quoteRepository.paymentScheduleItems.values()]
        .filter((item) => item.agreementId === agreement.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      payments: [...this.paymentRows.values()]
        .filter((payment) => payment.agreementId === agreement.id)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      quote,
      quoteRevision,
      requirements: [...this.rfqRepository.requirements.values()]
        .filter((requirement) => requirement.rfqId === rfq.id)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      rfq,
      signedDocument: agreement.signedDocumentFileId
        ? (this.agreementRepository.files.get(agreement.signedDocumentFileId) ?? null)
        : null,
      vendor,
    };
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date) {
    return this.rfqRepository.updateRfqStatus(rfqId, status, updatedAt);
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    return this.rfqRepository.createStatusHistory(input);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    return this.rfqRepository.createAuditLog(input);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    return this.rfqRepository.createOutboxEvent(input);
  }

  async transaction<T>(callback: (repo: SchedulingRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }
}
