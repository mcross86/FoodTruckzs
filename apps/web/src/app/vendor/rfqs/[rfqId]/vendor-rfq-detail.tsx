"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import {
  formatRfqNumber,
  rfqApiRequest,
  rfqLinkIdentifier,
  statusLabel,
  type RfqDetail,
} from "@/lib/rfq-api";

import {
  budgetLabel,
  cityStateLabel,
  formatDate,
  stringValue,
  targetForVendor,
} from "../../rfq-shared";

type VendorRfqDetailProps = {
  rfqId: string;
};

const clarificationTemplates = [
  "Where can the truck park, and how much flat space is available for the service line?",
  "Is power available, and is generator use allowed if power is unavailable?",
  "Who is responsible for permits, COI requirements, and any venue restrictions?",
  "What is the final guaranteed guest count and desired meals per hour?",
  "Can the menu be limited for speed during the requested service window?",
];

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

export function VendorRfqDetail({ rfqId }: VendorRfqDetailProps) {
  const session = useVendorAuthSession();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [clarificationBody, setClarificationBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [declineReason, setDeclineReason] = useState("unavailable");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const loadRfq = useCallback(async () => {
    setError(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
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
        throw new Error(
          `Vendor RFQ detail failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfq(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Vendor RFQ detail failed.");
    } finally {
      setIsLoading(false);
    }
  }, [rfqId, session]);

  useEffect(() => {
    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      return;
    }

    void loadRfq();
  }, [loadRfq, session.accessToken, session.activeVendorId]);

  async function runTargetAction(action: "accept" | "reject") {
    if (!rfq) return;
    const target = targetForVendor(rfq, session.activeVendorId);
    setError(null);

    if (!target) {
      setError("This RFQ does not expose a target for the selected active vendor.");
      return;
    }

    setIsMutating(true);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body:
          action === "accept"
            ? { note: "Accepted from RFQ event packet." }
            : { note: "Declined from RFQ event packet.", reasonCode: declineReason },
        method: "POST",
        path: `/api/v1/rfqs/${encodeURIComponent(rfqLinkIdentifier(rfq))}/vendor-targets/${encodeURIComponent(target.id)}/${action}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `RFQ ${action} failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfq(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `RFQ ${action} failed.`);
    } finally {
      setIsMutating(false);
    }
  }

  async function requestClarification() {
    const body = clarificationBody.trim();
    setError(null);

    if (!body) {
      setError("Enter a clarification question first.");
      return;
    }

    setIsMutating(true);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: { body },
        method: "POST",
        path: `/api/v1/rfqs/${encodeURIComponent(rfq ? rfqLinkIdentifier(rfq) : rfqId)}/request-clarification`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Clarification request failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfq(result.data);
      setClarificationBody("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Clarification request failed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function sendMessage(threadId: string) {
    const body = messageBody.trim();
    setError(null);

    if (!body) {
      setError("Enter a message before sending.");
      return;
    }

    setIsMutating(true);

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
      setMessageBody("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Message send failed.");
    } finally {
      setIsMutating(false);
    }
  }

  async function markRead(threadId: string) {
    setError(null);
    setIsMutating(true);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: {},
        method: "POST",
        path: `/api/v1/message-threads/${encodeURIComponent(threadId)}/read`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Mark read failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setRfq(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Mark read failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const target = rfq ? targetForVendor(rfq, session.activeVendorId) : undefined;
  const vendorThread = rfq?.threads.find((thread) => thread.vendorId === session.activeVendorId);
  const sections = rfq?.requirements ?? {};
  const eventBasics = sections.event_basics ?? {};
  const venue = sections.venue_logistics ?? {};
  const service = sections.service_style ?? {};
  const food = sections.food_requirements ?? {};
  const equipment = sections.equipment ?? {};
  const budget = sections.budget ?? {};

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/vendor/rfqs">Back to RFQ inbox</Link>
        <h1>
          {rfq ? `RFQ ${formatRfqNumber(rfq.rfqNumber)}` : "Vendor RFQ Event Packet"}
        </h1>
        <p>
          Review the complete event packet, triage risk, message the customer, and start quote work
          from structured RFQ details.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
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
          <p>Load the authenticated RFQ detail to view the vendor event packet.</p>
        </section>
      ) : null}

      {rfq ? (
        <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 6px" }}>
              {statusLabel(rfq.status)} · Target {statusLabel(target?.status ?? "unknown")}
            </p>
            <h2 style={{ margin: "0 0 8px" }}>{rfq.event.eventName}</h2>
            <p style={{ margin: 0 }}>
              {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
              {cityStateLabel(rfq)} · Budget {budgetLabel(rfq)}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Vendor Actions</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                disabled={isMutating}
                onClick={() => void runTargetAction("accept")}
                type="button"
              >
                Accept review
              </button>
              <select
                onChange={(event) => setDeclineReason(event.target.value)}
                value={declineReason}
              >
                <option value="unavailable">Unavailable</option>
                <option value="outside_service_area">Outside service area</option>
                <option value="budget_too_low">Budget too low</option>
                <option value="poor_fit">Poor fit</option>
                <option value="other">Other</option>
              </select>
              <button
                disabled={isMutating}
                onClick={() => void runTargetAction("reject")}
                type="button"
              >
                Decline
              </button>
              <Link
                href={`/vendor/rfqs/${rfqLinkIdentifier(rfq)}/quote`}
                style={{ alignSelf: "center" }}
              >
                Start quote
              </Link>
            </div>
            <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
              Request clarification
              <textarea
                onChange={(event) => setClarificationBody(event.target.value)}
                placeholder="Ask for parking dimensions, power access, guaranteed guest count, permit owner, or menu constraints."
                rows={3}
                style={{ padding: 10 }}
                value={clarificationBody}
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" }}>
              {clarificationTemplates.map((template) => (
                <button key={template} onClick={() => setClarificationBody(template)} type="button">
                  {template.split("?")[0]}?
                </button>
              ))}
            </div>
            <button disabled={isMutating} onClick={() => void requestClarification()} type="button">
              Send clarification request
            </button>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Risk and Completeness</h2>
            <p>
              Completeness: {rfq.completenessScore}% ({statusLabel(rfq.completenessStatus)}) ·
              Unread messages: {rfq.unreadMessageCount}
            </p>
            {rfq.riskFlags.length === 0 ? <p>No risk flags generated.</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {rfq.riskFlags.map((flag) => (
                <span
                  key={flag.code}
                  style={{
                    background: flag.severity === "high" ? "#ffe8e8" : "#fff4df",
                    borderRadius: 999,
                    padding: "6px 10px",
                  }}
                >
                  {statusLabel(flag.severity)}: {flag.label}
                </span>
              ))}
            </div>
          </section>

          <SectionSummary
            fields={[
              { label: "Customer type", value: eventBasics.customerType },
              { label: "Open to public", value: eventBasics.isOpenToPublic },
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
              { label: "Restrictions", value: venue.restrictionDescription },
            ]}
            title="Venue logistics"
          />
          <SectionSummary
            fields={[
              { label: "Service style", value: service.desiredServiceStyle },
              { label: "Meal period", value: service.mealPeriod },
              { label: "Guest payment model", value: service.guestPaymentModel },
              { label: "Service starts", value: service.serviceStartsAt },
              { label: "Service ends", value: service.serviceEndsAt },
              { label: "Desired meals/hour", value: service.desiredMealsPerHour },
            ]}
            title="Service style and guest flow"
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
            title="Equipment requests"
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
            title="Budget and timing"
          />

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Messages</h2>
            {!vendorThread ? <p>No visible thread for this vendor ID.</p> : null}
            {vendorThread ? (
              <div style={{ display: "grid", gap: 12 }}>
                {rfq.messages.filter((message) => message.threadId === vendorThread.id).length ===
                0 ? (
                  <p>No messages in this RFQ thread yet.</p>
                ) : (
                  <ul>
                    {rfq.messages
                      .filter((message) => message.threadId === vendorThread.id)
                      .map((message) => (
                        <li key={message.id}>
                          {formatDate(message.createdAt)}: {message.body}
                        </li>
                      ))}
                  </ul>
                )}
                <label style={{ display: "grid", gap: 6 }}>
                  Send message
                  <textarea
                    onChange={(event) => setMessageBody(event.target.value)}
                    rows={3}
                    style={{ padding: 10 }}
                    value={messageBody}
                  />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button
                    disabled={isMutating}
                    onClick={() => void sendMessage(vendorThread.id)}
                    type="button"
                  >
                    Send message
                  </button>
                  <button
                    disabled={isMutating}
                    onClick={() => void markRead(vendorThread.id)}
                    type="button"
                  >
                    Mark thread read
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
