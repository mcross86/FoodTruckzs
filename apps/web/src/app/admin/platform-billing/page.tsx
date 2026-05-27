"use client";

import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

const defaultSettingsPayload = {
  agreementFeeBasisPoints: 750,
  billingEmail: "billing@exampletruck.test",
  invoiceTermsDays: 30,
};

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminPlatformBillingPage() {
  const session = useAuthSession();
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [billingPeriodStart, setBillingPeriodStart] = useState(today());
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(today());
  const [settingsPayload, setSettingsPayload] = useState(stringify(defaultSettingsPayload));
  const [result, setResult] = useState<VendorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedResult = useMemo(() => (result ? stringify(result.body) : ""), [result]);
  const vendorOptions = useMemo(() => {
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
            ? (item as { vendor?: { businessName?: unknown; id?: unknown; slug?: unknown } })
                .vendor
            : null;
        return typeof vendor?.id === "string"
          ? {
              id: vendor.id,
              label: `${String(vendor.businessName ?? "Vendor")} (${String(vendor.slug ?? vendor.id)})`,
            }
          : null;
      })
      .filter((item): item is { id: string; label: string } => item !== null);
  }, [result]);

  function requireVendorId(): string | null {
    const value = vendorId.trim();

    if (!value) {
      setError("Enter a vendor ID first.");
      return null;
    }

    return value;
  }

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

  function parseSettingsPayload(): unknown | null {
    try {
      return JSON.parse(settingsPayload) as unknown;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Invalid settings JSON.");
      return null;
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1180 }}>
      <h1>Admin Platform Billing</h1>
      <p>
        Configure vendor signed-agreement fee percentages, inspect pending platform fees, and
        generate foodtruckzs invoices to catering companies. These records are separate from
        customer deposit/payment amounts.
      </p>

      <AuthSessionPanel requireAdmin session={session} title="Admin Account" />

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 18 }}>
        <label>
          Search vendors
          <input
            onChange={(event) => setVendorSearch(event.target.value)}
            placeholder="Business name or slug"
            style={{ display: "block", marginTop: 4, padding: 8, width: "100%" }}
            value={vendorSearch}
          />
        </label>
        <label>
          Vendor ID
          <input
            onChange={(event) => setVendorId(event.target.value)}
            placeholder="Vendor UUID"
            style={{ display: "block", marginTop: 4, padding: 8, width: "100%" }}
            value={vendorId}
          />
        </label>
        {vendorOptions.length > 0 ? (
          <label style={{ gridColumn: "1 / -1" }}>
            Select vendor from latest search
            <select
              onChange={(event) => setVendorId(event.target.value)}
              style={{ display: "block", marginTop: 4, padding: 8, width: "100%" }}
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
        <button
          onClick={() => {
            const query = vendorSearch.trim()
              ? `?search=${encodeURIComponent(vendorSearch.trim())}`
              : "";
            void runRequest({ path: `/api/v1/admin/vendors${query}` });
          }}
          type="button"
        >
          Search Vendors
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Billing Settings</h2>
        <textarea
          onChange={(event) => setSettingsPayload(event.target.value)}
          rows={7}
          style={{ boxSizing: "border-box", fontFamily: "monospace", width: "100%" }}
          value={settingsPayload}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              const id = requireVendorId();

              if (id) {
                void runRequest({ path: `/api/v1/admin/vendors/${id}/billing-settings` });
              }
            }}
          >
            Load Billing Settings
          </button>
          <button
            onClick={() => {
              const id = requireVendorId();
              const body = parseSettingsPayload();

              if (id && body) {
                void runRequest({
                  body,
                  method: "PATCH",
                  path: `/api/v1/admin/vendors/${id}/billing-settings`,
                });
              }
            }}
          >
            Save Billing Settings
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Fees and Invoice Generation</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label>
            Billing period start
            <input
              onChange={(event) => setBillingPeriodStart(event.target.value)}
              style={{ display: "block", marginTop: 4, padding: 8, width: "100%" }}
              type="date"
              value={billingPeriodStart}
            />
          </label>
          <label>
            Billing period end
            <input
              onChange={(event) => setBillingPeriodEnd(event.target.value)}
              style={{ display: "block", marginTop: 4, padding: 8, width: "100%" }}
              type="date"
              value={billingPeriodEnd}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              const query = vendorId.trim() ? `?vendorId=${vendorId.trim()}` : "";
              void runRequest({ path: `/api/v1/admin/platform-billing${query}` });
            }}
          >
            Load Platform Billing
          </button>
          <button
            onClick={() => {
              const id = requireVendorId();

              if (id) {
                void runRequest({
                  body: {
                    billingPeriodEnd,
                    billingPeriodStart,
                    vendorId: id,
                  },
                  method: "POST",
                  path: "/api/v1/admin/vendor-invoices",
                });
              }
            }}
          >
            Generate Vendor Invoice
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
