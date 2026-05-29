"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import {
  accountLabel,
  type AuthSessionState,
  savedAccountsForPersona,
  vendorMembershipLabel,
} from "@/lib/auth-session";

function personaWorkspaceLabel(persona: AuthSessionState["persona"]): string {
  if (persona === "vendor") return "vendor";
  if (persona === "admin") return "admin";
  return "customer";
}

type AuthSessionPanelProps = {
  requireAdmin?: boolean;
  requireCustomer?: boolean;
  requireVendor?: boolean;
  session: AuthSessionState;
  showDevConnectionTools?: boolean;
  showSavedAccountsWhenSignedIn?: boolean;
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
  showDevConnectionTools = true,
  showSavedAccountsWhenSignedIn = false,
  title = "Account",
}: AuthSessionPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const personaAccounts = useMemo(
    () => savedAccountsForPersona(session.persona, session.savedAccounts),
    [session.persona, session.savedAccounts],
  );

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return personaAccounts;

    return personaAccounts.filter((account) => {
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
  }, [accountSearch, personaAccounts]);

  const roleWarnings = [
    requireCustomer && session.user && !session.hasCustomerAccess
      ? "This page expects a customer account."
      : null,
    requireVendor && session.user && !session.hasVendorAccess
      ? "You are signed in, but this vendor profile is not linked to a food truck yet. Finish registration or operational setup to load vendor tools."
      : null,
    requireAdmin && session.user && !session.hasAdminAccess
      ? "This page expects a platform or support admin account."
      : null,
  ].filter(Boolean);

  const showDevTools = showDevConnectionTools && session.persona !== "admin";

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
          {session.user
            ? `Signed in to your ${personaWorkspaceLabel(session.persona)} workspace.`
            : session.persona === "admin"
              ? "Sign in with a platform or support admin account. Admin sign-in is separate from customer and vendor workspaces."
              : `Sign in for this ${personaWorkspaceLabel(session.persona)} workspace. Customer, vendor, and admin accounts are kept separately.`}
        </p>
      </header>

      {showDevTools ? (
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
      ) : null}

      {showDevTools &&
      personaAccounts.length > 0 &&
      (!session.user || showSavedAccountsWhenSignedIn) ? (
        <section
          style={{ background: "#f8fafc", borderRadius: 14, display: "grid", gap: 10, padding: 14 }}
        >
          <h3 style={{ margin: 0 }}>
            {session.persona === "admin" ? "Saved admin users" : "Saved users"}
          </h3>
          <input
            aria-label="Search saved users"
            onChange={(event) => setAccountSearch(event.target.value)}
            placeholder="Search by name, email, role, or vendor ID"
            style={inputStyle}
            value={accountSearch}
          />
          <select
            aria-label="Select saved user"
            onChange={(event) => {
              if (event.target.value) {
                session.selectSavedAccount(event.target.value);
              }
            }}
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
            {requireVendor && !session.hasVendorAccess ? (
              <Link
                href={ROUTES.vendor.register}
                style={{
                  background: "#ffe66d",
                  borderRadius: 16,
                  color: "#171b2a",
                  fontWeight: 800,
                  padding: "12px 18px",
                  textDecoration: "none",
                }}
              >
                Continue vendor setup
              </Link>
            ) : null}
            {requireVendor && session.hasVendorAccess ? (
              <Link
                href={ROUTES.vendor.dashboard}
                style={{
                  background: "#ffe66d",
                  borderRadius: 16,
                  color: "#171b2a",
                  fontWeight: 800,
                  padding: "12px 18px",
                  textDecoration: "none",
                }}
              >
                Open vendor dashboard
              </Link>
            ) : null}
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
          {session.persona !== "admin" ? (
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
          ) : null}
          {session.persona !== "admin" && mode === "register" ? (
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
          {requireVendor && session.user && !session.hasVendorAccess ? (
            <p style={{ margin: "10px 0 0" }}>
              <Link href={ROUTES.vendor.register}>Continue to food truck setup →</Link>
            </p>
          ) : null}
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

