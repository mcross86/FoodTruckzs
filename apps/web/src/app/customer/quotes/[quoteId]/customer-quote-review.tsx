"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useCustomerAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type QuoteDetail,
} from "@/lib/rfq-api";

type CustomerQuoteReviewProps = {
  quoteId: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CustomerQuoteReview({ quoteId }: CustomerQuoteReviewProps) {
  const session = useCustomerAuthSession();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  async function loadQuote() {
    setError(null);
    setSuccess(null);

    if (!session.accessToken.trim()) {
      setError("Log in as the quote customer or choose a saved customer account to load this quote.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<QuoteDetail>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/quotes/${encodeURIComponent(quoteId)}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Quote load failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setQuote(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Quote load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runQuoteAction(action: "accept" | "decline" | "request-revision") {
    if (!quote) return;
    setError(null);
    setSuccess(null);
    setIsMutating(true);

    try {
      const result = await rfqApiRequest<QuoteDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body:
          action === "accept"
            ? { acceptedRevisionId: quote.quote.currentRevisionId }
            : action === "decline"
              ? { reason: declineReason || undefined }
              : {
                  message: revisionMessage,
                  reasonCodes: ["other"],
                  requestedRevisionId: quote.quote.currentRevisionId,
                },
        method: "POST",
        path: `/api/v1/quotes/${encodeURIComponent(quote.quote.id)}/${action}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Quote action failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setQuote(result.data);
      setSuccess(
        action === "accept"
          ? "Quote accepted. Agreement draft is ready for signature."
          : action === "decline"
            ? "Quote declined."
            : "Revision request sent.",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Quote action failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const revision = quote?.currentRevision;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        {quote ? (
          <Link href={`/customer/rfqs/${quote.quote.rfqId}`}>Back to RFQ detail</Link>
        ) : null}
        <h1>Customer Quote Review</h1>
        <p>
          Review the current vendor quote revision, terms, assumptions, exclusions, and event
          payment schedule. foodtruckzs platform billing is invoiced to the caterer separately and
          is not a customer-facing charge.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
        <button disabled={isLoading} onClick={() => void loadQuote()} type="button">
          {isLoading ? "Loading..." : "Load quote"}
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

      {!quote || !revision ? (
        <section style={{ background: "#fff4df", borderRadius: 16, marginTop: 20, padding: 20 }}>
          <h2>Quote not loaded</h2>
          <p>Load the authenticated quote to review customer-facing terms.</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 6px" }}>
              {statusLabel(quote.quote.status)} · Revision {revision.revisionNumber}
            </p>
            <h2 style={{ margin: "0 0 8px" }}>{quote.vendor.businessName}</h2>
            <p style={{ margin: 0 }}>
              {quote.rfq.eventName} · {quote.rfq.estimatedHeadcount} guests · Expires{" "}
              {formatDate(revision.expiresAt)}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Quote Summary</h2>
            <dl
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <dt style={{ fontWeight: 700 }}>Subtotal</dt>
                <dd>{moneyLabel(revision.subtotalCents)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Vendor/service fees</dt>
                <dd>{moneyLabel(revision.feesCents)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Taxes</dt>
                <dd>{moneyLabel(revision.taxCents)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Total</dt>
                <dd>{moneyLabel(revision.totalCents)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Deposit</dt>
                <dd>{moneyLabel(revision.depositRequiredCents)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Service style</dt>
                <dd>{revision.serviceStyle}</dd>
              </div>
            </dl>
            <p>
              <strong>Menu:</strong> {revision.menuSummary}
            </p>
            <p>
              <strong>Cancellation policy:</strong>{" "}
              {revision.cancellationPolicySummary ?? "Not listed"}
            </p>
            <p>
              This total reflects customer-visible event charges from the vendor quote. It does not
              include foodtruckzs signed-agreement platform fees.
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Line Items</h2>
            <ul>
              {revision.lineItems
                .filter((lineItem) => !lineItem.isInternal)
                .map((lineItem) => (
                  <li key={lineItem.id}>
                    <strong>{statusLabel(lineItem.type)}:</strong> {lineItem.name} ·{" "}
                    {lineItem.quantity} {lineItem.unit} · {moneyLabel(lineItem.totalAmountCents)}
                    {lineItem.isOptional ? " · optional" : ""}
                  </li>
                ))}
            </ul>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Payment Schedule</h2>
            <ul>
              {revision.paymentSchedule.map((item) => (
                <li key={item.id}>
                  <strong>{statusLabel(item.type)}:</strong> {item.label} ·{" "}
                  {moneyLabel(item.amountCents)} · due {formatDate(item.dueAt)}
                </li>
              ))}
            </ul>
          </section>

          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              display: "grid",
              gap: 12,
              padding: 18,
            }}
          >
            <h2 style={{ margin: 0 }}>Assumptions and Exclusions</h2>
            <div>
              <h3>Assumptions</h3>
              <ul>
                {revision.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Exclusions</h3>
              <ul>
                {revision.exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              display: "grid",
              gap: 12,
              padding: 18,
            }}
          >
            <h2 style={{ margin: 0 }}>Actions</h2>
            <button
              disabled={isMutating}
              onClick={() => void runQuoteAction("accept")}
              type="button"
            >
              Accept current revision
            </button>
            <label>
              Revision request
              <textarea
                onChange={(event) => setRevisionMessage(event.target.value)}
                rows={4}
                style={{ display: "block", width: "100%" }}
                value={revisionMessage}
              />
            </label>
            <button
              disabled={isMutating || !revisionMessage.trim()}
              onClick={() => void runQuoteAction("request-revision")}
              type="button"
            >
              Request revision
            </button>
            <label>
              Decline reason
              <textarea
                onChange={(event) => setDeclineReason(event.target.value)}
                rows={3}
                style={{ display: "block", width: "100%" }}
                value={declineReason}
              />
            </label>
            <button
              disabled={isMutating}
              onClick={() => void runQuoteAction("decline")}
              type="button"
            >
              Decline quote
            </button>
            {quote.agreement ? (
              <Link href={`/customer/agreements/${quote.agreement.agreement.id}`}>
                Review and sign agreement
              </Link>
            ) : null}
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Revision History</h2>
            <ul>
              {quote.revisions.map((historyRevision) => (
                <li key={historyRevision.id}>
                  Revision {historyRevision.revisionNumber} ·{" "}
                  {moneyLabel(historyRevision.totalCents)} · created{" "}
                  {formatDate(historyRevision.createdAt)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
