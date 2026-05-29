type DashboardActionBadgeProps = {
  count: number;
};

export function DashboardActionBadge({ count }: DashboardActionBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-label={`${count} pending ${count === 1 ? "action" : "actions"}`}
      style={{
        alignItems: "center",
        background: "#e53935",
        borderRadius: 999,
        boxShadow: "0 4px 12px rgba(229, 57, 53, 0.45)",
        color: "#ffffff",
        display: "inline-flex",
        fontSize: 13,
        fontWeight: 800,
        height: 28,
        justifyContent: "center",
        lineHeight: 1,
        minWidth: 28,
        padding: "0 8px",
        position: "absolute",
        right: 16,
        top: 16,
      }}
    >
      {label}
    </span>
  );
}
