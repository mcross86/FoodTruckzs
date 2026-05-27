import Link from "next/link";
import type { ReactNode } from "react";

import { navGroups } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          fontFamily: "Arial, sans-serif",
          padding: "14px clamp(16px, 4vw, 32px)",
        }}
      >
        <nav
          aria-label="Primary navigation"
          style={{
            alignItems: "flex-start",
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(140px, 0.8fr) repeat(4, minmax(120px, 1fr))",
            margin: "0 auto",
            maxWidth: 1180,
          }}
        >
          <Link
            href="/"
            style={{
              color: "#1f2937",
              fontSize: 20,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            foodtruckzs
          </Link>
          {navGroups.map((group) => (
            <section key={group.label} aria-label={`${group.label} links`}>
              <p
                style={{
                  color: "#8a4b00",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  margin: "0 0 6px",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 10px" }}>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href}>
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
