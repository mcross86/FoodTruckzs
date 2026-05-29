import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

export default function VendorOnboardingPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <p>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
      </p>
      <section style={{ background: "#fff4df", borderRadius: 22, padding: 28 }}>
        <p style={{ color: "#8a4b00", fontWeight: 800, margin: "0 0 8px" }}>Operator setup</p>
        <h1 style={{ marginTop: 0 }}>Set up your catering operation</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>
          Complete business profile, service areas, cuisine, minimums, lead time, operating model,
          insurance/license metadata, Stripe Connect readiness, and platform billing terms before
          publishing a marketplace listing.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginTop: 24,
        }}
      >
        {[
          {
            body: "Capture business name, owner contact, public description, service styles, service areas, cuisine, and catering minimums.",
            title: "Business profile",
          },
          {
            body: "Set minimum lead time, travel radius, response expectations, and whether customers can request unavailable dates.",
            title: "Operating rules",
          },
          {
            body: "Use the dedicated menu and availability pages to keep quote inputs reusable and reduce poor-fit RFQs.",
            title: "Quote readiness",
          },
          {
            body: "foodtruckzs platform signed-agreement fee settings are visible to operators and separate from customer deposits.",
            title: "Billing clarity",
          },
        ].map((item) => (
          <article
            key={item.title}
            style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}
          >
            <h2 style={{ marginTop: 0 }}>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section style={{ border: "1px dashed #bbb", borderRadius: 16, marginTop: 24, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Current MVP state</h2>
        <p>
          The backend setup APIs exist. This route provides production navigation and operator-first
          guidance while the existing API exercise screen remains the write surface for this phase.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href={ROUTES.vendor.register}>Start vendor registration</Link>
          <Link href={ROUTES.vendor.dashboard}>Back to vendor dashboard</Link>
          <Link href="/vendor/menus">Manage menus</Link>
          <Link href="/vendor/availability">Manage availability</Link>
          <Link href="/vendor/platform-billing">Review platform billing</Link>
        </p>
      </section>
    </main>
  );
}
