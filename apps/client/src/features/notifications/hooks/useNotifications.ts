import { useCallback, useEffect, useState } from 'react';

import { listNotifications, markNotificationRead, type Notification } from '../api/notificationApi';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotifications();
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const incoming = data.filter((n) => !existingIds.has(n.id));
        const merged = [...incoming, ...prev];
        return merged.sort((a, b) => {
          if ((a.readAt === null) !== (b.readAt === null)) return a.readAt === null ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
    } catch {
      // non-critical: silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const append = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const updated = await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch {
      // silently fail
    }
  }, []);

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return { notifications, loading, unreadCount, markAsRead, append };
}
