"use client";

import Link from "next/link";
import { useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { PlanField, PlanFormPanel } from "@/components/plan/plan-form-panel";
import { useAuthSession } from "@/lib/auth-session";

const steps = ["Account", "Business", "Operations", "Approval"] as const;

export function VendorRegisterWizard() {
  const session = useAuthSession();
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [cuisines, setCuisines] = useState("");
  const [serviceRegions, setServiceRegions] = useState("");
  const [phone, setPhone] = useState("");

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

      {step === 0 ? (
        <PlanFormPanel title="Step 1 — Account setup">
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            Create the owner account that will manage this food truck on foodtruckzs.
          </p>
          <AuthSessionPanel session={session} title="Owner account" />
          <button disabled={!session.user} onClick={() => setStep(1)} type="button">
            Continue
          </button>
        </PlanFormPanel>
      ) : null}

      {step === 1 ? (
        <PlanFormPanel title="Step 2 — Business information">
          <PlanField label="Food truck name">
            <input onChange={(e) => setBusinessName(e.target.value)} value={businessName} />
          </PlanField>
          <PlanField label="Cuisine categories">
            <input onChange={(e) => setCuisines(e.target.value)} placeholder="Tacos, BBQ" value={cuisines} />
          </PlanField>
          <PlanField label="Service regions">
            <input
              onChange={(e) => setServiceRegions(e.target.value)}
              placeholder="Atlanta metro, Decatur"
              value={serviceRegions}
            />
          </PlanField>
          <PlanField label="Phone">
            <input onChange={(e) => setPhone(e.target.value)} value={phone} />
          </PlanField>
          <p style={{ color: "#8f96ac", fontSize: 14, margin: 0 }}>
            Licensing, insurance uploads, website, and social links are captured in vendor
            operational setup after registration.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(0)} type="button">
              Back
            </button>
            <button onClick={() => setStep(2)} type="button">
              Continue
            </button>
          </div>
        </PlanFormPanel>
      ) : null}

      {step === 2 ? (
        <PlanFormPanel title="Step 3 — Operational configuration">
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            Configure schedule, catering availability, minimum booking pricing, menus, and service
            radius in the vendor workspace. API-backed setup is available today at operational
            setup.
          </p>
          <Link href="/vendor-operational-setup">Open operational setup</Link>
          <div style={{ display: "flex", gap: 8 }}>
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
            <li>Account created</li>
            <li>Business profile draft saved locally in this wizard (API wiring next)</li>
            <li>Operations configured in vendor tools</li>
            <li>Admin approval required for publish</li>
          </ul>
          <Link href={ROUTES.vendor.dashboard}>Go to vendor dashboard</Link>
        </PlanFormPanel>
      ) : null}
    </div>
  );
}
