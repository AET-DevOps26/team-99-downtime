import { useEffect } from 'react';

import { authClient } from '@/shared/lib/auth-client';
import type { Notification } from '../api/notificationApi';

export function useNotificationStream(onNotification: (n: Notification) => void) {
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let cancelled = false;

    async function connect() {
      const { data } = await authClient.token();
      const token = data?.token;
      if (!token || cancelled) return;

      // Standard EventSource cannot set Authorization headers; the backend's
      // DefaultBearerTokenResolver is configured to also accept ?access_token=
      eventSource = new EventSource(`/api/notifications/stream?access_token=${token}`);

      eventSource.addEventListener('notification', (e) => {
        try {
          const notification = JSON.parse(e.data) as Notification;
          onNotification(notification);
        } catch {
          // ignore malformed events
        }
      });

      eventSource.onerror = () => {
        // EventSource auto-reconnects on error — no manual retry needed
      };
    }

    void connect();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [onNotification]);
}
