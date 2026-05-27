import Link from "next/link";
import type { ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

export function GatewayShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header
        style={{
          alignItems: "center",
          background: "rgba(23, 27, 42, 0.92)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          justifyContent: "space-between",
          padding: "14px clamp(16px, 4vw, 28px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href={ROUTES.home}
          style={{
            alignItems: "center",
            color: "#f8fafc",
            display: "inline-flex",
            fontSize: 18,
            fontWeight: 800,
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              background: "#ff9d66",
              borderRadius: 10,
              display: "inline-block",
              height: 28,
              width: 28,
            }}
          />
          foodtruckzs
        </Link>
        <nav aria-label="Gateway shortcuts" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link
            href={ROUTES.vendor.login}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 999,
              color: "#c5cbe0",
              fontSize: 13,
              fontWeight: 700,
              padding: "8px 12px",
            }}
          >
            Vendor login
          </Link>
        </nav>
      </header>
      {children}
    </>
  );
}
