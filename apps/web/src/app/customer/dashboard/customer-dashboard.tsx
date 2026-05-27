"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type RfqDetail,
} from "@/lib/rfq-api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export function CustomerDashboard() {
  const session = useAuthSession();
  const [rfqs, setRfqs] = useState<RfqDetail[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [eventDateFilter, setEventDateFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadRfqs() {
    setError(null);

    if (!session.accessToken.trim()) {
      setError("Log in as a customer or select a saved customer account to load RFQs.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<RfqDetail[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: "/api/v1/customers/me/rfqs",
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Customer RFQ list failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfqs(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Customer RFQ list failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredRfqs = useMemo(() => {
    const vendorQuery = vendorFilter.trim().toLowerCase();
    const eventDateQuery = eventDateFilter.trim();

    return rfqs.filter((rfq) => {
      const statusMatches = statusFilter === "all" || rfq.status === statusFilter;
      const vendorMatches =
        !vendorQuery ||
        rfq.vendorTargets.some((target) =>
          target.vendor.businessName.toLowerCase().includes(vendorQuery),
        );
      const eventDateMatches = !eventDateQuery || rfq.event.startsAt.startsWith(eventDateQuery);
      return statusMatches && vendorMatches && eventDateMatches;
    });
  }, [eventDateFilter, rfqs, statusFilter, vendorFilter]);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/">foodtruckzs</Link>
        <h1>Customer Dashboard</h1>
        <p>
          Track active RFQs, quotes awaiting review, agreements awaiting signature, deposits due,
          confirmed events, unread messages, and customer action items.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
        <button disabled={isLoading} onClick={() => void loadRfqs()} type="button">
          {isLoading ? "Loading..." : "Load my RFQs"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2>RFQs and Action Items</h2>
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 16,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: 16,
            padding: 16,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Status
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All</option>
              {[...new Set(rfqs.map((rfq) => rfq.status))].map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Event date
            <input
              onChange={(event) => setEventDateFilter(event.target.value)}
              type="date"
              value={eventDateFilter}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Vendor
            <input
              onChange={(event) => setVendorFilter(event.target.value)}
              placeholder="Vendor name"
              value={vendorFilter}
            />
          </label>
        </section>
        {rfqs.length === 0 ? (
          <section style={{ background: "#fff4df", borderRadius: 16, padding: 20 }}>
            <h3>No RFQs loaded</h3>
            <p>
              Submit an RFQ or load the authenticated customer list. Customer action items appear
              here so vendors do not have to chase missing details.
            </p>
            <Link href="/rfq/start">Start a catering RFQ</Link>
          </section>
        ) : null}
        {rfqs.length > 0 && filteredRfqs.length === 0 ? (
          <section style={{ background: "#fff4df", borderRadius: 16, padding: 20 }}>
            <h3>No RFQs match these filters</h3>
            <p>
              Clear filters to see all requests, quotes, agreements, deposits, and event statuses.
            </p>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 14 }}>
          {filteredRfqs.map((rfq) => (
            <article
              key={rfq.rfqId}
              style={{
                border: "1px solid #ddd",
                borderRadius: 16,
                display: "grid",
                gap: 12,
                padding: 18,
              }}
            >
              <div>
                <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 4px" }}>
                  {statusLabel(rfq.status)}
                </p>
                <h3 style={{ margin: "0 0 6px" }}>{rfq.event.eventName}</h3>
                <p style={{ margin: 0 }}>
                  {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
                  {rfq.address ? `${rfq.address.city}, ${rfq.address.state}` : "Venue TBD"}
                </p>
              </div>
              <dl
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  margin: 0,
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
                  <dt style={{ fontWeight: 700 }}>Vendor responses</dt>
                  <dd style={{ margin: 0 }}>
                    {rfq.vendorTargets.length} target{rfq.vendorTargets.length === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Risk flags</dt>
                  <dd style={{ margin: 0 }}>{rfq.riskFlags.length}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 700 }}>Unread messages</dt>
                  <dd style={{ margin: 0 }}>{rfq.unreadMessageCount}</dd>
                </div>
              </dl>
              <Link href={`/customer/rfqs/${rfq.rfqId}`}>Open RFQ detail</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
