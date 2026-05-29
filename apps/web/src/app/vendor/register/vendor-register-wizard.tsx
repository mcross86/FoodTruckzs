"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { CuisineMultiSelect } from "@/components/cuisine-multi-select";
import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { parseCuisinesText } from "@/lib/catering-cuisines";
import { useCustomerAuthSession, useVendorAuthSession } from "@/lib/auth-session";
import { createVendorFromRegisterDraft } from "@/lib/vendor-registration-api";

const steps = ["Profile", "Business", "Operations", "Approval"] as const;
const draftStorageKey = "foodtruckzs.vendorRegisterDraft.v1";

type VendorRegisterDraft = {
  businessName: string;
  businessPhone: string;
  cuisinesText: string;
  email: string;
  firstName: string;
  headline: string;
  lastName: string;
  password: string;
  phone: string;
  publicDescription: string;
  serviceIncludeSurroundingArea: boolean;
  serviceState: string;
  serviceZipCode: string;
};

function emptyDraft(): VendorRegisterDraft {
  return {
    businessName: "",
    businessPhone: "",
    cuisinesText: "",
    email: "",
    firstName: "",
    headline: "",
    lastName: "",
    password: "",
    phone: "",
    publicDescription: "",
    serviceIncludeSurroundingArea: false,
    serviceState: "",
    serviceZipCode: "",
  };
}

function isValidUsZipCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

function serviceAreaLabel(draft: VendorRegisterDraft): string {
  const zip = draft.serviceZipCode.trim();
  if (!zip) return "";
  return draft.serviceIncludeSurroundingArea ? `${zip} (+ 25 mi)` : zip;
}

function saveDraft(draft: VendorRegisterDraft) {
  window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
}

function clearDraft() {
  window.localStorage.removeItem(draftStorageKey);
}

export function VendorRegisterWizard() {
  const session = useVendorAuthSession();
  const customerSession = useCustomerAuthSession();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<VendorRegisterDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [hasAppliedNewFlowReset, setHasAppliedNewFlowReset] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return;

    try {
      setDraft({ ...emptyDraft(), ...(JSON.parse(stored) as VendorRegisterDraft) });
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, []);

  // Starting a brand-new vendor flow should not reuse the previous vendor's draft.
  // If the user isn't signed in to a vendor persona yet, treat this as a new flow and reset once.
  useEffect(() => {
    if (hasAppliedNewFlowReset) return;
    if (session.accessToken.trim()) return;

    clearDraft();
    setDraft(emptyDraft());
    setStep(0);
    setHasAppliedNewFlowReset(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAppliedNewFlowReset, session.accessToken]);

  useEffect(() => {
    if (!session.accessToken.trim()) return;
    void session.refreshMe();
  }, [session.accessToken]);

  useEffect(() => {
    if (session.hasVendorAccess) return;
    if (!session.user) return;

    setStep((current) => (current === 0 ? 1 : current));
    setDraft((current) => {
      const normalizedStored = current.email.trim().toLowerCase();
      const normalizedSignedIn = session.user?.email.trim().toLowerCase() ?? "";
      // If we're starting a new vendor onboarding under a different email than the stored draft,
      // reset the draft so step 2 doesn't inherit the previous vendor's business details.
      const base = normalizedStored && normalizedSignedIn && normalizedStored !== normalizedSignedIn
        ? emptyDraft()
        : current;
      const next = {
        ...base,
        email: base.email.trim() || session.user?.email || "",
        firstName: base.firstName.trim() || session.user?.firstName || "",
        lastName: base.lastName.trim() || session.user?.lastName || "",
        phone: base.phone.trim() || session.user?.phone || "",
      };
      saveDraft(next);
      return next;
    });
  }, [session.hasVendorAccess, session.user]);

  function updateDraft<K extends keyof VendorRegisterDraft>(key: K, value: VendorRegisterDraft[K]) {
    setDraft((current) => {
      if (key === "email") {
        const nextEmail = String(value ?? "").trim().toLowerCase();
        const currentEmail = current.email.trim().toLowerCase();

        if (nextEmail && currentEmail && nextEmail !== currentEmail) {
          const reset = emptyDraft();
          const next = { ...reset, ...current, email: String(value ?? "") };
          saveDraft(next);
          return next;
        }
      }

      const next = { ...current, [key]: value };
      saveDraft(next);
      return next;
    });
  }

  async function ensureOwnerAccount(): Promise<boolean> {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const email = draft.email.trim();
    const password = draft.password;
    const normalizedEmail = email.toLowerCase();
    const signedInEmail = session.user?.email.trim().toLowerCase();

    if (!firstName || !lastName) {
      setError("Enter your first and last name.");
      return false;
    }
    if (!email) {
      setError("Enter your email address.");
      return false;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return false;
    }

    if (session.user && signedInEmail === normalizedEmail) {
      return true;
    }

    setIsWorking(true);
    setError(null);

    if (session.user && signedInEmail !== normalizedEmail) {
      await session.logout();
    }

    const registered = await session.register({
      email,
      firstName,
      lastName,
      password,
      phone: draft.phone.trim() || undefined,
    });

    setIsWorking(false);

    if (!registered) {
      setError(session.authError ?? "Could not create your vendor owner account.");
      return false;
    }

    await session.refreshMe();
    return true;
  }

  async function handleProfileContinue() {
    const ok = await ensureOwnerAccount();
    if (ok) setStep(1);
  }

  async function handleBusinessContinue() {
    if (!session.user) {
      setError("Create your owner account on step 1 before continuing.");
      return;
    }
    if (!draft.businessName.trim()) {
      setError("Enter your food truck or business name.");
      return;
    }
    if (!isValidUsZipCode(draft.serviceZipCode)) {
      setError("Enter a valid 5-digit ZIP code (optional +4 extension allowed).");
      return;
    }
    if (draft.serviceState.trim().length < 2) {
      setError("Enter your service state (2-letter code, e.g. GA).");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const vendorId = await createVendorFromRegisterDraft({
        apiBaseUrl: session.apiBaseUrl,
        draft,
        token: session.accessToken,
      });
      session.setActiveVendorId(vendorId);
      await session.refreshMe();
      saveDraft(draft);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your food truck profile.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <nav
        aria-label="Vendor registration progress"
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 16,
        }}
      >
        {steps.map((label, index) => (
          <span
            key={label}
            style={{
              background: index === step ? "#ffe66d" : "rgba(255, 255, 255, 0.08)",
              borderRadius: 12,
              color: index === step ? "#171b2a" : "#f8fafc",
              fontSize: 12,
              fontWeight: 800,
              padding: "8px 6px",
              textAlign: "center",
            }}
          >
            {index + 1}. {label}
          </span>
        ))}
      </nav>

      {error ? (
        <section
          style={{
            background: "rgba(255, 143, 156, 0.12)",
            border: "1px solid rgba(255, 143, 156, 0.35)",
            borderRadius: 14,
            color: "#f8fafc",
            marginBottom: 16,
            padding: 14,
          }}
        >
          {error}
        </section>
      ) : null}

      {step === 0 ? (
        <PlanFormPanel title="Step 1 — Your profile">
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            Vendor and customer accounts are separate sign-ins. Enter the email and password for
            this food truck owner — it will not reuse your customer login.
          </p>
          {customerSession.user &&
          customerSession.user.email.toLowerCase() !== draft.email.trim().toLowerCase() ? (
            <p style={{ color: "#87ddf7", fontSize: 14, margin: 0 }}>
              Your customer account ({customerSession.user.email}) stays signed in separately for
              planning events.
            </p>
          ) : null}
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <PlanField label="First name">
              <input
                autoComplete="given-name"
                onChange={(event) => updateDraft("firstName", event.target.value)}
                value={draft.firstName}
              />
            </PlanField>
            <PlanField label="Last name">
              <input
                autoComplete="family-name"
                onChange={(event) => updateDraft("lastName", event.target.value)}
                value={draft.lastName}
              />
            </PlanField>
            <PlanField label="Email">
              <input
                autoComplete="email"
                onChange={(event) => updateDraft("email", event.target.value)}
                type="email"
                value={draft.email}
              />
            </PlanField>
            <PlanField label="Mobile phone">
              <input
                autoComplete="tel"
                onChange={(event) => updateDraft("phone", event.target.value)}
                type="tel"
                value={draft.phone}
              />
            </PlanField>
            <PlanField label="Password">
              <input
                autoComplete="new-password"
                onChange={(event) => updateDraft("password", event.target.value)}
                placeholder="At least 8 characters with upper, lower, and number"
                type="password"
                value={draft.password}
              />
            </PlanField>
          </div>
          <button disabled={isWorking} onClick={() => void handleProfileContinue()} type="button">
            {isWorking ? "Creating account..." : "Continue"}
          </button>
        </PlanFormPanel>
      ) : null}

      {step === 1 ? (
        <PlanFormPanel title="Step 2 — Business information">
          {session.user ? (
            <p style={{ color: "#9cf579", margin: 0 }}>
              Signed in as {session.user.email}. Complete this step to create your food truck profile
              and unlock the vendor dashboard.
            </p>
          ) : null}
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <PlanField label="Food truck / business name">
              <input
                onChange={(event) => updateDraft("businessName", event.target.value)}
                value={draft.businessName}
              />
            </PlanField>
            <PlanField label="Public headline">
              <input
                onChange={(event) => updateDraft("headline", event.target.value)}
                placeholder="Award-winning tacos for festivals and offices"
                value={draft.headline}
              />
            </PlanField>
            <PlanField label="Cuisine categories">
              <CuisineMultiSelect
                onChange={(cuisinesText) => updateDraft("cuisinesText", cuisinesText)}
                value={draft.cuisinesText}
              />
            </PlanField>
            <PlanField label="Service ZIP code">
              <input
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => updateDraft("serviceZipCode", event.target.value)}
                placeholder="30301"
                value={draft.serviceZipCode}
              />
            </PlanField>
            <PlanField label="Service state">
              <input
                maxLength={2}
                onChange={(event) =>
                  updateDraft("serviceState", event.target.value.toUpperCase().slice(0, 2))
                }
                placeholder="GA"
                value={draft.serviceState}
              />
            </PlanField>
            <label
              style={{
                alignItems: "center",
                color: "#c5cbe0",
                display: "flex",
                fontWeight: 700,
                gap: 10,
                gridColumn: "1 / -1",
              }}
            >
              <input
                checked={draft.serviceIncludeSurroundingArea}
                onChange={(event) =>
                  updateDraft("serviceIncludeSurroundingArea", event.target.checked)
                }
                type="checkbox"
              />
              Include surrounding area (25 miles)
            </label>
            <PlanField label="Business phone">
              <input
                onChange={(event) => updateDraft("businessPhone", event.target.value)}
                type="tel"
                value={draft.businessPhone}
              />
            </PlanField>
          </div>
          <PlanField label="Public description">
            <textarea
              onChange={(event) => updateDraft("publicDescription", event.target.value)}
              placeholder="What makes your truck a great fit for events?"
              rows={4}
              style={{ width: "100%" }}
              value={draft.publicDescription}
            />
          </PlanField>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => setStep(0)} type="button">
              Back
            </button>
            <button disabled={isWorking} onClick={() => void handleBusinessContinue()} type="button">
              {isWorking ? "Creating food truck profile..." : "Continue"}
            </button>
          </div>
        </PlanFormPanel>
      ) : null}

      {step === 2 ? (
        <PlanFormPanel title="Step 3 — Operational configuration">
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            Configure schedule, catering availability, minimum booking pricing, menus, and service
            radius in the vendor workspace.
          </p>
          {session.user ? (
            <p style={{ color: "#9cf579", fontSize: 14, margin: 0 }}>
              Signed in as {session.user.email}. Business draft: {draft.businessName || "unnamed"}
              {serviceAreaLabel(draft) ? ` · Service area: ${serviceAreaLabel(draft)}` : ""} ·{" "}
              {parseCuisinesText(draft.cuisinesText).length} cuisine
              {parseCuisinesText(draft.cuisinesText).length === 1 ? "" : "s"} selected.
            </p>
          ) : null}
          <Link href={ROUTES.vendor.dashboard}>Open vendor dashboard</Link>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => setStep(1)} type="button">
              Back
            </button>
            <button onClick={() => setStep(3)} type="button">
              Continue
            </button>
          </div>
        </PlanFormPanel>
      ) : null}

      {step === 3 ? (
        <PlanFormPanel title="Step 4 — Approval and activation">
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            New vendors remain pending until platform admin review. Once approved, your truck can
            appear in discovery and catering marketplace search.
          </p>
          <ul style={{ color: "#c5cbe0" }}>
            <li>
              Owner profile {session.user ? `created (${session.user.email})` : "pending account"}
            </li>
            <li>
              Business profile draft saved ({draft.businessName || "add business name on step 2"})
            </li>
            <li>Operations configured in vendor tools</li>
            <li>Admin approval required for publish</li>
          </ul>
          <Link
            href={ROUTES.vendor.dashboard}
            style={{
              background: "#ffe66d",
              borderRadius: 16,
              color: "#171b2a",
              display: "inline-block",
              fontWeight: 800,
              marginTop: 8,
              padding: "12px 18px",
              textDecoration: "none",
            }}
          >
            Take me to dashboard
          </Link>
        </PlanFormPanel>
      ) : null}
    </div>
  );
}
