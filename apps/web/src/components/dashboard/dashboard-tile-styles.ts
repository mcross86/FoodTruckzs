import type { CSSProperties } from "react";

export const dashboardCardBase: CSSProperties = {
  border: "none",
  borderRadius: 28,
  color: "#171b2a",
  cursor: "pointer",
  display: "grid",
  gap: 10,
  minHeight: 160,
  padding: "clamp(20px, 5vw, 28px)",
  textAlign: "left",
  textDecoration: "none",
  width: "100%",
};

export const dashboardSubmenuButtonStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 20,
  color: "#f8fafc",
  display: "grid",
  gap: 6,
  minHeight: 72,
  padding: "16px 18px",
  textAlign: "left",
  width: "100%",
};
