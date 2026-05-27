import { defaultRfqApiBaseUrl, rfqApiRequest } from "./rfq-api";

export const defaultNotificationApiBaseUrl = defaultRfqApiBaseUrl;
export const notificationTokenStorageKey = "foodtruckzs.notificationAccessToken";
export const notificationApiBaseStorageKey = "foodtruckzs.rfqApiBaseUrl";

export type NotificationItem = {
  body: string;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
  id: string;
  readAt: string | null;
  title: string;
  type: string;
};

export type NotificationCenterResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export type NotificationPreference = {
  channel: "email" | "in_app";
  isEnabled: boolean;
  notificationType: string;
  required: boolean;
};

export async function notificationApiRequest<T>(input: {
  apiBaseUrl: string;
  body?: unknown;
  path: string;
  token: string;
}) {
  return rfqApiRequest<T>({
    apiBaseUrl: input.apiBaseUrl,
    body: input.body,
    method: input.body ? "POST" : "GET",
    path: input.path,
    token: input.token,
  });
}
