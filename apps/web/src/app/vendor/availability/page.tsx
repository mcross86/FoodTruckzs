import Link from "next/link";

export default function VendorAvailabilityPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1040 }}>
      <section style={{ background: "#fff4df", borderRadius: 22, padding: 28 }}>
        <p style={{ color: "#8a4b00", fontWeight: 800, margin: "0 0 8px" }}>
          Availability and operating settings
        </p>
        <h1 style={{ marginTop: 0 }}>Control when and where you accept catering</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5 }}>
          Set lead time, service areas, travel radius, catering minimums, operating windows,
          blackout dates, setup buffers, and response preferences so weak or impossible leads are
          reduced before they reach the inbox.
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
            body: "Use recurring hours and blackout dates to keep unavailable dates from looking guaranteed.",
            title: "Calendar fit",
          },
          {
            body: "Travel radius, service areas, minimums, and lead time help the marketplace screen requests before operators spend time reviewing them.",
            title: "Lead quality",
          },
          {
            body: "Setup and travel buffers feed calendar warnings so confirmed catering events stay operationally realistic.",
            title: "Day-of readiness",
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
          Availability APIs and calendar warnings exist. Drag editing, recurring-event editing, and
          a full visual settings form remain open UI work.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/vendor-operational-setup">Open setup API surface</Link>
          <Link href="/vendor/calendar">Open calendar</Link>
          <Link href="/vendor/rfqs">Review RFQ inbox</Link>
        </p>
      </section>
    </main>
  );
}
