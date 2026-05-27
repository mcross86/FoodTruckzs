import Link from "next/link";

export default function VendorMenusPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <section style={{ background: "#fff4df", borderRadius: 22, padding: 28 }}>
        <p style={{ color: "#8a4b00", fontWeight: 800, margin: "0 0 8px" }}>Menu management</p>
        <h1 style={{ marginTop: 0 }}>Build reusable catering menus</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>
          Create public or private menus, packages, per-person pricing, dietary tags, guest-count
          limits, and quote-only options without forcing exact custom pricing onto the public
          marketplace.
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
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>No menus loaded</h2>
          <p>
            If the API returns no menus, create quote templates or sample packages so RFQs can turn
            into quotes faster.
          </p>
        </article>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Public vs private</h2>
          <p>
            Public menus can appear on vendor profiles. Private menus should stay internal for
            custom packages, seasonal items, and quote-only offers.
          </p>
        </article>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Operational reuse</h2>
          <p>
            Menus should capture dietary tags, lead-time needs, and service style compatibility so
            operators can quote with fewer repeated assumptions.
          </p>
        </article>
      </section>

      <section style={{ border: "1px dashed #bbb", borderRadius: 16, marginTop: 24, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Current MVP state</h2>
        <p>
          Menu APIs are available through the setup API surface. A polished CRUD interface with
          image uploads, cloning, and inline package editing remains an open UI gap.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/vendor-operational-setup">Open setup API surface</Link>
          <Link href="/marketplace">Preview marketplace profile pattern</Link>
          <Link href="/vendor/rfqs">Return to RFQ inbox</Link>
        </p>
      </section>
    </main>
  );
}
