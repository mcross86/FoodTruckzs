"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { CustomerWorkspaceShell } from "@/components/customer/customer-workspace-shell";
import { accountLabel, useCustomerAuthSession } from "@/lib/auth-session";

const detailCardStyle = {
  background: "rgba(37, 41, 58, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 20,
  display: "grid",
  gap: 12,
  padding: 20,
} as const;

export function CustomerProfilePage() {
  const session = useCustomerAuthSession();

  useEffect(() => {
    if (!session.accessToken.trim()) return;
    void session.refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.accessToken]);

  return (
    <CustomerWorkspaceShell
      description="Your contact details for quotes, agreements, and event coordination."
      title="My Profile"
    >
      {!session.user ? (
        <AuthSessionPanel requireCustomer session={session} title="Customer account" />
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          <article style={detailCardStyle}>
            <p style={{ color: "#9cf579", fontWeight: 800, margin: 0 }}>
              {accountLabel({ user: session.user })}
            </p>
            <dl style={{ color: "#c5cbe0", display: "grid", gap: 10, margin: 0 }}>
              <div>
                <dt style={{ color: "#8f96ac", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Email
                </dt>
                <dd style={{ color: "#f8fafc", margin: 0 }}>{session.user.email}</dd>
              </div>
              <div>
                <dt style={{ color: "#8f96ac", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Phone
                </dt>
                <dd style={{ color: "#f8fafc", margin: 0 }}>
                  {session.user.phone?.trim() || "Not provided"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "#8f96ac", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Roles
                </dt>
                <dd style={{ color: "#f8fafc", margin: 0 }}>
                  {session.user.globalRoles.length
                    ? session.user.globalRoles.join(", ")
                    : "customer"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "#8f96ac", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  Account status
                </dt>
                <dd style={{ color: "#f8fafc", margin: 0 }}>{session.user.status}</dd>
              </div>
            </dl>
          </article>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button disabled={session.isAuthLoading} onClick={() => void session.refreshMe()} type="button">
              {session.isAuthLoading ? "Refreshing..." : "Refresh profile"}
            </button>
            <button
              disabled={session.isAuthLoading}
              onClick={() => {
                void session.logout().then(() => {
                  window.location.assign(`${ROUTES.customer.login}?signedOut=1`);
                });
              }}
              type="button"
            >
              Sign out
            </button>
          </div>

          {session.authError ? (
            <section
              style={{
                background: "rgba(255, 120, 120, 0.12)",
                border: "1px solid rgba(255, 120, 120, 0.35)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <p style={{ color: "#ffb4b4", margin: 0 }}>{session.authError}</p>
            </section>
          ) : null}

          <p style={{ color: "#8f96ac", fontSize: 14, margin: 0 }}>
            Need to update your details for a new event?{" "}
            <Link href={ROUTES.plan.account} style={{ color: "#87ddf7" }}>
              Open planning account step
            </Link>
          </p>
        </section>
      )}
    </CustomerWorkspaceShell>
  );
}
