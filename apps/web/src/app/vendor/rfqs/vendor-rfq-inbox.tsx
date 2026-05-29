"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

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
  targetForVendor,
} from "../rfq-shared";

const targetStatusOptions = ["all", "invited", "viewed", "accepted", "rejected"];

function queryParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export function VendorRfqInbox() {
  const session = useVendorAuthSession();
  const [rfqs, setRfqs] = useState<RfqDetail[]>([]);
  const [targetStatus, setTargetStatus] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionRfqId, setActionRfqId] = useState<string | null>(null);

  useEffect(() => {
    setTargetStatus(queryParam("targetStatus") || "all");
    setRiskFilter(queryParam("risk") || "all");
  }, []);

  const loadRfqs = useCallback(async () => {
    setError(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setRfqs([]);
      setError(gateMessage);
      setHasLoaded(true);
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
      setHasLoaded(true);
    }
  }, [session, targetStatus]);

  useEffect(() => {
    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      return;
    }

    void loadRfqs();
  }, [loadRfqs, session.accessToken, session.activeVendorId]);

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
        path: `/api/v1/rfqs/${encodeURIComponent(rfqLinkIdentifier(rfq))}/vendor-targets/${encodeURIComponent(target.id)}/${action}`,
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
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
        <h1>RFQs</h1>
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
          {isLoading ? "Refreshing..." : "Refresh inbox"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2>RFQs</h2>
        {isLoading && !hasLoaded ? (
          <p style={{ color: "#666" }}>Loading catering requests…</p>
        ) : null}
        {hasLoaded && rfqs.length === 0 && !error ? (
          <section style={{ background: "#fff4df", borderRadius: 16, padding: 18 }}>
            <h3>No catering requests yet</h3>
            <p style={{ lineHeight: 1.5, margin: 0 }}>
              When a customer submits an RFQ that targets your food truck, it will appear here.
              Make sure your truck profile is approved, and that your service areas and cuisines
              match incoming requests if customers use general marketplace matching.
            </p>
          </section>
        ) : null}
        {hasLoaded && rfqs.length > 0 && filteredRfqs.length === 0 ? (
          <section style={{ background: "#fff4df", borderRadius: 16, padding: 18 }}>
            <h3>No RFQs match these filters</h3>
            <p>Try another target status or clear the city, event type, and risk filters.</p>
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
                  <h3 style={{ margin: "0 0 6px" }}>
                    {rfq.event.eventName}
                    <span style={{ color: "#666", fontSize: 14, fontWeight: 600 }}>
                      {" "}
                      · RFQ {formatRfqNumber(rfq.rfqNumber)}
                    </span>
                  </h3>
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
                  <Link href={`/vendor/rfqs/${rfqLinkIdentifier(rfq)}`}>Open event packet</Link>
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
                  <Link href={`/vendor/rfqs/${rfqLinkIdentifier(rfq)}/quote`}>Start quote</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
