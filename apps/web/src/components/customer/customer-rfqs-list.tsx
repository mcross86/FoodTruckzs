"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { CustomerWorkspaceShell } from "@/components/customer/customer-workspace-shell";
import { useCustomerAuthSession } from "@/lib/auth-session";
import {
  isLocalDraftRfq,
  localDraftContinueHref,
  mergeCustomerRfqsWithLocalDraft,
} from "@/lib/customer-rfq-actions";
import {
  formatRfqNumber,
  moneyLabel,
  rfqApiRequest,
  rfqLinkIdentifier,
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

const filterPanelStyle = {
  background: "rgba(37, 41, 58, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 20,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  marginBottom: 16,
  padding: 16,
} as const;

const inputStyle = {
  background: "rgba(60, 67, 91, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 12,
  color: "#f8fafc",
  minHeight: 40,
  padding: "8px 10px",
} as const;

export function CustomerRfqsList() {
  const session = useCustomerAuthSession();
  const [rfqs, setRfqs] = useState<RfqDetail[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [eventDateFilter, setEventDateFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localDraftVersion, setLocalDraftVersion] = useState(0);

  async function loadRfqs() {
    setError(null);

    if (!session.accessToken.trim()) {
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
      setLocalDraftVersion((current) => current + 1);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Customer RFQ list failed.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session.accessToken.trim()) return;
    void loadRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.accessToken]);

  useEffect(() => {
    const refreshLocalDraft = () => {
      setLocalDraftVersion((current) => current + 1);
    };

    window.addEventListener("focus", refreshLocalDraft);
    return () => {
      window.removeEventListener("focus", refreshLocalDraft);
    };
  }, []);

  const displayRfqs = useMemo(
    () => mergeCustomerRfqsWithLocalDraft(rfqs),
    [localDraftVersion, rfqs],
  );

  const filteredRfqs = useMemo(() => {
    const vendorQuery = vendorFilter.trim().toLowerCase();
    const eventDateQuery = eventDateFilter.trim();

    return displayRfqs.filter((rfq) => {
      const statusMatches = statusFilter === "all" || rfq.status === statusFilter;
      const vendorMatches =
        !vendorQuery ||
        rfq.vendorTargets.some((target) =>
          target.vendor.businessName.toLowerCase().includes(vendorQuery),
        );
      const eventDateMatches = !eventDateQuery || rfq.event.startsAt.startsWith(eventDateQuery);
      return statusMatches && vendorMatches && eventDateMatches;
    });
  }, [displayRfqs, eventDateFilter, statusFilter, vendorFilter]);

  return (
    <CustomerWorkspaceShell
      description="Track active requests, quotes, agreements, deposits, and event status."
      title="My RFQs"
    >
      {!session.user ? (
        <AuthSessionPanel requireCustomer session={session} title="Customer account" />
      ) : (
        <>
          {error ? (
            <section
              style={{
                background: "rgba(255, 120, 120, 0.12)",
                border: "1px solid rgba(255, 120, 120, 0.35)",
                borderRadius: 18,
                marginBottom: 16,
                padding: 16,
              }}
            >
              <p style={{ color: "#ffb4b4", margin: 0 }}>{error}</p>
            </section>
          ) : null}

          <section style={filterPanelStyle}>
            <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
              Status
              <select
                onChange={(event) => setStatusFilter(event.target.value)}
                style={inputStyle}
                value={statusFilter}
              >
                <option value="all">All</option>
                {[...new Set(displayRfqs.map((rfq) => rfq.status))].map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
              Event date
              <input
                onChange={(event) => setEventDateFilter(event.target.value)}
                style={inputStyle}
                type="date"
                value={eventDateFilter}
              />
            </label>
            <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
              Vendor
              <input
                onChange={(event) => setVendorFilter(event.target.value)}
                placeholder="Vendor name"
                style={inputStyle}
                value={vendorFilter}
              />
            </label>
          </section>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <button disabled={isLoading} onClick={() => void loadRfqs()} type="button">
              {isLoading ? "Loading..." : "Refresh RFQs"}
            </button>
            <Link
              href={ROUTES.plan.event}
              style={{
                background: "#ffe66d",
                borderRadius: 16,
                color: "#171b2a",
                fontWeight: 800,
                padding: "10px 16px",
                textDecoration: "none",
              }}
            >
              Start new RFQ
            </Link>
          </div>

          {displayRfqs.length === 0 && !isLoading ? (
            <section
              style={{
                background: "rgba(255, 230, 109, 0.1)",
                border: "1px solid rgba(255, 230, 109, 0.35)",
                borderRadius: 18,
                padding: 20,
              }}
            >
              <h3 style={{ color: "#ffe66d", margin: "0 0 8px" }}>No RFQs yet</h3>
              <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
                Submit a catering request to start receiving quotes from food truck operators.
              </p>
            </section>
          ) : null}

          {displayRfqs.length > 0 && filteredRfqs.length === 0 ? (
            <section
              style={{
                background: "rgba(255, 230, 109, 0.1)",
                border: "1px solid rgba(255, 230, 109, 0.35)",
                borderRadius: 18,
                padding: 20,
              }}
            >
              <h3 style={{ color: "#ffe66d", margin: "0 0 8px" }}>No RFQs match these filters</h3>
              <p style={{ color: "#c5cbe0", margin: 0 }}>Clear filters to see all requests.</p>
            </section>
          ) : null}

          <div style={{ display: "grid", gap: 14 }}>
            {filteredRfqs.map((rfq) => (
              <article
                key={rfq.rfqId}
                style={{
                  background: "rgba(37, 41, 58, 0.92)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 18,
                  display: "grid",
                  gap: 12,
                  padding: 18,
                }}
              >
                <div>
                  <p style={{ color: "#ffe66d", fontWeight: 700, margin: "0 0 4px" }}>
                    {statusLabel(rfq.status)}
                  </p>
                  <h3 style={{ color: "#f8fafc", margin: "0 0 6px" }}>{rfq.event.eventName}</h3>
                  <p style={{ color: "#c5cbe0", margin: 0 }}>
                    {formatDate(rfq.event.startsAt)} · {rfq.event.estimatedHeadcount} guests ·{" "}
                    {rfq.address ? `${rfq.address.city}, ${rfq.address.state}` : "Venue TBD"}
                  </p>
                </div>
                <dl
                  style={{
                    color: "#c5cbe0",
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    margin: 0,
                  }}
                >
                  {isLocalDraftRfq(rfq.rfqId) ? (
                    <div>
                      <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Progress</dt>
                      <dd style={{ margin: 0 }}>Not submitted yet — continue your catering request.</dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Completeness</dt>
                        <dd style={{ margin: 0 }}>
                          {rfq.completenessScore}% ({statusLabel(rfq.completenessStatus)})
                        </dd>
                      </div>
                      <div>
                        <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Budget</dt>
                        <dd style={{ margin: 0 }}>{budgetLabel(rfq)}</dd>
                      </div>
                      <div>
                        <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Vendor responses</dt>
                        <dd style={{ margin: 0 }}>
                          {rfq.vendorTargets.length} target
                          {rfq.vendorTargets.length === 1 ? "" : "s"}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ color: "#f8fafc", fontWeight: 700 }}>Unread messages</dt>
                        <dd style={{ margin: 0 }}>{rfq.unreadMessageCount}</dd>
                      </div>
                    </>
                  )}
                </dl>
                <Link
                  href={
                    isLocalDraftRfq(rfq.rfqId)
                      ? localDraftContinueHref()
                      : ROUTES.customer.rfq(rfqLinkIdentifier(rfq))
                  }
                  style={{ color: "#87ddf7", fontWeight: 700 }}
                >
                  {isLocalDraftRfq(rfq.rfqId) ? "Continue draft →" : "Open RFQ detail →"}
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </CustomerWorkspaceShell>
  );
}
