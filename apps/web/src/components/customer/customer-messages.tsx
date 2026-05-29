"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { CustomerWorkspaceShell } from "@/components/customer/customer-workspace-shell";
import { useCustomerAuthSession } from "@/lib/auth-session";
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

  return null;
}

export function CustomerMessages() {
  const session = useCustomerAuthSession();
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
      setError(caughtError instanceof Error ? caughtError.message : "Messages failed to load.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session.accessToken.trim()) return;
    void loadNotificationCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.accessToken, unreadOnly]);

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
    <CustomerWorkspaceShell
      description="Quotes, agreements, payments, and vendor updates appear here as your event moves forward."
      title="Messages"
    >
      {!session.user ? (
        <AuthSessionPanel requireCustomer session={session} title="Customer account" />
      ) : (
        <>
          <section
            style={{
              alignItems: "center",
              background: "rgba(37, 41, 58, 0.92)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
              marginBottom: 16,
              padding: 16,
            }}
          >
            <p style={{ color: "#c5cbe0", margin: 0 }}>
              <strong style={{ color: "#f8fafc" }}>{center.unreadCount}</strong> unread
            </p>
            <label style={{ alignItems: "center", color: "#c5cbe0", display: "flex", gap: 8 }}>
              <input
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
                type="checkbox"
              />
              Unread only
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button disabled={isLoading} onClick={() => void loadNotificationCenter()} type="button">
                {isLoading ? "Loading..." : "Refresh"}
              </button>
              <button disabled={center.unreadCount === 0} onClick={() => void markAllRead()} type="button">
                Mark all read
              </button>
            </div>
          </section>

          {error ? (
            <section
              style={{
                background: "rgba(255, 120, 120, 0.12)",
                border: "1px solid rgba(255, 120, 120, 0.35)",
                borderRadius: 18,
                marginBottom: 16,
                padding: 16,
              }}
            >
              <p style={{ color: "#ffb4b4", margin: 0 }}>{error}</p>
            </section>
          ) : null}

          <div style={{ display: "grid", gap: 12 }}>
            {center.notifications.map((notification) => {
              const href = entityLink(notification);
              return (
                <article
                  key={notification.id}
                  style={{
                    background: notification.readAt
                      ? "rgba(37, 41, 58, 0.72)"
                      : "rgba(255, 230, 109, 0.12)",
                    border: notification.readAt
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(255, 230, 109, 0.35)",
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <p style={{ color: "#8f96ac", margin: "0 0 8px" }}>
                    {typeLabel(notification.type)} · {formatDate(notification.createdAt)}
                  </p>
                  <h3 style={{ color: "#f8fafc", margin: "0 0 8px" }}>{notification.title}</h3>
                  <p style={{ color: "#c5cbe0", lineHeight: 1.5, margin: "0 0 12px" }}>
                    {notification.body}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {href ? (
                      <Link href={href} style={{ color: "#87ddf7", fontWeight: 700 }}>
                        Open related item →
                      </Link>
                    ) : null}
                    {!notification.readAt ? (
                      <button onClick={() => void markRead(notification.id)} type="button">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {center.notifications.length === 0 && !isLoading ? (
              <p style={{ color: "#c5cbe0", margin: 0 }}>
                No messages yet. Updates from your RFQs and quotes will appear here.
              </p>
            ) : null}
          </div>

          {groupedPreferences.length > 0 ? (
            <section style={{ display: "grid", gap: 12, marginTop: 28 }}>
              <h2 style={{ color: "#f8fafc", fontSize: 20, margin: 0 }}>Notification preferences</h2>
              {groupedPreferences.map(([notificationType, rows]) => (
                <article
                  key={notificationType}
                  style={{
                    background: "rgba(37, 41, 58, 0.92)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <h3 style={{ color: "#f8fafc", marginTop: 0 }}>{typeLabel(notificationType)}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {rows.map((preference) => (
                      <label
                        key={`${preference.notificationType}-${preference.channel}`}
                        style={{ alignItems: "center", color: "#c5cbe0", display: "flex", gap: 8 }}
                      >
                        <input
                          checked={preference.isEnabled}
                          disabled={preference.required}
                          onChange={() => void togglePreference(preference)}
                          type="checkbox"
                        />
                        {preference.channel === "in_app" ? "In-app" : "Email"}
                        {preference.required ? " (required)" : ""}
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </>
      )}
    </CustomerWorkspaceShell>
  );
}
