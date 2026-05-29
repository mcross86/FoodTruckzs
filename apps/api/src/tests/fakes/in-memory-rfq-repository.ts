import { randomUUID } from "node:crypto";

import {
  isUuidRfqIdentifier,
  parseRfqNumberIdentifier,
} from "../../modules/rfqs/rfq-identifier.js";

import type {
  addresses,
  auditLogs,
  messageThreads,
  messages,
  outboxEvents,
  rfqs,
  rfqRequirements,
  rfqStatusHistory,
  rfqVendorTargets,
  threadReadStates,
} from "../../db/schema/index.js";
import type {
  CreateRequirementInput,
  CreateRfqRecordInput,
  RfqCandidateVendorRecord,
  RfqDetailRecord,
  RfqRepository,
  RfqTargetRecord,
} from "../../modules/rfqs/rfqs.repository.js";
import type { RfqStatus } from "../../modules/rfqs/rfq-state-machine.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AddressRow = typeof addresses.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type MessageThreadRow = typeof messageThreads.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqRequirementRow = typeof rfqRequirements.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type RfqTargetRow = typeof rfqVendorTargets.$inferSelect;
type ThreadReadStateRow = typeof threadReadStates.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryRfqRepository implements RfqRepository {
  private nextRfqNumber = 1;

  readonly addresses = new Map<string, AddressRow>();
  readonly auditLogs = new Map<string, AuditLogRow>();
  readonly messages = new Map<string, MessageRow>();
  readonly outboxEvents = new Map<string, OutboxEventRow>();
  readonly requirements = new Map<string, RfqRequirementRow>();
  readonly rfqs = new Map<string, RfqRow>();
  readonly readStates = new Map<string, ThreadReadStateRow>();
  readonly statusHistory = new Map<string, RfqStatusHistoryRow>();
  readonly targets = new Map<string, RfqTargetRow>();
  readonly threads = new Map<string, MessageThreadRow>();

  constructor(readonly vendorRepository: InMemoryVendorRepository) {}

  private resolveRfq(identifier: string): RfqRow | null {
    if (isUuidRfqIdentifier(identifier)) {
      const rfq = this.rfqs.get(identifier);
      return rfq && rfq.deletedAt === null ? rfq : null;
    }

    const rfqNumber = parseRfqNumberIdentifier(identifier);
    if (rfqNumber === null) {
      return null;
    }

    return (
      [...this.rfqs.values()].find((rfq) => rfq.rfqNumber === rfqNumber && rfq.deletedAt === null) ??
      null
    );
  }

  async createAddress(input: typeof addresses.$inferInsert): Promise<AddressRow> {
    const createdAt = now();
    const address: AddressRow = {
      city: input.city,
      country: input.country ?? "US",
      createdAt,
      id: randomUUID(),
      line1: input.line1,
      line2: input.line2 ?? null,
      postalCode: input.postalCode ?? null,
      state: input.state,
      timezone: input.timezone ?? null,
      updatedAt: createdAt,
    };
    this.addresses.set(address.id, address);
    return address;
  }

  async createRfq(input: CreateRfqRecordInput): Promise<RfqRow> {
    const createdAt = now();
    const rfq: RfqRow = {
      budgetMaxCents: input.budgetMaxCents ?? null,
      budgetMinCents: input.budgetMinCents ?? null,
      createdAt,
      customerUserId: input.customerUserId,
      deletedAt: null,
      endsAt: input.endsAt,
      estimatedHeadcount: input.estimatedHeadcount,
      eventName: input.eventName,
      eventType: input.eventType,
      id: randomUUID(),
      indoorOutdoor: input.indoorOutdoor,
      quoteResponseDeadline: input.quoteResponseDeadline ?? null,
      rfqNumber: this.nextRfqNumber++,
      startsAt: input.startsAt,
      status: input.status,
      timezone: input.timezone,
      updatedAt: createdAt,
      venueAddressId: input.venueAddressId,
    };
    this.rfqs.set(rfq.id, rfq);
    return rfq;
  }

  async createRequirements(inputs: CreateRequirementInput[]): Promise<RfqRequirementRow[]> {
    return inputs.map((input) => {
      const requirement: RfqRequirementRow = {
        createdAt: now(),
        details: input.details,
        id: randomUUID(),
        label: input.label,
        rfqId: input.rfqId,
        type: input.type,
      };
      this.requirements.set(requirement.id, requirement);
      return requirement;
    });
  }

  async createVendorTargets(
    inputs: (typeof rfqVendorTargets.$inferInsert)[],
  ): Promise<RfqTargetRow[]> {
    return inputs.map((input) => {
      const createdAt = now();
      const target: RfqTargetRow = {
        createdAt,
        id: randomUUID(),
        rejectedReason: input.rejectedReason ?? null,
        respondedAt: input.respondedAt ?? null,
        rfqId: input.rfqId,
        status: input.status ?? "invited",
        updatedAt: createdAt,
        vendorId: input.vendorId,
      };
      this.targets.set(target.id, target);
      return target;
    });
  }

  async createMessageThreads(
    inputs: (typeof messageThreads.$inferInsert)[],
  ): Promise<MessageThreadRow[]> {
    return inputs.map((input) => {
      const createdAt = now();
      const thread: MessageThreadRow = {
        createdAt,
        customerUserId: input.customerUserId,
        id: randomUUID(),
        lastMessageAt: input.lastMessageAt ?? null,
        lastMessageId: input.lastMessageId ?? null,
        rfqId: input.rfqId,
        status: input.status ?? "open",
        updatedAt: createdAt,
        vendorId: input.vendorId,
      };
      this.threads.set(thread.id, thread);
      return thread;
    });
  }

  async createMessage(input: typeof messages.$inferInsert): Promise<MessageRow> {
    const message: MessageRow = {
      attachmentFileId: input.attachmentFileId ?? null,
      body: input.body ?? null,
      createdAt: now(),
      deletedAt: null,
      id: randomUUID(),
      senderUserId: input.senderUserId,
      status: input.status ?? "visible",
      threadId: input.threadId,
    };
    this.messages.set(message.id, message);
    return message;
  }

  async updateThreadLastMessage(
    threadId: string,
    messageId: string,
    lastMessageAt: Date,
  ): Promise<MessageThreadRow | null> {
    const thread = this.threads.get(threadId);

    if (!thread) {
      return null;
    }

    const updatedThread: MessageThreadRow = {
      ...thread,
      lastMessageAt,
      lastMessageId: messageId,
      updatedAt: lastMessageAt,
    };
    this.threads.set(threadId, updatedThread);
    return updatedThread;
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    const history: RfqStatusHistoryRow = {
      actorUserId: input.actorUserId ?? null,
      createdAt: now(),
      fromStatus: input.fromStatus ?? null,
      id: randomUUID(),
      metadata: input.metadata ?? {},
      reason: input.reason ?? null,
      rfqId: input.rfqId,
      toStatus: input.toStatus,
    };
    this.statusHistory.set(history.id, history);
    return history;
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const auditLog: AuditLogRow = {
      action: input.action,
      actorRole: input.actorRole ?? null,
      actorUserId: input.actorUserId ?? null,
      createdAt: now(),
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      id: randomUUID(),
      ipAddress: input.ipAddress ?? null,
      newState: input.newState ?? null,
      previousState: input.previousState ?? null,
      requestId: input.requestId ?? null,
      userAgent: input.userAgent ?? null,
      vendorId: input.vendorId ?? null,
    };
    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const createdAt = now();
    const event: OutboxEventRow = {
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
      attempts: input.attempts ?? 0,
      availableAt: input.availableAt ?? createdAt,
      createdAt,
      eventType: input.eventType,
      id: randomUUID(),
      lastError: input.lastError ?? null,
      payload: input.payload,
      processedAt: input.processedAt ?? null,
      requestId: input.requestId ?? null,
      status: input.status ?? "pending",
      updatedAt: createdAt,
    };
    this.outboxEvents.set(event.id, event);
    return event;
  }

  async createOrUpdateThreadReadState(
    input: typeof threadReadStates.$inferInsert,
  ): Promise<ThreadReadStateRow> {
    const readState: ThreadReadStateRow = {
      lastReadMessageId: input.lastReadMessageId ?? null,
      readAt: input.readAt ?? now(),
      threadId: input.threadId,
      userId: input.userId,
    };
    this.readStates.set(`${readState.threadId}:${readState.userId}`, readState);
    return readState;
  }

  async updateRfqStatus(
    rfqIdentifier: string,
    status: RfqStatus,
    updatedAt: Date,
  ): Promise<RfqRow | null> {
    const rfq = this.resolveRfq(rfqIdentifier);

    if (!rfq) {
      return null;
    }

    const updatedRfq: RfqRow = { ...rfq, status, updatedAt };
    this.rfqs.set(rfq.id, updatedRfq);
    return updatedRfq;
  }

  async updateVendorTarget(
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "rejectedReason" | "respondedAt" | "status">>,
    updatedAt: Date,
  ): Promise<RfqTargetRow | null> {
    const target = this.targets.get(targetId);

    if (!target) {
      return null;
    }

    const updatedTarget: RfqTargetRow = {
      ...target,
      ...input,
      updatedAt,
    };
    this.targets.set(targetId, updatedTarget);
    return updatedTarget;
  }

  async findRfqDetailById(rfqIdentifier: string): Promise<RfqDetailRecord | null> {
    const rfq = this.resolveRfq(rfqIdentifier);
    if (!rfq) {
      return null;
    }

    return this.loadDetail(rfq);
  }

  async findVendorTargetById(
    rfqIdentifier: string,
    targetId: string,
  ): Promise<RfqTargetRecord | null> {
    const rfq = this.resolveRfq(rfqIdentifier);
    const target = this.targets.get(targetId);
    const vendor = target ? this.vendorRepository.vendors.get(target.vendorId) : undefined;

    if (!rfq || !target || !vendor || target.rfqId !== rfq.id) {
      return null;
    }

    return { target, vendor };
  }

  async findThreadByRfqVendor(
    rfqIdentifier: string,
    vendorId: string,
  ): Promise<MessageThreadRow | null> {
    const rfq = this.resolveRfq(rfqIdentifier);
    if (!rfq) {
      return null;
    }

    return (
      [...this.threads.values()].find(
        (thread) => thread.rfqId === rfq.id && thread.vendorId === vendorId,
      ) ?? null
    );
  }

  async findThreadById(threadId: string): Promise<MessageThreadRow | null> {
    return this.threads.get(threadId) ?? null;
  }

  async listCustomerRfqDetails(
    customerUserId: string,
    status?: RfqStatus,
  ): Promise<RfqDetailRecord[]> {
    const rows = [...this.rfqs.values()]
      .filter(
        (rfq) =>
          rfq.customerUserId === customerUserId &&
          rfq.deletedAt === null &&
          (status === undefined || rfq.status === status),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return Promise.all(rows.map((rfq) => this.loadDetail(rfq)));
  }

  async listVendorRfqDetails(
    vendorId: string,
    targetStatus?: RfqTargetRow["status"],
  ): Promise<RfqDetailRecord[]> {
    const rfqIds = new Set(
      [...this.targets.values()]
        .filter(
          (target) =>
            target.vendorId === vendorId &&
            (targetStatus === undefined || target.status === targetStatus),
        )
        .map((target) => target.rfqId),
    );
    const rows = [...this.rfqs.values()]
      .filter((rfq) => rfqIds.has(rfq.id) && rfq.deletedAt === null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return Promise.all(rows.map((rfq) => this.loadDetail(rfq)));
  }

  async listCandidateVendorRecords(): Promise<RfqCandidateVendorRecord[]> {
    const vendorIds = [...this.vendorRepository.vendors.values()]
      .filter(
        (vendor) =>
          vendor.deletedAt === null &&
          vendor.status === "active" &&
          vendor.approvalStatus === "approved",
      )
      .sort((left, right) => left.businessName.localeCompare(right.businessName))
      .map((vendor) => vendor.id);

    return Promise.all(vendorIds.map((vendorId) => this.loadCandidateVendorRecord(vendorId)));
  }

  async findCandidateVendorRecordsByIds(vendorIds: string[]): Promise<RfqCandidateVendorRecord[]> {
    const candidates = await this.listCandidateVendorRecords();
    return candidates.filter((candidate) => vendorIds.includes(candidate.vendor.id));
  }

  async transaction<T>(callback: (repo: RfqRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private async loadDetail(rfq: RfqRow): Promise<RfqDetailRecord> {
    const targetRows = [...this.targets.values()]
      .filter((target) => target.rfqId === rfq.id)
      .map((target) => {
        const vendor = this.vendorRepository.vendors.get(target.vendorId);

        if (!vendor) {
          throw new Error("Expected RFQ target vendor to exist.");
        }

        return { target, vendor };
      });
    const threadRows = [...this.threads.values()].filter((thread) => thread.rfqId === rfq.id);
    const threadIds = new Set(threadRows.map((thread) => thread.id));

    return {
      address: rfq.venueAddressId ? (this.addresses.get(rfq.venueAddressId) ?? null) : null,
      messages: [...this.messages.values()]
        .filter((message) => threadIds.has(message.threadId))
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      readStates: [...this.readStates.values()].filter((readState) =>
        threadIds.has(readState.threadId),
      ),
      requirements: [...this.requirements.values()]
        .filter((requirement) => requirement.rfqId === rfq.id)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      rfq,
      statusHistory: [...this.statusHistory.values()]
        .filter((history) => history.rfqId === rfq.id)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      targets: targetRows.sort(
        (left, right) => left.target.createdAt.getTime() - right.target.createdAt.getTime(),
      ),
      threads: threadRows.sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      ),
    };
  }

  private async loadCandidateVendorRecord(vendorId: string): Promise<RfqCandidateVendorRecord> {
    const setup = await this.vendorRepository.findVendorSetup(vendorId);

    if (!setup) {
      throw new Error("Expected vendor setup to exist.");
    }

    return {
      availabilityExceptions: [...this.vendorRepository.availabilityExceptions.values()].filter(
        (exception) => exception.vendorId === vendorId,
      ),
      cuisines: setup.cuisines.filter((cuisine) => cuisine.isActive),
      operatingSettings: setup.operatingSettings,
      profile: setup.profile,
      serviceAreas: setup.serviceAreas,
      vendor: setup.vendor,
    };
  }
}
