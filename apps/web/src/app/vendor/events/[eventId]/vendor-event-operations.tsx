"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type EventOperationsDetail,
} from "@/lib/rfq-api";

import {
  formatDate,
  stringValue,
} from "../../rfq-shared";

type VendorEventOperationsProps = {
  eventId: string;
};

function DetailCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export function VendorEventOperations({ eventId }: VendorEventOperationsProps) {
  const session = useVendorAuthSession();
  const [detail, setDetail] = useState<EventOperationsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadOperations() {
    setError(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<EventOperationsDetail>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(
          session.activeVendorId.trim(),
        )}/calendar-events/${encodeURIComponent(eventId)}/operations`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Run sheet failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setDetail(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Run sheet load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const event = detail?.calendarEvent;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/vendor/calendar">Back to vendor calendar</Link>
        <h1>{event?.title ?? "Event Operations"}</h1>
        <p>
          Confirmed event run sheet with contacts, venue logistics, agreed menu, staffing and prep
          notes, equipment checklist, payment status, and documents.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <button disabled={isLoading} onClick={() => void loadOperations()} type="button">
          {isLoading ? "Loading..." : "Load run sheet"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      {!detail ? (
        <section
          style={{ border: "1px dashed #bbb", borderRadius: 16, marginTop: 24, padding: 18 }}
        >
          <h2>No run sheet loaded</h2>
          <p>Load the event operations detail from the API to review day-of execution notes.</p>
        </section>
      ) : null}

      {detail ? (
        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 4px" }}>
              {statusLabel(detail.calendarEvent.type)} · {statusLabel(detail.calendarEvent.status)}
            </p>
            <h2 style={{ margin: "0 0 6px" }}>{detail.calendarEvent.title}</h2>
            <p style={{ margin: 0 }}>
              {formatDate(detail.calendarEvent.startsAt)} -{" "}
              {formatDate(detail.calendarEvent.endsAt)}
            </p>
            {detail.warnings.length > 0 ? (
              <ul style={{ color: "#9a3412" }}>
                {detail.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.eventIds.join("-")}`}>{warning.message}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            <DetailCard title="Contacts">
              <p>
                Customer:{" "}
                {detail.contacts.customer
                  ? stringValue(detail.contacts.customer.name)
                  : "Not provided"}
              </p>
              <p>
                Email:{" "}
                {detail.contacts.customer
                  ? stringValue(detail.contacts.customer.email)
                  : "Not provided"}
              </p>
              <p>
                Phone:{" "}
                {detail.contacts.customer
                  ? stringValue(detail.contacts.customer.phone)
                  : "Not provided"}
              </p>
              <p>Onsite: {detail.contacts.onsite.name ?? "Not provided"}</p>
              <p>Onsite phone: {detail.contacts.onsite.phone ?? "Not provided"}</p>
            </DetailCard>

            <DetailCard title="Venue Logistics">
              <p>
                Address:{" "}
                {detail.venueLogistics.address
                  ? `${detail.venueLogistics.address.line1}, ${detail.venueLogistics.address.city}, ${detail.venueLogistics.address.state}`
                  : "Not provided"}
              </p>
              <p>Guest count: {detail.venueLogistics.guestCount ?? "Not provided"}</p>
              <p>Service starts: {stringValue(detail.venueLogistics.serviceWindow.startsAt)}</p>
              <p>Service ends: {stringValue(detail.venueLogistics.serviceWindow.endsAt)}</p>
              <p>Parking: {stringValue(detail.venueLogistics.details.parkingNotes)}</p>
              <p>Power: {stringValue(detail.venueLogistics.details.powerAvailable)}</p>
            </DetailCard>

            <DetailCard title="Payment Status">
              <p>
                Paid {moneyLabel(detail.paymentStatus.paidCents)} of{" "}
                {moneyLabel(detail.paymentStatus.totalCents)}
              </p>
              <ul>
                {detail.paymentStatus.schedule.map((item) => (
                  <li key={item.id}>
                    {item.label}: {moneyLabel(item.amountCents)} · {statusLabel(item.status)}
                  </li>
                ))}
              </ul>
            </DetailCard>

            <DetailCard title="Documents">
              <p>Agreement: {detail.documents.agreementId ?? "Not linked"}</p>
              <p>Current version: {detail.documents.currentVersionId ?? "Not linked"}</p>
              <p>Signed document: {detail.documents.signedDocumentFileId ?? "Not generated"}</p>
              {detail.documents.agreementId ? (
                <Link href={`/customer/agreements/${detail.documents.agreementId}`}>
                  Open customer agreement view
                </Link>
              ) : null}
            </DetailCard>
          </div>

          <DetailCard title="Agreed Menu">
            <p>{detail.agreedMenu.menuSummary ?? "No menu summary captured."}</p>
            <div style={{ display: "grid", gap: 8 }}>
              {detail.agreedMenu.lineItems.map((item) => (
                <article
                  key={`${item.name}-${item.type}`}
                  style={{ background: "#f8fafc", borderRadius: 12, padding: 12 }}
                >
                  <strong>{item.name}</strong>
                  <p style={{ margin: "4px 0" }}>
                    {statusLabel(item.type)} · {item.quantity} {item.unit} ·{" "}
                    {moneyLabel(item.totalAmountCents)}
                  </p>
                  {item.description ? <p style={{ margin: 0 }}>{item.description}</p> : null}
                </article>
              ))}
            </div>
          </DetailCard>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            <DetailCard title="Staffing Notes">
              {detail.staffingNotes.length === 0 ? <p>No staffing notes captured.</p> : null}
              <ul>
                {detail.staffingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </DetailCard>

            <DetailCard title="Prep Notes">
              {detail.prepNotes.length === 0 ? <p>No prep notes captured.</p> : null}
              <ul>
                {detail.prepNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </DetailCard>

            <DetailCard title="Equipment Checklist">
              {detail.equipmentChecklist.length === 0 ? (
                <p>No equipment checklist captured.</p>
              ) : null}
              <ul>
                {detail.equipmentChecklist.map((item) => (
                  <li key={item.item}>
                    {item.item} {item.quantity ? `x${item.quantity}` : ""} ·{" "}
                    {item.required ? "required" : "optional"} · {statusLabel(item.status)}
                  </li>
                ))}
              </ul>
            </DetailCard>

            <DetailCard title="Internal Notes">
              <p>{detail.internalNotes ?? "No internal notes captured."}</p>
            </DetailCard>
          </div>
        </div>
      ) : null}
    </main>
  );
}
