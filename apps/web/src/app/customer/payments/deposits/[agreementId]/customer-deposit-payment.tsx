"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useCustomerAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type AgreementDetail,
  type PaymentDetail,
} from "@/lib/rfq-api";

type CustomerDepositPaymentProps = {
  agreementId: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function paymentSchedule(snapshot: Record<string, unknown>) {
  const paymentTerms = snapshot.paymentTerms;
  if (!paymentTerms || typeof paymentTerms !== "object" || Array.isArray(paymentTerms)) return [];
  const schedule = (paymentTerms as Record<string, unknown>).paymentSchedule;
  return Array.isArray(schedule) ? (schedule as Record<string, unknown>[]) : [];
}

export function CustomerDepositPayment({ agreementId }: CustomerDepositPaymentProps) {
  const session = useCustomerAuthSession();
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  async function loadAgreement() {
    setError(null);
    setSuccess(null);

    if (!session.accessToken.trim()) {
      setError("Log in as the agreement customer or choose a saved customer account.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<AgreementDetail>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/agreements/${encodeURIComponent(agreementId)}`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Agreement load failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setAgreement(result.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Agreement load failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createCheckout() {
    if (!agreement?.nextPaymentAction) return;
    setError(null);
    setSuccess(null);
    setIsMutating(true);

    try {
      const result = await rfqApiRequest<PaymentDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: {
          agreementId: agreement.agreement.id,
          paymentScheduleItemId: agreement.nextPaymentAction.paymentScheduleItemId,
        },
        headers: {
          "Idempotency-Key": `deposit:${agreement.agreement.id}:${agreement.nextPaymentAction.paymentScheduleItemId}`,
        },
        method: "POST",
        path: "/api/v1/payments/deposits/checkout-session",
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Checkout creation failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setPayment(result.data);
      setSuccess(
        "Checkout session created. Use the Stripe Checkout URL below to complete payment.",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Checkout creation failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const scheduleItems = useMemo(
    () => paymentSchedule(agreement?.currentVersion?.termsSnapshot ?? {}),
    [agreement],
  );
  const nextPaymentAction = agreement?.nextPaymentAction;
  const remainingBalanceCents =
    scheduleItems.reduce((total, item) => total + Number(item.amountCents ?? 0), 0) -
    (nextPaymentAction?.amountCents ?? 0);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href={`/customer/agreements/${agreementId}`}>Back to agreement</Link>
        <h1>Customer Deposit Payment</h1>
        <p>
          Pay the required down payment for a signed agreement. Amounts come from the server-owned
          agreement payment schedule for the catered event. foodtruckzs platform agreement fees are
          not customer charges and do not appear in this checkout flow.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
        <button disabled={isLoading} onClick={() => void loadAgreement()} type="button">
          {isLoading ? "Loading..." : "Load deposit"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}
      {success ? (
        <section style={{ background: "#e8ffe8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {success}
        </section>
      ) : null}

      {!agreement ? (
        <section style={{ background: "#fff4df", borderRadius: 16, marginTop: 20, padding: 20 }}>
          <h2>Deposit not loaded</h2>
          <p>Load the signed agreement to see the required deposit and payment schedule.</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 6px" }}>
              Agreement {statusLabel(agreement.agreement.status)}
            </p>
            <h2 style={{ margin: "0 0 8px" }}>{agreement.rfq.eventName}</h2>
            <p style={{ margin: 0 }}>
              {agreement.vendor.businessName} · total {moneyLabel(agreement.quote.totalCents)}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Current Payment</h2>
            {nextPaymentAction ? (
              <>
                <p>
                  <strong>{nextPaymentAction.label}</strong> ·{" "}
                  {moneyLabel(nextPaymentAction.amountCents)} · due{" "}
                  {formatDate(nextPaymentAction.dueAt)}
                </p>
                <p>
                  Remaining scheduled balance after this payment:{" "}
                  {moneyLabel(remainingBalanceCents)}.
                </p>
                <p>
                  This payment is collected for the caterer through the agreement schedule. It is
                  not a foodtruckzs platform invoice or platform billing charge.
                </p>
                <button disabled={isMutating} onClick={() => void createCheckout()} type="button">
                  {isMutating ? "Creating checkout..." : "Create Stripe Checkout session"}
                </button>
              </>
            ) : (
              <p>No unpaid required deposit is currently due.</p>
            )}
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Payment Schedule</h2>
            <ul>
              {scheduleItems.map((item) => (
                <li key={String(item.id)}>
                  {String(item.label)} · {moneyLabel(Number(item.amountCents ?? 0))} ·{" "}
                  {statusLabel(String(item.status ?? "pending"))} · due{" "}
                  {formatDate((item.dueAt as string | null) ?? null)}
                </li>
              ))}
            </ul>
          </section>

          {payment ? (
            <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
              <h2 style={{ marginTop: 0 }}>Checkout Status</h2>
              <p>
                Payment {payment.payment.id}: {statusLabel(payment.payment.status)} ·{" "}
                {moneyLabel(payment.payment.amountCents)}
              </p>
              {payment.checkoutUrl ? (
                <p>
                  <a href={payment.checkoutUrl} rel="noreferrer" target="_blank">
                    Open Stripe Checkout
                  </a>
                </p>
              ) : null}
              {payment.attempts.at(-1)?.failureMessage ? (
                <p style={{ color: "crimson" }}>{payment.attempts.at(-1)?.failureMessage}</p>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
