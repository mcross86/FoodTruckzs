"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PLAN_STEP_ROUTES } from "@/components/rfq/plan-rfq-wizard";

const labels = ["Event", "Catering", "Logistics", "Vendors", "Account", "Review"] as const;

export function PlanStepper() {
  const pathname = usePathname() ?? PLAN_STEP_ROUTES[0];
  const activeIndex = PLAN_STEP_ROUTES.findIndex((route) => route === pathname);

  return (
    <nav
      aria-label="Catering plan progress"
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
        marginBottom: 20,
      }}
    >
      {PLAN_STEP_ROUTES.map((href, index) => {
        const isActive = index === activeIndex;
        const isComplete = activeIndex > index;

        return (
          <Link
            key={href}
            href={href}
            style={{
              background: isActive
                ? "#ffe66d"
                : isComplete
                  ? "rgba(156, 245, 121, 0.2)"
                  : "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              color: isActive ? "#171b2a" : "#f8fafc",
              fontSize: 12,
              fontWeight: 800,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            {index + 1}. {labels[index]}
          </Link>
        );
      })}
    </nav>
  );
}
