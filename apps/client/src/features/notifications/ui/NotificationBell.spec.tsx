import { fireEvent, render, screen } from '@testing-library/react';

import { NotificationBell } from './NotificationBell';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationStream } from '../hooks/useNotificationStream';
import type { Notification } from '../api/notificationApi';

vi.mock('../hooks/useNotifications', () => ({ useNotifications: vi.fn() }));
vi.mock('../hooks/useNotificationStream', () => ({ useNotificationStream: vi.fn() }));
vi.mock('@/shared/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button type="button" onClick={() => onSelect?.(new Event('select'))}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

const mockUseNotifications = vi.mocked(useNotifications);
const mockUseNotificationStream = vi.mocked(useNotificationStream);

const unread: Notification = {
  id: 'notification-1',
  categoryId: 'cat-food',
  categoryName: 'Food',
  threshold: 80,
  percentUsed: 86.5,
  amountLeft: 40,
  readAt: null,
  createdAt: '2026-07-03T10:00:00',
};

const read: Notification = {
  ...unread,
  id: 'notification-2',
  categoryName: 'Rent',
  threshold: 90,
  percentUsed: 91,
  amountLeft: 120,
  readAt: '2026-07-03T11:00:00',
};

function arrange(notifications: Notification[] = [unread, read]) {
  const append = vi.fn();
  const markAsRead = vi.fn();
  mockUseNotifications.mockReturnValue({
    notifications,
    loading: false,
    unreadCount: notifications.filter((n) => n.readAt === null).length,
    markAsRead,
    append,
  });

  render(<NotificationBell />);
  return { append, markAsRead };
}

describe('NotificationBell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('connects the stream and marks unread notifications as read from the menu', () => {
    const { append, markAsRead } = arrange();

    expect(mockUseNotificationStream).toHaveBeenCalledWith(append);
    expect(screen.getByText('1')).toBeTruthy();

    fireEvent.click(screen.getByText('80% of Food reached'));

    expect(screen.getByText('86.5% used · 40,00 € left')).toBeTruthy();
    expect(markAsRead).toHaveBeenCalledWith('notification-1');
  });

  it('shows an empty notification menu without a badge', () => {
    arrange([]);

    expect(screen.queryByText('1')).toBeNull();

    expect(screen.getByText('No notifications')).toBeTruthy();
  });
});
