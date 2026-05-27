"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import { rfqApiRequest, statusLabel, type CalendarView } from "@/lib/rfq-api";

import { formatDate } from "../rfq-shared";

type ManualEventForm = {
  endsAt: string;
  isBlocking: boolean;
  location: string;
  notes: string;
  startsAt: string;
  title: string;
  type: "blocked_time" | "festival" | "food_truck_location" | "manual_booking";
};

const calendarViews = ["month", "week", "day", "agenda", "timeline"] as const;

function datetimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function isoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function defaultForm(): ManualEventForm {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 7);
  startsAt.setHours(10, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(14, 0, 0, 0);

  return {
    endsAt: datetimeLocalValue(endsAt),
    isBlocking: true,
    location: "",
    notes: "",
    startsAt: datetimeLocalValue(startsAt),
    title: "",
    type: "manual_booking",
  };
}

export default function VendorCalendarPage() {
  const session = useAuthSession();
  const [view, setView] = useState<(typeof calendarViews)[number]>("agenda");
  const [calendar, setCalendar] = useState<CalendarView | null>(null);
  const [form, setForm] = useState<ManualEventForm>(() => defaultForm());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const range = useMemo(() => {
    const startsFrom = new Date();
    startsFrom.setDate(startsFrom.getDate() - 7);
    startsFrom.setHours(0, 0, 0, 0);
    const startsTo = new Date(startsFrom);
    startsTo.setDate(startsTo.getDate() + (view === "month" ? 45 : 21));
    return { startsFrom, startsTo };
  }, [view]);

  async function loadCalendar() {
    setError(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor to load calendar events.");
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
  }

  async function createManualEvent() {
    setError(null);

    if (!session.accessToken.trim() || !session.activeVendorId.trim()) {
      setError("Log in as a vendor and choose an active vendor before creating events.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await rfqApiRequest<{ event: CalendarView["events"][number] }>({
        apiBaseUrl: session.apiBaseUrl,
        body: {
          endsAt: isoFromLocalInput(form.endsAt),
          isBlocking: form.isBlocking,
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
          startsAt: isoFromLocalInput(form.startsAt),
          title: form.title,
          type: form.type,
        },
        method: "POST",
        path: `/api/v1/vendors/${encodeURIComponent(session.activeVendorId.trim())}/calendar-events`,
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(
          `Create event failed with ${result.status}: ${JSON.stringify(result.body)}`,
        );
      }

      setForm(defaultForm());
      await loadCalendar();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Create event failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1120 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/vendor/dashboard">Back to vendor dashboard</Link>
        <h1>Vendor Calendar</h1>
        <p>
          View confirmed catering, manual bookings, festivals, public truck locations, and blocked
          time with conflict and setup/travel buffer warnings.
        </p>
      </header>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 18,
          display: "grid",
          gap: 12,
          padding: 18,
        }}
      >
        <AuthSessionPanel requireVendor session={session} title="Vendor Account" />
        <label style={{ display: "grid", gap: 6 }}>
          Calendar view
          <select onChange={(event) => setView(event.target.value as typeof view)} value={view}>
            {calendarViews.map((candidate) => (
              <option key={candidate} value={candidate}>
                {statusLabel(candidate)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={isLoading} onClick={() => void loadCalendar()} type="button">
          {isLoading ? "Loading..." : "Load calendar"}
        </button>
      </section>

      {error ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, marginTop: 18, padding: 16 }}>
          {error}
        </section>
      ) : null}

      <section style={{ background: "#fff4df", borderRadius: 18, marginTop: 24, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Create Manual Event</h2>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <input
            aria-label="Manual event title"
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Event title"
            value={form.title}
          />
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
            value={form.type}
          >
            <option value="manual_booking">Manual booking</option>
            <option value="blocked_time">Blocked time</option>
            <option value="festival">Festival</option>
            <option value="food_truck_location">Food truck operating location</option>
          </select>
          <input
            aria-label="Manual event starts at"
            onChange={(event) =>
              setForm((current) => ({ ...current, startsAt: event.target.value }))
            }
            type="datetime-local"
            value={form.startsAt}
          />
          <input
            aria-label="Manual event ends at"
            onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
            type="datetime-local"
            value={form.endsAt}
          />
          <input
            aria-label="Manual event location"
            onChange={(event) =>
              setForm((current) => ({ ...current, location: event.target.value }))
            }
            placeholder="Location"
            value={form.location}
          />
          <label>
            <input
              checked={form.isBlocking}
              onChange={(event) =>
                setForm((current) => ({ ...current, isBlocking: event.target.checked }))
              }
              type="checkbox"
            />{" "}
            Blocks confirmed catering time
          </label>
        </div>
        <textarea
          aria-label="Manual event notes"
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Internal notes"
          style={{ marginTop: 10, minHeight: 90, width: "100%" }}
          value={form.notes}
        />
        <button
          disabled={isLoading || !form.title.trim()}
          onClick={() => void createManualEvent()}
          type="button"
        >
          Create event
        </button>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>{calendar ? `${statusLabel(calendar.view)} Events` : "Calendar Events"}</h2>
        {!calendar || calendar.events.length === 0 ? (
          <section style={{ border: "1px dashed #bbb", borderRadius: 16, padding: 18 }}>
            <h3>No events loaded</h3>
            <p>Load the calendar or create manual blocked time, festivals, or truck locations.</p>
          </section>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {calendar?.events.map((event) => (
            <article
              key={event.id}
              style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}
            >
              <p
                style={{
                  color: event.type === "confirmed_catering" ? "#0f766e" : "#8a4b00",
                  fontWeight: 700,
                  margin: "0 0 4px",
                }}
              >
                {statusLabel(event.type)} · {statusLabel(event.status)}
              </p>
              <h3 style={{ margin: "0 0 6px" }}>{event.title}</h3>
              <p style={{ margin: 0 }}>
                {formatDate(event.startsAt)} - {formatDate(event.endsAt)} ·{" "}
                {event.location ?? "No location"}
              </p>
              {event.warnings.length > 0 ? (
                <ul style={{ color: "#9a3412" }}>
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
