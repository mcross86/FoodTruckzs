"use client";

import type { ReactNode } from "react";

export function PlanFormPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section
      style={{
        background: "rgba(37, 41, 58, 0.92)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 24,
        display: "grid",
        gap: 14,
        padding: 20,
      }}
    >
      <h2 style={{ color: "#f8fafc", margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export function PlanField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
      {label}
      {children}
    </label>
  );
}
