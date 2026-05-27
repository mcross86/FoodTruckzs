"use client";

import { useEffect, useMemo, useState } from "react";

import { defaultRfqApiBaseUrl } from "./rfq-api";

export const authApiBaseStorageKey = "foodtruckzs.authApiBaseUrl";
const currentAccountStorageKey = "foodtruckzs.currentAccountId";
const savedAccountsStorageKey = "foodtruckzs.savedAccounts";
const legacyCustomerTokenStorageKey = "foodtruckzs.customerAccessToken";
const legacyVendorTokenStorageKey = "foodtruckzs.vendorAccessToken";
const legacyNotificationTokenStorageKey = "foodtruckzs.notificationAccessToken";
const legacyVendorIdStorageKey = "foodtruckzs.activeVendorId";
const legacyRfqApiBaseStorageKey = "foodtruckzs.rfqApiBaseUrl";

export type UserSummary = {
  email: string;
  firstName: string | null;
  globalRoles: string[];
  id: string;
  lastName: string | null;
  phone?: string;
  status: string;
};

export type VendorMembershipSummary = {
  role: string;
  status: string;
  vendorId: string;
};

export type SavedAccount = {
  accessToken: string;
  activeVendorId: string;
  savedAt: string;
  user: UserSummary;
  vendorMemberships: VendorMembershipSummary[];
};

type AuthResponse = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: UserSummary;
  vendorMemberships: VendorMembershipSummary[];
};

type MeResponse = {
  activeVendorId?: string;
  globalRoles: string[];
  sessionId: string;
  user: UserSummary;
  vendorMemberships: VendorMembershipSummary[];
};

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = LoginInput & {
  firstName: string;
  lastName: string;
  phone?: string;
};

export type AuthSessionState = {
  accessToken: string;
  activeVendorId: string;
  apiBaseUrl: string;
  authError: string | null;
  isAuthLoading: boolean;
  savedAccounts: SavedAccount[];
  selectedAccountId: string;
  user: UserSummary | null;
  vendorMemberships: VendorMembershipSummary[];
  clearAuthError: () => void;
  hasAdminAccess: boolean;
  hasCustomerAccess: boolean;
  hasVendorAccess: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  selectSavedAccount: (userId: string) => void;
  setActiveVendorId: (vendorId: string) => void;
  setApiBaseUrl: (apiBaseUrl: string) => void;
};

function readSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(savedAccountsStorageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccount[]): void {
  window.localStorage.setItem(savedAccountsStorageKey, JSON.stringify(accounts));
}

function accountFromAuthResponse(result: AuthResponse, activeVendorId = ""): SavedAccount {
  const firstMembership = result.vendorMemberships.find((membership) => membership.status === "active");

  return {
    accessToken: result.accessToken,
    activeVendorId: activeVendorId || firstMembership?.vendorId || "",
    savedAt: new Date().toISOString(),
    user: result.user,
    vendorMemberships: result.vendorMemberships,
  };
}

function saveAccount(account: SavedAccount): SavedAccount[] {
  const accounts = readSavedAccounts();
  const nextAccounts = [
    account,
    ...accounts.filter((candidate) => candidate.user.id !== account.user.id),
  ].slice(0, 20);
  writeSavedAccounts(nextAccounts);
  window.localStorage.setItem(currentAccountStorageKey, account.user.id);
  window.localStorage.setItem(legacyCustomerTokenStorageKey, account.accessToken);
  window.localStorage.setItem(legacyVendorTokenStorageKey, account.accessToken);
  window.localStorage.setItem(legacyNotificationTokenStorageKey, account.accessToken);
  window.localStorage.setItem(legacyVendorIdStorageKey, account.activeVendorId);
  return nextAccounts;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiEnvelope<T>) : {};

  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? `Request failed with ${response.status}.`);
  }

  return body.data;
}

async function authRequest<T>(
  apiBaseUrl: string,
  path: string,
  input?: { body?: unknown; token?: string },
): Promise<T> {
  const headers = new Headers({ accept: "application/json" });

  if (input?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (input?.token) {
    headers.set("authorization", `Bearer ${input.token}`);
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
    headers,
    method: input?.body === undefined ? "GET" : "POST",
  });

  return parseEnvelope<T>(response);
}

export function accountLabel(account: Pick<SavedAccount, "user">): string {
  const name = [account.user.firstName, account.user.lastName].filter(Boolean).join(" ");
  return name ? `${name} (${account.user.email})` : account.user.email;
}

export function vendorMembershipLabel(membership: VendorMembershipSummary): string {
  return `${membership.role} vendor ${membership.vendorId.slice(0, 8)}`;
}

export function useAuthSession(): AuthSessionState {
  const [apiBaseUrl, setApiBaseUrlState] = useState(defaultRfqApiBaseUrl);
  const [accessToken, setAccessToken] = useState("");
  const [activeVendorId, setActiveVendorIdState] = useState("");
  const [user, setUser] = useState<UserSummary | null>(null);
  const [vendorMemberships, setVendorMemberships] = useState<VendorMembershipSummary[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const accounts = readSavedAccounts();
    const storedApiBase =
      window.localStorage.getItem(authApiBaseStorageKey) ??
      window.localStorage.getItem(legacyRfqApiBaseStorageKey) ??
      defaultRfqApiBaseUrl;
    const currentId = window.localStorage.getItem(currentAccountStorageKey) ?? "";
    const current = accounts.find((account) => account.user.id === currentId) ?? accounts[0];

    setSavedAccounts(accounts);
    setApiBaseUrlState(storedApiBase);

    if (current) {
      setSelectedAccountId(current.user.id);
      setAccessToken(current.accessToken);
      setActiveVendorIdState(current.activeVendorId);
      setUser(current.user);
      setVendorMemberships(current.vendorMemberships);
    }
  }, []);

  function setApiBaseUrl(nextApiBaseUrl: string) {
    setApiBaseUrlState(nextApiBaseUrl);
    window.localStorage.setItem(authApiBaseStorageKey, nextApiBaseUrl);
    window.localStorage.setItem(legacyRfqApiBaseStorageKey, nextApiBaseUrl);
  }

  function applyAccount(account: SavedAccount, accounts = savedAccounts) {
    setSelectedAccountId(account.user.id);
    setAccessToken(account.accessToken);
    setActiveVendorIdState(account.activeVendorId);
    setUser(account.user);
    setVendorMemberships(account.vendorMemberships);
    setSavedAccounts(accounts);
    setAuthError(null);
  }

  async function authenticate(path: "/api/v1/auth/login" | "/api/v1/auth/register", body: unknown) {
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const result = await authRequest<AuthResponse>(apiBaseUrl, path, { body });
      const account = accountFromAuthResponse(result, activeVendorId);
      const accounts = saveAccount(account);
      applyAccount(account, accounts);
    } catch (caughtError) {
      setAuthError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function refreshMe() {
    if (!accessToken) return;
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const result = await authRequest<MeResponse>(apiBaseUrl, "/api/v1/auth/me", {
        token: accessToken,
      });
      const account = {
        accessToken,
        activeVendorId:
          activeVendorId ||
          result.activeVendorId ||
          result.vendorMemberships.find((membership) => membership.status === "active")?.vendorId ||
          "",
        savedAt: new Date().toISOString(),
        user: result.user,
        vendorMemberships: result.vendorMemberships,
      };
      const accounts = saveAccount(account);
      applyAccount(account, accounts);
    } catch (caughtError) {
      setAuthError(caughtError instanceof Error ? caughtError.message : "Session refresh failed.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  function selectSavedAccount(userId: string) {
    const account = savedAccounts.find((candidate) => candidate.user.id === userId);
    if (!account) return;
    window.localStorage.setItem(currentAccountStorageKey, account.user.id);
    saveAccount(account);
    applyAccount(account);
  }

  function setActiveVendorId(vendorId: string) {
    setActiveVendorIdState(vendorId);
    window.localStorage.setItem(legacyVendorIdStorageKey, vendorId);

    if (user) {
      const account = savedAccounts.find((candidate) => candidate.user.id === user.id);
      if (account) {
        const updated = { ...account, activeVendorId: vendorId, savedAt: new Date().toISOString() };
        const accounts = saveAccount(updated);
        setSavedAccounts(accounts);
      }
    }
  }

  async function logout() {
    if (accessToken) {
      try {
        await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/auth/logout`, {
          headers: { authorization: `Bearer ${accessToken}` },
          method: "POST",
        });
      } catch {
        // Local logout should still clear the browser session if the API is offline.
      }
    }

    setAccessToken("");
    setActiveVendorIdState("");
    setSelectedAccountId("");
    setUser(null);
    setVendorMemberships([]);
    window.localStorage.removeItem(currentAccountStorageKey);
    window.localStorage.removeItem(legacyCustomerTokenStorageKey);
    window.localStorage.removeItem(legacyVendorTokenStorageKey);
    window.localStorage.removeItem(legacyNotificationTokenStorageKey);
    window.localStorage.removeItem(legacyVendorIdStorageKey);
  }

  const globalRoles = user?.globalRoles ?? [];
  const hasAdminAccess = globalRoles.includes("platform_admin") || globalRoles.includes("support_admin");
  const hasCustomerAccess = globalRoles.includes("customer");
  const hasVendorAccess = vendorMemberships.some((membership) => membership.status === "active");

  return useMemo(
    () => ({
      accessToken,
      activeVendorId,
      apiBaseUrl,
      authError,
      clearAuthError: () => setAuthError(null),
      hasAdminAccess,
      hasCustomerAccess,
      hasVendorAccess,
      isAuthLoading,
      login: (input) => authenticate("/api/v1/auth/login", input),
      logout,
      refreshMe,
      register: (input) => authenticate("/api/v1/auth/register", input),
      savedAccounts,
      selectSavedAccount,
      selectedAccountId,
      setActiveVendorId,
      setApiBaseUrl,
      user,
      vendorMemberships,
    }),
    [
      accessToken,
      activeVendorId,
      apiBaseUrl,
      authError,
      hasAdminAccess,
      hasCustomerAccess,
      hasVendorAccess,
      isAuthLoading,
      savedAccounts,
      selectedAccountId,
      user,
      vendorMemberships,
    ],
  );
}

