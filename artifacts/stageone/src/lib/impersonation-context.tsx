import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

export interface ImpersonatedUser {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

export interface ImpersonationState {
  active: boolean;
  token: string | null;
  targetUser: ImpersonatedUser | null;
  expiresAt: number | null;
  reason: string;
}

interface ImpersonationContextType {
  impersonation: ImpersonationState;
  startImpersonation: (targetUserId: string, reason?: string) => Promise<{ error?: string }>;
  stopImpersonation: () => Promise<void>;
  getToken: () => string | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

const INITIAL_STATE: ImpersonationState = {
  active: false,
  token: null,
  targetUser: null,
  expiresAt: null,
  reason: "",
};

// Module-level token reference for use inside api.ts fetch interceptor
let _activeImpersonationToken: string | null = null;
export function getActiveImpersonationToken(): string | null {
  return _activeImpersonationToken;
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonationState>(INITIAL_STATE);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  // Auto-expire impersonation when token expires
  const scheduleExpiry = useCallback((expiresAt: number) => {
    clearExpiryTimer();
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      setImpersonation(INITIAL_STATE);
      _activeImpersonationToken = null;
      return;
    }
    expiryTimerRef.current = setTimeout(() => {
      setImpersonation(INITIAL_STATE);
      _activeImpersonationToken = null;
    }, remaining);
  }, []);

  useEffect(() => () => clearExpiryTimer(), []);

  const startImpersonation = useCallback(async (targetUserId: string, reason = ""): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? "Failed to start impersonation" };

      const { token, expiresAt, targetUser } = data as {
        token: string;
        expiresAt: number;
        targetUser: ImpersonatedUser;
      };

      _activeImpersonationToken = token;
      setImpersonation({ active: true, token, targetUser, expiresAt, reason });
      scheduleExpiry(expiresAt);
      return {};
    } catch (err) {
      return { error: (err as Error).message ?? "Network error" };
    }
  }, [scheduleExpiry]);

  const stopImpersonation = useCallback(async () => {
    const targetUserId = impersonation.targetUser?.id;
    clearExpiryTimer();
    _activeImpersonationToken = null;
    setImpersonation(INITIAL_STATE);

    if (targetUserId) {
      await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId }),
      }).catch(() => {});
    }
  }, [impersonation.targetUser?.id]);

  const getToken = useCallback(() => _activeImpersonationToken, []);

  return (
    <ImpersonationContext.Provider value={{ impersonation, startImpersonation, stopImpersonation, getToken }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
