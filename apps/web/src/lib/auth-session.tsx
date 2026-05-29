"use client";

import { useEffect, useMemo, useState } from "react";

import { setPlanGuestMode } from "./plan-guest-mode";
import { defaultRfqApiBaseUrl } from "./rfq-api";

export const authApiBaseStorageKey = "foodtruckzs.authApiBaseUrl";
const currentCustomerAccountStorageKey = "foodtruckzs.currentCustomerAccountId";
const currentVendorAccountStorageKey = "foodtruckzs.currentVendorAccountId";
const currentAdminAccountStorageKey = "foodtruckzs.currentAdminAccountId";
const legacyCurrentAccountStorageKey = "foodtruckzs.currentAccountId";
const savedAccountsStorageKey = "foodtruckzs.savedAccounts";
const legacyCustomerTokenStorageKey = "foodtruckzs.customerAccessToken";
const legacyVendorTokenStorageKey = "foodtruckzs.vendorAccessToken";
const legacyAdminTokenStorageKey = "foodtruckzs.adminAccessToken";
const legacyNotificationTokenStorageKey = "foodtruckzs.notificationAccessToken";
const legacyVendorIdStorageKey = "foodtruckzs.activeVendorId";
const legacyRfqApiBaseStorageKey = "foodtruckzs.rfqApiBaseUrl";
export const customerSignedOutStorageKey = "foodtruckzs.customerSignedOut";
export const vendorSignedOutStorageKey = "foodtruckzs.vendorSignedOut";
export const adminSignedOutStorageKey = "foodtruckzs.adminSignedOut";

export type AuthPersona = "customer" | "vendor" | "admin";

const personaSignedOutStorageKey: Record<AuthPersona, string> = {
  admin: adminSignedOutStorageKey,
  customer: customerSignedOutStorageKey,
  vendor: vendorSignedOutStorageKey,
};

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
  approvalStatus: string;
  businessName: string;
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

type UseAuthSessionOptions = {
  persona?: AuthPersona;
};

export type AuthSessionState = {
  accessToken: string;
  activeVendorId: string;
  apiBaseUrl: string;
  authError: string | null;
  isAuthLoading: boolean;
  persona: AuthPersona;
  savedAccounts: SavedAccount[];
  selectedAccountId: string;
  user: UserSummary | null;
  vendorMemberships: VendorMembershipSummary[];
  clearAuthError: () => void;
  hasAdminAccess: boolean;
  hasCustomerAccess: boolean;
  hasVendorAccess: boolean;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  register: (input: RegisterInput) => Promise<boolean>;
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

function migrateLegacyCurrentAccount(): void {
  if (typeof window === "undefined") return;

  const legacy = window.localStorage.getItem(legacyCurrentAccountStorageKey);
  if (!legacy) return;

  if (!window.localStorage.getItem(currentCustomerAccountStorageKey)) {
    window.localStorage.setItem(currentCustomerAccountStorageKey, legacy);
  }
}

function currentAccountStorageKey(persona: AuthPersona): string {
  if (persona === "customer") return currentCustomerAccountStorageKey;
  if (persona === "vendor") return currentVendorAccountStorageKey;
  return currentAdminAccountStorageKey;
}

export function userHasAdminRole(user: Pick<UserSummary, "globalRoles">): boolean {
  return (
    user.globalRoles.includes("platform_admin") || user.globalRoles.includes("support_admin")
  );
}

export function savedAccountsForPersona(
  persona: AuthPersona,
  accounts: SavedAccount[],
): SavedAccount[] {
  if (persona === "admin") {
    return accounts.filter((account) => userHasAdminRole(account.user));
  }

  return accounts;
}

export function readCurrentAccountId(persona: AuthPersona): string {
  if (typeof window === "undefined") return "";
  migrateLegacyCurrentAccount();
  return window.localStorage.getItem(currentAccountStorageKey(persona)) ?? "";
}

function writeCurrentAccountId(persona: AuthPersona, userId: string): void {
  window.localStorage.setItem(currentAccountStorageKey(persona), userId);
}

function clearCurrentAccountId(persona: AuthPersona): void {
  window.localStorage.removeItem(currentAccountStorageKey(persona));
}

function isPersonaSignedOut(persona: AuthPersona): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(personaSignedOutStorageKey[persona]) === "1";
}

function markPersonaSignedOut(persona: AuthPersona): void {
  window.sessionStorage.setItem(personaSignedOutStorageKey[persona], "1");
}

function clearPersonaSignedOut(persona: AuthPersona): void {
  window.sessionStorage.removeItem(personaSignedOutStorageKey[persona]);
}

function markAllPersonasSignedOut(): void {
  markPersonaSignedOut("customer");
  markPersonaSignedOut("vendor");
  markPersonaSignedOut("admin");
}

function clearAllPersonasSignedOut(): void {
  clearPersonaSignedOut("customer");
  clearPersonaSignedOut("vendor");
  clearPersonaSignedOut("admin");
}

export function readActiveAccountForPersona(persona: AuthPersona): SavedAccount | null {
  const accounts = readSavedAccounts();
  const currentId = readCurrentAccountId(persona);
  if (!currentId) return null;
  return accounts.find((account) => account.user.id === currentId) ?? null;
}

function resolveActiveAccount(persona: AuthPersona, accounts: SavedAccount[]): SavedAccount | null {
  if (isPersonaSignedOut(persona)) {
    return null;
  }

  const currentId = readCurrentAccountId(persona);
  if (currentId) {
    const selected = accounts.find((account) => account.user.id === currentId);
    if (selected) {
      if (persona === "admin" && !userHasAdminRole(selected.user)) {
        clearCurrentAccountId("admin");
        return null;
      }
      return selected;
    }
  }

  if (persona === "vendor" && typeof window !== "undefined") {
    const legacyToken = window.localStorage.getItem(legacyVendorTokenStorageKey);
    if (legacyToken) {
      const byToken = accounts.find((account) => account.accessToken === legacyToken);
      if (byToken) {
        writeCurrentAccountId("vendor", byToken.user.id);
        return byToken;
      }
    }
  }

  if (persona === "admin" && typeof window !== "undefined") {
    const legacyToken = window.localStorage.getItem(legacyAdminTokenStorageKey);
    if (legacyToken) {
      const byToken = accounts.find(
        (account) => account.accessToken === legacyToken && userHasAdminRole(account.user),
      );
      if (byToken) {
        writeCurrentAccountId("admin", byToken.user.id);
        return byToken;
      }
    }
  }

  if (persona === "customer" && typeof window !== "undefined") {
    const legacyToken = window.localStorage.getItem(legacyCustomerTokenStorageKey);
    if (legacyToken) {
      const byToken = accounts.find((account) => account.accessToken === legacyToken);
      if (byToken) {
        writeCurrentAccountId("customer", byToken.user.id);
        return byToken;
      }
    }
  }

  return null;
}

type PersonaSessionSnapshot = {
  accessToken: string;
  activeVendorId: string;
  apiBaseUrl: string;
  savedAccounts: SavedAccount[];
  selectedAccountId: string;
  user: UserSummary | null;
  vendorMemberships: VendorMembershipSummary[];
};

function emptyPersonaSessionSnapshot(apiBaseUrl = defaultRfqApiBaseUrl): PersonaSessionSnapshot {
  return {
    accessToken: "",
    activeVendorId: "",
    apiBaseUrl,
    savedAccounts: [],
    selectedAccountId: "",
    user: null,
    vendorMemberships: [],
  };
}

function loadPersonaSessionSnapshot(persona: AuthPersona): PersonaSessionSnapshot {
  if (typeof window === "undefined") {
    return emptyPersonaSessionSnapshot();
  }

  const accounts = readSavedAccounts();
  const apiBaseUrl =
    window.localStorage.getItem(authApiBaseStorageKey) ??
    window.localStorage.getItem(legacyRfqApiBaseStorageKey) ??
    defaultRfqApiBaseUrl;
  const current = resolveActiveAccount(persona, accounts);

  if (!current) {
    return { ...emptyPersonaSessionSnapshot(apiBaseUrl), savedAccounts: accounts };
  }

  if (persona === "admin" && !userHasAdminRole(current.user)) {
    clearCurrentAccountId("admin");
    return { ...emptyPersonaSessionSnapshot(apiBaseUrl), savedAccounts: accounts };
  }

  return {
    accessToken: current.accessToken,
    activeVendorId: current.activeVendorId,
    apiBaseUrl,
    savedAccounts: accounts,
    selectedAccountId: current.user.id,
    user: current.user,
    vendorMemberships: current.vendorMemberships,
  };
}

function accountFromAuthResponse(result: AuthResponse, activeVendorId = ""): SavedAccount {
  const memberships = result.vendorMemberships.filter((membership) => membership.status === "active");
  const firstApprovedMembership = memberships.find((membership) => membership.approvalStatus === "approved");
  const firstMembership = firstApprovedMembership ?? memberships[0];

  return {
    accessToken: result.accessToken,
    activeVendorId: activeVendorId || firstMembership?.vendorId || "",
    savedAt: new Date().toISOString(),
    user: result.user,
    vendorMemberships: result.vendorMemberships,
  };
}

function saveAccount(account: SavedAccount, persona: AuthPersona): SavedAccount[] {
  const accounts = readSavedAccounts();
  const nextAccounts = [
    account,
    ...accounts.filter((candidate) => candidate.user.id !== account.user.id),
  ].slice(0, 20);
  writeSavedAccounts(nextAccounts);
  writeCurrentAccountId(persona, account.user.id);

  if (persona === "customer") {
    window.localStorage.setItem(legacyCustomerTokenStorageKey, account.accessToken);
    window.localStorage.setItem(legacyNotificationTokenStorageKey, account.accessToken);
  } else if (persona === "vendor") {
    window.localStorage.setItem(legacyVendorTokenStorageKey, account.accessToken);
    window.localStorage.setItem(legacyNotificationTokenStorageKey, account.accessToken);
    window.localStorage.setItem(legacyVendorIdStorageKey, account.activeVendorId);
  } else {
    window.localStorage.setItem(legacyAdminTokenStorageKey, account.accessToken);
  }

  return nextAccounts;
}

/** Clears every local auth session (all personas). Use on explicit sign-out. */
export function clearAllAuthStorage(): void {
  if (typeof window === "undefined") return;

  clearCurrentAccountId("customer");
  clearCurrentAccountId("vendor");
  clearCurrentAccountId("admin");
  window.localStorage.removeItem(legacyCurrentAccountStorageKey);
  window.localStorage.removeItem(legacyCustomerTokenStorageKey);
  window.localStorage.removeItem(legacyVendorTokenStorageKey);
  window.localStorage.removeItem(legacyAdminTokenStorageKey);
  window.localStorage.removeItem(legacyNotificationTokenStorageKey);
  window.localStorage.removeItem(legacyVendorIdStorageKey);
  writeSavedAccounts([]);
  markAllPersonasSignedOut();
  setPlanGuestMode(false);
}

export class AuthApiError extends Error {
  readonly code: string | undefined;
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

function isUnauthorizedAuthError(error: unknown): boolean {
  return error instanceof AuthApiError && error.httpStatus === 401;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiEnvelope<T>) : {};

  if (!response.ok || !body.data) {
    throw new AuthApiError(
      body.error?.message ?? `Request failed with ${response.status}.`,
      response.status,
      body.error?.code,
    );
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

export function accountDisplayName(account: Pick<SavedAccount, "user">): string {
  const name = [account.user.firstName, account.user.lastName].filter(Boolean).join(" ");
  if (name) return name;

  const emailLocalPart = account.user.email.split("@")[0]?.trim();
  return emailLocalPart || account.user.email;
}

export function accountLabel(account: Pick<SavedAccount, "user">): string {
  const name = accountDisplayName(account);
  return name === account.user.email ? name : `${name} (${account.user.email})`;
}

export function vendorMembershipLabel(membership: VendorMembershipSummary): string {
  const statusSuffix =
    membership.approvalStatus === "approved" ? "" : ` (${membership.approvalStatus})`;
  return `${membership.role} · ${membership.businessName}${statusSuffix} · ${membership.vendorId.slice(0, 8)}`;
}

export function useAuthSession(options: UseAuthSessionOptions = {}): AuthSessionState {
  const persona = options.persona ?? "customer";
  // Start empty so SSR and the first client render match; rehydrate from storage in useEffect.
  const [snapshot, setSnapshot] = useState<PersonaSessionSnapshot>(() =>
    emptyPersonaSessionSnapshot(),
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const {
    accessToken,
    activeVendorId,
    apiBaseUrl,
    savedAccounts,
    selectedAccountId,
    user,
    vendorMemberships,
  } = snapshot;

  function applySnapshot(next: PersonaSessionSnapshot) {
    setSnapshot(next);
  }

  function rehydrateFromStorage() {
    applySnapshot(loadPersonaSessionSnapshot(persona));
  }

  useEffect(() => {
    rehydrateFromStorage();

    const handleStorage = () => rehydrateFromStorage();
    window.addEventListener("focus", handleStorage);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [persona]);

  function setApiBaseUrl(nextApiBaseUrl: string) {
    window.localStorage.setItem(authApiBaseStorageKey, nextApiBaseUrl);
    window.localStorage.setItem(legacyRfqApiBaseStorageKey, nextApiBaseUrl);
    setSnapshot((current) => ({ ...current, apiBaseUrl: nextApiBaseUrl }));
  }

  function applyAccount(account: SavedAccount, accounts: SavedAccount[]) {
    setSnapshot((current) => ({
      ...current,
      accessToken: account.accessToken,
      activeVendorId: account.activeVendorId,
      savedAccounts: accounts,
      selectedAccountId: account.user.id,
      user: account.user,
      vendorMemberships: account.vendorMemberships,
    }));
    setAuthError(null);
  }

  async function authenticate(
    path: "/api/v1/auth/login" | "/api/v1/auth/register",
    body: unknown,
  ): Promise<boolean> {
    if (persona === "admin" && path === "/api/v1/auth/register") {
      setAuthError("Admin accounts are provisioned by the platform. Sign in with an existing admin user.");
      return false;
    }

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const result = await authRequest<AuthResponse>(apiBaseUrl, path, { body });

      if (persona === "admin" && !userHasAdminRole(result.user)) {
        setAuthError(
          "This account does not have platform or support admin access. Use customer or vendor sign-in instead.",
        );
        return false;
      }

      const account = accountFromAuthResponse(result, persona === "vendor" ? activeVendorId : "");
      const accounts = saveAccount(account, persona);
      applyAccount(account, accounts);
      clearPersonaSignedOut(persona);
      return true;
    } catch (caughtError) {
      setAuthError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
      return false;
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
          result.vendorMemberships.find(
            (membership) => membership.status === "active" && membership.approvalStatus === "approved",
          )?.vendorId ||
          result.vendorMemberships.find((membership) => membership.status === "active")?.vendorId ||
          "",
        savedAt: new Date().toISOString(),
        user: result.user,
        vendorMemberships: result.vendorMemberships,
      };
      const accounts = saveAccount(account, persona);
      applyAccount(account, accounts);
    } catch (caughtError) {
      if (isUnauthorizedAuthError(caughtError)) {
        applySnapshot(emptyPersonaSessionSnapshot(apiBaseUrl));
        clearAllAuthStorage();
        return;
      }

      setAuthError(caughtError instanceof Error ? caughtError.message : "Session refresh failed.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  function selectSavedAccount(userId: string) {
    const account = savedAccounts.find((candidate) => candidate.user.id === userId);
    if (!account) return;

    if (persona === "admin" && !userHasAdminRole(account.user)) {
      setAuthError("Select an account with platform or support admin access.");
      return;
    }

    const accounts = saveAccount(account, persona);
    applyAccount(account, accounts);
  }

  function setActiveVendorId(vendorId: string) {
    window.localStorage.setItem(legacyVendorIdStorageKey, vendorId);

    setSnapshot((current) => {
      if (!current.user) {
        return { ...current, activeVendorId: vendorId };
      }

      const account = current.savedAccounts.find((candidate) => candidate.user.id === current.user?.id);
      if (!account) {
        return { ...current, activeVendorId: vendorId };
      }

      const updated = { ...account, activeVendorId: vendorId, savedAt: new Date().toISOString() };
      const accounts = saveAccount(updated, persona);
      return {
        ...current,
        activeVendorId: vendorId,
        savedAccounts: accounts,
      };
    });
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

    applySnapshot(emptyPersonaSessionSnapshot(apiBaseUrl));
    clearAllAuthStorage();
    window.dispatchEvent(new Event("storage"));
  }

  const globalRoles = user?.globalRoles ?? [];
  const hasAdminAccess = user ? userHasAdminRole(user) : false;
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
      persona,
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
      persona,
      savedAccounts,
      selectedAccountId,
      user,
      vendorMemberships,
    ],
  );
}

export function useCustomerAuthSession(): AuthSessionState {
  return useAuthSession({ persona: "customer" });
}

export function useVendorAuthSession(): AuthSessionState {
  return useAuthSession({ persona: "vendor" });
}

export function useAdminAuthSession(): AuthSessionState {
  return useAuthSession({ persona: "admin" });
}
