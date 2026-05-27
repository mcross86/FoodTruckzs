"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { rfqApiRequest, statusLabel, type RfqDetail } from "@/lib/rfq-api";

import {
  budgetLabel,
  cityStateLabel,
  formatDate,
  targetForVendor,
} from "../rfq-shared";

type DashboardCard = {
  count: number;
  description: string;
  href: string;
  title: string;
};

export function VendorDashboard() {
  const session = useAuthSession();
  const [rfqs, setRfqs] = useState<RfqDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadRfqs() {
    setError(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor to load RFQ action items.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<RfqDetail[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/rfqs?limit=50`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Vendor RFQ list failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfqs(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Vendor dashboard failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const cards = useMemo<DashboardCard[]>(() => {
    const pendingReview = rfqs.filter((rfq) => {
      const target = targetForVendor(rfq, session.activeVendorId);
      return target?.status === "invited" || target?.status === "viewed";
    }).length;
    const clarifications = rfqs.filter(
      (rfq) => rfq.status === "clarification_requested" || rfq.unreadMessageCount > 0,
    ).length;
    const accepted = rfqs.filter(
      (rfq) => targetForVendor(rfq, session.activeVendorId)?.status === "accepted",
    ).length;
    const highRisk = rfqs.filter((rfq) =>
      rfq.riskFlags.some((flag) => flag.severity === "high"),
    ).length;

    return [
      {
        count: pendingReview,
        description: "New or viewed RFQs that still need accept, decline, or clarification.",
        href: "/vendor/rfqs?targetStatus=invited",
        title: "Needs triage",
      },
      {
        count: clarifications,
        description: "Customer/vendor message threads with clarification pressure.",
        href: "/vendor/rfqs",
        title: "Clarifications and unread",
      },
      {
        count: accepted,
        description:
          "Accepted RFQs that are ready for quote building, revision, and send workflow.",
        href: "/vendor/rfqs?targetStatus=accepted",
        title: "Accepted review",
      },
      {
        count: highRisk,
        description: "RFQs with high-risk logistics, allergy, budget, or throughput flags.",
        href: "/vendor/rfqs?risk=high",
        title: "High-risk RFQs",
      },
    ];
  }, [rfqs, session.activeVendorId]);

  const actionItems = rfqs
    .filter((rfq) => {
      const target = targetForVendor(rfq, session.activeVendorId);
      return (
        target?.status === "invited" ||
        target?.status === "viewed" ||
        rfq.unreadMessageCount > 0 ||
        rfq.status === "clarification_requested"
      );
    })
    .slice(0, 6);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/">foodtruckzs</Link>
        <h1>Vendor Dashboard</h1>
        <p>
          Daily RFQ action cards for leads, clarification responses, high-risk requests, and quote
          stubs, with calendar operations linked once bookings are confirmed.
        </p>
        <p>
          <Link href="/vendor/calendar">Open vendor calendar</Link> ·{" "}
          <Link href="/vendor/payments">Open vendor payments</Link>
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireVendor session={session} title="Vendor Account" />
        <button disabled={isLoading} onClick={() => void loadRfqs()} type="button">
          {isLoading ? "Loading..." : "Load vendor dashboard"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 24,
        }}
      >
        {cards.map((card) => (
          <article
            key={card.title}
            style={{ background: "#fff4df", borderRadius: 18, padding: 18 }}
          >
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: 0 }}>{card.count}</p>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <Link href={card.href}>Open inbox</Link>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>RFQ Action Items</h2>
        {actionItems.length === 0 ? (
          <section style={{ border: "1px dashed #bbb", borderRadius: 16, padding: 18 }}>
            <h3>No urgent RFQ items loaded</h3>
            <p>
              Load the dashboard or open the inbox. If there are still no RFQs, improve your public
              profile, service areas, menus, availability, and catering minimums so matching has
              better operator data.
            </p>
            <Link href="/vendor/rfqs">Open RFQ inbox</Link>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {actionItems.map((rfq) => {
            const target = targetForVendor(rfq, session.activeVendorId);

            return (
              <article
                key={rfq.rfqId}
                style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}
              >
                <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 4px" }}>
                  {statusLabel(target?.status ?? rfq.status)}
                </p>
                <h3 style={{ margin: "0 0 6px" }}>{rfq.event.eventName}</h3>
                <p style={{ margin: 0 }}>
                  {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
                  {cityStateLabel(rfq)}
                </p>
                <p>
                  Budget: {budgetLabel(rfq)} · Risks: {rfq.riskFlags.length} · Unread:{" "}
                  {rfq.unreadMessageCount}
                </p>
                <Link href={`/vendor/rfqs/${rfq.rfqId}`}>Open event packet</Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
