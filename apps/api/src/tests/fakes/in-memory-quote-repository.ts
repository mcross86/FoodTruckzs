import { randomUUID } from "node:crypto";

import type {
  paymentScheduleItems,
  quoteLineItems,
  quoteRevisions,
  quotes,
  rfqVendorTargets,
} from "../../db/schema/index.js";
import type {
  QuoteDetailRecord,
  QuoteRepository,
  QuoteRevisionBundle,
  QuoteRfqTargetRecord,
} from "../../modules/quotes/quotes.repository.js";
import type { RfqStatus } from "../../modules/rfqs/rfq-state-machine.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";

type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
type QuoteLineItemRow = typeof quoteLineItems.$inferSelect;
type QuoteRevisionRow = typeof quoteRevisions.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type RfqTargetRow = typeof rfqVendorTargets.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryQuoteRepository implements QuoteRepository {
  readonly lineItems = new Map<string, QuoteLineItemRow>();
  readonly paymentScheduleItems = new Map<string, PaymentScheduleItemRow>();
  readonly quotes = new Map<string, QuoteRow>();
  readonly revisions = new Map<string, QuoteRevisionRow>();

  constructor(private readonly rfqRepository: InMemoryRfqRepository) {}

  async createQuote(input: typeof quotes.$inferInsert): Promise<QuoteRow> {
    const createdAt = now();
    const quote: QuoteRow = {
      createdAt,
      currentRevisionId: input.currentRevisionId ?? null,
      deletedAt: null,
      depositRequiredCents: input.depositRequiredCents ?? 0,
      expiresAt: input.expiresAt ?? null,
      feesCents: input.feesCents ?? 0,
      id: randomUUID(),
      rfqId: input.rfqId,
      status: input.status ?? "draft",
      subtotalCents: input.subtotalCents ?? 0,
      taxCents: input.taxCents ?? 0,
      totalCents: input.totalCents ?? 0,
      updatedAt: createdAt,
      vendorId: input.vendorId,
    };
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async createRevision(input: typeof quoteRevisions.$inferInsert): Promise<QuoteRevisionRow> {
    const revision: QuoteRevisionRow = {
      assumptions: input.assumptions ?? [],
      cancellationPolicySummary: input.cancellationPolicySummary ?? null,
      createdAt: now(),
      createdByUserId: input.createdByUserId ?? null,
      depositRequiredCents: input.depositRequiredCents ?? 0,
      exclusions: input.exclusions ?? [],
      expiresAt: input.expiresAt ?? null,
      feesCents: input.feesCents ?? 0,
      id: randomUUID(),
      menuSummary: input.menuSummary ?? null,
      notes: input.notes ?? null,
      paymentSchedule: input.paymentSchedule ?? [],
      quoteId: input.quoteId,
      revisionNumber: input.revisionNumber,
      serviceStyle: input.serviceStyle ?? null,
      subtotalCents: input.subtotalCents ?? 0,
      taxCents: input.taxCents ?? 0,
      totalCents: input.totalCents ?? 0,
    };
    this.revisions.set(revision.id, revision);
    return revision;
  }

  async createLineItems(
    inputs: (typeof quoteLineItems.$inferInsert)[],
  ): Promise<QuoteLineItemRow[]> {
    return inputs.map((input) => {
      const lineItem: QuoteLineItemRow = {
        createdAt: now(),
        description: input.description ?? null,
        id: randomUUID(),
        isInternal: input.isInternal ?? false,
        isOptional: input.isOptional ?? false,
        name: input.name,
        quantity: input.quantity ?? 1,
        quoteId: input.quoteId,
        quoteRevisionId: input.quoteRevisionId,
        sortOrder: input.sortOrder ?? 0,
        taxable: input.taxable ?? false,
        totalAmountCents: input.totalAmountCents ?? 0,
        type: input.type,
        unit: input.unit ?? "each",
        unitAmountCents: input.unitAmountCents ?? 0,
      };
      this.lineItems.set(lineItem.id, lineItem);
      return lineItem;
    });
  }

  async createPaymentScheduleItems(
    inputs: (typeof paymentScheduleItems.$inferInsert)[],
  ): Promise<PaymentScheduleItemRow[]> {
    return inputs.map((input) => {
      const createdAt = now();
      const item: PaymentScheduleItemRow = {
        amountCents: input.amountCents,
        agreementId: input.agreementId ?? null,
        createdAt,
        currency: input.currency ?? "usd",
        dueAt: input.dueAt ?? null,
        id: randomUUID(),
        label: input.label,
        paidAt: input.paidAt ?? null,
        quoteRevisionId: input.quoteRevisionId,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "pending",
        type: input.type,
        updatedAt: createdAt,
      };
      this.paymentScheduleItems.set(item.id, item);
      return item;
    });
  }

  async updateQuote(
    quoteId: string,
    input: Partial<
      Pick<
        QuoteRow,
        | "currentRevisionId"
        | "depositRequiredCents"
        | "expiresAt"
        | "feesCents"
        | "status"
        | "subtotalCents"
        | "taxCents"
        | "totalCents"
      >
    >,
    updatedAt: Date,
  ): Promise<QuoteRow | null> {
    const quote = this.quotes.get(quoteId);

    if (!quote || quote.deletedAt !== null) {
      return null;
    }

    const updatedQuote: QuoteRow = { ...quote, ...input, updatedAt };
    this.quotes.set(quoteId, updatedQuote);
    return updatedQuote;
  }

  async updateCompetingQuotesNotSelected(
    rfqId: string,
    acceptedQuoteId: string,
    updatedAt: Date,
  ): Promise<void> {
    for (const quote of this.quotes.values()) {
      if (quote.rfqId === rfqId && quote.id !== acceptedQuoteId && quote.status !== "cancelled") {
        this.quotes.set(quote.id, { ...quote, status: "not_selected", updatedAt });
      }
    }
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date) {
    return this.rfqRepository.updateRfqStatus(rfqId, status, updatedAt);
  }

  async updateVendorTarget(
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "respondedAt" | "status">>,
    updatedAt: Date,
  ) {
    return this.rfqRepository.updateVendorTarget(targetId, input, updatedAt);
  }

  async createStatusHistory(input: Parameters<QuoteRepository["createStatusHistory"]>[0]) {
    return this.rfqRepository.createStatusHistory(input);
  }

  async createAuditLog(input: Parameters<QuoteRepository["createAuditLog"]>[0]) {
    return this.rfqRepository.createAuditLog(input);
  }

  async createOutboxEvent(input: Parameters<QuoteRepository["createOutboxEvent"]>[0]) {
    return this.rfqRepository.createOutboxEvent(input);
  }

  async findRfqTargetForVendor(
    rfqId: string,
    vendorId: string,
  ): Promise<QuoteRfqTargetRecord | null> {
    const rfq = this.rfqRepository.rfqs.get(rfqId);
    const target = [...this.rfqRepository.targets.values()].find(
      (candidate) => candidate.rfqId === rfqId && candidate.vendorId === vendorId,
    );
    const vendor = target ? this.rfqRepository.vendorRepository.vendors.get(vendorId) : undefined;

    if (!rfq || !target || !vendor || rfq.deletedAt !== null) {
      return null;
    }

    return { rfq, target, vendor };
  }

  async findQuoteById(quoteId: string): Promise<QuoteDetailRecord | null> {
    const quote = this.quotes.get(quoteId);
    return quote && quote.deletedAt === null ? this.loadDetail(quote) : null;
  }

  async findQuoteByRfqVendor(rfqId: string, vendorId: string): Promise<QuoteDetailRecord | null> {
    const quote = [...this.quotes.values()].find(
      (candidate) =>
        candidate.rfqId === rfqId &&
        candidate.vendorId === vendorId &&
        candidate.deletedAt === null,
    );

    return quote ? this.loadDetail(quote) : null;
  }

  async listQuotesForRfq(rfqId: string): Promise<QuoteDetailRecord[]> {
    const rows = [...this.quotes.values()]
      .filter((quote) => quote.rfqId === rfqId && quote.deletedAt === null)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    return Promise.all(rows.map((quote) => this.loadDetail(quote))).then((records) =>
      records.filter((record): record is QuoteDetailRecord => record !== null),
    );
  }

  async transaction<T>(callback: (repo: QuoteRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private async loadDetail(quote: QuoteRow): Promise<QuoteDetailRecord | null> {
    const rfq = this.rfqRepository.rfqs.get(quote.rfqId);
    const vendor = this.rfqRepository.vendorRepository.vendors.get(quote.vendorId);

    if (!rfq || !vendor) {
      return null;
    }

    const target =
      [...this.rfqRepository.targets.values()].find(
        (candidate) => candidate.rfqId === quote.rfqId && candidate.vendorId === quote.vendorId,
      ) ?? null;
    const revisionRows = [...this.revisions.values()]
      .filter((revision) => revision.quoteId === quote.id)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
    const revisions: QuoteRevisionBundle[] = revisionRows.map((revision) => ({
      lineItems: [...this.lineItems.values()]
        .filter((lineItem) => lineItem.quoteRevisionId === revision.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      paymentScheduleItems: [...this.paymentScheduleItems.values()]
        .filter((item) => item.quoteRevisionId === revision.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      revision,
    }));

    return {
      currentRevision:
        revisions.find((revision) => revision.revision.id === quote.currentRevisionId) ?? null,
      quote,
      revisions,
      rfq,
      target,
      vendor,
    };
  }
}
