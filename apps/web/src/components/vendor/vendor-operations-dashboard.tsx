"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { dashboardCardBase } from "@/components/dashboard/dashboard-tile-styles";
import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";

type VendorDashboardTile = {
  description: string;
  href: string;
  id: string;
  style: CSSProperties;
  title: string;
};

const VENDOR_DASHBOARD_TILES: VendorDashboardTile[] = [
  {
    description:
      "Business name, cuisines, service areas, public description, and marketplace listing details.",
    href: ROUTES.vendor.profile,
    id: "profile",
    style: {
      background: "linear-gradient(145deg, #ff9d66, #ffb088)",
      boxShadow: "0 20px 44px rgba(255, 157, 102, 0.28)",
    },
    title: "Food Truck Profile",
  },
  {
    description: "Menus, packages, pricing, dietary tags, and quote-ready catering options.",
    href: ROUTES.vendor.menus,
    id: "menus",
    style: {
      background: "linear-gradient(145deg, #c785ff, #d9a8ff)",
      boxShadow: "0 20px 44px rgba(199, 133, 255, 0.24)",
    },
    title: "Menu",
  },
  {
    description: "Review catering requests, send quotes, and respond to customer clarifications.",
    href: ROUTES.vendor.rfqs,
    id: "rfqs",
    style: {
      background: "linear-gradient(145deg, #ffe66d, #fff0a8)",
      boxShadow: "0 20px 44px rgba(255, 230, 109, 0.22)",
    },
    title: "RFQs",
  },
  {
    description:
      "Lead time, travel radius, catering minimums, blackout dates, and when you accept events.",
    href: ROUTES.vendor.availability,
    id: "availability",
    style: {
      background: "linear-gradient(145deg, #5ec4e8, #87ddf7)",
      boxShadow: "0 20px 44px rgba(135, 221, 247, 0.24)",
    },
    title: "Catering Availability",
  },
  {
    description:
      "Set where your truck operates, weekly hours, and public locations for hungry-now discovery.",
    href: ROUTES.vendor.hoursLocations,
    id: "hours-locations",
    style: {
      background: "linear-gradient(145deg, #6ed48a, #9cf579)",
      boxShadow: "0 20px 44px rgba(156, 245, 121, 0.22)",
    },
    title: "Truck Hours and Locations",
  },
  {
    description:
      "Booked catering appointments, festivals, blocked time, and your operating schedule in one view.",
    href: ROUTES.vendor.calendar,
    id: "calendar",
    style: {
      background: "linear-gradient(145deg, #ff9d66, #ffc299)",
      boxShadow: "0 20px 44px rgba(255, 157, 102, 0.22)",
    },
    title: "Calendar",
  },
  {
    description:
      "Subscription plan, Stripe payout setup, platform billing, and payment account details.",
    href: ROUTES.vendor.account,
    id: "account",
    style: {
      background: "linear-gradient(145deg, #c785ff, #e0b8ff)",
      boxShadow: "0 20px 44px rgba(199, 133, 255, 0.2)",
    },
    title: "My Account",
  },
];

export function VendorOperationsDashboard() {
  const session = useVendorAuthSession();
  const gateMessage = vendorWorkspaceGateMessage(session);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 920 }}>
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ color: "#ffe66d", fontWeight: 800, margin: "0 0 8px" }}>foodtruckzs vendor</p>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(30px, 7vw, 46px)",
            letterSpacing: -1,
            lineHeight: 1.05,
            margin: "0 0 12px",
          }}
        >
          Vendor Dashboard
        </h1>
        <p style={{ color: "#c5cbe0", fontSize: 17, lineHeight: 1.5, margin: 0 }}>
          Run your food truck profile, menus, catering requests, availability, and account settings
          from one place.
        </p>
      </header>

      {gateMessage && session.user ? (
        <section
          style={{
            background: "rgba(255, 230, 109, 0.1)",
            border: "1px solid rgba(255, 230, 109, 0.35)",
            borderRadius: 18,
            marginBottom: 20,
            padding: 16,
          }}
        >
          <p style={{ color: "#ffe66d", fontWeight: 800, margin: "0 0 6px" }}>
            Finish setup to unlock all tools
          </p>
          <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>{gateMessage}</p>
        </section>
      ) : null}

      <section
        aria-label="Vendor workspace sections"
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {VENDOR_DASHBOARD_TILES.map((tile) => (
          <Link
            href={tile.href}
            key={tile.id}
            style={{ ...dashboardCardBase, ...tile.style }}
          >
            <strong style={{ fontSize: "clamp(22px, 4.5vw, 28px)", lineHeight: 1.1 }}>
              {tile.title}
            </strong>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}>{tile.description}</span>
          </Link>
        ))}
      </section>

      <p style={{ color: "#8f96ac", fontSize: 14, marginTop: 28, textAlign: "center" }}>
        New operator?{" "}
        <Link href={ROUTES.vendor.register} style={{ color: "#87ddf7" }}>
          Complete vendor registration
        </Link>
      </p>
    </main>
  );
}
