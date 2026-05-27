"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { rfqApiRequest, statusLabel, type RfqDetail } from "@/lib/rfq-api";

import {
  budgetLabel,
  cityStateLabel,
  formatDate,
  targetForVendor,
} from "../rfq-shared";

const targetStatusOptions = ["all", "invited", "viewed", "accepted", "rejected"];

function queryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export function VendorRfqInbox() {
  const session = useAuthSession();
  const [rfqs, setRfqs] = useState<RfqDetail[]>([]);
  const [targetStatus, setTargetStatus] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionRfqId, setActionRfqId] = useState<string | null>(null);

  useEffect(() => {
    setTargetStatus(queryParam("targetStatus") || "all");
    setRiskFilter(queryParam("risk") || "all");
  }, []);

  async function loadRfqs() {
    setError(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor to load the RFQ inbox.");
      return;
    }

    setIsLoading(true);

    try {
      const statusQuery =
        targetStatus === "all" ? "" : `&targetStatus=${encodeURIComponent(targetStatus)}`;
      const result = await rfqApiRequest<RfqDetail[]>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/rfqs?limit=50${statusQuery}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Vendor RFQ inbox failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfqs(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Vendor RFQ inbox failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runTargetAction(rfq: RfqDetail, action: "accept" | "reject") {
    const target = targetForVendor(rfq, session.activeVendorId);
    setError(null);

    if (!target) {
      setError("This RFQ does not expose a target for the active vendor.");
      return;
    }

    setActionRfqId(rfq.rfqId);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body:
          action === "accept"
            ? { note: "Accepted from vendor inbox." }
            : { note: "Declined from vendor inbox.", reasonCode: "unavailable" },
        method: "POST",
        path: `/api/v1/rfqs/${encodeURIComponent(rfq.rfqId)}/vendor-targets/${encodeURIComponent(target.id)}/${action}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `RFQ ${action} failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setRfqs((items) => items.map((item) => (item.rfqId === rfq.rfqId ? result.data! : item)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `RFQ ${action} failed.`);
    } finally {
      setActionRfqId(null);
    }
  }

  const filteredRfqs = useMemo(() => {
    const cityQuery = cityFilter.trim().toLowerCase();
    const eventQuery = eventTypeFilter.trim().toLowerCase();

    return rfqs.filter((rfq) => {
      const riskMatches =
        riskFilter === "all" || rfq.riskFlags.some((flag) => flag.severity === riskFilter);
      const cityMatches =
        !cityQuery ||
        rfq.address?.city.toLowerCase().includes(cityQuery) ||
        rfq.address?.state.toLowerCase().includes(cityQuery);
      const eventMatches = !eventQuery || rfq.event.eventType.toLowerCase().includes(eventQuery);
      return riskMatches && cityMatches && eventMatches;
    });
  }, [cityFilter, eventTypeFilter, rfqs, riskFilter]);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/vendor/dashboard">Back to vendor dashboard</Link>
        <h1>Vendor RFQ Inbox</h1>
        <p>Filter and triage incoming catering requests before opening the full event packet.</p>
      </header>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 18,
          display: "grid",
          gap: 12,
          padding: 18,
        }}
      >
        <AuthSessionPanel requireVendor session={session} title="Vendor Account" />
        <h2 style={{ margin: 0 }}>Filters</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Target status
            <select
              onChange={(event) => setTargetStatus(event.target.value)}
              style={{ padding: 10 }}
              value={targetStatus}
            >
              {targetStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Risk severity
            <select
              onChange={(event) => setRiskFilter(event.target.value)}
              style={{ padding: 10 }}
              value={riskFilter}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            City or state
            <input
              onChange={(event) => setCityFilter(event.target.value)}
              style={{ padding: 10 }}
              value={cityFilter}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Event type
            <input
              onChange={(event) => setEventTypeFilter(event.target.value)}
              style={{ padding: 10 }}
              value={eventTypeFilter}
            />
          </label>
        </div>
        <button disabled={isLoading} onClick={() => void loadRfqs()} type="button">
          {isLoading ? "Loading..." : "Load inbox"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2>RFQs</h2>
        {filteredRfqs.length === 0 ? (
          <section style={{ background: "#fff4df", borderRadius: 16, padding: 18 }}>
            <h3>No RFQs match these filters</h3>
            <p>Try another target status, clear risk filters, or load the latest vendor RFQs.</p>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 14 }}>
          {filteredRfqs.map((rfq) => {
            const target = targetForVendor(rfq, session.activeVendorId);

            return (
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
                    {statusLabel(target?.status ?? rfq.status)}
                  </p>
                  <h3 style={{ margin: "0 0 6px" }}>{rfq.event.eventName}</h3>
                  <p style={{ margin: 0 }}>
                    {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
                    {cityStateLabel(rfq)}
                  </p>
                </div>
                <dl
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    margin: 0,
                  }}
                >
                  <div>
                    <dt style={{ fontWeight: 700 }}>Budget</dt>
                    <dd style={{ margin: 0 }}>{budgetLabel(rfq)}</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 700 }}>Completeness</dt>
                    <dd style={{ margin: 0 }}>{rfq.completenessScore}%</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 700 }}>Unread</dt>
                    <dd style={{ margin: 0 }}>{rfq.unreadMessageCount}</dd>
                  </div>
                </dl>
                {rfq.riskFlags.length > 0 ? (
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
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <Link href={`/vendor/rfqs/${rfq.rfqId}`}>Open event packet</Link>
                  <button
                    disabled={actionRfqId === rfq.rfqId}
                    onClick={() => void runTargetAction(rfq, "accept")}
                    type="button"
                  >
                    Accept review
                  </button>
                  <button
                    disabled={actionRfqId === rfq.rfqId}
                    onClick={() => void runTargetAction(rfq, "reject")}
                    type="button"
                  >
                    Decline unavailable
                  </button>
                  <Link href={`/vendor/rfqs/${rfq.rfqId}/quote`}>Start quote</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
