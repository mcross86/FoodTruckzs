"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@foodtruckzs/shared";

import { vendorWorkspaceGateMessage } from "@/components/vendor/vendor-workspace-auth";
import { useVendorAuthSession } from "@/lib/auth-session";
import { rfqApiRequest, statusLabel, type CalendarView } from "@/lib/rfq-api";

import { formatDate } from "../rfq-shared";

type ManualEventForm = {
  endsAt: string;
  isBlocking: boolean;
  location: string;
  notes: string;
  recurrence: RecurrenceForm;
  startsAt: string;
  title: string;
  type: "blocked_time" | "festival" | "food_truck_location" | "manual_booking";
};

type RecurrenceForm = {
  daysOfWeek: number[];
  enabled: boolean;
  endMode: "count" | "until";
  frequency: "weekly" | "biweekly";
  occurrenceCount: number;
  until: string;
};

const calendarViews = ["month", "week", "day", "agenda", "timeline"] as const;

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
] as const;

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

function datetimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function isoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function defaultRecurrence(startsAt: string, operatingFocus: boolean): RecurrenceForm {
  const day = new Date(startsAt).getDay();
  return {
    daysOfWeek: [day],
    enabled: operatingFocus,
    endMode: "count",
    frequency: "weekly",
    occurrenceCount: 12,
    until: "",
  };
}

function defaultForm(operatingFocus: boolean): ManualEventForm {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 7);
  startsAt.setHours(11, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(14, 0, 0, 0);
  const startsAtValue = datetimeLocalValue(startsAt);

  return {
    endsAt: datetimeLocalValue(endsAt),
    isBlocking: !operatingFocus,
    location: "",
    notes: "",
    recurrence: defaultRecurrence(startsAtValue, operatingFocus),
    startsAt: startsAtValue,
    title: operatingFocus ? "Regular lunch service" : "",
    type: operatingFocus ? "food_truck_location" : "manual_booking",
  };
}

function toggleDay(days: number[], day: number): number[] {
  if (days.includes(day)) {
    const next = days.filter((value) => value !== day);
    return next.length > 0 ? next : [day];
  }
  return [...days, day].sort((left, right) => left - right);
}

/** Matches API MVP cap: total span from startsFrom through startsTo is 180 days. */
const CALENDAR_RANGE_MAX_DAYS = 180;
const CALENDAR_LOOKBACK_DAYS = 7;

function buildCalendarRange(view: (typeof calendarViews)[number]) {
  const startsFrom = new Date();
  startsFrom.setDate(startsFrom.getDate() - CALENDAR_LOOKBACK_DAYS);
  startsFrom.setHours(0, 0, 0, 0);

  const forwardDays =
    view === "month"
      ? Math.min(90, CALENDAR_RANGE_MAX_DAYS - CALENDAR_LOOKBACK_DAYS)
      : CALENDAR_RANGE_MAX_DAYS - CALENDAR_LOOKBACK_DAYS;

  const startsTo = new Date(startsFrom);
  startsTo.setDate(startsTo.getDate() + forwardDays);
  startsTo.setHours(23, 59, 59, 999);

  return { startsFrom, startsTo };
}

export default function VendorCalendarPage() {
  const session = useVendorAuthSession();
  const [focusOperating, setFocusOperating] = useState(false);

  useEffect(() => {
    setFocusOperating(new URLSearchParams(window.location.search).get("focus") === "operating");
  }, []);

  const [view, setView] = useState<(typeof calendarViews)[number]>("agenda");
  const [calendar, setCalendar] = useState<CalendarView | null>(null);
  const [form, setForm] = useState<ManualEventForm>(() => defaultForm(false));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm(defaultForm(focusOperating));
  }, [focusOperating]);

  const range = useMemo(() => buildCalendarRange(view), [view]);

  const loadCalendar = useCallback(
    async (options?: { preserveSuccess?: boolean }) => {
      if (!options?.preserveSuccess) {
        setSuccess(null);
      }
      setError(null);

      const gateMessage = vendorWorkspaceGateMessage(session);
      if (gateMessage) {
        setError(gateMessage);
        return;
      }

      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          startsFrom: range.startsFrom.toISOString(),
          startsTo: range.startsTo.toISOString(),
          view,
        });
        const result = await rfqApiRequest<CalendarView>({
          apiBaseUrl: session.apiBaseUrl,
          path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/calendar-events?${params}`,
          token: session.accessToken,
        });

        if (!result.ok || !result.data) {
          throw new Error(`Calendar failed with ${result.status}: ${JSON.stringify(result.body)}`);
        }

        setCalendar(result.data);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Calendar load failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [range.startsFrom, range.startsTo, session, view],
  );

  useEffect(() => {
    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      return;
    }

    void loadCalendar();
  }, [loadCalendar, session.accessToken, session.activeVendorId]);

  async function createManualEvent() {
    setError(null);
    setSuccess(null);

    const gateMessage = vendorWorkspaceGateMessage(session);
    if (gateMessage) {
      setError(gateMessage);
      return;
    }

    if (form.recurrence.enabled && form.recurrence.daysOfWeek.length === 0) {
      setError("Choose at least one weekday for the recurring schedule.");
      return;
    }

    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        endsAt: isoFromLocalInput(form.endsAt),
        isBlocking: form.isBlocking,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
        startsAt: isoFromLocalInput(form.startsAt),
        title: form.title,
        type: form.type,
      };

      if (form.recurrence.enabled) {
        body.recurrence = {
          daysOfWeek: form.recurrence.daysOfWeek,
          frequency: form.recurrence.frequency,
          ...(form.recurrence.endMode === "until" && form.recurrence.until.trim()
            ? { until: form.recurrence.until.trim() }
            : { occurrenceCount: form.recurrence.occurrenceCount }),
        };
      }

      const result = await rfqApiRequest<{
        event: CalendarView["events"][number];
        events?: CalendarView["events"];
        recurrence?: { frequency: string; occurrencesCreated: number };
      }>({
        apiBaseUrl: session.apiBaseUrl,
        body,
        method: "POST",
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/calendar-events`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Create event failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      const createdCount = result.data.recurrence?.occurrencesCreated ?? 1;
      setSuccess(
        createdCount > 1
          ? `Created ${createdCount} recurring ${statusLabel(form.type).toLowerCase()} events.`
          : "Event created.",
      );
      setForm(defaultForm(focusOperating));

      if (result.data.events?.length) {
        setCalendar((current) => {
          const merged = new Map<string, CalendarView["events"][number]>();
          for (const event of current?.events ?? []) {
            merged.set(event.id, event);
          }
          for (const event of result.data!.events!) {
            merged.set(event.id, event);
          }
          const events = [...merged.values()].sort(
            (left, right) =>
              new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
          );

          return {
            events,
            groups: [],
            range: {
              startsFrom: range.startsFrom.toISOString(),
              startsTo: range.startsTo.toISOString(),
            },
            vendorId: session.activeVendorId.trim(),
            view,
            warnings: current?.warnings ?? [],
          };
        });
      }

      await loadCalendar({ preserveSuccess: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Create event failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyRecurrencePreset(preset: "weekly-lunch" | "weekend-market" | "biweekly-spot") {
    setForm((current) => {
      if (preset === "weekly-lunch") {
        return {
          ...current,
          isBlocking: false,
          recurrence: {
            ...current.recurrence,
            enabled: true,
            endMode: "count",
            frequency: "weekly",
            occurrenceCount: 12,
          },
          type: "food_truck_location",
        };
      }

      if (preset === "weekend-market") {
        return {
          ...current,
          isBlocking: false,
          recurrence: {
            ...current.recurrence,
            daysOfWeek: [0, 6],
            enabled: true,
            endMode: "count",
            frequency: "weekly",
            occurrenceCount: 16,
          },
          type: "festival",
        };
      }

      return {
        ...current,
        isBlocking: false,
        recurrence: {
          ...current.recurrence,
          enabled: true,
          endMode: "count",
          frequency: "biweekly",
          occurrenceCount: 8,
        },
        type: "food_truck_location",
      };
    });
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href={ROUTES.vendor.dashboard}>← Vendor Dashboard</Link>
        <h1>{focusOperating ? "Truck Hours and Locations" : "Calendar"}</h1>
        <p>
          {focusOperating
            ? "Schedule regular truck stops with recurring times and locations so hungry-now discovery stays accurate."
            : "View confirmed catering, manual bookings, festivals, public truck locations, and blocked time with conflict and setup/travel buffer warnings."}
        </p>
      </header>

      {focusOperating ? (
        <section
          style={{
            background: "rgba(156, 245, 121, 0.12)",
            border: "1px solid rgba(156, 245, 121, 0.35)",
            borderRadius: 16,
            marginBottom: 18,
            padding: 14,
          }}
        >
          <p style={{ color: "#9cf579", margin: 0 }}>
            Use <strong>Food truck operating location</strong> with <strong>Repeat weekly</strong> for
            regular lunch stops. Catering blackout rules live in{" "}
            <Link href={ROUTES.vendor.availability}>Catering Availability</Link>.
          </p>
        </section>
      ) : null}

      {error ? (
        <section style={{ background: "rgba(255, 143, 156, 0.12)", borderRadius: 14, marginBottom: 16, padding: 16 }}>
          <p style={{ color: "#ff8f9c", margin: 0 }}>{error}</p>
        </section>
      ) : null}
      {success ? (
        <section style={{ background: "rgba(156, 245, 121, 0.12)", borderRadius: 14, marginBottom: 16, padding: 16 }}>
          <p style={{ color: "#9cf579", margin: 0 }}>{success}</p>
        </section>
      ) : null}

      <section style={{ ...panelStyle, display: "grid", gap: 12, marginBottom: 20 }}>
        <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
          Calendar view
          <select
            onChange={(event) => setView(event.target.value as typeof view)}
            style={inputStyle}
            value={view}
          >
            {calendarViews.map((candidate) => (
              <option key={candidate} value={candidate}>
                {statusLabel(candidate)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={isLoading} onClick={() => void loadCalendar()} type="button">
          {isLoading ? "Loading..." : "Reload calendar"}
        </button>
        <p style={{ color: "#8f96ac", fontSize: 13, margin: 0 }}>
          Showing events from {formatDate(range.startsFrom.toISOString())} through{" "}
          {formatDate(range.startsTo.toISOString())} (max {CALENDAR_RANGE_MAX_DAYS}-day window per
          load).
        </p>
      </section>

      <section style={{ ...panelStyle, display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>
            {focusOperating ? "Schedule operating location" : "Create manual event"}
          </h2>
          <p style={{ color: "#8f96ac", margin: 0 }}>
            Set the first date and time, then repeat on the same weekdays for regular spots.
          </p>
        </div>

        {focusOperating ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => applyRecurrencePreset("weekly-lunch")} type="button">
              Weekly lunch (12 weeks)
            </button>
            <button onClick={() => applyRecurrencePreset("weekend-market")} type="button">
              Weekend market (16 dates)
            </button>
            <button onClick={() => applyRecurrencePreset("biweekly-spot")} type="button">
              Biweekly spot (8 dates)
            </button>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Title
            <input
              aria-label="Manual event title"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Event title"
              style={inputStyle}
              value={form.title}
            />
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Type
            <select
              aria-label="Manual event type"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isBlocking:
                    event.target.value === "blocked_time" || event.target.value === "manual_booking",
                  type: event.target.value as ManualEventForm["type"],
                }))
              }
              style={inputStyle}
              value={form.type}
            >
              <option value="food_truck_location">Food truck operating location</option>
              <option value="festival">Festival</option>
              <option value="manual_booking">Manual booking</option>
              <option value="blocked_time">Blocked time</option>
            </select>
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Starts
            <input
              aria-label="Manual event starts at"
              onChange={(event) => {
                const startsAt = event.target.value;
                setForm((current) => ({
                  ...current,
                  recurrence: {
                    ...current.recurrence,
                    daysOfWeek: current.recurrence.enabled
                      ? [new Date(startsAt).getDay()]
                      : current.recurrence.daysOfWeek,
                  },
                  startsAt,
                }));
              }}
              style={inputStyle}
              type="datetime-local"
              value={form.startsAt}
            />
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Ends
            <input
              aria-label="Manual event ends at"
              onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              style={inputStyle}
              type="datetime-local"
              value={form.endsAt}
            />
          </label>
          <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
            Location
            <input
              aria-label="Manual event location"
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              placeholder="Address, park, office campus…"
              style={inputStyle}
              value={form.location}
            />
          </label>
        </div>

        <section
          style={{
            background: "rgba(48, 54, 75, 0.55)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
            display: "grid",
            gap: 12,
            padding: 14,
          }}
        >
          <label style={{ alignItems: "center", color: "#f8fafc", display: "flex", fontWeight: 800, gap: 10 }}>
            <input
              checked={form.recurrence.enabled}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  recurrence: {
                    ...current.recurrence,
                    daysOfWeek: event.target.checked
                      ? [new Date(current.startsAt).getDay()]
                      : current.recurrence.daysOfWeek,
                    enabled: event.target.checked,
                  },
                }))
              }
              type="checkbox"
            />
            Repeat on a regular schedule
          </label>

          {form.recurrence.enabled ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = form.recurrence.daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            daysOfWeek: toggleDay(current.recurrence.daysOfWeek, day.value),
                          },
                        }))
                      }
                      style={{
                        background: active
                          ? "linear-gradient(145deg, #9cf579, #b8ff9e)"
                          : "rgba(60, 67, 91, 0.9)",
                        color: active ? "#171b2a" : "#c5cbe0",
                        minHeight: 36,
                        padding: "6px 12px",
                      }}
                      type="button"
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
                  Frequency
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrence: {
                          ...current.recurrence,
                          frequency: event.target.value as RecurrenceForm["frequency"],
                        },
                      }))
                    }
                    style={inputStyle}
                    value={form.recurrence.frequency}
                  >
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every 2 weeks</option>
                  </select>
                </label>
                <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
                  End schedule
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrence: {
                          ...current.recurrence,
                          endMode: event.target.value as RecurrenceForm["endMode"],
                        },
                      }))
                    }
                    style={inputStyle}
                    value={form.recurrence.endMode}
                  >
                    <option value="count">After a number of dates</option>
                    <option value="until">On a specific date</option>
                  </select>
                </label>
                {form.recurrence.endMode === "count" ? (
                  <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
                    Number of dates
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            occurrenceCount: Number.parseInt(event.target.value, 10),
                          },
                        }))
                      }
                      style={inputStyle}
                      value={form.recurrence.occurrenceCount}
                    >
                      {[4, 8, 12, 16, 26, 52].map((count) => (
                        <option key={count} value={count}>
                          {count} dates
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
                    End on
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recurrence: { ...current.recurrence, until: event.target.value },
                        }))
                      }
                      style={inputStyle}
                      type="date"
                      value={form.recurrence.until}
                    />
                  </label>
                )}
              </div>
            </>
          ) : null}
        </section>

        <label style={{ alignItems: "center", color: "#c5cbe0", display: "flex", gap: 8 }}>
          <input
            checked={form.isBlocking}
            onChange={(event) =>
              setForm((current) => ({ ...current, isBlocking: event.target.checked }))
            }
            type="checkbox"
          />
          Blocks confirmed catering time
        </label>

        <label style={{ color: "#c5cbe0", display: "grid", fontWeight: 700, gap: 6 }}>
          Internal notes
          <textarea
            aria-label="Manual event notes"
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Setup notes, parking instructions, contact on site…"
            style={{ ...inputStyle, minHeight: 90 }}
            value={form.notes}
          />
        </label>

        <button
          disabled={isLoading || !form.title.trim()}
          onClick={() => void createManualEvent()}
          type="button"
        >
          {form.recurrence.enabled ? "Create recurring schedule" : "Create event"}
        </button>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>{calendar ? `${statusLabel(calendar.view)} Events` : "Calendar Events"}</h2>
        {isLoading && !calendar ? (
          <section style={{ ...panelStyle }}>
            <p style={{ color: "#8f96ac", margin: 0 }}>Loading calendar events…</p>
          </section>
        ) : null}
        {!isLoading && (!calendar || calendar.events.length === 0) ? (
          <section style={{ ...panelStyle }}>
            <h3 style={{ marginTop: 0 }}>No events in this range</h3>
            <p style={{ color: "#8f96ac", marginBottom: 0 }}>
              Create a recurring operating location above, or reload if you just signed back in.
              Events are saved to your vendor account in the database.
            </p>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {calendar?.events.map((event) => (
            <article key={event.id} style={panelStyle}>
              <p
                style={{
                  color: event.type === "confirmed_catering" ? "#9cf579" : "#87ddf7",
                  fontWeight: 700,
                  margin: "0 0 4px",
                }}
              >
                {statusLabel(event.type)} · {statusLabel(event.status)}
              </p>
              <h3 style={{ margin: "0 0 6px" }}>{event.title}</h3>
              <p style={{ color: "#c5cbe0", margin: 0 }}>
                {formatDate(event.startsAt)} – {formatDate(event.endsAt)} ·{" "}
                {event.location ?? "No location"}
              </p>
              {event.warnings.length > 0 ? (
                <ul style={{ color: "#ff9d66" }}>
                  {event.warnings.map((warning) => (
                    <li key={`${event.id}-${warning.code}-${warning.eventIds.join("-")}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href={`/vendor/events/${event.id}`}>Open operations run sheet</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
