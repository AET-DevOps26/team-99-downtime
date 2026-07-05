import { apiClient } from '@/shared/api/client';
import type { components } from '@/shared/api/generated/notification-service';
import { unwrap } from '@/shared/lib/api';

/**
 * api: thin wrappers over the notification-service endpoints, built on the
 * shared typed apiClient — URL, method, params and body of every call are
 * compile-checked against openapi/notification-service.json (regenerate with
 * `bun run openapi`). No React, no UI here.
 */

// Responses always carry every field; springdoc types them optional (no
// @NonNull on the record), so re-require them. readAt is genuinely nullable —
// the server sends null until the notification is read — which the generated
// type can't express, so it is re-declared here.
export type Notification = Omit<
  Required<components['schemas']['NotificationResponse']>,
  'readAt'
> & { readAt: string | null };

export async function listNotifications(): Promise<Notification[]> {
  return unwrap(await apiClient.GET('/api/notifications')) as Notification[];
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return unwrap(
    await apiClient.PATCH('/api/notifications/{id}/read', { params: { path: { id } } })
  ) as Notification;
}
