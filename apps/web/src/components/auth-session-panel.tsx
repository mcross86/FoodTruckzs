"use client";

import { useMemo, useState } from "react";

import {
  accountLabel,
  type AuthSessionState,
  vendorMembershipLabel,
} from "@/lib/auth-session";

type AuthSessionPanelProps = {
  requireAdmin?: boolean;
  requireCustomer?: boolean;
  requireVendor?: boolean;
  session: AuthSessionState;
  title?: string;
};

const inputStyle = {
  boxSizing: "border-box" as const,
  padding: 10,
  width: "100%",
};

export function AuthSessionPanel({
  requireAdmin = false,
  requireCustomer = false,
  requireVendor = false,
  session,
  title = "Account",
}: AuthSessionPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return session.savedAccounts;

    return session.savedAccounts.filter((account) => {
      const searchable = [
        account.user.email,
        account.user.firstName,
        account.user.lastName,
        account.user.globalRoles.join(" "),
        account.vendorMemberships.map((membership) => membership.vendorId).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [accountSearch, session.savedAccounts]);

  const roleWarnings = [
    requireCustomer && session.user && !session.hasCustomerAccess
      ? "This page expects a customer account."
      : null,
    requireVendor && session.user && !session.hasVendorAccess
      ? "This page expects a vendor account with an active vendor membership."
      : null,
    requireAdmin && session.user && !session.hasAdminAccess
      ? "This page expects a platform or support admin account."
      : null,
  ].filter(Boolean);

  async function submitAuth() {
    if (mode === "login") {
      await session.login({ email, password });
      return;
    }

    await session.register({
      email,
      firstName,
      lastName,
      password,
      phone: phone.trim() || undefined,
    });
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 18,
        display: "grid",
        gap: 14,
        padding: 18,
      }}
    >
      <header>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ marginBottom: 0 }}>
          Sign in or pick a saved local account. Access tokens stay in browser storage and are not
          exposed as fields.
        </p>
      </header>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Advanced connection</summary>
        <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
          API base URL
          <input
            onChange={(event) => session.setApiBaseUrl(event.target.value)}
            style={inputStyle}
            value={session.apiBaseUrl}
          />
        </label>
      </details>

      {session.savedAccounts.length > 0 ? (
        <section
          style={{ background: "#f8fafc", borderRadius: 14, display: "grid", gap: 10, padding: 14 }}
        >
          <h3 style={{ margin: 0 }}>Saved Users</h3>
          <input
            aria-label="Search saved users"
            onChange={(event) => setAccountSearch(event.target.value)}
            placeholder="Search by name, email, role, or vendor ID"
            style={inputStyle}
            value={accountSearch}
          />
          <select
            aria-label="Select saved user"
            onChange={(event) => session.selectSavedAccount(event.target.value)}
            style={inputStyle}
            value={session.selectedAccountId}
          >
            <option value="">Select a saved user</option>
            {filteredAccounts.map((account) => (
              <option key={account.user.id} value={account.user.id}>
                {accountLabel(account)}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {session.user ? (
        <section
          style={{ background: "#ecfdf3", borderRadius: 14, display: "grid", gap: 8, padding: 14 }}
        >
          <strong>{accountLabel({ user: session.user })}</strong>
          <span>
            Roles: {session.user.globalRoles.length ? session.user.globalRoles.join(", ") : "none"}
          </span>
          {session.vendorMemberships.length > 0 ? (
            <label style={{ display: "grid", gap: 6 }}>
              Active vendor
              <select
                onChange={(event) => session.setActiveVendorId(event.target.value)}
                style={inputStyle}
                value={session.activeVendorId}
              >
                <option value="">Choose vendor</option>
                {session.vendorMemberships.map((membership) => (
                  <option key={membership.vendorId} value={membership.vendorId}>
                    {vendorMembershipLabel(membership)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              disabled={session.isAuthLoading}
              onClick={() => void session.refreshMe()}
              type="button"
            >
              Refresh session
            </button>
            <button
              disabled={session.isAuthLoading}
              onClick={() => void session.logout()}
              type="button"
            >
              Log out
            </button>
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={mode === "login"} onClick={() => setMode("login")} type="button">
              Login
            </button>
            <button
              disabled={mode === "register"}
              onClick={() => setMode("register")}
              type="button"
            >
              Register
            </button>
          </div>
          {mode === "register" ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <input
                aria-label="First name"
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                style={inputStyle}
                value={firstName}
              />
              <input
                aria-label="Last name"
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                style={inputStyle}
                value={lastName}
              />
              <input
                aria-label="Phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone optional"
                style={inputStyle}
                value={phone}
              />
            </div>
          ) : null}
          <input
            aria-label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            style={inputStyle}
            type="email"
            value={email}
          />
          <input
            aria-label="Password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "register" ? "Password with upper/lower/number" : "Password"}
            style={inputStyle}
            type="password"
            value={password}
          />
          <button disabled={session.isAuthLoading} onClick={() => void submitAuth()} type="button">
            {session.isAuthLoading ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </section>
      )}

      {roleWarnings.length > 0 ? (
        <section style={{ background: "#fff4df", borderRadius: 14, padding: 14 }}>
          {roleWarnings.map((warning) => (
            <p key={warning} style={{ margin: 0 }}>
              {warning}
            </p>
          ))}
        </section>
      ) : null}

      {session.authError ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, padding: 14 }}>
          {session.authError}
        </section>
      ) : null}
    </section>
  );
}

