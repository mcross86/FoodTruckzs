import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "48px auto", maxWidth: 960 }}>
      <section style={{ background: "#fff4df", borderRadius: 24, padding: 32 }}>
        <p style={{ color: "#8a4b00", fontWeight: 700, margin: "0 0 8px" }}>
          Food truck catering for private, corporate, and community events
        </p>
        <h1 style={{ fontSize: 48, margin: "0 0 16px" }}>Find catering-ready food trucks</h1>
        <p style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 720 }}>
          Discover real food truck operators, compare service styles and minimums, then request a
          quote with event details operators need to respond well.
        </p>
        <form action="/marketplace" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <input
            aria-label="Service area"
            name="serviceArea"
            placeholder="Metro or city"
            style={{ flex: "1 1 200px", padding: 12 }}
          />
          <input
            aria-label="Cuisine"
            name="cuisine"
            placeholder="Cuisine"
            style={{ flex: "1 1 160px", padding: 12 }}
          />
          <input
            aria-label="Event date"
            name="eventDate"
            style={{ flex: "1 1 160px", padding: 12 }}
            type="date"
          />
          <input
            aria-label="Guest count"
            min="1"
            name="guestCount"
            placeholder="Guest count"
            style={{ flex: "1 1 140px", padding: 12 }}
            type="number"
          />
          <button style={{ padding: "12px 18px" }} type="submit">
            Search vendors
          </button>
        </form>
        <p style={{ marginBottom: 0 }}>
          <Link href="/rfq/start">Request catering quotes</Link> ·{" "}
          <Link href="/vendor/onboarding">List your food truck</Link>
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 32,
        }}
      >
        <div>
          <h2>Verified operators</h2>
          <p>Marketplace visibility is limited to approved, active, published vendors.</p>
        </div>
        <div>
          <h2>Operator-first RFQs</h2>
          <p>
            Quote requests are structured around event size, service model, budget, and logistics.
          </p>
        </div>
        <div>
          <h2>Cuisines and events</h2>
          <p>
            Search for tacos, BBQ, burgers, desserts, coffee, and other trucks for offices,
            weddings, schools, festivals, and neighborhood events.
          </p>
        </div>
        <div>
          <h2>Clear next step</h2>
          <p>
            Discovery leads into RFQ start without implying instant booking or guaranteed
            availability.
          </p>
        </div>
      </section>

      <p style={{ marginTop: 32 }}>
        Operators can configure profiles, menus, availability, payments, documents, and platform
        billing from the vendor navigation. Admin tools are available from the admin navigation.
      </p>
    </main>
  );
}
