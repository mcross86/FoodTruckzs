"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type QuoteDetail,
  type QuoteLineItemPayload,
  type QuoteWritePayload,
  type RfqDetail,
} from "@/lib/rfq-api";

type VendorQuoteBuilderProps = {
  rfqId: string;
};

const initialLineItems: QuoteLineItemPayload[] = [
  {
    name: "Food package",
    quantity: 100,
    taxable: true,
    type: "food",
    unit: "guest",
    unitAmountCents: 1500,
  },
  { name: "Service fee", quantity: 1, type: "service", unit: "event", unitAmountCents: 20000 },
  { name: "Staffing", quantity: 2, type: "staffing", unit: "staff", unitAmountCents: 15000 },
  { name: "Travel", quantity: 1, type: "travel", unit: "event", unitAmountCents: 5000 },
  {
    name: "Rentals/equipment",
    quantity: 1,
    taxable: true,
    type: "rental",
    unit: "event",
    unitAmountCents: 10000,
  },
  { name: "Gratuity", quantity: 1, type: "gratuity", unit: "event", unitAmountCents: 10000 },
  {
    name: "Service charge",
    quantity: 1,
    type: "service_charge",
    unit: "event",
    unitAmountCents: 8000,
  },
  { name: "Overtime rate", quantity: 4, type: "overtime", unit: "hour", unitAmountCents: 5000 },
  { name: "Estimated taxes", quantity: 1, type: "tax", unit: "event", unitAmountCents: 17000 },
];

function inputDateTime(value: Date): string {
  return value.toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

function lineTotal(lineItem: QuoteLineItemPayload): number {
  const total = Math.abs(lineItem.quantity * lineItem.unitAmountCents);
  return lineItem.type === "discount" ? -total : total;
}

export function VendorQuoteBuilder({ rfqId }: VendorQuoteBuilderProps) {
  const session = useAuthSession();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [existingQuote, setExistingQuote] = useState<QuoteDetail | null>(null);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [depositRequiredCents, setDepositRequiredCents] = useState(50_000);
  const [expiresAt, setExpiresAt] = useState(
    inputDateTime(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
  );
  const [menuSummary, setMenuSummary] = useState("Recommended catering menu based on the RFQ.");
  const [serviceStyle, setServiceStyle] = useState("Truck onsite hosted meal service.");
  const [notes, setNotes] = useState("Initial quote based on the submitted RFQ.");
  const [assumptions, setAssumptions] = useState(
    "Pricing assumes the submitted guest count.\nTruck access and parking are available as described.",
  );
  const [exclusions, setExclusions] = useState(
    "Alcohol service is excluded.\nCustomer handles venue permits unless otherwise stated.",
  );
  const [cancellationPolicySummary, setCancellationPolicySummary] = useState(
    "Deposit is non-refundable inside 7 days of the event.",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const visibleTotalCents = useMemo(
    () =>
      lineItems.filter((item) => !item.isInternal).reduce((sum, item) => sum + lineTotal(item), 0),
    [lineItems],
  );

  async function loadQuoteContext() {
    setError(null);
    setSuccess(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor before loading quote context.");
      return;
    }

    setIsLoading(true);

    try {
      const [rfqResult, quoteResult] = await Promise.all([
        rfqApiRequest<RfqDetail>({
          apiBaseUrl: session.apiBaseUrl,
          path: `/api/v1/rfqs/${encodeURIComponent(rfqId)}`,
          token: session.accessToken,
        }),
        rfqApiRequest<QuoteDetail[]>({
          apiBaseUrl: session.apiBaseUrl,
          path: `/api/v1/rfqs/${encodeURIComponent(rfqId)}/quotes`,
          token: session.accessToken,
        }),
      ]);

      if (!rfqResult.ok || !rfqResult.data) {
        throw new Error(
          `RFQ load failed with ${rfqResult.status}: ${JSON.stringify(rfqResult.body)}`,
        );
      }

      setRfq(rfqResult.data);

      if (quoteResult.ok && quoteResult.data) {
        const currentQuote =
          quoteResult.data.find((quote) => quote.quote.vendorId === session.activeVendorId) ?? null;
        setExistingQuote(currentQuote);

        if (currentQuote) {
          setLineItems(
            currentQuote.currentRevision.lineItems.map((item) => ({
              description: item.description ?? undefined,
              isInternal: item.isInternal,
              isOptional: item.isOptional,
              name: item.name,
              quantity: item.quantity,
              taxable: item.taxable,
              type: item.type as QuoteLineItemPayload["type"],
              unit: item.unit,
              unitAmountCents: item.unitAmountCents,
            })),
          );
          setDepositRequiredCents(currentQuote.currentRevision.depositRequiredCents);
          setExpiresAt(inputDateTime(new Date(currentQuote.currentRevision.expiresAt)));
          setMenuSummary(currentQuote.currentRevision.menuSummary ?? "");
          setServiceStyle(currentQuote.currentRevision.serviceStyle ?? "");
          setNotes("Revision notes required for revised quotes.");
          setAssumptions(currentQuote.currentRevision.assumptions.join("\n"));
          setExclusions(currentQuote.currentRevision.exclusions.join("\n"));
          setCancellationPolicySummary(
            currentQuote.currentRevision.cancellationPolicySummary ?? "",
          );
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Quote context load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateLineItem(index: number, patch: Partial<QuoteLineItemPayload>) {
    setLineItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function saveQuote() {
    setError(null);
    setSuccess(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor before sending a quote.");
      return;
    }

    if (depositRequiredCents > visibleTotalCents) {
      setError("Deposit cannot exceed the current quote total.");
      return;
    }

    setIsSaving(true);

    try {
      const payload: QuoteWritePayload = {
        assumptions: assumptions
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        cancellationPolicySummary: cancellationPolicySummary.trim() || undefined,
        depositRequiredCents,
        exclusions: exclusions
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        expiresAt: fromLocalDateTime(expiresAt),
        lineItems,
        menuSummary,
        notes,
        paymentSchedule: [
          {
            amountCents: depositRequiredCents,
            dueAt: fromLocalDateTime(expiresAt),
            label: "Deposit / down payment",
            type: "deposit",
          },
          {
            amountCents: visibleTotalCents - depositRequiredCents,
            dueAt: rfq?.event.startsAt,
            label: "Final balance",
            type: "final_balance",
          },
        ],
        serviceStyle,
        vendorId: session.activeVendorId,
      };
      const result = await rfqApiRequest<QuoteDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: existingQuote ? { ...payload, vendorId: undefined } : payload,
        method: "POST",
        path: existingQuote
          ? `/api/v1/quotes/${encodeURIComponent(existingQuote.quote.id)}/revisions`
          : `/api/v1/rfqs/${encodeURIComponent(rfqId)}/quotes`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Quote save failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setExistingQuote(result.data);
      setSuccess(`Quote revision ${result.data.currentRevision.revisionNumber} sent.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Quote save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1180 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href={`/vendor/rfqs/${rfqId}`}>Back to RFQ event packet</Link>
        <h1>Vendor Quote Builder</h1>
        <p>Create or revise a customer-facing quote. Totals are calculated again on the server.</p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireVendor session={session} title="Vendor Account" />
        <button disabled={isLoading} onClick={() => void loadQuoteContext()} type="button">
          {isLoading ? "Loading..." : "Load RFQ and quote"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}
      {success ? (
        <section style={{ background: "#e8ffe8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {success}
        </section>
      ) : null}

      <section style={{ background: "#fff4df", borderRadius: 18, marginTop: 20, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>{rfq?.event.eventName ?? "RFQ not loaded"}</h2>
        <p>
          Status: {rfq ? statusLabel(rfq.status) : "Unknown"} · Local preview total:{" "}
          {moneyLabel(visibleTotalCents)}
          {existingQuote ? ` · Revising quote ${existingQuote.quote.id}` : " · New quote"}
        </p>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 18,
          display: "grid",
          gap: 12,
          marginTop: 20,
          padding: 18,
        }}
      >
        <h2 style={{ margin: 0 }}>Quote Terms</h2>
        <label>
          Service style
          <input
            onChange={(event) => setServiceStyle(event.target.value)}
            style={{ display: "block", width: "100%" }}
            value={serviceStyle}
          />
        </label>
        <label>
          Menu summary
          <textarea
            onChange={(event) => setMenuSummary(event.target.value)}
            rows={3}
            style={{ display: "block", width: "100%" }}
            value={menuSummary}
          />
        </label>
        <label>
          Notes / revision notes
          <textarea
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            style={{ display: "block", width: "100%" }}
            value={notes}
          />
        </label>
        <label>
          Quote expiration
          <input
            onChange={(event) => setExpiresAt(event.target.value)}
            type="datetime-local"
            value={expiresAt}
          />
        </label>
        <label>
          Deposit required (cents)
          <input
            onChange={(event) => setDepositRequiredCents(Number(event.target.value))}
            type="number"
            value={depositRequiredCents}
          />
        </label>
        <label>
          Assumptions
          <textarea
            onChange={(event) => setAssumptions(event.target.value)}
            rows={4}
            style={{ display: "block", width: "100%" }}
            value={assumptions}
          />
        </label>
        <label>
          Exclusions
          <textarea
            onChange={(event) => setExclusions(event.target.value)}
            rows={4}
            style={{ display: "block", width: "100%" }}
            value={exclusions}
          />
        </label>
        <label>
          Cancellation policy summary
          <textarea
            onChange={(event) => setCancellationPolicySummary(event.target.value)}
            rows={3}
            style={{ display: "block", width: "100%" }}
            value={cancellationPolicySummary}
          />
        </label>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 18, marginTop: 20, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Line Items</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {lineItems.map((lineItem, index) => (
            <div
              key={`${lineItem.type}-${index}`}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: 12,
              }}
            >
              <input
                aria-label="Line item name"
                onChange={(event) => updateLineItem(index, { name: event.target.value })}
                value={lineItem.name}
              />
              <select
                onChange={(event) =>
                  updateLineItem(index, {
                    type: event.target.value as QuoteLineItemPayload["type"],
                  })
                }
                value={lineItem.type}
              >
                {[
                  "food",
                  "service",
                  "staffing",
                  "travel",
                  "rental",
                  "gratuity",
                  "service_charge",
                  "overtime",
                  "tax",
                  "discount",
                  "fee",
                ].map((type) => (
                  <option key={type} value={type}>
                    {statusLabel(type)}
                  </option>
                ))}
              </select>
              <input
                aria-label="Quantity"
                onChange={(event) =>
                  updateLineItem(index, { quantity: Number(event.target.value) })
                }
                type="number"
                value={lineItem.quantity}
              />
              <input
                aria-label="Unit"
                onChange={(event) => updateLineItem(index, { unit: event.target.value })}
                value={lineItem.unit}
              />
              <input
                aria-label="Unit amount cents"
                onChange={(event) =>
                  updateLineItem(index, { unitAmountCents: Number(event.target.value) })
                }
                type="number"
                value={lineItem.unitAmountCents}
              />
              <label>
                <input
                  checked={lineItem.taxable ?? false}
                  onChange={(event) => updateLineItem(index, { taxable: event.target.checked })}
                  type="checkbox"
                />{" "}
                Taxable
              </label>
              <label>
                <input
                  checked={lineItem.isOptional ?? false}
                  onChange={(event) => updateLineItem(index, { isOptional: event.target.checked })}
                  type="checkbox"
                />{" "}
                Optional
              </label>
              <label>
                <input
                  checked={lineItem.isInternal ?? false}
                  onChange={(event) => updateLineItem(index, { isInternal: event.target.checked })}
                  type="checkbox"
                />{" "}
                Internal
              </label>
              <strong>{moneyLabel(lineTotal(lineItem))}</strong>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setLineItems((items) => [
              ...items,
              {
                name: "New line item",
                quantity: 1,
                type: "fee",
                unit: "event",
                unitAmountCents: 0,
              },
            ])
          }
          style={{ marginTop: 12 }}
          type="button"
        >
          Add line item
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 18, marginTop: 20, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Payment Schedule Preview</h2>
        <p>
          Deposit: {moneyLabel(depositRequiredCents)} · Final balance:{" "}
          {moneyLabel(visibleTotalCents - depositRequiredCents)}
        </p>
        <button disabled={isSaving} onClick={() => void saveQuote()} type="button">
          {isSaving ? "Sending..." : existingQuote ? "Send revised quote" : "Send quote"}
        </button>
      </section>
    </main>
  );
}
