"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import {
  adminApiErrorMessage,
  approveAdminVendor,
  listAdminVendors,
  rejectAdminVendor,
  requestAdminVendorChanges,
  type AdminVendorReview,
} from "@/lib/admin-api";
import { useAdminAuthSession } from "@/lib/auth-session";

type AdminVendorApprovalsProps = {
  initialApprovalStatus?: "all" | "approved" | "pending" | "rejected";
};

const panelStyle = {
  background: "rgba(37, 41, 58, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 24,
  display: "grid",
  gap: 14,
  padding: 20,
} as const;

const inputStyle = {
  background: "rgba(23, 27, 42, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 12,
  boxSizing: "border-box" as const,
  color: "#f8fafc",
  padding: 10,
  width: "100%",
} as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function approvalLabel(status: AdminVendorReview["vendor"]["approvalStatus"]): string {
  if (status === "pending") return "Pending review";
  if (status === "approved") return "Approved";
  return "Rejected";
}

function userIsPlatformAdmin(globalRoles: string[]): boolean {
  return globalRoles.includes("platform_admin");
}

export function AdminVendorApprovals({ initialApprovalStatus }: AdminVendorApprovalsProps) {
  const session = useAdminAuthSession();
  const [approvalStatus, setApprovalStatus] = useState<
    "all" | "approved" | "pending" | "rejected"
  >(initialApprovalStatus ?? "pending");
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<AdminVendorReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const canDecide = session.user ? userIsPlatformAdmin(session.user.globalRoles) : false;

  const loadVendors = useCallback(async () => {
    if (!session.accessToken.trim()) {
      setVendors([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rows = await listAdminVendors({
        apiBaseUrl: session.apiBaseUrl,
        approvalStatus: approvalStatus === "all" ? undefined : approvalStatus,
        search: search.trim() || undefined,
        token: session.accessToken,
      });
      setVendors(rows);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load vendors.");
    } finally {
      setIsLoading(false);
    }
  }, [approvalStatus, search, session.accessToken, session.apiBaseUrl]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const pendingCount = useMemo(
    () => vendors.filter((row) => row.vendor.approvalStatus === "pending").length,
    [vendors],
  );

  async function runDecision(
    vendorId: string,
    action: "approve" | "reject" | "request-changes",
  ) {
    const note = (decisionNotes[vendorId] ?? "").trim();

    if ((action === "reject" || action === "request-changes") && !note) {
      setError(action === "reject" ? "A rejection reason is required." : "A note is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response =
        action === "approve"
          ? await approveAdminVendor({
              apiBaseUrl: session.apiBaseUrl,
              note: note || undefined,
              token: session.accessToken,
              vendorId,
            })
          : action === "reject"
            ? await rejectAdminVendor({
                apiBaseUrl: session.apiBaseUrl,
                reason: note,
                token: session.accessToken,
                vendorId,
              })
            : await requestAdminVendorChanges({
                apiBaseUrl: session.apiBaseUrl,
                note,
                token: session.accessToken,
                vendorId,
              });

      if (!response.result.ok) {
        throw new Error(adminApiErrorMessage(response.result));
      }

      setStatusMessage(
        action === "approve"
          ? "Vendor approved and published to the marketplace."
          : action === "reject"
            ? "Vendor application rejected."
            : "Change request recorded for the vendor.",
      );
      setDecisionNotes((current) => {
        const next = { ...current };
        delete next[vendorId];
        return next;
      });
      await loadVendors();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Vendor decision failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 960 }}>
      <p style={{ margin: "0 0 20px" }}>
        <Link href={ROUTES.admin.root} style={{ color: "#87ddf7", fontWeight: 700 }}>
          ← Admin dashboard
        </Link>
      </p>

      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 8px" }}>foodtruckzs admin</p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Vendor approval queue</h1>
        <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
          Review new food truck applications, approve operators for the marketplace, or request
          changes.
        </p>
      </header>

      {!canDecide ? (
        <p style={{ color: "#ffe66d", marginBottom: 16, textAlign: "center" }}>
          You can review applications with a support admin account. Approve, reject, and change
          requests require a platform admin account.
        </p>
      ) : null}

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
            Approval status
            <select
              onChange={(event) =>
                setApprovalStatus(event.target.value as typeof approvalStatus)
              }
              style={inputStyle}
              value={approvalStatus}
            >
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
            Search
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Business name or slug"
              style={inputStyle}
              value={search}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button disabled={isLoading} onClick={() => void loadVendors()} type="button">
            {isLoading ? "Loading..." : "Refresh list"}
          </button>
          <span style={{ color: "#c5cbe0" }}>
            {approvalStatus === "pending"
              ? `${pendingCount} pending in this view`
              : `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </section>

      {error ? (
        <section style={{ ...panelStyle, borderColor: "rgba(255, 120, 120, 0.35)", marginBottom: 16 }}>
          <p style={{ color: "#ffb4b4", margin: 0 }}>{error}</p>
        </section>
      ) : null}

      {statusMessage ? (
        <section style={{ ...panelStyle, borderColor: "rgba(156, 245, 121, 0.35)", marginBottom: 16 }}>
          <p style={{ color: "#9cf579", margin: 0 }}>{statusMessage}</p>
        </section>
      ) : null}

      {!isLoading && vendors.length === 0 ? (
        <section style={panelStyle}>
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            No vendors match this filter. New applications appear here with approval status{" "}
            <strong style={{ color: "#f8fafc" }}>pending</strong> after an operator completes
            registration.
          </p>
        </section>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {vendors.map((row) => (
          <article key={row.vendor.id} style={panelStyle}>
            <div style={{ display: "grid", gap: 8 }}>
              <p style={{ color: "#ffe66d", fontWeight: 700, margin: 0 }}>
                {approvalLabel(row.vendor.approvalStatus)}
              </p>
              <h2 style={{ color: "#f8fafc", margin: 0 }}>{row.vendor.businessName}</h2>
              <p style={{ color: "#c5cbe0", margin: 0 }}>
                Submitted {formatDate(row.vendor.createdAt)}
                {row.profile?.ownerContactName ? ` · ${row.profile.ownerContactName}` : ""}
                {row.profile?.businessEmail ? ` · ${row.profile.businessEmail}` : ""}
              </p>
              {row.profile?.publicDescription ? (
                <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
                  {row.profile.publicDescription}
                </p>
              ) : null}
              <p style={{ color: "#8f96ac", fontSize: 14, margin: 0 }}>
                Cuisines:{" "}
                {row.cuisines.length > 0
                  ? row.cuisines.map((cuisine) => cuisine.name).join(", ")
                  : "None listed"}
                {" · "}
                Service areas:{" "}
                {row.serviceAreas.length > 0
                  ? row.serviceAreas
                      .map((area) => [area.city, area.state].filter(Boolean).join(", "))
                      .join(" · ")
                  : "None listed"}
              </p>
            </div>

            {row.vendor.approvalStatus === "pending" && canDecide ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ color: "#c5cbe0", display: "grid", gap: 6 }}>
                  Decision note (required for reject / request changes)
                  <textarea
                    onChange={(event) =>
                      setDecisionNotes((current) => ({
                        ...current,
                        [row.vendor.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                    value={decisionNotes[row.vendor.id] ?? ""}
                  />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    disabled={isSaving}
                    onClick={() => void runDecision(row.vendor.id, "approve")}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => void runDecision(row.vendor.id, "request-changes")}
                    type="button"
                  >
                    Request changes
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => void runDecision(row.vendor.id, "reject")}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
