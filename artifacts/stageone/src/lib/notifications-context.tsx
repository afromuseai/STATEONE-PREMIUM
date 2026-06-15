import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  read: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    refresh();

    // Polling fallback: re-fetch every 30s so broadcasts/messages appear even
    // if the SSE connection isn't active (proxy timeouts, reconnects, etc.)
    const poll = setInterval(refresh, 30_000);

    const es = new EventSource("/api/notifications/stream", { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.connected) return;

        const n: AppNotification = data.notification;
        if (!n) return;

        setNotifications((prev) => [n, ...prev.slice(0, 49)]);
        setUnreadCount((prev) => prev + 1);

        const toastFn =
          n.severity === "error"
            ? toast.error
            : n.severity === "warning"
            ? toast.warning
            : n.severity === "success"
            ? toast.success
            : toast.info;

        toastFn(n.title, { description: n.message, duration: 5000 });
      } catch {}
    };

    es.onerror = () => {
      // Don't close — browser will auto-reconnect EventSource
    };

    return () => {
      clearInterval(poll);
      es.close();
      esRef.current = null;
    };
  }, [user, refresh]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((prev) => Math.max(0, prev - 1));
  }, [notifications]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, dismiss, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
