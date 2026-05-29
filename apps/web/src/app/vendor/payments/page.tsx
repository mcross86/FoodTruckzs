"use client";

import Link from "next/link";
import { useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type StripeOnboardingLink,
  type VendorPaymentSummary,
} from "@/lib/rfq-api";

export default function VendorPaymentsPage() {
  const session = useVendorAuthSession();
  const [summary, setSummary] = useState<VendorPaymentSummary | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadPayments() {
    setError(null);
    setOnboardingUrl(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<VendorPaymentSummary>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/payments`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Payment status failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setSummary(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Payment status failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createOnboardingLink() {
    setError(null);
    setOnboardingUrl(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<StripeOnboardingLink>({
        apiBaseUrl: session.apiBaseUrl,
        body: {
          refreshUrl: `${window.location.origin}/vendor/payments?stripe=refresh`,
          returnUrl: `${window.location.origin}/vendor/payments?stripe=return`,
        },
        method: "POST",
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/stripe-connect/onboarding-link`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Onboarding link failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setOnboardingUrl(result.data.onboardingUrl);
      setSummary((current) =>
        current
          ? { ...current, stripeAccount: result.data!.stripeAccount }
          : {
              payments: [],
              stripeAccount: result.data!.stripeAccount,
              vendorId: session.activeVendorId.trim(),
            },
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Onboarding link failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const stripeAccount = summary?.stripeAccount;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
        <h1>My Account</h1>
        <p>
          Track customer deposits, payment attempts, and Stripe Connect payout setup. Platform
          subscription and foodtruckzs invoices are managed in{" "}
          <Link href={ROUTES.vendor.platformBilling}>platform billing</Link>.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <button disabled={isLoading} onClick={() => void loadPayments()} type="button">
          {isLoading ? "Loading..." : "Load payments"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ background: "#fff4df", borderRadius: 18, marginTop: 24, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Stripe Connect</h2>
        {stripeAccount ? (
          <p>
            {stripeAccount.accountId ?? "No account"} · charges{" "}
            {stripeAccount.chargesEnabled ? "enabled" : "not enabled"} · payouts{" "}
            {stripeAccount.payoutsEnabled ? "enabled" : "not enabled"} ·{" "}
            {stripeAccount.readyForPayments ? "ready for deposits" : "not ready for deposits"}
          </p>
        ) : (
          <p>Load payment status to see Stripe account readiness.</p>
        )}
        {stripeAccount?.disabledReason ? (
          <p>Disabled reason: {stripeAccount.disabledReason}</p>
        ) : null}
        <button disabled={isLoading} onClick={() => void createOnboardingLink()} type="button">
          Create Stripe onboarding link
        </button>
        {onboardingUrl ? (
          <p>
            <a href={onboardingUrl} rel="noreferrer" target="_blank">
              Open Stripe onboarding
            </a>
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Customer Payment Records</h2>
        {!summary || summary.payments.length === 0 ? (
          <section style={{ border: "1px dashed #bbb", borderRadius: 16, padding: 18 }}>
            <h3>No customer payments loaded</h3>
            <p>Deposits and later balances appear here after checkout sessions are created.</p>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {summary?.payments.map((payment) => (
            <article
              key={payment.payment.id}
              style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}
            >
              <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 4px" }}>
                {statusLabel(payment.payment.status)}
              </p>
              <h3 style={{ margin: "0 0 6px" }}>{payment.eventName}</h3>
              <p style={{ margin: 0 }}>
                {statusLabel(payment.payment.type)} · {moneyLabel(payment.payment.amountCents)} ·{" "}
                schedule: {payment.scheduleItem ? statusLabel(payment.scheduleItem.status) : "N/A"}
              </p>
              <p>
                Stripe session: {payment.payment.stripeCheckoutSessionId ?? "not created"} · intent:{" "}
                {payment.payment.stripePaymentIntentId ?? "not available"}
              </p>
              {payment.attempts.at(-1)?.failureMessage ? (
                <p style={{ color: "crimson" }}>{payment.attempts.at(-1)?.failureMessage}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
