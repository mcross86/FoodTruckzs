"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function inputStyle() {
  return { display: "block", marginTop: 4, padding: 8, width: "100%" };
}

function vendorOptionsFromResult(result: VendorApiResult | null) {
  const body = result?.body;
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data?: unknown }).data
      : null;

  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const vendor =
        item && typeof item === "object" && "vendor" in item
          ? (item as { vendor?: { businessName?: unknown; id?: unknown; slug?: unknown } }).vendor
          : null;
      return typeof vendor?.id === "string"
        ? {
            id: vendor.id,
            label: `${String(vendor.businessName ?? "Vendor")} (${String(vendor.slug ?? vendor.id)})`,
          }
        : null;
    })
    .filter((item): item is { id: string; label: string } => item !== null);
}

export default function AdminPortalPage() {
  const session = useAuthSession();
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [rfqId, setRfqId] = useState("");
  const [vendorNote, setVendorNote] = useState("");
  const [rfqNote, setRfqNote] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("open");
  const [paymentStatus, setPaymentStatus] = useState("failed");
  const [webhookFailedOnly, setWebhookFailedOnly] = useState(true);
  const [result, setResult] = useState<VendorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedResult = useMemo(() => (result ? stringify(result.body) : ""), [result]);
  const vendorOptions = useMemo(() => vendorOptionsFromResult(result), [result]);

  async function runRequest(request: {
    body?: unknown;
    method?: "GET" | "PATCH" | "POST";
    path: string;
  }) {
    setError(null);

    try {
      const apiResult = await vendorApiRequest({
        apiBaseUrl: session.apiBaseUrl,
        body: request.body,
        method: request.method,
        path: request.path,
        token: session.accessToken,
      });
      setResult(apiResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Request failed.");
    }
  }

  function requiredVendorId(): string | null {
    const value = vendorId.trim();
    if (!value) {
      setError("Enter a vendor ID first.");
      return null;
    }
    return value;
  }

  function requiredRfqId(): string | null {
    const value = rfqId.trim();
    if (!value) {
      setError("Enter an RFQ ID first.");
      return null;
    }
    return value;
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1180 }}>
      <h1>Admin Operations Portal</h1>
      <p>
        MVP tools for vendor approval, marketplace visibility, RFQ/dispute review, payment
        monitoring, and Stripe webhook failure visibility. Advanced analytics and automated dispute
        resolution are intentionally not included.
      </p>
      <p>
        <Link href="/admin/platform-billing">Open platform billing admin</Link>
      </p>

      <AuthSessionPanel requireAdmin session={session} title="Admin Account" />

      <section style={{ marginTop: 24 }}>
        <h2>Dashboard</h2>
        <button onClick={() => void runRequest({ path: "/api/v1/admin/dashboard" })}>
          Load Admin Dashboard
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Vendor Approval and Marketplace Moderation</h2>
        <label>
          Search vendors
          <input
            onChange={(event) => setVendorSearch(event.target.value)}
            placeholder="Business name or slug"
            style={inputStyle()}
            value={vendorSearch}
          />
        </label>
        {vendorOptions.length > 0 ? (
          <label>
            Select vendor from latest search
            <select
              onChange={(event) => setVendorId(event.target.value)}
              style={inputStyle()}
              value={vendorId}
            >
              <option value="">Choose a vendor</option>
              {vendorOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Vendor ID
          <input
            onChange={(event) => setVendorId(event.target.value)}
            placeholder="Vendor UUID"
            style={inputStyle()}
            value={vendorId}
          />
        </label>
        <label>
          Admin note or reason
          <textarea
            onChange={(event) => setVendorNote(event.target.value)}
            rows={3}
            style={{ boxSizing: "border-box", width: "100%" }}
            value={vendorNote}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              const query = vendorSearch.trim()
                ? `?search=${encodeURIComponent(vendorSearch.trim())}`
                : "";
              void runRequest({ path: `/api/v1/admin/vendors${query}` });
            }}
          >
            Search Vendors
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) void runRequest({ path: `/api/v1/admin/vendors/${id}` });
            }}
          >
            Review Vendor
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) {
                void runRequest({
                  body: { note: vendorNote || undefined },
                  method: "POST",
                  path: `/api/v1/admin/vendors/${id}/approve`,
                });
              }
            }}
          >
            Approve
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) {
                void runRequest({
                  body: { reason: vendorNote || "Admin rejection." },
                  method: "POST",
                  path: `/api/v1/admin/vendors/${id}/reject`,
                });
              }
            }}
          >
            Reject
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) {
                void runRequest({
                  body: { note: vendorNote || "Please update your application." },
                  method: "POST",
                  path: `/api/v1/admin/vendors/${id}/request-changes`,
                });
              }
            }}
          >
            Request Changes
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) {
                void runRequest({
                  body: { isPublished: false, reason: vendorNote || undefined },
                  method: "PATCH",
                  path: `/api/v1/admin/vendors/${id}/marketplace-visibility`,
                });
              }
            }}
          >
            Hide Profile
          </button>
          <button
            onClick={() => {
              const id = requiredVendorId();
              if (id) {
                void runRequest({
                  body: { isPublished: true, reason: vendorNote || undefined, status: "active" },
                  method: "PATCH",
                  path: `/api/v1/admin/vendors/${id}/marketplace-visibility`,
                });
              }
            }}
          >
            Publish Profile
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>RFQ and Dispute Review</h2>
        <label>
          RFQ ID
          <input
            onChange={(event) => setRfqId(event.target.value)}
            placeholder="RFQ UUID"
            style={inputStyle()}
            value={rfqId}
          />
        </label>
        <label>
          Admin note
          <textarea
            onChange={(event) => setRfqNote(event.target.value)}
            rows={3}
            style={{ boxSizing: "border-box", width: "100%" }}
            value={rfqNote}
          />
        </label>
        <label>
          Dispute status
          <select
            onChange={(event) => setDisputeStatus(event.target.value)}
            style={inputStyle()}
            value={disputeStatus}
          >
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button onClick={() => void runRequest({ path: "/api/v1/admin/rfqs" })}>List RFQs</button>
          <button
            onClick={() => {
              const id = requiredRfqId();
              if (id) void runRequest({ path: `/api/v1/admin/rfqs/${id}` });
            }}
          >
            Review RFQ
          </button>
          <button
            onClick={() => {
              const id = requiredRfqId();
              if (id) {
                void runRequest({
                  body: { note: rfqNote || "Admin review note." },
                  method: "POST",
                  path: `/api/v1/admin/rfqs/${id}/notes`,
                });
              }
            }}
          >
            Add Note
          </button>
          <button
            onClick={() => {
              const id = requiredRfqId();
              if (id) {
                void runRequest({
                  body: { note: rfqNote || undefined, status: disputeStatus },
                  method: "PATCH",
                  path: `/api/v1/admin/rfqs/${id}/dispute`,
                });
              }
            }}
          >
            Mark Dispute Status
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Payment and Webhook Monitoring</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label>
            Payment status
            <select
              onChange={(event) => setPaymentStatus(event.target.value)}
              style={inputStyle()}
              value={paymentStatus}
            >
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
              <option value="checkout_created">Checkout created</option>
              <option value="succeeded">Succeeded</option>
              <option value="refund_pending">Refund pending</option>
            </select>
          </label>
          <label>
            Failed webhooks only
            <input
              checked={webhookFailedOnly}
              onChange={(event) => setWebhookFailedOnly(event.target.checked)}
              style={{ marginLeft: 8 }}
              type="checkbox"
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            onClick={() =>
              void runRequest({ path: `/api/v1/admin/payments?status=${paymentStatus}` })
            }
          >
            Load Payments
          </button>
          <button
            onClick={() =>
              void runRequest({
                path: `/api/v1/admin/stripe-webhooks?failedOnly=${webhookFailedOnly}`,
              })
            }
          >
            Load Stripe Webhooks
          </button>
        </div>
      </section>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <section style={{ marginTop: 24 }}>
        <h2>API Result</h2>
        <pre style={{ background: "#111", color: "#fff", overflowX: "auto", padding: 16 }}>
          {formattedResult || "No request run yet."}
        </pre>
      </section>
    </main>
  );
}
