import { useEffect, useRef } from 'react';

import { authClient } from '@/shared/lib/auth-client';
import type { Notification } from '../api/notificationApi';

const RECONNECT_DELAY_MS = 3000;

export function useNotificationStream(onNotification: (n: Notification) => void) {
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (cancelled) return;

      const { data } = await authClient.token();
      const token = data?.token;
      if (!token || cancelled) return;

      // EventSource cannot set Authorization headers; backend accepts ?access_token=
      eventSource = new EventSource(`/api/notifications/stream?access_token=${token}`);

      eventSource.addEventListener('notification', (e) => {
        try {
          const notification = JSON.parse(e.data) as Notification;
          onNotificationRef.current(notification);
        } catch {
          // ignore malformed events
        }
      });

      eventSource.onerror = () => {
        // Close so EventSource stops its own reconnect loop (which reuses the
        // stale token). Re-fetch a fresh token and reconnect manually.
        eventSource?.close();
        eventSource = null;
        if (!cancelled) {
          reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
        }
      };
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, []);
}
