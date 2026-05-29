"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { DashboardActionBadge } from "@/components/dashboard/dashboard-action-badge";
import { dashboardCardBase } from "@/components/dashboard/dashboard-tile-styles";
import { useCustomerRfqPendingCount } from "@/hooks/use-customer-rfq-pending-count";
import { useCustomerAuthSession } from "@/lib/auth-session";

type CustomerDashboardTile = {
  description: string;
  href: string;
  id: string;
  style: CSSProperties;
  title: string;
};

const CUSTOMER_DASHBOARD_TILES: CustomerDashboardTile[] = [
  {
    description:
      "Name, email, phone, and account settings for quotes, agreements, and event coordination.",
    href: ROUTES.customer.profile,
    id: "profile",
    style: {
      background: "linear-gradient(145deg, #ff9d66, #ffb088)",
      boxShadow: "0 20px 44px rgba(255, 157, 102, 0.28)",
    },
    title: "My Profile",
  },
  {
    description:
      "Track catering requests, quotes awaiting review, agreements, deposits, and confirmed events.",
    href: ROUTES.customer.rfqs,
    id: "rfqs",
    style: {
      background: "linear-gradient(145deg, #c785ff, #d9a8ff)",
      boxShadow: "0 20px 44px rgba(199, 133, 255, 0.24)",
    },
    title: "My RFQs",
  },
  {
    description:
      "Workflow updates, vendor clarifications, and booking notifications in one inbox.",
    href: ROUTES.customer.messages,
    id: "messages",
    style: {
      background: "linear-gradient(145deg, #ffe66d, #fff0a8)",
      boxShadow: "0 20px 44px rgba(255, 230, 109, 0.22)",
    },
    title: "Messages",
  },
];

export function CustomerOperationsDashboard() {
  const session = useCustomerAuthSession();
  const { count: rfqPendingCount } = useCustomerRfqPendingCount();

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 920 }}>
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ color: "#c785ff", fontWeight: 800, margin: "0 0 8px" }}>foodtruckzs customer</p>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(30px, 7vw, 46px)",
            letterSpacing: -1,
            lineHeight: 1.05,
            margin: "0 0 12px",
          }}
        >
          Customer Dashboard
        </h1>
        <p style={{ color: "#c5cbe0", fontSize: 17, lineHeight: 1.5, margin: 0 }}>
          Manage your profile, catering requests, and messages from one place.
        </p>
      </header>

      <section
        aria-label="Customer workspace sections"
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {CUSTOMER_DASHBOARD_TILES.map((tile) => (
          <Link
            href={tile.href}
            key={tile.id}
            style={{
              ...dashboardCardBase,
              ...tile.style,
              position: "relative",
            }}
          >
            {tile.id === "rfqs" ? <DashboardActionBadge count={rfqPendingCount} /> : null}
            <strong style={{ fontSize: "clamp(22px, 4.5vw, 28px)", lineHeight: 1.1 }}>
              {tile.title}
            </strong>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}>{tile.description}</span>
          </Link>
        ))}
      </section>

      <p style={{ color: "#8f96ac", fontSize: 14, marginTop: 28, textAlign: "center" }}>
        Planning a new event?{" "}
        <Link href={ROUTES.plan.event} style={{ color: "#87ddf7" }}>
          Start a catering RFQ
        </Link>
        {!session.user ? (
          <>
            {" "}
            or{" "}
            <Link href={ROUTES.customer.login} style={{ color: "#87ddf7" }}>
              sign in
            </Link>
          </>
        ) : null}
      </p>
    </main>
  );
}
