"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  statusLabel,
  type AgreementDetail,
  type AgreementDownloadUrl,
} from "@/lib/rfq-api";

type CustomerAgreementReviewProps = {
  agreementId: string;
};

const acknowledgementOptions: {
  key: "cancellationPolicy" | "customerResponsibilities" | "paymentTerms";
  label: string;
}[] = [
  { key: "paymentTerms", label: "I acknowledge the payment terms." },
  { key: "cancellationPolicy", label: "I acknowledge the cancellation policy." },
  {
    key: "customerResponsibilities",
    label: "I acknowledge the customer responsibilities.",
  },
];

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function section(snapshot: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = snapshot[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function CustomerAgreementReview({ agreementId }: CustomerAgreementReviewProps) {
  const session = useAuthSession();
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [typedName, setTypedName] = useState("");
  const [acknowledgements, setAcknowledgements] = useState({
    cancellationPolicy: false,
    customerResponsibilities: false,
    paymentTerms: false,
  });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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

  async function signAgreement() {
    if (!agreement?.currentVersion) return;
    setError(null);
    setSuccess(null);
    setIsMutating(true);

    try {
      const result = await rfqApiRequest<AgreementDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: {
          acceptedTermsVersion: agreement.currentVersion.id,
          acknowledgements,
          signatureMetadata: { source: "customer_agreement_review_page" },
          typedName,
        },
        method: "POST",
        path: `/api/v1/agreements/${encodeURIComponent(agreement.agreement.id)}/sign`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Agreement signing failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setAgreement(result.data);
      setSuccess("Agreement signed. The next payment action is shown below.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Agreement signing failed.");
    } finally {
      setIsMutating(false);
    }
  }

  async function loadDownloadUrl() {
    if (!agreement) return;
    setError(null);
    setDownloadUrl(null);
    setIsMutating(true);

    try {
      const result = await rfqApiRequest<AgreementDownloadUrl>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/agreements/${encodeURIComponent(agreement.agreement.id)}/download-url`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Download URL failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setDownloadUrl(result.data.downloadUrl);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Download URL failed.");
    } finally {
      setIsMutating(false);
    }
  }

  const currentVersion = agreement?.currentVersion;
  const snapshot = currentVersion?.termsSnapshot ?? {};
  const eventDetails = section(snapshot, "eventDetails");
  const pricing = section(snapshot, "pricing");
  const paymentTerms = section(snapshot, "paymentTerms");
  const cancellationPolicy = section(snapshot, "cancellationPolicy");
  const vendorRequirements = section(snapshot, "vendorRequirements");
  const customerResponsibilities = section(snapshot, "customerResponsibilities");
  const allAcknowledged =
    acknowledgements.cancellationPolicy &&
    acknowledgements.customerResponsibilities &&
    acknowledgements.paymentTerms;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        {agreement ? (
          <Link href={`/customer/rfqs/${agreement.rfq.id}`}>Back to RFQ detail</Link>
        ) : null}
        <h1>Customer Agreement Review</h1>
        <p>
          Review the generated agreement version, sign digitally, and see the next customer event
          payment action. foodtruckzs platform billing stays separate from customer deposits.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
        <button disabled={isLoading} onClick={() => void loadAgreement()} type="button">
          {isLoading ? "Loading..." : "Load agreement"}
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

      {!agreement || !currentVersion ? (
        <section style={{ background: "#fff4df", borderRadius: 16, marginTop: 20, padding: 20 }}>
          <h2>Agreement not loaded</h2>
          <p>Load the authenticated agreement to review and sign current terms.</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
          <section style={{ background: "#fff4df", borderRadius: 18, padding: 20 }}>
            <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 6px" }}>
              {statusLabel(agreement.agreement.status)} · Version {currentVersion.versionNumber}
            </p>
            <h2 style={{ margin: "0 0 8px" }}>{agreement.vendor.businessName}</h2>
            <p style={{ margin: 0 }}>
              {agreement.rfq.eventName} · {moneyLabel(agreement.quote.totalCents)} · generated{" "}
              {formatDate(agreement.agreement.generatedAt)}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Event Details</h2>
            <p>
              <strong>{String(eventDetails.eventName ?? agreement.rfq.eventName)}</strong>
            </p>
            <p>
              {formatDate(String(eventDetails.startsAt ?? ""))} to{" "}
              {formatDate(String(eventDetails.endsAt ?? ""))}
            </p>
            <p>
              {String(eventDetails.estimatedHeadcount ?? "Unknown")} guests ·{" "}
              {String(eventDetails.indoorOutdoor ?? "Venue type not listed")}
            </p>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Pricing and Payment Terms</h2>
            <p>
              Total {moneyLabel(Number(pricing.totalCents ?? 0))}; deposit{" "}
              {moneyLabel(Number(paymentTerms.depositRequiredCents ?? 0))}.
            </p>
            <p>
              These amounts come from the accepted vendor quote and agreement payment schedule, not
              from foodtruckzs platform invoices to the catering company.
            </p>
            <ul>
              {Array.isArray(paymentTerms.paymentSchedule)
                ? paymentTerms.paymentSchedule.map((item) => {
                    const scheduleItem = item as Record<string, unknown>;
                    return (
                      <li key={String(scheduleItem.id)}>
                        {String(scheduleItem.label)} ·{" "}
                        {moneyLabel(Number(scheduleItem.amountCents ?? 0))} · due{" "}
                        {formatDate((scheduleItem.dueAt as string | null) ?? null)}
                      </li>
                    );
                  })
                : null}
            </ul>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Policies and Responsibilities</h2>
            <p>
              <strong>Cancellation:</strong> {String(cancellationPolicy.summary ?? "Not listed")}
            </p>
            <h3>Vendor Requirements</h3>
            <ul>
              {textList(vendorRequirements.assumptions).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Customer Responsibilities</h3>
            <ul>
              {textList(customerResponsibilities.responsibilities).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {agreement.agreement.status === "signed" ? (
            <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
              <h2 style={{ marginTop: 0 }}>Signed Agreement</h2>
              <p>Signed at {formatDate(agreement.agreement.signedAt)}.</p>
              <button disabled={isMutating} onClick={() => void loadDownloadUrl()} type="button">
                Get download URL
              </button>
              {downloadUrl ? <p>Download URL stub: {downloadUrl}</p> : null}
              {agreement.nextPaymentAction ? (
                <p>
                  Next payment action: {agreement.nextPaymentAction.label} ·{" "}
                  {moneyLabel(agreement.nextPaymentAction.amountCents)}.{" "}
                  <Link href={`/customer/payments/deposits/${agreement.agreement.id}`}>
                    Pay deposit
                  </Link>
                </p>
              ) : (
                <p>No immediate payment action is due.</p>
              )}
            </section>
          ) : (
            <section
              style={{
                border: "1px solid #ddd",
                borderRadius: 16,
                display: "grid",
                gap: 12,
                padding: 18,
              }}
            >
              <h2 style={{ margin: 0 }}>Digital Signature</h2>
              <label>
                Legal name
                <input
                  onChange={(event) => setTypedName(event.target.value)}
                  style={{ display: "block", width: "100%" }}
                  value={typedName}
                />
              </label>
              {acknowledgementOptions.map(({ key, label }) => (
                <label key={key}>
                  <input
                    checked={acknowledgements[key]}
                    onChange={(event) =>
                      setAcknowledgements((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />{" "}
                  {label}
                </label>
              ))}
              <button
                disabled={isMutating || !typedName.trim() || !allAcknowledged}
                onClick={() => void signAgreement()}
                type="button"
              >
                Sign current agreement version
              </button>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
