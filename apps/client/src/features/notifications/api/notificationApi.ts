import { apiFetch } from '@/shared/lib/api';

export interface Notification {
  id: string;
  categoryId: string;
  categoryName: string;
  threshold: number;
  percentUsed: number;
  amountLeft: number;
  createdAt: string;
  readAt: string | null;
}

const BASE = '/api/notifications';

export function listNotifications() {
  return apiFetch<Notification[]>(BASE);
}

export function markNotificationRead(id: string) {
  return apiFetch<Notification>(`${BASE}/${id}/read`, { method: 'PATCH' });
}
