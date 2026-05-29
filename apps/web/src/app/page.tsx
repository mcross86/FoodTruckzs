import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

const cardBase = {
  alignContent: "center",
  borderRadius: 28,
  color: "#171b2a",
  display: "grid",
  gap: 16,
  justifyItems: "center",
  minHeight: 180,
  padding: "clamp(24px, 5vw, 32px)",
  textAlign: "center",
  textDecoration: "none",
} as const;

const tileTitleStyle = {
  display: "block",
  fontSize: 32,
  lineHeight: 1.15,
  margin: 0,
  textAlign: "center",
  width: "100%",
} as const;

const tileDescriptionStyle = {
  display: "block",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
  maxWidth: 420,
  textAlign: "center",
  width: "100%",
} as const;

export default function HomePage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 720 }}>
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 8px" }}>
          foodtruckzs
        </p>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(34px, 8vw, 52px)",
            letterSpacing: -1.2,
            lineHeight: 1,
            margin: "0 0 12px",
          }}
        >
          What brings you here today?
        </h1>
        <p style={{ color: "#c5cbe0", fontSize: 18, lineHeight: 1.5, margin: 0 }}>
          Choose your path. Hungry now is fast discovery. Planning an event is a guided catering
          quote request.
        </p>
      </header>

      <section
        aria-label="Customer intents"
        style={{ display: "grid", gap: 16, marginBottom: 28 }}
      >
        <Link
          href={ROUTES.discover}
          style={{
            ...cardBase,
            background: "linear-gradient(145deg, #ff9d66, #ffb088)",
            boxShadow: "0 20px 44px rgba(255, 157, 102, 0.28)",
          }}
        >
          <strong style={tileTitleStyle}>I&apos;m Hungry Now</strong>
          <span style={tileDescriptionStyle}>
            Find food trucks open near you with map + list discovery. No account required.
          </span>
        </Link>

        <Link
          href={ROUTES.customer.dashboard}
          style={{
            ...cardBase,
            background: "linear-gradient(145deg, #c785ff, #d9a8ff)",
            boxShadow: "0 20px 44px rgba(199, 133, 255, 0.24)",
          }}
        >
          <strong style={tileTitleStyle}>I&apos;m Planning an Event</strong>
          <span style={tileDescriptionStyle}>
            Guided catering RFQ for weddings, offices, festivals, and private parties. Sign in,
            create a profile, or continue as guest.
          </span>
        </Link>
      </section>

      <section
        aria-label="Vendor access"
        style={{
          background: "rgba(37, 41, 58, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          display: "grid",
          gap: 14,
          padding: 20,
        }}
      >
        <div>
          <p style={{ color: "#87ddf7", fontSize: 12, fontWeight: 800, margin: "0 0 6px" }}>
            FOR FOOD TRUCK OPERATORS
          </p>
          <h2 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Run your truck on foodtruckzs</h2>
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            Manage RFQs, quotes, calendars, menus, and payouts from your vendor workspace.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            href={ROUTES.vendor.login}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: 999,
              color: "#f8fafc",
              fontWeight: 800,
              padding: "10px 16px",
            }}
          >
            Vendor login
          </Link>
          <Link
            href={ROUTES.vendor.register}
            style={{
              background: "#ffe66d",
              borderRadius: 999,
              color: "#171b2a",
              fontWeight: 800,
              padding: "10px 16px",
            }}
          >
            Become a vendor
          </Link>
        </div>
      </section>

      <p style={{ color: "#8f96ac", fontSize: 14, marginTop: 24, textAlign: "center" }}>
        Catering search for event planners:{" "}
        <Link href={ROUTES.marketplace}>Browse marketplace</Link>
      </p>
    </main>
  );
}
