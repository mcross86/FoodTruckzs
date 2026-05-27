import Link from "next/link";

import { ROUTES } from "@foodtruckzs/shared";

import { VendorRegisterWizard } from "./vendor-register-wizard";

export default function VendorRegisterPage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 720 }}>
      <p>
        <Link href={ROUTES.home}>← Back</Link>
      </p>
      <header style={{ marginBottom: 16 }}>
        <p style={{ color: "#ff9d66", fontWeight: 800, margin: "0 0 6px" }}>
          BECOME A VENDOR
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Food truck onboarding</h1>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Four-step registration: account, business profile, operations, and admin activation.
        </p>
      </header>
      <VendorRegisterWizard />
      <p style={{ color: "#c5cbe0", marginTop: 20 }}>
        Already registered? <Link href={ROUTES.vendor.login}>Vendor login</Link>
      </p>
    </main>
  );
}
