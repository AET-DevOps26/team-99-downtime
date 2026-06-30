import { BellIcon, CheckIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationStream } from '../hooks/useNotificationStream';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, append } = useNotifications();

  useNotificationStream(append);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn('flex flex-col items-start gap-0.5 py-2', !n.readAt && 'bg-accent/50')}
              onSelect={() => {
                if (!n.readAt) void markAsRead(n.id);
              }}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">
                  {n.threshold}% of {n.categoryName} reached
                </span>
                {!n.readAt && <CheckIcon className="size-3 text-muted-foreground" />}
              </div>
              <span className="text-xs text-muted-foreground">
                {n.percentUsed.toFixed(1)}% used · {euro.format(n.amountLeft)} left
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
