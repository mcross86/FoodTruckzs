"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type QuoteDetail,
  type RfqDetail,
} from "@/lib/rfq-api";

type CustomerRfqDetailProps = {
  rfqId: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "Not provided";
  return JSON.stringify(value);
}

function budgetLabel(rfq: RfqDetail): string {
  const budget = rfq.requirements.budget ?? {};
  const min = typeof budget.budgetMinCents === "number" ? budget.budgetMinCents : null;
  const max = typeof budget.budgetMaxCents === "number" ? budget.budgetMaxCents : null;

  if (min === null && max === null) {
    return "Budget guidance requested";
  }

  return `${moneyLabel(min)} - ${moneyLabel(max)}`;
}

function SectionSummary({
  fields,
  title,
}: {
  fields: { label: string; value: unknown }[];
  title: string;
}) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <dl
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {fields.map((field) => (
          <div key={field.label}>
            <dt style={{ fontWeight: 700 }}>{field.label}</dt>
            <dd style={{ margin: 0 }}>{stringValue(field.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CustomerRfqDetail({ rfqId }: CustomerRfqDetailProps) {
  const session = useAuthSession();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [quotes, setQuotes] = useState<QuoteDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [sendingThreadId, setSendingThreadId] = useState<string | null>(null);

  async function loadRfq() {
    setError(null);

    if (!session.accessToken.trim()) {
      setError("Log in as the RFQ customer or choose a saved customer account to load this RFQ.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/rfqs/${encodeURIComponent(rfqId)}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`RFQ detail failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setRfq(result.data);
      const quotesResult = await rfqApiRequest<QuoteDetail[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/rfqs/${encodeURIComponent(rfqId)}/quotes`,
        token: session.accessToken,
      });
      setQuotes(quotesResult.ok && quotesResult.data ? quotesResult.data : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "RFQ detail failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendThreadMessage(threadId: string) {
    const body = (messageDrafts[threadId] ?? "").trim();
    setError(null);

    if (!session.accessToken.trim()) {
      setError("Log in as the RFQ customer to send a clarification response.");
      return;
    }

    if (!body) {
      setError("Enter a clarification response before sending.");
      return;
    }

    setSendingThreadId(threadId);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: { body },
        method: "POST",
        path: `/api/v1/message-threads/${encodeURIComponent(threadId)}/messages`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Message send failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfq(result.data);
      setMessageDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Message send failed.");
    } finally {
      setSendingThreadId(null);
    }
  }

  const sections = rfq?.requirements ?? {};
  const eventBasics = sections.event_basics ?? {};
  const venue = sections.venue_logistics ?? {};
  const service = sections.service_style ?? {};
  const food = sections.food_requirements ?? {};
  const equipment = sections.equipment ?? {};
  const budget = sections.budget ?? {};
  const attachments = rfq?.attachments ?? [];

  function vendorNameForThread(threadVendorId: string): string {
    return (
      rfq?.vendorTargets.find((target) => target.vendor.id === threadVendorId)?.vendor
        .businessName ?? "Vendor"
    );
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/customer/dashboard">Back to customer dashboard</Link>
        <h1>Customer RFQ Detail</h1>
        <p>
          This page tracks the submitted RFQ packet, vendor responses, risks, messages, and status
          history. Quote cards, agreement signing links, and clarification responses use the current
          backend APIs.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
        <button disabled={isLoading} onClick={() => void loadRfq()} type="button">
          {isLoading ? "Loading..." : "Load RFQ detail"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      {!rfq ? (
        <section style={{ background: "#fff4df", borderRadius: 16, marginTop: 20, padding: 20 }}>
          <h2>RFQ not loaded</h2>
          <p>
            Load the authenticated RFQ detail to view the event packet and vendor response status.
          </p>
        </section>
      ) : null}

      {rfq ? (
        <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 6px" }}>
              {statusLabel(rfq.status)}
            </p>
            <h2 style={{ margin: "0 0 8px" }}>{rfq.event.eventName}</h2>
            <p style={{ margin: 0 }}>
              {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
              {rfq.address ? `${rfq.address.city}, ${rfq.address.state}` : "Venue TBD"}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Operational health</h2>
            <dl
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <dt style={{ fontWeight: 700 }}>Completeness</dt>
                <dd style={{ margin: 0 }}>
                  {rfq.completenessScore}% ({statusLabel(rfq.completenessStatus)})
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Budget</dt>
                <dd style={{ margin: 0 }}>{budgetLabel(rfq)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Risk flags</dt>
                <dd style={{ margin: 0 }}>{rfq.riskFlags.length}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700 }}>Attachments</dt>
                <dd style={{ margin: 0 }}>{attachments.length}</dd>
              </div>
            </dl>
            {rfq.riskFlags.length > 0 ? (
              <ul>
                {rfq.riskFlags.map((flag) => (
                  <li key={flag.code}>
                    <strong>{statusLabel(flag.severity)}:</strong> {flag.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <SectionSummary
            fields={[
              { label: "Customer type", value: eventBasics.customerType },
              { label: "Open to public", value: eventBasics.isOpenToPublic },
              { label: "Recurring", value: eventBasics.isRecurring },
              { label: "Primary contact", value: eventBasics.primaryContact },
            ]}
            title="Event basics"
          />
          <SectionSummary
            fields={[
              { label: "Venue", value: venue.venueName },
              {
                label: "Address",
                value: rfq.address
                  ? `${rfq.address.line1}, ${rfq.address.city}, ${rfq.address.state}`
                  : null,
              },
              { label: "Truck parking", value: venue.truckParkingLocation ?? venue.parkingNotes },
              { label: "Power available", value: venue.powerAvailable },
              { label: "Generator allowed", value: venue.generatorAllowed },
              { label: "Permit responsibility", value: venue.permitResponsibility },
              { label: "COI required", value: venue.coiRequired },
            ]}
            title="Venue and logistics"
          />
          <SectionSummary
            fields={[
              { label: "Service style", value: service.desiredServiceStyle },
              { label: "Meal period", value: service.mealPeriod },
              { label: "Guest payment model", value: service.guestPaymentModel },
              { label: "Guest flow", value: service.guestArrivalPattern },
              { label: "Service points", value: service.servicePointsRequested },
            ]}
            title="Service style"
          />
          <SectionSummary
            fields={[
              { label: "Cuisine preferences", value: food.cuisinePreferences },
              { label: "Menu preference", value: food.menuPreference },
              { label: "Meal components", value: food.mealComponents },
              { label: "Dietary accommodations", value: food.dietaryAccommodations },
              { label: "Allergy notes", value: food.allergyNotes ?? food.otherAllergyNotes },
            ]}
            title="Food requirements"
          />
          <SectionSummary
            fields={[
              { label: "Vendor serviceware", value: equipment.expectsVendorServiceware },
              { label: "Tables or tenting", value: equipment.expectsVendorTablesOrTenting },
              { label: "Requested equipment", value: equipment.requests },
              { label: "Trash cleanup", value: equipment.trashCleanup },
            ]}
            title="Equipment and supplies"
          />
          <SectionSummary
            fields={[
              { label: "Budget flexibility", value: budget.budgetFlexibility },
              { label: "Deposit readiness", value: budget.depositReadiness },
              { label: "Payer", value: budget.payer },
              { label: "Quote deadline", value: budget.quoteResponseDeadline },
              { label: "Invoice needed", value: budget.invoiceOrReceiptNeeded },
              { label: "PO required", value: budget.purchaseOrderRequired },
            ]}
            title="Budget and payment timing"
          />

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Quote cards</h2>
            {quotes.length === 0 ? (
              <p>No quotes are ready for review yet.</p>
            ) : (
              <ul>
                {quotes.map((quote) => (
                  <li key={quote.quote.id}>
                    <strong>{quote.vendor.businessName}</strong> ·{" "}
                    {moneyLabel(quote.quote.totalCents)} · {statusLabel(quote.quote.status)} ·
                    Revision {quote.currentRevision.revisionNumber} ·{" "}
                    <Link href={`/customer/quotes/${quote.quote.id}`}>Review quote</Link>
                    {quote.agreement ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/customer/agreements/${quote.agreement.agreement.id}`}>
                          Review agreement
                        </Link>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Vendor responses</h2>
            {rfq.vendorTargets.length === 0 ? (
              <p>Matching vendors are still being selected.</p>
            ) : null}
            <div style={{ display: "grid", gap: 10 }}>
              {rfq.vendorTargets.map((target) => (
                <article
                  key={target.id}
                  style={{ background: "#f6f6f6", borderRadius: 12, padding: 12 }}
                >
                  <strong>{target.vendor.businessName}</strong>
                  <p style={{ margin: "4px 0" }}>
                    Status: {statusLabel(target.status)} · Minimum:{" "}
                    {moneyLabel(target.vendor.cateringMinimumCents)}
                  </p>
                  {target.rejectedReason ? (
                    <p>Reason: {statusLabel(target.rejectedReason)}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Messages and clarifications</h2>
            {rfq.threads.length === 0 ? (
              <p>No clarification messages yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {rfq.threads.map((thread) => {
                  const messages = rfq.messages.filter((message) => message.threadId === thread.id);

                  return (
                    <article
                      key={thread.id}
                      style={{ background: "#f6f6f6", borderRadius: 12, padding: 14 }}
                    >
                      <h3 style={{ marginTop: 0 }}>{vendorNameForThread(thread.vendorId)}</h3>
                      {thread.unreadCount > 0 ? (
                        <p style={{ color: "#8a4b00", fontWeight: 700 }}>
                          {thread.unreadCount} unread message
                          {thread.unreadCount === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      {messages.length === 0 ? (
                        <p>No messages in this thread yet.</p>
                      ) : (
                        <ul>
                          {messages.map((message) => (
                            <li key={message.id}>
                              {formatDate(message.createdAt)}: {message.body}
                            </li>
                          ))}
                        </ul>
                      )}
                      <label style={{ display: "grid", gap: 6 }}>
                        Respond to this vendor
                        <textarea
                          onChange={(event) =>
                            setMessageDrafts((drafts) => ({
                              ...drafts,
                              [thread.id]: event.target.value,
                            }))
                          }
                          placeholder="Share parking details, power updates, guest count changes, or other clarification."
                          rows={3}
                          style={{ padding: 10 }}
                          value={messageDrafts[thread.id] ?? ""}
                        />
                      </label>
                      <button
                        disabled={sendingThreadId === thread.id}
                        onClick={() => void sendThreadMessage(thread.id)}
                        type="button"
                      >
                        {sendingThreadId === thread.id
                          ? "Sending..."
                          : "Send clarification response"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
            <p>Additional uploads remain deferred until RFQ attachment upload APIs are added.</p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Status timeline</h2>
            <ol>
              {rfq.statusHistory.map((history) => (
                <li key={`${history.toStatus}-${history.createdAt}`}>
                  {formatDate(history.createdAt)}:{" "}
                  {history.fromStatus ? `${statusLabel(history.fromStatus)} -> ` : ""}
                  {statusLabel(history.toStatus)}
                  {history.reason ? ` (${history.reason})` : ""}
                </li>
              ))}
            </ol>
          </section>

          <section style={{ border: "1px dashed #bbb", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Deferred customer actions</h2>
            <p>
              RFQ cancellation, additional post-submit uploads, milestone/final balance payments,
              and polished account UI remain open. Quote review, agreement signing, and required
              deposit payment links appear above when those workflow records exist.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
