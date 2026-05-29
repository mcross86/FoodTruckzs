"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";

import { ROUTES } from "@foodtruckzs/shared";

const cardBase: CSSProperties = {
  border: "none",
  borderRadius: 28,
  color: "#171b2a",
  cursor: "pointer",
  display: "grid",
  gap: 10,
  minHeight: 160,
  padding: "clamp(20px, 4vw, 28px)",
  textAlign: "left",
  width: "100%",
};

const submenuButtonStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 20,
  color: "#f8fafc",
  display: "grid",
  gap: 6,
  minHeight: 72,
  padding: "16px 18px",
  textAlign: "left",
  width: "100%",
};

type AdminSectionId =
  | "vendors"
  | "rfqs"
  | "disputes"
  | "payments"
  | "platform-billing"
  | "marketplace-config";

type AdminSubmenuItem = {
  description: string;
  href?: string;
  id: string;
  label: string;
};

type AdminSection = {
  description: string;
  id: AdminSectionId;
  style: CSSProperties;
  submenu: AdminSubmenuItem[];
  title: string;
};

const ADMIN_SECTIONS: AdminSection[] = [
  {
    description: "Review applications, approvals, and marketplace visibility.",
    id: "vendors",
    style: {
      background: "linear-gradient(145deg, #ff9d66, #ffb088)",
      boxShadow: "0 20px 44px rgba(255, 157, 102, 0.28)",
    },
    submenu: [
      {
        description: "Pending vendor applications awaiting admin decision.",
        href: `${ROUTES.admin.vendors}?approvalStatus=pending`,
        id: "vendors.pending",
        label: "New Vendor Approval Requests",
      },
      {
        description: "Search and review vendors across all approval statuses.",
        href: `${ROUTES.admin.vendors}?approvalStatus=all`,
        id: "vendors.all",
        label: "Vendor List (All status)",
      },
    ],
    title: "Manage Vendors",
  },
  {
    description: "Monitor inbound catering requests and vendor response activity.",
    id: "rfqs",
    style: {
      background: "linear-gradient(145deg, #c785ff, #d9a8ff)",
      boxShadow: "0 20px 44px rgba(199, 133, 255, 0.24)",
    },
    submenu: [
      {
        description: "Submitted RFQs where no vendor target has responded yet.",
        id: "rfqs.new",
        label: "New RFQs (no response)",
      },
      {
        description: "Full RFQ queue across every lifecycle status.",
        id: "rfqs.all",
        label: "RFQ Lists (All status)",
      },
    ],
    title: "Manage RFQs",
  },
  {
    description: "Track open customer disputes and historical dispute reviews.",
    id: "disputes",
    style: {
      background: "linear-gradient(145deg, #5ec4e8, #87ddf7)",
      boxShadow: "0 20px 44px rgba(135, 221, 247, 0.24)",
    },
    submenu: [
      {
        description: "RFQs with active dispute reviews that are not resolved.",
        id: "disputes.new",
        label: "New Disputes",
      },
      {
        description: "All RFQs that have dispute activity on record.",
        id: "disputes.all",
        label: "Dispute Lists (All status)",
      },
    ],
    title: "Customer Disputes",
  },
  {
    description: "Watch checkout, processing failures, and payout risk.",
    id: "payments",
    style: {
      background: "linear-gradient(145deg, #ffe66d, #fff0a8)",
      boxShadow: "0 20px 44px rgba(255, 230, 109, 0.22)",
    },
    submenu: [
      {
        description: "Payments in checkout_created or processing states.",
        id: "payments.stuck",
        label: "Stuck Payments",
      },
      {
        description: "Failed payments that need admin follow-up.",
        id: "payments.late",
        label: "Late Payments",
      },
      {
        description: "Complete payment monitoring feed.",
        id: "payments.all",
        label: "Payments List (All status)",
      },
    ],
    title: "Payment Monitoring",
  },
  {
    description: "Cuisine categories, marketplace filters, and vendor setup prerequisites.",
    id: "marketplace-config",
    style: {
      background: "linear-gradient(145deg, #ff9d66, #ffc299)",
      boxShadow: "0 20px 44px rgba(255, 157, 102, 0.22)",
    },
    submenu: [
      {
        description:
          "Add and activate cuisine categories required before vendors can save truck profiles.",
        href: ROUTES.admin.marketplaceConfig,
        id: "marketplace-config.cuisines",
        label: "Manage cuisine categories",
      },
    ],
    title: "Marketplace Configuration",
  },
  {
    description:
      "Configure agreement fees, inspect pending platform fees, and generate vendor invoices.",
    id: "platform-billing",
    style: {
      background: "linear-gradient(145deg, #6ed48a, #9cf579)",
      boxShadow: "0 20px 44px rgba(156, 245, 121, 0.22)",
    },
    submenu: [
      {
        description: "Full billing settings, fees, and invoice generation tools.",
        href: ROUTES.admin.platformBilling,
        id: "platform-billing.workspace",
        label: "Open platform billing workspace",
      },
      {
        description: "Review vendors with outstanding platform billing fees.",
        href: ROUTES.admin.platformBilling,
        id: "platform-billing.pending",
        label: "Pending platform fees",
      },
    ],
    title: "Platform Billing",
  },
];

export function AdminOperationsDashboard() {
  const router = useRouter();
  const [activeSectionId, setActiveSectionId] = useState<AdminSectionId | null>(null);

  const activeSection = useMemo(
    () => ADMIN_SECTIONS.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId],
  );

  function handleSubmenuAction(item: AdminSubmenuItem) {
    if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 920 }}>
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 8px" }}>foodtruckzs admin</p>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(30px, 7vw, 46px)",
            letterSpacing: -1,
            lineHeight: 1.05,
            margin: "0 0 12px",
          }}
        >
          {activeSection ? activeSection.title : "Operations dashboard"}
        </h1>
        {activeSection ? (
          <p style={{ color: "#c5cbe0", fontSize: 17, lineHeight: 1.5, margin: 0 }}>
            {activeSection.description}
          </p>
        ) : null}
      </header>

      {!activeSection ? (
        <section
          aria-label="Admin operations sections"
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {ADMIN_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSectionId(section.id)}
              style={{ ...cardBase, ...section.style }}
              type="button"
            >
              <strong style={{ fontSize: "clamp(24px, 5vw, 30px)", lineHeight: 1.1 }}>
                {section.title}
              </strong>
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>{section.description}</span>
            </button>
          ))}
        </section>
      ) : (
        <section aria-label={`${activeSection.title} submenu`} style={{ display: "grid", gap: 14 }}>
          <button
            onClick={() => setActiveSectionId(null)}
            style={{
              alignSelf: "start",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: 999,
              color: "#f8fafc",
              fontWeight: 800,
              minHeight: 40,
              padding: "8px 16px",
            }}
            type="button"
          >
            ← Back to dashboard
          </button>

          <div
            style={{
              background: "rgba(37, 41, 58, 0.92)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 24,
              display: "grid",
              gap: 12,
              padding: 20,
            }}
          >
            {activeSection.submenu.map((item) => (
              <button
                disabled={!item.href}
                key={item.id}
                onClick={() => handleSubmenuAction(item)}
                style={{
                  ...submenuButtonStyle,
                  cursor: item.href ? "pointer" : "not-allowed",
                  opacity: item.href ? 1 : 0.55,
                }}
                type="button"
              >
                <strong style={{ fontSize: 17 }}>{item.label}</strong>
                <span style={{ color: "#c5cbe0", fontSize: 14, fontWeight: 400, lineHeight: 1.4 }}>
                  {item.description}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
