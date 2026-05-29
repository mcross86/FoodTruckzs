import type { ReactNode } from "react";

export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: "28px auto", maxWidth: 900 }}>
      {children}
    </div>
  );
}
