import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  addresses,
  agreements,
  agreementVersions,
  auditLogs,
  calendarEvents,
  cateringEvents,
  files,
  outboxEvents,
  payments,
  paymentScheduleItems,
  quoteLineItems,
  quoteRevisions,
  quotes,
  rfqs,
  rfqRequirements,
  rfqStatusHistory,
  vendorOperatingSettings,
  vendors,
} from "../../db/schema/index.js";
import type { RfqStatus } from "../rfqs/rfq-state-machine.js";
import type { CalendarEventType } from "./scheduling.dto.js";

type SchedulingDb = Database | Transaction;

export type AddressRow = typeof addresses.$inferSelect;
export type AgreementRow = typeof agreements.$inferSelect;
export type AgreementVersionRow = typeof agreementVersions.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type CateringEventRow = typeof cateringEvents.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
export type QuoteLineItemRow = typeof quoteLineItems.$inferSelect;
export type QuoteRevisionRow = typeof quoteRevisions.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type RfqRequirementRow = typeof rfqRequirements.$inferSelect;
export type RfqRow = typeof rfqs.$inferSelect;
export type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
export type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
export type VendorRow = typeof vendors.$inferSelect;

export type SchedulingAgreementContext = {
  address: AddressRow | null;
  agreement: AgreementRow;
  currentVersion: AgreementVersionRow | null;
  lineItems: QuoteLineItemRow[];
  paymentScheduleItems: PaymentScheduleItemRow[];
  payments: PaymentRow[];
  quote: QuoteRow;
  quoteRevision: QuoteRevisionRow;
  requirements: RfqRequirementRow[];
  rfq: RfqRow;
  signedDocument: FileRow | null;
  vendor: VendorRow;
};

export type CalendarEventDetailRecord = {
  agreementContext: SchedulingAgreementContext | null;
  calendarEvent: CalendarEventRow;
  cateringEvent: CateringEventRow | null;
  operatingSettings: VendorOperatingSettingsRow | null;
};

export type ConfirmedCateringEventRecord = {
  calendarEvent: CalendarEventRow;
  cateringEvent: CateringEventRow;
};

export type SchedulingRepository = {
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createCalendarEvent: (input: typeof calendarEvents.$inferInsert) => Promise<CalendarEventRow>;
  createCateringEvent: (input: typeof cateringEvents.$inferInsert) => Promise<CateringEventRow>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createStatusHistory: (
    input: typeof rfqStatusHistory.$inferInsert,
  ) => Promise<RfqStatusHistoryRow>;
  findAgreementContextByAgreementId: (
    agreementId: string,
  ) => Promise<SchedulingAgreementContext | null>;
  findCalendarEventDetailById: (
    vendorId: string,
    eventId: string,
  ) => Promise<CalendarEventDetailRecord | null>;
  findConfirmedCateringEventByAgreementId: (
    agreementId: string,
  ) => Promise<ConfirmedCateringEventRecord | null>;
  findOperatingSettingsByVendorId: (vendorId: string) => Promise<VendorOperatingSettingsRow | null>;
  findVendorById: (vendorId: string) => Promise<VendorRow | null>;
  listCalendarEvents: (
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
    types?: CalendarEventType[],
  ) => Promise<CalendarEventRow[]>;
  listRangeEventsForConflict: (
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ) => Promise<CalendarEventRow[]>;
  transaction: <T>(callback: (repo: SchedulingRepository) => Promise<T>) => Promise<T>;
  updateRfqStatus: (rfqId: string, status: RfqStatus, updatedAt: Date) => Promise<RfqRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleSchedulingRepository implements SchedulingRepository {
  constructor(private readonly db: SchedulingDb) {}

  async findVendorById(vendorId: string): Promise<VendorRow | null> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .limit(1);
    return vendor ?? null;
  }

  async findOperatingSettingsByVendorId(
    vendorId: string,
  ): Promise<VendorOperatingSettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(vendorOperatingSettings)
      .where(eq(vendorOperatingSettings.vendorId, vendorId))
      .limit(1);
    return settings ?? null;
  }

  async listCalendarEvents(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
    types: CalendarEventType[] = [],
  ): Promise<CalendarEventRow[]> {
    const conditions = [
      eq(calendarEvents.vendorId, vendorId),
      isNull(calendarEvents.deletedAt),
      lt(calendarEvents.startsAt, startsTo),
      gt(calendarEvents.endsAt, startsFrom),
    ];

    if (types.length > 0) {
      conditions.push(inArray(calendarEvents.type, types));
    }

    return this.db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startsAt), asc(calendarEvents.endsAt));
  }

  async listRangeEventsForConflict(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ): Promise<CalendarEventRow[]> {
    return this.listCalendarEvents(vendorId, startsFrom, startsTo);
  }

  async createCalendarEvent(input: typeof calendarEvents.$inferInsert): Promise<CalendarEventRow> {
    const [event] = await this.db.insert(calendarEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async createCateringEvent(input: typeof cateringEvents.$inferInsert): Promise<CateringEventRow> {
    const [event] = await this.db.insert(cateringEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async findConfirmedCateringEventByAgreementId(
    agreementId: string,
  ): Promise<ConfirmedCateringEventRecord | null> {
    const [cateringEvent] = await this.db
      .select()
      .from(cateringEvents)
      .where(and(eq(cateringEvents.agreementId, agreementId), isNull(cateringEvents.deletedAt)))
      .limit(1);

    if (!cateringEvent) return null;

    const [calendarEvent] = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.cateringEventId, cateringEvent.id), isNull(calendarEvents.deletedAt)),
      )
      .limit(1);

    return calendarEvent ? { calendarEvent, cateringEvent } : null;
  }

  async findCalendarEventDetailById(
    vendorId: string,
    eventId: string,
  ): Promise<CalendarEventDetailRecord | null> {
    const [calendarEvent] = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, eventId),
          eq(calendarEvents.vendorId, vendorId),
          isNull(calendarEvents.deletedAt),
        ),
      )
      .limit(1);

    if (!calendarEvent) return null;

    const [cateringEvent] = calendarEvent.cateringEventId
      ? await this.db
          .select()
          .from(cateringEvents)
          .where(
            and(
              eq(cateringEvents.id, calendarEvent.cateringEventId),
              isNull(cateringEvents.deletedAt),
            ),
          )
          .limit(1)
      : [];

    const [operatingSettings, agreementContext] = await Promise.all([
      this.findOperatingSettingsByVendorId(vendorId),
      cateringEvent?.agreementId
        ? this.findAgreementContextByAgreementId(cateringEvent.agreementId)
        : Promise.resolve(null),
    ]);

    return {
      agreementContext,
      calendarEvent,
      cateringEvent: cateringEvent ?? null,
      operatingSettings,
    };
  }

  async findAgreementContextByAgreementId(
    agreementId: string,
  ): Promise<SchedulingAgreementContext | null> {
    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, agreementId), isNull(agreements.deletedAt)))
      .limit(1);

    if (!agreement) return null;

    const [rfqRows, quoteRows, revisionRows, vendorRows, versionRows, scheduleRows, paymentRows] =
      await Promise.all([
        this.db
          .select()
          .from(rfqs)
          .where(and(eq(rfqs.id, agreement.rfqId), isNull(rfqs.deletedAt)))
          .limit(1),
        this.db
          .select()
          .from(quotes)
          .where(and(eq(quotes.id, agreement.quoteId), isNull(quotes.deletedAt)))
          .limit(1),
        this.db
          .select()
          .from(quoteRevisions)
          .where(eq(quoteRevisions.id, agreement.quoteRevisionId))
          .limit(1),
        this.db.select().from(vendors).where(eq(vendors.id, agreement.vendorId)).limit(1),
        agreement.currentVersionId
          ? this.db
              .select()
              .from(agreementVersions)
              .where(eq(agreementVersions.id, agreement.currentVersionId))
              .limit(1)
          : [],
        this.db
          .select()
          .from(paymentScheduleItems)
          .where(eq(paymentScheduleItems.agreementId, agreement.id))
          .orderBy(asc(paymentScheduleItems.sortOrder), asc(paymentScheduleItems.createdAt)),
        this.db
          .select()
          .from(payments)
          .where(eq(payments.agreementId, agreement.id))
          .orderBy(asc(payments.createdAt)),
      ]);

    const rfq = rfqRows[0];
    const quote = quoteRows[0];
    const quoteRevision = revisionRows[0];
    const vendor = vendorRows[0];

    if (!rfq || !quote || !quoteRevision || !vendor) return null;

    const [addressRows, requirementRows, lineItemRows, signedDocumentRows] = await Promise.all([
      rfq.venueAddressId
        ? this.db.select().from(addresses).where(eq(addresses.id, rfq.venueAddressId)).limit(1)
        : [],
      this.db
        .select()
        .from(rfqRequirements)
        .where(eq(rfqRequirements.rfqId, rfq.id))
        .orderBy(asc(rfqRequirements.createdAt)),
      this.db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteRevisionId, quoteRevision.id))
        .orderBy(asc(quoteLineItems.sortOrder), asc(quoteLineItems.createdAt)),
      agreement.signedDocumentFileId
        ? this.db.select().from(files).where(eq(files.id, agreement.signedDocumentFileId)).limit(1)
        : [],
    ]);

    return {
      address: addressRows[0] ?? null,
      agreement,
      currentVersion: versionRows[0] ?? null,
      lineItems: lineItemRows,
      paymentScheduleItems: scheduleRows,
      payments: paymentRows,
      quote,
      quoteRevision,
      requirements: requirementRows,
      rfq,
      signedDocument: signedDocumentRows[0] ?? null,
      vendor,
    };
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date): Promise<RfqRow | null> {
    const [rfq] = await this.db
      .update(rfqs)
      .set({ status, updatedAt })
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .returning();
    return rfq ?? null;
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    const [history] = await this.db.insert(rfqStatusHistory).values(input).returning();
    return requireReturnedRow(history);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const [event] = await this.db.insert(outboxEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async transaction<T>(callback: (repo: SchedulingRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleSchedulingRepository(tx)));
    }

    return callback(this);
  }
}

export function createUnavailableSchedulingRepository(): SchedulingRepository {
  const unavailable = async () => {
    throw new Error(
      "Scheduling repository is unavailable because no database client was provided.",
    );
  };

  return {
    createAuditLog: unavailable,
    createCalendarEvent: unavailable,
    createCateringEvent: unavailable,
    createOutboxEvent: unavailable,
    createStatusHistory: unavailable,
    findAgreementContextByAgreementId: unavailable,
    findCalendarEventDetailById: unavailable,
    findConfirmedCateringEventByAgreementId: unavailable,
    findOperatingSettingsByVendorId: unavailable,
    findVendorById: unavailable,
    listCalendarEvents: unavailable,
    listRangeEventsForConflict: unavailable,
    transaction: unavailable,
    updateRfqStatus: unavailable,
  };
}
