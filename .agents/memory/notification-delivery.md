---
name: Notification delivery pipeline
description: Broadcasts and messages must SSE-push after DB insert; context needs polling fallback
---

## Rule
Any code that bulk-inserts into `notificationsTable` must also call `pushNotificationToUser(userId, row)` for each inserted row. The notification context needs a polling interval as a belt-and-suspenders fallback.

**Why:** `emitNotification()` in `notifications.ts` does both DB insert + SSE push atomically. But `fanOutBroadcast` and the message-center POST both did raw `db.insert()` directly, bypassing SSE entirely. Users with open sessions never saw broadcasts or messages in the bell — the DB had them but no live push happened.

The notifications context only refreshed on mount. With no polling, messages only appeared after a full page reload.

**How to apply:**
1. After any bulk insert into `notificationsTable`, iterate the `.returning()` rows and call `pushNotificationToUser(n.userId, n)` (exported from `notifications.ts`).
2. The `NotificationsProvider` should `setInterval(refresh, 30_000)` while a user is logged in so the bell catches anything missed by SSE (proxy timeouts, reconnects).
3. Don't close the `EventSource` on error — browser auto-reconnects.
