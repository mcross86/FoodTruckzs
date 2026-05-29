"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import {
  adminApiErrorMessage,
  createAdminCuisine,
  listAdminCuisines,
  slugFromCuisineName,
  updateAdminCuisine,
  type AdminCuisine,
} from "@/lib/admin-api";
import { useAdminAuthSession } from "@/lib/auth-session";

const STARTER_CUISINES = [
  "American",
  "BBQ / Barbecue",
  "Burgers",
  "Tacos / Mexican",
  "Pizza",
  "Mediterranean",
  "Asian Fusion",
  "Desserts",
] as const;

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
};

export function AdminMarketplaceConfig() {
  const session = useAdminAuthSession();
  const [cuisines, setCuisines] = useState<AdminCuisine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const activeCount = useMemo(() => cuisines.filter((cuisine) => cuisine.isActive).length, [cuisines]);

  const loadCuisines = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const rows = await listAdminCuisines({
        apiBaseUrl: session.apiBaseUrl,
        token: session.accessToken,
      });
      setCuisines(rows);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load cuisines.");
    } finally {
      setIsLoading(false);
    }
  }, [session.accessToken, session.apiBaseUrl]);

  useEffect(() => {
    void loadCuisines();
  }, [loadCuisines]);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugFromCuisineName(name));
  }, [name, slugTouched]);

  async function handleCreateCuisine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    setIsSaving(true);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim() || slugFromCuisineName(trimmedName);

    if (trimmedName.length < 2) {
      setError("Cuisine name must be at least 2 characters.");
      setIsSaving(false);
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setError("Slug must use lowercase letters, numbers, and hyphens only.");
      setIsSaving(false);
      return;
    }

    const { cuisine: created, result } = await createAdminCuisine({
      apiBaseUrl: session.apiBaseUrl,
      name: trimmedName,
      slug: trimmedSlug,
      token: session.accessToken,
    });

    setIsSaving(false);

    if (!created) {
      setError(adminApiErrorMessage(result));
      return;
    }

    setCuisines((current) =>
      [...current, created].sort((left, right) => left.name.localeCompare(right.name)),
    );
    setName("");
    setSlug("");
    setSlugTouched(false);
    setStatusMessage(`Added "${created.name}". Vendors can now select it during setup.`);
  }

  async function toggleCuisineActive(cuisine: AdminCuisine) {
    setError(null);
    setStatusMessage(null);
    setIsSaving(true);

    const { cuisine: updated, result } = await updateAdminCuisine({
      apiBaseUrl: session.apiBaseUrl,
      cuisineId: cuisine.id,
      isActive: !cuisine.isActive,
      token: session.accessToken,
    });

    setIsSaving(false);

    if (!updated) {
      setError(adminApiErrorMessage(result));
      return;
    }

    setCuisines((current) =>
      current
        .map((row) => (row.id === updated.id ? updated : row))
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
    setStatusMessage(
      updated.isActive
        ? `"${updated.name}" is active in marketplace filters and vendor setup.`
        : `"${updated.name}" is hidden from new vendor selection.`,
    );
  }

  async function addStarterCuisines() {
    setError(null);
    setStatusMessage(null);
    setIsSaving(true);

    const existingSlugs = new Set(cuisines.map((cuisine) => cuisine.slug));
    let added = 0;

    for (const starterName of STARTER_CUISINES) {
      const starterSlug = slugFromCuisineName(starterName);
      if (existingSlugs.has(starterSlug)) continue;

      const { cuisine: created } = await createAdminCuisine({
        apiBaseUrl: session.apiBaseUrl,
        name: starterName,
        slug: starterSlug,
        token: session.accessToken,
      });

      if (created) {
        existingSlugs.add(created.slug);
        added += 1;
      }
    }

    setIsSaving(false);
    await loadCuisines();

    if (added === 0) {
      setStatusMessage("Starter cuisines are already configured.");
      return;
    }

    setStatusMessage(`Added ${added} starter cuisine${added === 1 ? "" : "s"}.`);
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 920 }}>
      <p>
        <Link href={ROUTES.admin.root}>← Back to admin dashboard</Link>
      </p>

      <header style={{ marginBottom: 24 }}>
        <p style={{ color: "#87ddf7", fontWeight: 800, margin: "0 0 6px" }}>
          MARKETPLACE CONFIGURATION
        </p>
        <h1 style={{ color: "#f8fafc", margin: "0 0 8px" }}>Cuisine categories</h1>
        <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
          Vendors cannot complete truck setup until at least one active cuisine exists. Add the
          categories operators can claim, then vendors can map their truck to them during registration
          and profile updates.
        </p>
      </header>

      {activeCount === 0 ? (
        <section
          style={{
            background: "rgba(255, 157, 102, 0.12)",
            border: "1px solid rgba(255, 157, 102, 0.35)",
            borderRadius: 18,
            marginBottom: 20,
            padding: 16,
          }}
        >
          <p style={{ color: "#ffb088", fontWeight: 800, margin: "0 0 6px" }}>
            Vendor setup is blocked
          </p>
          <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: 0 }}>
            No active cuisines are available yet. Add at least one cuisine below, or use the starter
            pack to bootstrap common categories.
          </p>
        </section>
      ) : null}

      {error ? (
        <section
          style={{
            background: "rgba(255, 120, 120, 0.12)",
            border: "1px solid rgba(255, 120, 120, 0.35)",
            borderRadius: 18,
            marginBottom: 16,
            padding: 14,
          }}
        >
          <p style={{ color: "#ffb4b4", margin: 0 }}>{error}</p>
        </section>
      ) : null}

      {statusMessage ? (
        <section
          style={{
            background: "rgba(156, 245, 121, 0.12)",
            border: "1px solid rgba(156, 245, 121, 0.35)",
            borderRadius: 18,
            marginBottom: 16,
            padding: 14,
          }}
        >
          <p style={{ color: "#9cf579", margin: 0 }}>{statusMessage}</p>
        </section>
      ) : null}

      <section style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ color: "#f8fafc", flex: "1 1 220px", margin: 0 }}>Add cuisine</h2>
          <button disabled={isSaving} onClick={() => void addStarterCuisines()} type="button">
            Add starter pack ({STARTER_CUISINES.length})
          </button>
        </div>

        <form onSubmit={(event) => void handleCreateCuisine(event)} style={{ display: "grid", gap: 12 }}>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Display name
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Tacos / Mexican"
              style={inputStyle}
              value={name}
            />
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            URL slug
            <input
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              placeholder="tacos-mexican"
              style={inputStyle}
              value={slug}
            />
          </label>
          <button
            disabled={isSaving || name.trim().length < 2}
            style={{
              background: "#ffe66d",
              border: "none",
              borderRadius: 16,
              color: "#171b2a",
              cursor: "pointer",
              fontWeight: 800,
              justifySelf: "start",
              padding: "12px 18px",
            }}
            type="submit"
          >
            {isSaving ? "Saving…" : "Add cuisine"}
          </button>
        </form>
      </section>

      <section style={panelStyle}>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ color: "#f8fafc", flex: "1 1 220px", margin: 0 }}>
            Configured cuisines ({cuisines.length})
          </h2>
          <span style={{ color: "#9cf579", fontSize: 14, fontWeight: 700 }}>
            {activeCount} active
          </span>
          <button disabled={isLoading} onClick={() => void loadCuisines()} type="button">
            Refresh
          </button>
        </div>

        {isLoading ? (
          <p style={{ color: "#c5cbe0", margin: 0 }}>Loading cuisines…</p>
        ) : cuisines.length === 0 ? (
          <p style={{ color: "#c5cbe0", margin: 0 }}>
            No cuisines configured yet. Add your first cuisine above.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {cuisines.map((cuisine) => (
              <article
                key={cuisine.id}
                style={{
                  alignItems: "center",
                  background: "rgba(23, 27, 42, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  padding: "14px 16px",
                }}
              >
                <div>
                  <p style={{ color: "#f8fafc", fontWeight: 800, margin: "0 0 4px" }}>{cuisine.name}</p>
                  <p style={{ color: "#8f96ac", fontSize: 13, margin: 0 }}>
                    {cuisine.slug} · {cuisine.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <button
                  disabled={isSaving}
                  onClick={() => void toggleCuisineActive(cuisine)}
                  type="button"
                >
                  {cuisine.isActive ? "Deactivate" : "Activate"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
