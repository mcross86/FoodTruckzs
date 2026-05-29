"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import { rfqApiRequest } from "@/lib/rfq-api";

type AvailabilityRuleDraft = {
  dayOfWeek: number;
  effectiveEndDate?: string;
  effectiveStartDate?: string;
  endsAtLocal: string;
  startsAtLocal: string;
  timezone: string;
};

type AvailabilityExceptionDraft = {
  capacityLimit?: number;
  endsAt: string;
  reason?: string;
  startsAt: string;
  timezone: string;
  type: "blackout" | "special_hours" | "capacity_limit";
};

type AvailabilitySettingsDraft = {
  defaultSetupMinutes?: number;
  defaultTravelBufferMinutes?: number;
  maxDailyBookings?: number;
  minimumGuestCount?: number;
  minimumLeadTimeDays: number;
  quoteResponseTargetHours?: number;
  requestAnywayOnBlackout: boolean;
  timezone: string;
  travelRadiusMiles: number;
};

type AvailabilityRecord = {
  exceptions: AvailabilityExceptionDraft[];
  rules: AvailabilityRuleDraft[];
  settings: (AvailabilitySettingsDraft & { createdAt?: string; updatedAt?: string }) | null;
};

const panelStyle = {
  background: "rgba(37, 41, 58, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: 18,
  padding: 18,
} as const;

const inputStyle = {
  background: "rgba(60, 67, 91, 0.65)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 12,
  color: "#f8fafc",
  minHeight: 44,
  padding: "10px 12px",
  width: "100%",
} as const;

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function safeInt(value: string, fallback?: number): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}

function datetimeLocalValue(isoValue: string): string {
  const date = new Date(isoValue);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function isoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function normalizeOptionalDate(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export default function VendorAvailabilityPage() {
  const session = useVendorAuthSession();
  const [record, setRecord] = useState<AvailabilityRecord | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AvailabilitySettingsDraft>(() => ({
    minimumLeadTimeDays: 7,
    requestAnywayOnBlackout: false,
    timezone: defaultTimezone(),
    travelRadiusMiles: 25,
  }));
  const [rulesDraft, setRulesDraft] = useState<AvailabilityRuleDraft[]>([]);
  const [exceptionsDraft, setExceptionsDraft] = useState<AvailabilityExceptionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const vendorId = session.activeVendorId.trim();
  const timezone = settingsDraft.timezone.trim() || defaultTimezone();

  const loadAvailability = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    setIsLoading(true);
    try {
      const result = await rfqApiRequest<AvailabilityRecord>({
        apiBaseUrl: session.apiBaseUrl,
        path: `/api/v1/vendors/${encodeURIComponent(vendorId)}/availability`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Availability load failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setRecord(result.data);

      const nextSettings: AvailabilitySettingsDraft = {
        defaultSetupMinutes: result.data.settings?.defaultSetupMinutes ?? 60,
        defaultTravelBufferMinutes: result.data.settings?.defaultTravelBufferMinutes ?? 30,
        maxDailyBookings: result.data.settings?.maxDailyBookings ?? undefined,
        minimumGuestCount: result.data.settings?.minimumGuestCount ?? undefined,
        minimumLeadTimeDays: result.data.settings?.minimumLeadTimeDays ?? 7,
        quoteResponseTargetHours: result.data.settings?.quoteResponseTargetHours ?? undefined,
        requestAnywayOnBlackout: result.data.settings?.requestAnywayOnBlackout ?? false,
        timezone: result.data.settings?.timezone ?? defaultTimezone(),
        travelRadiusMiles: result.data.settings?.travelRadiusMiles ?? 25,
      };

      setSettingsDraft(nextSettings);
      setRulesDraft(
        (result.data.rules ?? []).map((rule) => ({
          ...rule,
          endsAtLocal: normalizeTime(rule.endsAtLocal),
          startsAtLocal: normalizeTime(rule.startsAtLocal),
        })),
      );
      setExceptionsDraft(result.data.exceptions ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Availability load failed.");
    } finally {
      setIsLoading(false);
    }
  }, [session, vendorId]);

  useEffect(() => {
    if (!session.accessToken.trim() || !vendorId) return;
    void loadAvailability();
  }, [loadAvailability, session.accessToken, vendorId]);

  const rulesByDay = useMemo(() => {
    const grouped: Record<number, AvailabilityRuleDraft[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const rule of rulesDraft) {
      const day = Math.max(0, Math.min(6, rule.dayOfWeek));
      grouped[day] = [...(grouped[day] ?? []), rule];
    }
    for (const day of Object.keys(grouped)) {
      const dayNumber = Number(day);
      grouped[dayNumber] = (grouped[dayNumber] ?? []).slice().sort((a, b) => a.startsAtLocal.localeCompare(b.startsAtLocal));
    }
    return grouped;
  }, [rulesDraft]);

  async function saveAvailability() {
    setError(null);
    setSuccess(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    if (settingsDraft.minimumLeadTimeDays < 7) {
      setError("Minimum lead time must be at least 7 days.");
      return;
    }
    if (!Number.isFinite(settingsDraft.travelRadiusMiles) || settingsDraft.travelRadiusMiles <= 0) {
      setError("Travel radius must be a positive number of miles.");
      return;
    }

    const payload = {
      settings: {
        ...settingsDraft,
        timezone,
      },
      rules: rulesDraft.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        effectiveEndDate: normalizeOptionalDate(rule.effectiveEndDate ?? ""),
        effectiveStartDate: normalizeOptionalDate(rule.effectiveStartDate ?? ""),
        endsAtLocal: normalizeTime(rule.endsAtLocal),
        startsAtLocal: normalizeTime(rule.startsAtLocal),
        timezone: rule.timezone.trim() || timezone,
      })),
      exceptions: exceptionsDraft.map((exception) => ({
        capacityLimit: exception.capacityLimit,
        endsAt: exception.endsAt,
        reason: normalizeOptionalText(exception.reason ?? ""),
        startsAt: exception.startsAt,
        timezone: exception.timezone.trim() || timezone,
        type: exception.type,
      })),
    };

    setIsSaving(true);
    try {
      const result = await rfqApiRequest<AvailabilityRecord>({
        apiBaseUrl: session.apiBaseUrl,
        body: payload,
        method: "PUT",
        path: `/api/v1/vendors/${encodeURIComponent(vendorId)}/availability`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`Availability save failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      setRecord(result.data);
      setSuccess("Saved availability settings.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function addRule(dayOfWeek: number) {
    setRulesDraft((current) => [
      ...current,
      {
        dayOfWeek,
        endsAtLocal: "14:00:00",
        startsAtLocal: "11:00:00",
        timezone,
      },
    ]);
  }

  function updateRule(index: number, next: Partial<AvailabilityRuleDraft>) {
    setRulesDraft((current) => current.map((rule, idx) => (idx === index ? { ...rule, ...next } : rule)));
  }

  function removeRule(index: number) {
    setRulesDraft((current) => current.filter((_, idx) => idx !== index));
  }

  function addException(type: AvailabilityExceptionDraft["type"]) {
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 7);
    startsAt.setHours(11, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(14, 0, 0, 0);

    setExceptionsDraft((current) => [
      ...current,
      {
        endsAt: endsAt.toISOString(),
        startsAt: startsAt.toISOString(),
        timezone,
        type,
      },
    ]);
  }

  function updateException(index: number, next: Partial<AvailabilityExceptionDraft>) {
    setExceptionsDraft((current) =>
      current.map((exception, idx) => (idx === index ? { ...exception, ...next } : exception)),
    );
  }

  function removeException(index: number) {
    setExceptionsDraft((current) => current.filter((_, idx) => idx !== index));
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "32px auto", maxWidth: 1040 }}>
      <p style={{ margin: "0 0 14px" }}>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
      </p>

      <section style={{ background: "#fff4df", borderRadius: 22, padding: 28 }}>
        <p style={{ color: "#8a4b00", fontWeight: 800, margin: "0 0 8px" }}>
          Availability and operating settings
        </p>
        <h1 style={{ marginTop: 0 }}>Control when and where you accept catering</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5, marginBottom: 0 }}>
          These settings drive marketplace matching and reduce impossible leads. Use operating windows for recurring
          availability, and exceptions for blackouts or special hours.
        </p>
      </section>

      {error ? (
        <section style={{ ...panelStyle, background: "rgba(255, 143, 156, 0.12)", marginTop: 18 }}>
          <strong style={{ color: "#ff8f9c" }}>Needs attention</strong>
          <p style={{ color: "#f8fafc", margin: "10px 0 0" }}>{error}</p>
        </section>
      ) : null}

      {success ? (
        <section style={{ ...panelStyle, background: "rgba(156, 245, 121, 0.12)", marginTop: 18 }}>
          <strong style={{ color: "#9cf579" }}>Saved</strong>
          <p style={{ color: "#f8fafc", margin: "10px 0 0" }}>{success}</p>
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: 18 }}>
        <section style={panelStyle}>
          <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <div>
              <h2 style={{ color: "#f8fafc", margin: 0 }}>Operating settings</h2>
              <p style={{ color: "#c5cbe0", margin: "8px 0 0", lineHeight: 1.45 }}>
                Lead time, travel, buffers, and booking caps for your truck.
              </p>
            </div>
            <button
              disabled={isLoading}
              onClick={() => void loadAvailability()}
              type="button"
              style={{ borderRadius: 12, padding: "10px 14px" }}
            >
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </header>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
              Timezone
              <input
                onChange={(event) => setSettingsDraft((current) => ({ ...current, timezone: event.target.value }))}
                style={inputStyle}
                value={settingsDraft.timezone}
              />
            </label>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Minimum lead time (days)
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      minimumLeadTimeDays: safeInt(event.target.value, current.minimumLeadTimeDays) ?? current.minimumLeadTimeDays,
                    }))
                  }
                  style={inputStyle}
                  value={String(settingsDraft.minimumLeadTimeDays)}
                />
              </label>

              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Travel radius (miles)
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      travelRadiusMiles: safeInt(event.target.value, current.travelRadiusMiles) ?? current.travelRadiusMiles,
                    }))
                  }
                  style={inputStyle}
                  value={String(settingsDraft.travelRadiusMiles)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Minimum guest count (optional)
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, minimumGuestCount: safeInt(event.target.value) }))
                  }
                  style={inputStyle}
                  value={settingsDraft.minimumGuestCount ?? ""}
                />
              </label>

              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Max daily bookings (optional)
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({ ...current, maxDailyBookings: safeInt(event.target.value) }))
                  }
                  style={inputStyle}
                  value={settingsDraft.maxDailyBookings ?? ""}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Default setup minutes
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      defaultSetupMinutes: safeInt(event.target.value, current.defaultSetupMinutes ?? 60),
                    }))
                  }
                  style={inputStyle}
                  value={settingsDraft.defaultSetupMinutes ?? 60}
                />
              </label>

              <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                Default travel buffer minutes
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      defaultTravelBufferMinutes: safeInt(event.target.value, current.defaultTravelBufferMinutes ?? 30),
                    }))
                  }
                  style={inputStyle}
                  value={settingsDraft.defaultTravelBufferMinutes ?? 30}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
              Quote response target (hours, optional)
              <input
                inputMode="numeric"
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, quoteResponseTargetHours: safeInt(event.target.value) }))
                }
                style={inputStyle}
                value={settingsDraft.quoteResponseTargetHours ?? ""}
              />
            </label>

            <label style={{ alignItems: "center", color: "#f8fafc", display: "flex", gap: 10 }}>
              <input
                checked={settingsDraft.requestAnywayOnBlackout}
                onChange={(event) =>
                  setSettingsDraft((current) => ({ ...current, requestAnywayOnBlackout: event.target.checked }))
                }
                type="checkbox"
              />
              Allow customers to request anyway on blackout dates
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <button
              disabled={isSaving || !vendorId}
              onClick={() => void saveAvailability()}
              type="button"
              style={{
                background: "#ffe66d",
                borderRadius: 14,
                color: "#171b2a",
                fontWeight: 900,
                padding: "12px 16px",
              }}
            >
              {isSaving ? "Saving…" : "Save settings"}
            </button>
            <Link href={ROUTES.vendor.calendar} style={{ alignSelf: "center", color: "#87ddf7" }}>
              View calendar warnings →
            </Link>
          </div>
        </section>

        <section style={panelStyle}>
          <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
            <div>
              <h2 style={{ color: "#f8fafc", margin: 0 }}>Operating windows</h2>
              <p style={{ color: "#c5cbe0", margin: "8px 0 0", lineHeight: 1.45 }}>
                Recurring weekly hours when you accept catering. Avoid overlaps on the same day.
              </p>
            </div>
          </header>

          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            {dayLabels.map((label, dayOfWeek) => (
              <section key={label} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: "#f8fafc" }}>{label}</strong>
                  <button onClick={() => addRule(dayOfWeek)} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
                    + Add window
                  </button>
                </div>

                {(rulesByDay[dayOfWeek] ?? []).length === 0 ? (
                  <p style={{ color: "#8f96ac", margin: "10px 0 0" }}>No windows set.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {rulesByDay[dayOfWeek]!.map((rule) => {
                      const originalIndex = rulesDraft.indexOf(rule);
                      return (
                        <div
                          key={`${dayOfWeek}-${originalIndex}`}
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: "1fr 1fr",
                            alignItems: "end",
                          }}
                        >
                          <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                            Starts
                            <input
                              onChange={(event) => updateRule(originalIndex, { startsAtLocal: normalizeTime(event.target.value) })}
                              style={inputStyle}
                              type="time"
                              value={rule.startsAtLocal.slice(0, 5)}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                            Ends
                            <input
                              onChange={(event) => updateRule(originalIndex, { endsAtLocal: normalizeTime(event.target.value) })}
                              style={inputStyle}
                              type="time"
                              value={rule.endsAtLocal.slice(0, 5)}
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                            Effective start (optional)
                            <input
                              onChange={(event) => updateRule(originalIndex, { effectiveStartDate: normalizeOptionalDate(event.target.value) })}
                              style={inputStyle}
                              type="date"
                              value={rule.effectiveStartDate ?? ""}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                            Effective end (optional)
                            <input
                              onChange={(event) => updateRule(originalIndex, { effectiveEndDate: normalizeOptionalDate(event.target.value) })}
                              style={inputStyle}
                              type="date"
                              value={rule.effectiveEndDate ?? ""}
                            />
                          </label>

                          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ color: "#8f96ac", alignSelf: "center" }}>Timezone: {rule.timezone || timezone}</span>
                            <button onClick={() => removeRule(originalIndex)} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </section>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div>
            <h2 style={{ color: "#f8fafc", margin: 0 }}>Exceptions</h2>
            <p style={{ color: "#c5cbe0", margin: "8px 0 0", lineHeight: 1.45 }}>
              One-off blackouts, special hours, or capacity limits (e.g., festivals).
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => addException("blackout")} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
              + Blackout
            </button>
            <button onClick={() => addException("special_hours")} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
              + Special hours
            </button>
            <button onClick={() => addException("capacity_limit")} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
              + Capacity limit
            </button>
          </div>
        </header>

        {exceptionsDraft.length === 0 ? (
          <p style={{ color: "#8f96ac", margin: "14px 0 0" }}>No exceptions yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {exceptionsDraft.map((exception, index) => (
              <article
                key={`${exception.type}-${index}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ color: "#f8fafc" }}>{exception.type.replace("_", " ")}</strong>
                  <button onClick={() => removeException(index)} type="button" style={{ borderRadius: 12, padding: "8px 10px" }}>
                    Remove
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                    Starts
                    <input
                      onChange={(event) => updateException(index, { startsAt: isoFromLocalInput(event.target.value) })}
                      style={inputStyle}
                      type="datetime-local"
                      value={datetimeLocalValue(exception.startsAt)}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                    Ends
                    <input
                      onChange={(event) => updateException(index, { endsAt: isoFromLocalInput(event.target.value) })}
                      style={inputStyle}
                      type="datetime-local"
                      value={datetimeLocalValue(exception.endsAt)}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                    Reason (optional)
                    <input
                      onChange={(event) => updateException(index, { reason: event.target.value })}
                      style={inputStyle}
                      value={exception.reason ?? ""}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#f8fafc" }}>
                    Capacity limit (optional)
                    <input
                      inputMode="numeric"
                      onChange={(event) => updateException(index, { capacityLimit: safeInt(event.target.value) })}
                      style={inputStyle}
                      value={exception.capacityLimit ?? ""}
                    />
                  </label>
                </div>

                <p style={{ color: "#8f96ac", margin: 0 }}>Timezone: {exception.timezone || timezone}</p>
              </article>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            disabled={isSaving || !vendorId}
            onClick={() => void saveAvailability()}
            type="button"
            style={{
              background: "#ffe66d",
              borderRadius: 14,
              color: "#171b2a",
              fontWeight: 900,
              padding: "12px 16px",
            }}
          >
            {isSaving ? "Saving…" : "Save exceptions"}
          </button>
          <span style={{ color: "#8f96ac", alignSelf: "center" }}>
            {record ? `Loaded ${record.rules.length} rules · ${record.exceptions.length} exceptions` : "Not loaded yet"}
          </span>
        </div>
      </section>
    </main>
  );
}
