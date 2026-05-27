export const QUOTE_LINE_ITEM_TYPES = [
  "food",
  "service",
  "staffing",
  "travel",
  "rental",
  "fee",
  "tax",
  "gratuity",
  "service_charge",
  "overtime",
  "discount",
] as const;

export type QuoteLineItemType = (typeof QUOTE_LINE_ITEM_TYPES)[number];

export type QuoteCalculationLineItemInput = {
  isInternal?: boolean;
  quantity: number;
  type: QuoteLineItemType;
  unitAmountCents: number;
};

export type CalculatedQuoteLineItem = QuoteCalculationLineItemInput & {
  totalAmountCents: number;
};

export type QuoteTotals = {
  feesCents: number;
  lineItems: CalculatedQuoteLineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export type PaymentScheduleCalculationItemInput = {
  amountCents: number;
  type: string;
};

export type PaymentScheduleTotals = {
  depositCents: number;
  itemCount: number;
  totalCents: number;
};

const feeTypes = new Set<QuoteLineItemType>([
  "service",
  "staffing",
  "travel",
  "rental",
  "fee",
  "gratuity",
  "service_charge",
  "overtime",
]);

function calculateLineTotal(lineItem: QuoteCalculationLineItemInput): number {
  const unsignedTotal = Math.abs(lineItem.quantity * lineItem.unitAmountCents);
  return lineItem.type === "discount" ? -unsignedTotal : unsignedTotal;
}

export function calculateQuoteTotals(inputLineItems: QuoteCalculationLineItemInput[]): QuoteTotals {
  const lineItems = inputLineItems.map((lineItem) => ({
    ...lineItem,
    totalAmountCents: calculateLineTotal(lineItem),
  }));
  const customerVisibleLineItems = lineItems.filter((lineItem) => !lineItem.isInternal);
  const subtotalCents = customerVisibleLineItems.reduce((sum, lineItem) => {
    if (lineItem.type === "food" || lineItem.type === "discount") {
      return sum + lineItem.totalAmountCents;
    }

    return sum;
  }, 0);
  const feesCents = customerVisibleLineItems.reduce((sum, lineItem) => {
    if (feeTypes.has(lineItem.type)) {
      return sum + lineItem.totalAmountCents;
    }

    return sum;
  }, 0);
  const taxCents = customerVisibleLineItems.reduce((sum, lineItem) => {
    if (lineItem.type === "tax") {
      return sum + lineItem.totalAmountCents;
    }

    return sum;
  }, 0);

  return {
    feesCents,
    lineItems,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + feesCents + taxCents,
  };
}

export function calculatePaymentScheduleTotals(
  scheduleItems: PaymentScheduleCalculationItemInput[],
): PaymentScheduleTotals {
  return {
    depositCents: scheduleItems
      .filter((item) => item.type === "deposit")
      .reduce((sum, item) => sum + item.amountCents, 0),
    itemCount: scheduleItems.length,
    totalCents: scheduleItems.reduce((sum, item) => sum + item.amountCents, 0),
  };
}
