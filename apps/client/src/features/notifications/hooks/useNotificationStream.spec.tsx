import { act, renderHook, waitFor } from '@testing-library/react';

import { authClient } from '@/shared/lib/auth-client';
import { useNotificationStream } from './useNotificationStream';
import type { Notification } from '../api/notificationApi';

vi.mock('@/shared/lib/auth-client', () => ({
  authClient: { token: vi.fn() },
}));

const mockToken = vi.mocked(authClient.token);
const originalEventSource = globalThis.EventSource;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const notification: Notification = {
  id: 'notification-1',
  categoryId: 'cat-food',
  categoryName: 'Food',
  threshold: 80,
  percentUsed: 86.5,
  amountLeft: 40,
  createdAt: '2026-07-03T10:00:00',
  readAt: null,
};

describe('useNotificationStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
  });

  afterAll(() => {
    globalThis.EventSource = originalEventSource;
  });

  it('opens an authenticated stream, forwards notification events, and closes on unmount', async () => {
    mockToken.mockResolvedValue({ data: { token: 'abc 123' } } as never);
    const onNotification = vi.fn();

    const { unmount } = renderHook(() => useNotificationStream(onNotification));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0].url).toBe(
      '/api/notifications/stream?access_token=abc%20123'
    );

    act(() => FakeEventSource.instances[0].emit('notification', notification));

    expect(onNotification).toHaveBeenCalledWith(notification);

    unmount();

    expect(FakeEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });
});
