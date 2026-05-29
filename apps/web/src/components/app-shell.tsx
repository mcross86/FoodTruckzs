import Link from "next/link";
import type { ReactNode } from "react";

import { AppHeaderSession } from "./app-header-session";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header
        style={{
          background: "rgba(23, 27, 42, 0.88)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 12px 32px rgba(4, 8, 22, 0.24)",
          fontFamily: "Arial, sans-serif",
          padding: "12px clamp(12px, 4vw, 28px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <nav
          aria-label="Site header"
          style={{
            alignItems: "center",
            display: "flex",
            gap: 16,
            justifyContent: "space-between",
            margin: "0 auto",
            maxWidth: 1180,
            width: "100%",
          }}
        >
          <Link
            href="/"
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
                boxShadow: "0 8px 18px rgba(255, 157, 102, 0.24)",
                display: "inline-block",
                height: 28,
                width: 28,
              }}
            />
            foodtruckzs
          </Link>
          <AppHeaderSession />
        </nav>
      </header>
      {children}
    </>
  );
}
