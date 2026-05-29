"use client";

import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

import { AdminWorkspaceAuth } from "@/components/admin/admin-workspace-auth";
import { useAdminAuthSession } from "@/lib/auth-session";

export default function AdminLoginPage() {
  const session = useAdminAuthSession();

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 520 }}>
      <p>
        <Link href={ROUTES.home}>← Back</Link>
      </p>
      <header style={{ marginBottom: 20 }}>
        <p style={{ color: "#f4a5ff", fontWeight: 800, margin: "0 0 6px" }}>
          PLATFORM ADMIN
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Admin login</h1>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Sign in with a platform or support admin account. Customer and vendor sign-ins are kept
          separately.
        </p>
      </header>

      <AdminWorkspaceAuth session={session} />

      {!session.user ? (
        <p style={{ color: "#8f96ac", fontSize: 14, marginTop: 20 }}>
          Admin accounts are provisioned by the platform team.
        </p>
      ) : null}
    </main>
  );
}
