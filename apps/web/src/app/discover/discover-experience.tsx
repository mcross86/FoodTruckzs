"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { searchPublicVendors, type PublicVendorCard } from "@/lib/marketplace-api";

type LocationState = {
  label: string;
  lat: number | null;
  lng: number | null;
};

export function DiscoverExperience() {
  const [location, setLocation] = useState<LocationState>({
    label: "",
    lat: null,
    lng: null,
  });
  const [manualLocation, setManualLocation] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(true);
  const [vendors, setVendors] = useState<PublicVendorCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadVendors = useCallback(async (serviceArea?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await searchPublicVendors({
        serviceArea: serviceArea?.trim() || undefined,
      });
      setVendors(result.vendors);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Discovery search failed.");
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser. Enter a city manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const label = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
        setLocation({
          label,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        void loadVendors(label);
      },
      () => {
        setError("Location permission denied. Enter a city or ZIP to continue.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function applyManualLocation() {
    const label = manualLocation.trim();
    if (!label) {
      setError("Enter a city, neighborhood, or ZIP code.");
      return;
    }

    setLocation({ label, lat: null, lng: null });
    void loadVendors(label);
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "24px auto", maxWidth: 960 }}>
      <header style={{ marginBottom: 20 }}>
        <Link href={ROUTES.home}>← Back</Link>
        <h1 style={{ color: "#f8fafc", fontSize: "clamp(30px, 7vw, 48px)", margin: "8px 0" }}>
          I&apos;m Hungry Now
        </h1>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Fast, mobile-first discovery. Live map integration and open-now signals are rolling out;
          this view uses published trucks near your area today.
        </p>
      </header>

      <section
        style={{
          background: "rgba(37, 41, 58, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          display: "grid",
          gap: 12,
          marginBottom: 16,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={requestDeviceLocation} type="button">
            Use my location
          </button>
          <label
            style={{
              alignItems: "center",
              color: "#c5cbe0",
              display: "flex",
              fontWeight: 700,
              gap: 8,
            }}
          >
            <input
              checked={openNowOnly}
              onChange={(event) => setOpenNowOnly(event.target.checked)}
              type="checkbox"
            />
            Open now (preview)
          </label>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
          <input
            aria-label="Manual location"
            onChange={(event) => setManualLocation(event.target.value)}
            placeholder="City, neighborhood, or ZIP"
            value={manualLocation}
          />
          <button onClick={applyManualLocation} type="button">
            Search area
          </button>
        </div>
        {location.label ? (
          <p style={{ color: "#87ddf7", fontWeight: 700, margin: 0 }}>
            Searching near: {location.label}
            {location.lat !== null ? ` (${location.lat}, ${location.lng})` : ""}
          </p>
        ) : null}
      </section>

      <section
        aria-label="Map preview"
        style={{
          background:
            "linear-gradient(160deg, rgba(135, 221, 247, 0.2), rgba(37, 41, 58, 0.95))",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          marginBottom: 16,
          minHeight: 220,
          padding: 20,
        }}
      >
        <p style={{ color: "#f8fafc", fontWeight: 800, margin: "0 0 8px" }}>
          Map + list hybrid (coming soon)
        </p>
        <p style={{ color: "#c5cbe0", margin: 0 }}>
          Map tiles, live pins, and wait-time estimates will use the discovery API. List results
          below stay usable on mobile without an account.
        </p>
      </section>

      {error ? (
        <section style={{ background: "#ff9d66", borderRadius: 18, marginBottom: 16, padding: 14 }}>
          <p style={{ color: "#171b2a", margin: 0 }}>{error}</p>
        </section>
      ) : null}

      <section aria-label="Nearby trucks">
        <p style={{ color: "#f8fafc", fontWeight: 800 }}>
          {isLoading ? "Loading trucks..." : `${vendors.length} truck${vendors.length === 1 ? "" : "s"} found`}
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {vendors.map((vendor, index) => {
            const accent = ["#ffe66d", "#87ddf7", "#9cf579", "#ff9d66"][index % 4];

            return (
              <article
                key={vendor.id}
                style={{
                  background: "rgba(37, 41, 58, 0.92)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 22,
                  display: "grid",
                  gap: 8,
                  padding: 16,
                }}
              >
                <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      background: accent,
                      borderRadius: 14,
                      display: "inline-block",
                      height: 48,
                      width: 48,
                    }}
                  />
                  <div>
                    <p style={{ color: "#9cf579", fontSize: 12, fontWeight: 800, margin: 0 }}>
                      {openNowOnly ? "OPEN · PREVIEW" : "PUBLISHED"}
                    </p>
                    <h2 style={{ color: "#f8fafc", margin: "4px 0" }}>{vendor.businessName}</h2>
                    <p style={{ color: "#c5cbe0", margin: 0 }}>
                      {vendor.cuisines.map((c) => c.name).join(", ") || "Cuisine TBD"} · Distance
                      estimate soon
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link
                    href={ROUTES.discoverTruck(vendor.slug)}
                    style={{
                      background: accent,
                      borderRadius: 999,
                      color: "#171b2a",
                      fontWeight: 800,
                      padding: "8px 14px",
                    }}
                  >
                    View truck
                  </Link>
                  <Link
                    href={`${ROUTES.rfq.start}?vendorId=${vendor.id}&from=${encodeURIComponent(ROUTES.discover)}`}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 999,
                      color: "#f8fafc",
                      fontWeight: 700,
                      padding: "8px 14px",
                    }}
                  >
                    Plan catering instead
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
