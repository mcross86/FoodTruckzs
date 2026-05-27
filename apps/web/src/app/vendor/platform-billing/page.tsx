"use client";

import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function VendorPlatformBillingPage() {
  const session = useAuthSession();
  const [result, setResult] = useState<VendorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedResult = useMemo(() => (result ? stringify(result.body) : ""), [result]);

  async function loadBilling() {
    setError(null);
    const id = session.activeVendorId.trim();

    if (!id) {
      setError("Log in as a vendor owner/manager and choose an active vendor first.");
      return;
    }

    try {
      const apiResult = await vendorApiRequest({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${id}/platform-billing`,
        token: session.accessToken,
      });
      setResult(apiResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Request failed.");
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1040 }}>
      <h1>Vendor Platform Billing</h1>
      <p>
        View your configured foodtruckzs signed-agreement fee percentage, pending platform fees, and
        issued vendor invoices. These platform invoices are separate from customer deposits,
        balances, Stripe processing fees, and vendor payouts.
      </p>

      <AuthSessionPanel requireVendor session={session} title="Vendor Account" />

      <button onClick={() => void loadBilling()} style={{ marginTop: 16 }}>
        Load Vendor Billing
      </button>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section style={{ marginTop: 24 }}>
        <h2>API Result</h2>
        <pre style={{ background: "#111", color: "#fff", overflowX: "auto", padding: 16 }}>
          {formattedResult || "No billing data loaded yet."}
        </pre>
      </section>
    </main>
  );
}
