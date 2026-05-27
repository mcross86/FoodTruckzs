import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import { calculateAgreementFeeCents } from "./billing-calculation.js";
import type { CreateVendorInvoiceDto } from "./billing.dto.js";
import type { BillingRepository, VendorInvoiceDetailRecord } from "./billing.repository.js";

type BillingSettingsResult = {
  agreementFeeBasisPoints: number;
  billingEmail: string | null;
  invoiceTermsDays: number;
};

type PlatformAgreementFeeResult = {
  agreementId: string;
  calculatedAt: Date;
  currency: string;
  feeAmountCents: number;
  feePercentageBasisPoints: number;
  id: string;
  signedAgreementTotalCents: number;
  status: string;
  vendorId: string;
  vendorInvoiceId: string | null;
};

type VendorInvoiceLineItemResult = {
  amountCents: number;
  currency: string;
  description: string;
  id: string;
  metadata: Record<string, unknown>;
  platformAgreementFeeId: string | null;
  type: string;
};

type VendorInvoiceResult = {
  billingPeriodEnd: string | null;
  billingPeriodStart: string | null;
  currency: string;
  dueAt: Date | null;
  id: string;
  invoiceNumber: string;
  issuedAt: Date | null;
  lineItems: VendorInvoiceLineItemResult[];
  paidAt: Date | null;
  status: string;
  subtotalCents: number;
  totalCents: number;
  vendorId: string;
};

export type PlatformBillingSummaryResult = {
  agreementFeeBasisPoints: number;
  billingEmail: string | null;
  invoiceTermsDays: number;
  issuedInvoices: VendorInvoiceResult[];
  pendingFees: PlatformAgreementFeeResult[];
  settings: BillingSettingsResult;
  totals: {
    issuedInvoiceAmountCents: number;
    issuedInvoiceCount: number;
    pendingFeeAmountCents: number;
    pendingFeeCount: number;
  };
};

export type AdminPlatformBillingResult = {
  issuedInvoices: VendorInvoiceResult[];
  pendingFees: PlatformAgreementFeeResult[];
  totals: {
    issuedInvoiceAmountCents: number;
    issuedInvoiceCount: number;
    pendingFeeAmountCents: number;
    pendingFeeCount: number;
  };
};

export type BillingService = {
  createVendorInvoice: (
    ctx: RequestContext,
    input: CreateVendorInvoiceDto,
  ) => Promise<VendorInvoiceResult>;
  getAdminPlatformBilling: (vendorId?: string) => Promise<AdminPlatformBillingResult>;
  getVendorPlatformBilling: (vendorId: string) => Promise<PlatformBillingSummaryResult>;
};

export type BillingServiceDeps = {
  repository: BillingRepository;
};

function dateBoundary(value: string, endOfDay = false): Date {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function dueAtFrom(issuedAt: Date, invoiceTermsDays: number): Date {
  return new Date(issuedAt.getTime() + invoiceTermsDays * 24 * 60 * 60 * 1000);
}

function invoiceNumberFor(vendorId: string, start: string, end: string): string {
  return `FTZ-${vendorId.slice(0, 8).toUpperCase()}-${start.replaceAll("-", "")}-${end.replaceAll("-", "")}`;
}

function assertValidBillingPeriod(start: string, end: string): void {
  if (dateBoundary(start).getTime() > dateBoundary(end).getTime()) {
    throw new ValidationError("Billing period start cannot be after billing period end.");
  }
}

function settingsToResult(
  settings: {
    agreementFeeBasisPoints: number;
    billingEmail: string | null;
    invoiceTermsDays: number;
  } | null,
): BillingSettingsResult {
  return {
    agreementFeeBasisPoints: settings?.agreementFeeBasisPoints ?? 0,
    billingEmail: settings?.billingEmail ?? null,
    invoiceTermsDays: settings?.invoiceTermsDays ?? 30,
  };
}

function feeToResult(fee: {
  agreementId: string;
  calculatedAt: Date;
  currency: string;
  feeAmountCents: number;
  feePercentageBasisPoints: number;
  id: string;
  signedAgreementTotalCents: number;
  status: string;
  vendorId: string;
  vendorInvoiceId: string | null;
}): PlatformAgreementFeeResult {
  return {
    agreementId: fee.agreementId,
    calculatedAt: fee.calculatedAt,
    currency: fee.currency,
    feeAmountCents: fee.feeAmountCents,
    feePercentageBasisPoints: fee.feePercentageBasisPoints,
    id: fee.id,
    signedAgreementTotalCents: fee.signedAgreementTotalCents,
    status: fee.status,
    vendorId: fee.vendorId,
    vendorInvoiceId: fee.vendorInvoiceId,
  };
}

function invoiceToResult(record: VendorInvoiceDetailRecord): VendorInvoiceResult {
  return {
    billingPeriodEnd: record.invoice.billingPeriodEnd,
    billingPeriodStart: record.invoice.billingPeriodStart,
    currency: record.invoice.currency,
    dueAt: record.invoice.dueAt,
    id: record.invoice.id,
    invoiceNumber: record.invoice.invoiceNumber,
    issuedAt: record.invoice.issuedAt,
    lineItems: record.lineItems.map((item) => ({
      amountCents: item.amountCents,
      currency: item.currency,
      description: item.description,
      id: item.id,
      metadata: item.metadata,
      platformAgreementFeeId: item.platformAgreementFeeId,
      type: item.type,
    })),
    paidAt: record.invoice.paidAt,
    status: record.invoice.status,
    subtotalCents: record.invoice.subtotalCents,
    totalCents: record.invoice.totalCents,
    vendorId: record.invoice.vendorId,
  };
}

function totalsFor(
  pendingFees: PlatformAgreementFeeResult[],
  issuedInvoices: VendorInvoiceResult[],
) {
  return {
    issuedInvoiceAmountCents: issuedInvoices.reduce((sum, invoice) => sum + invoice.totalCents, 0),
    issuedInvoiceCount: issuedInvoices.length,
    pendingFeeAmountCents: pendingFees.reduce((sum, fee) => sum + fee.feeAmountCents, 0),
    pendingFeeCount: pendingFees.length,
  };
}

export function createBillingService(deps: BillingServiceDeps): BillingService {
  const { repository } = deps;

  return {
    async getVendorPlatformBilling(vendorId) {
      const vendor = await repository.findVendorById(vendorId);

      if (!vendor) {
        throw new NotFoundError("Vendor was not found.");
      }

      const [settings, pendingFees, invoices] = await Promise.all([
        repository.findBillingSettingsByVendorId(vendorId),
        repository.listPendingAgreementFees(vendorId),
        repository.listInvoices(vendorId),
      ]);
      const settingsResult = settingsToResult(settings);
      const feeResults = pendingFees.map(feeToResult);
      const invoiceResults = invoices.map(invoiceToResult);

      return {
        agreementFeeBasisPoints: settingsResult.agreementFeeBasisPoints,
        billingEmail: settingsResult.billingEmail,
        invoiceTermsDays: settingsResult.invoiceTermsDays,
        issuedInvoices: invoiceResults,
        pendingFees: feeResults,
        settings: settingsResult,
        totals: totalsFor(feeResults, invoiceResults),
      };
    },

    async getAdminPlatformBilling(vendorId) {
      const [pendingFees, invoices] = await Promise.all([
        repository.listPendingAgreementFees(vendorId),
        repository.listInvoices(vendorId),
      ]);
      const feeResults = pendingFees.map(feeToResult);
      const invoiceResults = invoices.map(invoiceToResult);

      return {
        issuedInvoices: invoiceResults,
        pendingFees: feeResults,
        totals: totalsFor(feeResults, invoiceResults),
      };
    },

    async createVendorInvoice(ctx, input) {
      assertValidBillingPeriod(input.billingPeriodStart, input.billingPeriodEnd);

      return repository.transaction(async (repo) => {
        const vendor = await repo.findVendorById(input.vendorId);

        if (!vendor) {
          throw new NotFoundError("Vendor was not found.");
        }

        const existingInvoice = await repo.findInvoiceByVendorAndPeriod(
          input.vendorId,
          input.billingPeriodStart,
          input.billingPeriodEnd,
        );

        if (existingInvoice) {
          return invoiceToResult(existingInvoice);
        }

        const settings = settingsToResult(await repo.findBillingSettingsByVendorId(input.vendorId));
        const pendingFees = await repo.listPendingAgreementFeesForPeriod(
          input.vendorId,
          dateBoundary(input.billingPeriodStart),
          dateBoundary(input.billingPeriodEnd, true),
        );
        const billableFees = pendingFees.filter((fee) => fee.feeAmountCents > 0);

        if (billableFees.length === 0) {
          throw new BusinessRuleError(
            "No billable pending platform agreement fees exist for this vendor and period.",
          );
        }

        const issuedAt = new Date();
        const totalCents = billableFees.reduce((sum, fee) => sum + fee.feeAmountCents, 0);
        const invoice = await repo.createVendorInvoice({
          billingPeriodEnd: input.billingPeriodEnd,
          billingPeriodStart: input.billingPeriodStart,
          currency: "usd",
          dueAt: dueAtFrom(issuedAt, settings.invoiceTermsDays),
          invoiceNumber: invoiceNumberFor(
            input.vendorId,
            input.billingPeriodStart,
            input.billingPeriodEnd,
          ),
          issuedAt,
          status: "issued",
          subtotalCents: totalCents,
          totalCents,
          vendorId: input.vendorId,
        });
        await repo.createVendorInvoiceLineItems(
          billableFees.map((fee) => ({
            amountCents: fee.feeAmountCents,
            currency: fee.currency,
            description: `foodtruckzs signed-agreement fee for agreement ${fee.agreementId}`,
            metadata: {
              agreementFeeBasisPoints: fee.feePercentageBasisPoints,
              signedAgreementTotalCents: fee.signedAgreementTotalCents,
            },
            platformAgreementFeeId: fee.id,
            type: "agreement_fee",
            vendorInvoiceId: invoice.id,
          })),
        );
        await repo.markFeesInvoiced(
          billableFees.map((fee) => fee.id),
          invoice.id,
        );
        await repo.createAuditLog({
          action: "vendor_invoice.issued",
          actorRole: "platform_admin",
          actorUserId: ctx.userId,
          entityId: invoice.id,
          entityType: "vendor_invoice",
          newState: {
            feeIds: billableFees.map((fee) => fee.id),
            totalCents,
          },
          previousState: null,
          requestId: ctx.requestId,
          vendorId: input.vendorId,
        });
        await repo.createOutboxEvent({
          aggregateId: invoice.id,
          aggregateType: "vendor_invoice",
          eventType: "vendor_invoice.issued",
          payload: {
            invoiceId: invoice.id,
            totalCents,
            vendorId: input.vendorId,
          },
          requestId: ctx.requestId,
        });

        const createdInvoice = await repo.findInvoiceByVendorAndPeriod(
          input.vendorId,
          input.billingPeriodStart,
          input.billingPeriodEnd,
        );

        if (!createdInvoice) {
          throw new Error("Created invoice could not be loaded.");
        }

        return invoiceToResult(createdInvoice);
      });
    },
  };
}

export { calculateAgreementFeeCents };
