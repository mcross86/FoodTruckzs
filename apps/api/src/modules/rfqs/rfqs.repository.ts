import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  addresses,
  auditLogs,
  availabilityExceptions,
  cuisines,
  messageThreads,
  messages,
  outboxEvents,
  rfqs,
  rfqRequirements,
  rfqStatusHistory,
  rfqVendorTargets,
  threadReadStates,
  vendorCuisines,
  vendorOperatingSettings,
  vendorProfiles,
  vendors,
  vendorServiceAreas,
} from "../../db/schema/index.js";
import { findRfqRowByIdentifier } from "./rfq-identifier.js";
import type { RfqStatus } from "./rfq-state-machine.js";

type RfqDb = Database | Transaction;
type AddressRow = typeof addresses.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type MessageThreadRow = typeof messageThreads.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqRequirementRow = typeof rfqRequirements.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type RfqTargetRow = typeof rfqVendorTargets.$inferSelect;
type ThreadReadStateRow = typeof threadReadStates.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;
type VendorProfileRow = typeof vendorProfiles.$inferSelect;
type VendorServiceAreaRow = typeof vendorServiceAreas.$inferSelect;
type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
type AvailabilityExceptionRow = typeof availabilityExceptions.$inferSelect;
type CuisineRow = typeof cuisines.$inferSelect;

export type RfqTargetRecord = {
  target: RfqTargetRow;
  vendor: VendorRow;
};

export type RfqDetailRecord = {
  address: AddressRow | null;
  messages: MessageRow[];
  readStates: ThreadReadStateRow[];
  requirements: RfqRequirementRow[];
  rfq: RfqRow;
  statusHistory: RfqStatusHistoryRow[];
  targets: RfqTargetRecord[];
  threads: MessageThreadRow[];
};

export type RfqCandidateVendorRecord = {
  availabilityExceptions: AvailabilityExceptionRow[];
  cuisines: CuisineRow[];
  operatingSettings: VendorOperatingSettingsRow | null;
  profile: VendorProfileRow | null;
  serviceAreas: VendorServiceAreaRow[];
  vendor: VendorRow;
};

export type CreateRfqRecordInput = {
  budgetMaxCents?: number;
  budgetMinCents?: number;
  customerUserId: string;
  endsAt: Date;
  estimatedHeadcount: number;
  eventName: string;
  eventType: string;
  indoorOutdoor: string;
  quoteResponseDeadline?: Date;
  startsAt: Date;
  status: RfqStatus;
  timezone: string;
  venueAddressId: string;
};

export type CreateRequirementInput = {
  details: Record<string, unknown>;
  label: string;
  rfqId: string;
  type: "food" | "equipment" | "dietary" | "service" | "other";
};

export type RfqRepository = {
  createAddress: (input: typeof addresses.$inferInsert) => Promise<AddressRow>;
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createMessage: (input: typeof messages.$inferInsert) => Promise<MessageRow>;
  createMessageThreads: (
    inputs: (typeof messageThreads.$inferInsert)[],
  ) => Promise<MessageThreadRow[]>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createOrUpdateThreadReadState: (
    input: typeof threadReadStates.$inferInsert,
  ) => Promise<ThreadReadStateRow>;
  createRequirements: (inputs: CreateRequirementInput[]) => Promise<RfqRequirementRow[]>;
  createRfq: (input: CreateRfqRecordInput) => Promise<RfqRow>;
  createStatusHistory: (
    input: typeof rfqStatusHistory.$inferInsert,
  ) => Promise<RfqStatusHistoryRow>;
  createVendorTargets: (
    inputs: (typeof rfqVendorTargets.$inferInsert)[],
  ) => Promise<RfqTargetRow[]>;
  findCandidateVendorRecordsByIds: (vendorIds: string[]) => Promise<RfqCandidateVendorRecord[]>;
  findRfqDetailById: (rfqId: string) => Promise<RfqDetailRecord | null>;
  findThreadById: (threadId: string) => Promise<MessageThreadRow | null>;
  findThreadByRfqVendor: (rfqId: string, vendorId: string) => Promise<MessageThreadRow | null>;
  findVendorTargetById: (rfqId: string, targetId: string) => Promise<RfqTargetRecord | null>;
  listCandidateVendorRecords: () => Promise<RfqCandidateVendorRecord[]>;
  listCustomerRfqDetails: (
    customerUserId: string,
    status?: RfqStatus,
  ) => Promise<RfqDetailRecord[]>;
  listVendorRfqDetails: (
    vendorId: string,
    targetStatus?: RfqTargetRow["status"],
  ) => Promise<RfqDetailRecord[]>;
  transaction: <T>(callback: (repo: RfqRepository) => Promise<T>) => Promise<T>;
  updateRfqStatus: (rfqId: string, status: RfqStatus, updatedAt: Date) => Promise<RfqRow | null>;
  updateThreadLastMessage: (
    threadId: string,
    messageId: string,
    lastMessageAt: Date,
  ) => Promise<MessageThreadRow | null>;
  updateVendorTarget: (
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "rejectedReason" | "respondedAt" | "status">>,
    updatedAt: Date,
  ) => Promise<RfqTargetRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

function publicVendorVisibility() {
  return and(
    eq(vendors.status, "active"),
    eq(vendors.approvalStatus, "approved"),
    eq(vendors.isPublished, true),
    isNull(vendors.deletedAt),
  );
}

/** Approved active vendors eligible for RFQ targeting (marketplace publish not required). */
function rfqEligibleVendorVisibility() {
  return and(
    eq(vendors.status, "active"),
    eq(vendors.approvalStatus, "approved"),
    isNull(vendors.deletedAt),
  );
}

export class DrizzleRfqRepository implements RfqRepository {
  constructor(private readonly db: RfqDb) {}

  async createAddress(input: typeof addresses.$inferInsert): Promise<AddressRow> {
    const [address] = await this.db.insert(addresses).values(input).returning();
    return requireReturnedRow(address);
  }

  async createRfq(input: CreateRfqRecordInput): Promise<RfqRow> {
    const [rfq] = await this.db.insert(rfqs).values(input).returning();
    return requireReturnedRow(rfq);
  }

  async createRequirements(inputs: CreateRequirementInput[]): Promise<RfqRequirementRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.insert(rfqRequirements).values(inputs).returning();
  }

  async createVendorTargets(
    inputs: (typeof rfqVendorTargets.$inferInsert)[],
  ): Promise<RfqTargetRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.insert(rfqVendorTargets).values(inputs).returning();
  }

  async createMessageThreads(
    inputs: (typeof messageThreads.$inferInsert)[],
  ): Promise<MessageThreadRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.insert(messageThreads).values(inputs).returning();
  }

  async createMessage(input: typeof messages.$inferInsert): Promise<MessageRow> {
    const [message] = await this.db.insert(messages).values(input).returning();
    return requireReturnedRow(message);
  }

  async updateThreadLastMessage(
    threadId: string,
    messageId: string,
    lastMessageAt: Date,
  ): Promise<MessageThreadRow | null> {
    const [thread] = await this.db
      .update(messageThreads)
      .set({
        lastMessageAt,
        lastMessageId: messageId,
        updatedAt: lastMessageAt,
      })
      .where(eq(messageThreads.id, threadId))
      .returning();

    return thread ?? null;
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

  async createOrUpdateThreadReadState(
    input: typeof threadReadStates.$inferInsert,
  ): Promise<ThreadReadStateRow> {
    const readAt = input.readAt ?? new Date();
    const [readState] = await this.db
      .insert(threadReadStates)
      .values({
        lastReadMessageId: input.lastReadMessageId,
        readAt,
        threadId: input.threadId,
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          lastReadMessageId: input.lastReadMessageId,
          readAt,
        },
        target: [threadReadStates.threadId, threadReadStates.userId],
      })
      .returning();

    return requireReturnedRow(readState);
  }

  async updateRfqStatus(
    rfqIdentifier: string,
    status: RfqStatus,
    updatedAt: Date,
  ): Promise<RfqRow | null> {
    const existing = await findRfqRowByIdentifier(this.db, rfqIdentifier);
    if (!existing) {
      return null;
    }

    const [rfq] = await this.db
      .update(rfqs)
      .set({ status, updatedAt })
      .where(and(eq(rfqs.id, existing.id), isNull(rfqs.deletedAt)))
      .returning();

    return rfq ?? null;
  }

  async updateVendorTarget(
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "rejectedReason" | "respondedAt" | "status">>,
    updatedAt: Date,
  ): Promise<RfqTargetRow | null> {
    const [target] = await this.db
      .update(rfqVendorTargets)
      .set({ ...input, updatedAt })
      .where(eq(rfqVendorTargets.id, targetId))
      .returning();

    return target ?? null;
  }

  async findRfqDetailById(rfqIdentifier: string): Promise<RfqDetailRecord | null> {
    const rfq = await findRfqRowByIdentifier(this.db, rfqIdentifier);
    if (!rfq) {
      return null;
    }

    return this.loadDetail(rfq);
  }

  async findVendorTargetById(
    rfqIdentifier: string,
    targetId: string,
  ): Promise<RfqTargetRecord | null> {
    const rfq = await findRfqRowByIdentifier(this.db, rfqIdentifier);
    if (!rfq) {
      return null;
    }

    const [row] = await this.db
      .select({
        target: rfqVendorTargets,
        vendor: vendors,
      })
      .from(rfqVendorTargets)
      .innerJoin(vendors, eq(rfqVendorTargets.vendorId, vendors.id))
      .where(and(eq(rfqVendorTargets.rfqId, rfq.id), eq(rfqVendorTargets.id, targetId)))
      .limit(1);

    return row ?? null;
  }

  async findThreadByRfqVendor(
    rfqIdentifier: string,
    vendorId: string,
  ): Promise<MessageThreadRow | null> {
    const rfq = await findRfqRowByIdentifier(this.db, rfqIdentifier);
    if (!rfq) {
      return null;
    }

    const [thread] = await this.db
      .select()
      .from(messageThreads)
      .where(and(eq(messageThreads.rfqId, rfq.id), eq(messageThreads.vendorId, vendorId)))
      .limit(1);

    return thread ?? null;
  }

  async findThreadById(threadId: string): Promise<MessageThreadRow | null> {
    const [thread] = await this.db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.id, threadId))
      .limit(1);

    return thread ?? null;
  }

  async listCustomerRfqDetails(
    customerUserId: string,
    status?: RfqStatus,
  ): Promise<RfqDetailRecord[]> {
    const rows = await this.db
      .select()
      .from(rfqs)
      .where(
        and(
          eq(rfqs.customerUserId, customerUserId),
          isNull(rfqs.deletedAt),
          status ? eq(rfqs.status, status) : undefined,
        ),
      )
      .orderBy(desc(rfqs.createdAt));

    return Promise.all(rows.map((rfq) => this.loadDetail(rfq)));
  }

  async listVendorRfqDetails(
    vendorId: string,
    targetStatus?: RfqTargetRow["status"],
  ): Promise<RfqDetailRecord[]> {
    const targetRows = await this.db
      .select()
      .from(rfqVendorTargets)
      .where(
        and(
          eq(rfqVendorTargets.vendorId, vendorId),
          targetStatus ? eq(rfqVendorTargets.status, targetStatus) : undefined,
        ),
      )
      .orderBy(desc(rfqVendorTargets.createdAt));
    const rfqIds = targetRows.map((target) => target.rfqId);

    if (rfqIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(rfqs)
      .where(and(inArray(rfqs.id, rfqIds), isNull(rfqs.deletedAt)))
      .orderBy(desc(rfqs.createdAt));

    return Promise.all(rows.map((rfq) => this.loadDetail(rfq)));
  }

  async listCandidateVendorRecords(): Promise<RfqCandidateVendorRecord[]> {
    const vendorRows = await this.db
      .select()
      .from(vendors)
      .where(rfqEligibleVendorVisibility())
      .orderBy(asc(vendors.businessName));

    return Promise.all(vendorRows.map((vendor) => this.loadCandidateVendorRecord(vendor)));
  }

  async findCandidateVendorRecordsByIds(vendorIds: string[]): Promise<RfqCandidateVendorRecord[]> {
    if (vendorIds.length === 0) {
      return [];
    }

    const vendorRows = await this.db
      .select()
      .from(vendors)
      .where(and(inArray(vendors.id, vendorIds), rfqEligibleVendorVisibility()))
      .orderBy(asc(vendors.businessName));

    return Promise.all(vendorRows.map((vendor) => this.loadCandidateVendorRecord(vendor)));
  }

  async transaction<T>(callback: (repo: RfqRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleRfqRepository(tx)));
    }

    return callback(this);
  }

  private async loadDetail(rfq: RfqRow): Promise<RfqDetailRecord> {
    const [addressRows, requirementRows, targetRows, historyRows, threadRows] = await Promise.all([
      rfq.venueAddressId
        ? this.db.select().from(addresses).where(eq(addresses.id, rfq.venueAddressId)).limit(1)
        : Promise.resolve([]),
      this.db
        .select()
        .from(rfqRequirements)
        .where(eq(rfqRequirements.rfqId, rfq.id))
        .orderBy(asc(rfqRequirements.createdAt)),
      this.db
        .select({
          target: rfqVendorTargets,
          vendor: vendors,
        })
        .from(rfqVendorTargets)
        .innerJoin(vendors, eq(rfqVendorTargets.vendorId, vendors.id))
        .where(eq(rfqVendorTargets.rfqId, rfq.id))
        .orderBy(asc(rfqVendorTargets.createdAt)),
      this.db
        .select()
        .from(rfqStatusHistory)
        .where(eq(rfqStatusHistory.rfqId, rfq.id))
        .orderBy(asc(rfqStatusHistory.createdAt)),
      this.db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.rfqId, rfq.id))
        .orderBy(asc(messageThreads.createdAt)),
    ]);
    const threadIds = threadRows.map((thread) => thread.id);
    const messageRows =
      threadIds.length > 0
        ? await this.db
            .select()
            .from(messages)
            .where(inArray(messages.threadId, threadIds))
            .orderBy(asc(messages.createdAt))
        : [];
    const readStateRows =
      threadIds.length > 0
        ? await this.db
            .select()
            .from(threadReadStates)
            .where(inArray(threadReadStates.threadId, threadIds))
        : [];

    return {
      address: addressRows[0] ?? null,
      messages: messageRows,
      readStates: readStateRows,
      requirements: requirementRows,
      rfq,
      statusHistory: historyRows,
      targets: targetRows,
      threads: threadRows,
    };
  }

  private async loadCandidateVendorRecord(vendor: VendorRow): Promise<RfqCandidateVendorRecord> {
    const [profile, cuisineRows, serviceAreas, operatingSettings, exceptions] = await Promise.all([
      this.db
        .select()
        .from(vendorProfiles)
        .where(and(eq(vendorProfiles.vendorId, vendor.id), isNull(vendorProfiles.deletedAt)))
        .limit(1),
      this.db
        .select({
          createdAt: cuisines.createdAt,
          id: cuisines.id,
          isActive: cuisines.isActive,
          name: cuisines.name,
          slug: cuisines.slug,
        })
        .from(vendorCuisines)
        .innerJoin(cuisines, eq(vendorCuisines.cuisineId, cuisines.id))
        .where(and(eq(vendorCuisines.vendorId, vendor.id), eq(cuisines.isActive, true)))
        .orderBy(asc(cuisines.name)),
      this.db
        .select()
        .from(vendorServiceAreas)
        .where(eq(vendorServiceAreas.vendorId, vendor.id))
        .orderBy(asc(vendorServiceAreas.metroArea), asc(vendorServiceAreas.city)),
      this.db
        .select()
        .from(vendorOperatingSettings)
        .where(eq(vendorOperatingSettings.vendorId, vendor.id))
        .limit(1),
      this.db
        .select()
        .from(availabilityExceptions)
        .where(eq(availabilityExceptions.vendorId, vendor.id)),
    ]);

    return {
      availabilityExceptions: exceptions,
      cuisines: cuisineRows,
      operatingSettings: operatingSettings[0] ?? null,
      profile: profile[0] ?? null,
      serviceAreas,
      vendor,
    };
  }
}

export function createUnavailableRfqRepository(): RfqRepository {
  const unavailable = async () => {
    throw new Error("RFQ repository is unavailable because no database client was provided.");
  };

  return {
    createAddress: unavailable,
    createAuditLog: unavailable,
    createMessage: unavailable,
    createMessageThreads: unavailable,
    createOrUpdateThreadReadState: unavailable,
    createOutboxEvent: unavailable,
    createRequirements: unavailable,
    createRfq: unavailable,
    createStatusHistory: unavailable,
    createVendorTargets: unavailable,
    findCandidateVendorRecordsByIds: unavailable,
    findRfqDetailById: unavailable,
    findThreadById: unavailable,
    findThreadByRfqVendor: unavailable,
    findVendorTargetById: unavailable,
    listCandidateVendorRecords: unavailable,
    listCustomerRfqDetails: unavailable,
    listVendorRfqDetails: unavailable,
    transaction: unavailable,
    updateRfqStatus: unavailable,
    updateThreadLastMessage: unavailable,
    updateVendorTarget: unavailable,
  };
}
