"use client";

import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

import { VendorWorkspaceAuth } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";

export default function VendorLoginPage() {
  const session = useVendorAuthSession();

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 520 }}>
      <p>
        <Link href={ROUTES.home}>← Back</Link>
      </p>
      <header style={{ marginBottom: 20 }}>
        <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 6px" }}>
          VENDOR WORKSPACE
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Vendor login</h1>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Sign in to manage RFQs, quotes, menus, calendar, and payouts.
        </p>
      </header>

      <VendorWorkspaceAuth session={session} />

      {!session.user || !session.hasVendorAccess ? (
        <p style={{ color: "#c5cbe0", marginTop: 20 }}>
          New operator?{" "}
          <Link href={ROUTES.vendor.register}>Become a vendor</Link>
        </p>
      ) : null}
    </main>
  );
}
