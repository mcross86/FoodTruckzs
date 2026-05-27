"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { moneyLabel, statusLabel, type RfqDetail } from "@/lib/rfq-api";

type RfqConfirmationProps = {
  rfqId: string | undefined;
};

function targetLabel(rfq: RfqDetail): string {
  if (rfq.vendorTargets.length === 0) {
    return "Matching vendors are being evaluated.";
  }

  return rfq.vendorTargets.map((target) => target.vendor.businessName).join(", ");
}

export function RfqConfirmation({ rfqId }: RfqConfirmationProps) {
  const [submittedRfq, setSubmittedRfq] = useState<RfqDetail | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("foodtruckzs.lastSubmittedRfq");

    if (!stored) {
      return;
    }

    try {
      setSubmittedRfq(JSON.parse(stored) as RfqDetail);
    } catch {
      window.sessionStorage.removeItem("foodtruckzs.lastSubmittedRfq");
    }
  }, []);

  const displayId = submittedRfq?.rfqId ?? rfqId ?? "RFQ submitted";

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 900 }}>
      <section style={{ background: "#fff4df", borderRadius: 24, padding: 28 }}>
        <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 8px" }}>RFQ submitted</p>
        <h1 style={{ marginTop: 0 }}>Vendors can now review your event packet</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>
          Your request is not a booking yet. Vendors review the date, headcount, service model,
          logistics, and budget before accepting review, asking clarification questions, or sending
          a quote.
        </p>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 18, marginTop: 20, padding: 20 }}>
        <h2>Request summary</h2>
        <dl
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <dt style={{ fontWeight: 700 }}>RFQ number</dt>
            <dd style={{ margin: 0 }}>
              <code>{displayId}</code>
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Status</dt>
            <dd style={{ margin: 0 }}>
              {submittedRfq ? statusLabel(submittedRfq.status) : "Submitted"}
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Vendor targeting</dt>
            <dd style={{ margin: 0 }}>
              {submittedRfq ? targetLabel(submittedRfq) : "Open RFQ detail for targeting status."}
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Completeness</dt>
            <dd style={{ margin: 0 }}>
              {submittedRfq
                ? `${submittedRfq.completenessScore}% (${statusLabel(submittedRfq.completenessStatus)})`
                : "Available on detail page"}
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Budget maximum</dt>
            <dd style={{ margin: 0 }}>
              {submittedRfq
                ? moneyLabel(Number(submittedRfq.requirements.budget?.budgetMaxCents ?? 0) || null)
                : "Available on detail page"}
            </dd>
          </div>
        </dl>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 18, marginTop: 20, padding: 20 }}>
        <h2>What happens next</h2>
        <ol style={{ lineHeight: 1.6 }}>
          <li>Vendors review fit, timing, logistics, budget, and service requirements.</li>
          <li>A vendor may accept review, decline, or ask for clarification.</li>
          <li>
            Once accepted, the next phase is quote creation. Agreements and deposits come later.
          </li>
        </ol>
        <p>
          Respond quickly to clarification requests, especially around parking, power, permits,
          guest count, and allergy details. Those details directly affect whether operators can
          quote confidently.
        </p>
      </section>

      <p style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        {rfqId ? (
          <Link href={`/customer/rfqs/${encodeURIComponent(rfqId)}`}>Open RFQ detail</Link>
        ) : null}
        <Link href="/customer/dashboard">Open customer dashboard</Link>
        <Link href="/marketplace">Back to marketplace</Link>
      </p>
    </main>
  );
}
