"use client";

import { useMemo, useState } from "react";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import { vendorApiRequest, type VendorApiResult } from "@/lib/vendor-operations-api";

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function VendorPlatformBillingPage() {
  const session = useVendorAuthSession();
  const [result, setResult] = useState<VendorApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedResult = useMemo(() => (result ? stringify(result.body) : ""), [result]);

  async function loadBilling() {
    setError(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    const id = session.activeVendorId.trim();

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
