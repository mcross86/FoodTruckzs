"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

type CustomerWorkspaceShellProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function CustomerWorkspaceShell({
  children,
  description,
  eyebrow = "foodtruckzs customer",
  title,
}: CustomerWorkspaceShellProps) {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 920 }}>
      <p style={{ margin: "0 0 20px" }}>
        <Link href={ROUTES.customer.dashboard} style={{ color: "#87ddf7", fontWeight: 700 }}>
          ← Customer Dashboard
        </Link>
      </p>

      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ color: "#c785ff", fontWeight: 800, margin: "0 0 8px" }}>{eyebrow}</p>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "clamp(28px, 6vw, 40px)",
            letterSpacing: -0.8,
            lineHeight: 1.05,
            margin: "0 0 12px",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p style={{ color: "#c5cbe0", fontSize: 17, lineHeight: 1.5, margin: 0 }}>{description}</p>
        ) : null}
      </header>

      {children}
    </main>
  );
}
