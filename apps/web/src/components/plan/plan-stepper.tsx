"use client";

import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

const planSteps = [
  { href: ROUTES.plan.event, label: "Event basics" },
  { href: ROUTES.plan.preferences, label: "Preferences" },
  { href: ROUTES.plan.account, label: "Account" },
  { href: ROUTES.plan.review, label: "Review" },
] as const;

export function PlanStepper({ activeIndex }: { activeIndex: number }) {
  return (
    <nav
      aria-label="Catering plan progress"
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        marginBottom: 20,
      }}
    >
      {planSteps.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <Link
            key={step.href}
            href={step.href}
            style={{
              background: isActive ? "#ffe66d" : isComplete ? "rgba(156, 245, 121, 0.2)" : "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              color: isActive ? "#171b2a" : "#f8fafc",
              fontSize: 13,
              fontWeight: 800,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            {index + 1}. {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
