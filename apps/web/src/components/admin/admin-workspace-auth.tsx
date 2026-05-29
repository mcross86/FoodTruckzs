"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { type AuthSessionState, useAdminAuthSession } from "@/lib/auth-session";

type AdminWorkspaceAuthProps = {
  session?: AuthSessionState;
};

export function AdminWorkspaceAuth({ session: sessionProp }: AdminWorkspaceAuthProps) {
  const sessionFromHook = useAdminAuthSession();
  const session = sessionProp ?? sessionFromHook;
  const router = useRouter();

  useEffect(() => {
    if (!session.accessToken.trim() || !session.hasAdminAccess) return;
    router.replace(ROUTES.admin.root);
  }, [router, session.accessToken, session.hasAdminAccess]);

  return <AuthSessionPanel requireAdmin session={session} title="Admin account" />;
}
