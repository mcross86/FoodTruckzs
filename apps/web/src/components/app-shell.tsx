import Link from "next/link";
import type { ReactNode } from "react";

import { navGroups } from "./navigation";

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
          aria-label="Primary navigation"
          style={{
            alignItems: "center",
            display: "grid",
            gap: 14,
            gridTemplateColumns: "minmax(160px, 0.85fr) repeat(4, minmax(120px, 1fr))",
            margin: "0 auto",
            maxWidth: 1180,
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
          {navGroups.map((group) => (
            <section key={group.label} aria-label={`${group.label} links`}>
              <p
                style={{
                  color: "#87ddf7",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  margin: "0 0 6px",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 10px" }}>
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 999,
                      color: "#c5cbe0",
                      display: "inline-flex",
                      fontSize: 13,
                      padding: "7px 10px",
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </header>
      {children}
    </>
  );
}
