"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  notificationApiRequest,
  type NotificationCenterResponse,
  type NotificationItem,
  type NotificationPreference,
} from "@/lib/notification-api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function typeLabel(value: string): string {
  return value
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function entityLink(notification: NotificationItem): string | null {
  if (!notification.entityId || !notification.entityType) {
    return null;
  }

  if (notification.entityType === "rfq") {
    return `/customer/rfqs/${notification.entityId}`;
  }

  if (notification.entityType === "quote") {
    return `/customer/quotes/${notification.entityId}`;
  }

  if (notification.entityType === "agreement") {
    return `/customer/agreements/${notification.entityId}`;
  }

  if (notification.entityType === "calendar_event") {
    return `/vendor/events/${notification.entityId}`;
  }

  return null;
}

export function NotificationCenter() {
  const session = useAuthSession();
  const [center, setCenter] = useState<NotificationCenterResponse>({
    notifications: [],
    unreadCount: 0,
  });
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function loadNotificationCenter() {
    setError(null);

    if (!session.accessToken.trim()) {
      setError("Log in or choose a saved user to load notifications.");
      return;
    }

    setIsLoading(true);

    try {
      const [notificationResult, preferenceResult] = await Promise.all([
        notificationApiRequest<NotificationCenterResponse>({
          apiBaseUrl: session.apiBaseUrl,
          path: `/api/v1/notifications?limit=50${unreadOnly ? "&unreadOnly=true" : ""}`,
          token: session.accessToken,
        }),
        notificationApiRequest<NotificationPreference[]>({
          apiBaseUrl: session.apiBaseUrl,
          path: "/api/v1/notification-preferences",
          token: session.accessToken,
        }),
      ]);

      if (!notificationResult.ok || !notificationResult.data) {
        throw new Error(
          `Notification load failed with ${notificationResult.status}: ${JSON.stringify(
            notificationResult.body,
          )}`,
        );
      }

      if (!preferenceResult.ok || !preferenceResult.data) {
        throw new Error(
          `Preference load failed with ${preferenceResult.status}: ${JSON.stringify(
            preferenceResult.body,
          )}`,
        );
      }

      setCenter(notificationResult.data);
      setPreferences(preferenceResult.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Notification center failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function markRead(notificationId: string) {
    const result = await notificationApiRequest<NotificationCenterResponse>({
      apiBaseUrl: session.apiBaseUrl,
      body: {},
      path: `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      token: session.accessToken,
    });

    if (result.ok && result.data) {
      setCenter(result.data);
    }
  }

  async function markAllRead() {
    const result = await notificationApiRequest<{ unreadCount: number; updatedCount: number }>({
      apiBaseUrl: session.apiBaseUrl,
      body: {},
      path: "/api/v1/notifications/read-all",
      token: session.accessToken,
    });

    if (result.ok) {
      await loadNotificationCenter();
    }
  }

  async function togglePreference(preference: NotificationPreference) {
    if (preference.required) {
      return;
    }

    const result = await notificationApiRequest<NotificationPreference[]>({
      apiBaseUrl: session.apiBaseUrl,
      body: {
        preferences: [
          {
            channel: preference.channel,
            isEnabled: !preference.isEnabled,
            notificationType: preference.notificationType,
          },
        ],
      },
      path: "/api/v1/notification-preferences",
      token: session.accessToken,
    });

    if (result.ok && result.data) {
      setPreferences(result.data);
    }
  }

  const groupedPreferences = useMemo(() => {
    const byType = new Map<string, NotificationPreference[]>();
    for (const preference of preferences) {
      byType.set(preference.notificationType, [
        ...(byType.get(preference.notificationType) ?? []),
        preference,
      ]);
    }
    return [...byType.entries()];
  }, [preferences]);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "40px auto", maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/">foodtruckzs</Link>
        <h1>Notification Center</h1>
        <p>
          Review workflow notifications, mark action items read, and tune email preferences. In-app
          transactional notifications stay enabled so booking and payment updates are not missed.
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
        <AuthSessionPanel session={session} title="Notification Account" />
        <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <input
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
            type="checkbox"
          />
          Show unread only
        </label>
        <button disabled={isLoading} onClick={loadNotificationCenter} style={{ padding: 10 }}>
          {isLoading ? "Loading..." : "Load notifications"}
        </button>
        {error ? <p style={{ color: "#b00020", margin: 0 }}>{error}</p> : null}
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <h2>Inbox</h2>
          <button disabled={center.unreadCount === 0} onClick={markAllRead} style={{ padding: 10 }}>
            Mark all read
          </button>
        </div>
        <p>{center.unreadCount} unread notifications</p>
        <div style={{ display: "grid", gap: 12 }}>
          {center.notifications.map((notification) => {
            const href = entityLink(notification);
            return (
              <article
                key={notification.id}
                style={{
                  background: notification.readAt ? "#fff" : "#fff8e6",
                  border: "1px solid #ddd",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <p style={{ color: "#666", margin: "0 0 8px" }}>
                  {typeLabel(notification.type)} · {formatDate(notification.createdAt)}
                </p>
                <h3 style={{ margin: "0 0 8px" }}>{notification.title}</h3>
                <p>{notification.body}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {href ? <Link href={href}>Open related item</Link> : null}
                  {!notification.readAt ? (
                    <button
                      onClick={() => markRead(notification.id)}
                      style={{ padding: "6px 10px" }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {center.notifications.length === 0 ? (
            <p>
              No notifications yet. Workflow events will appear here after the worker processes
              outbox events.
            </p>
          ) : null}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Preferences</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {groupedPreferences.map(([notificationType, rows]) => (
            <article
              key={notificationType}
              style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16 }}
            >
              <h3 style={{ marginTop: 0 }}>{typeLabel(notificationType)}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {rows.map((preference) => (
                  <label
                    key={`${preference.notificationType}-${preference.channel}`}
                    style={{ alignItems: "center", display: "flex", gap: 8 }}
                  >
                    <input
                      checked={preference.isEnabled}
                      disabled={preference.required}
                      onChange={() => togglePreference(preference)}
                      type="checkbox"
                    />
                    {preference.channel === "in_app" ? "In-app" : "Email"}
                    {preference.required ? " (required)" : ""}
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
