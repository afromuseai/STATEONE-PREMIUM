import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, X, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/notifications-context";
import { cn } from "@/lib/utils";

function severityIcon(severity: AppNotification["severity"]) {
  switch (severity) {
    case "success": return <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />;
    case "error": return <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />;
    default: return <Info className="h-4 w-4 text-blue-400 shrink-0" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
          open
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground/60">
                    Agent completions and alerts will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
                        !n.read && "bg-primary/5",
                      )}
                    >
                      <div className="mt-0.5">{severityIcon(n.severity)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm leading-tight", !n.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {!n.read && (
                              <button
                                onClick={() => markRead(n.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-primary"
                                title="Mark read"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => dismiss(n.id)}
                              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/50">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
