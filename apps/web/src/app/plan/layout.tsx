import Link from "next/link";
import type { ReactNode } from "react";

import { ROUTES } from "@foodtruckzs/shared";

export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: "28px auto", maxWidth: 760 }}>
      <p>
        <Link href={ROUTES.home}>← Back to home</Link>
      </p>
      <header style={{ marginBottom: 8 }}>
        <p style={{ color: "#c785ff", fontWeight: 800, margin: "0 0 6px" }}>
          I&apos;M PLANNING AN EVENT
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Catering quote request</h1>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Answer a few questions now. You will only need an account right before submitting your
          request.
        </p>
      </header>
      {children}
    </div>
  );
}
