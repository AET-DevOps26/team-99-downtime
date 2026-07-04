# Notification Service

**Responsibility:**
Stores and delivers in-app notifications, and pushes real-time updates to connected clients via Server-Sent Events (SSE).

**Flow:**
Budget service (or other callers) create a notification → stored in DB → client subscribes to SSE stream → notifications pushed in real time → client marks notifications as read.

**Features:**

- Create and persist notifications
- List unread notifications per user
- Mark notifications as read
- Real-time SSE stream for live delivery

## API

| Method | Endpoint                       | Purpose                                          |
| ------ | ------------------------------ | ------------------------------------------------ |
| POST   | `/api/notifications`           | Create a notification (called by other services) |
| GET    | `/api/notifications`           | List notifications for the authenticated user    |
| PATCH  | `/api/notifications/{id}/read` | Mark a notification as read                      |
| GET    | `/api/notifications/stream`    | SSE stream — push notifications in real time     |
