"use client";

import { usePathname } from "next/navigation";

import { ROUTES } from "@foodtruckzs/shared";

import {
  accountDisplayName,
  useAdminAuthSession,
  useCustomerAuthSession,
  useVendorAuthSession,
} from "@/lib/auth-session";

function HeaderSessionControls({
  displayName,
  isAuthLoading,
  onSignOut,
}: {
  displayName: string;
  isAuthLoading: boolean;
  onSignOut: () => void;
}) {
  return (
    <div
      aria-label="Signed-in user"
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginLeft: "auto",
      }}
    >
      <span
        style={{
          color: "#9cf579",
          fontSize: 15,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {displayName}
      </span>
      <button disabled={isAuthLoading} onClick={onSignOut} type="button">
        Sign out
      </button>
    </div>
  );
}

function CustomerAppHeaderSession() {
  const session = useCustomerAuthSession();

  if (!session.user) {
    return null;
  }

  return (
    <HeaderSessionControls
      displayName={accountDisplayName({ user: session.user })}
      isAuthLoading={session.isAuthLoading}
      onSignOut={() => {
        void session.logout().then(() => {
          window.location.assign(`${ROUTES.customer.login}?signedOut=1`);
        });
      }}
    />
  );
}

function VendorAppHeaderSession() {
  const session = useVendorAuthSession();

  if (!session.user) {
    return null;
  }

  return (
    <HeaderSessionControls
      displayName={accountDisplayName({ user: session.user })}
      isAuthLoading={session.isAuthLoading}
      onSignOut={() => {
        void session.logout().then(() => {
          window.location.assign(`${ROUTES.vendor.login}?signedOut=1`);
        });
      }}
    />
  );
}

function AdminAppHeaderSession() {
  const session = useAdminAuthSession();

  if (!session.user || !session.hasAdminAccess) {
    return null;
  }

  return (
    <HeaderSessionControls
      displayName={accountDisplayName({ user: session.user })}
      isAuthLoading={session.isAuthLoading}
      onSignOut={() => {
        void session.logout().then(() => {
          window.location.assign(`${ROUTES.admin.login}?signedOut=1`);
        });
      }}
    />
  );
}

export function AppHeaderSession() {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/customer")) {
    return <CustomerAppHeaderSession />;
  }

  if (pathname.startsWith("/vendor")) {
    return <VendorAppHeaderSession />;
  }

  if (pathname.startsWith("/admin")) {
    return <AdminAppHeaderSession />;
  }

  return null;
}
