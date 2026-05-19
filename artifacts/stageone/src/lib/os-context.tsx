import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OSModule {
  id: string;
  name: string;
  status: "active" | "ready" | "idle";
  activityCount: number;
  lastActivity: string | null;
  health: number;
  path: string;
  detail: string;
}

export interface PriorityTask {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  category: "execution" | "revenue" | "conversion" | "automation" | "cosmetic";
  title: string;
  description: string;
  targetModule: string;
  estimatedImpact: string;
  actionPath: string;
}

export interface OptimizationOpportunity {
  id: string;
  inefficiency: string;
  suggestion: string;
  targetModule: string;
  impactScore: number;
  actionPath: string;
}

export interface ActivityItem {
  id: string;
  module: string;
  action: string;
  timestamp: string;
  impact: string;
  icon: string;
}

export interface OSStats {
  projects: number;
  websitesGenerated: number;
  agentsInstalled: number;
  activeAgents: number;
  memoryEntries: number;
  executions: number;
  deployments: number;
}

export interface OSState {
  coordinationScore: number;
  systemHealth: number;
  activeModules: number;
  totalModules: number;
  industry: string | null;
  modules: OSModule[];
  priorityQueue: PriorityTask[];
  optimizations: OptimizationOpportunity[];
  recentActivity: ActivityItem[];
  stats: OSStats;
  lastUpdated: string | null;
}

interface OSContextType {
  state: OSState | null;
  isLoading: boolean;
  isOptimizing: boolean;
  optimizationReport: string;
  refresh: () => Promise<void>;
  syncEvent: (module: string, event: string, details?: string) => Promise<void>;
  triggerOptimization: () => void;
  stopOptimization: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultState: OSState = {
  coordinationScore: 0,
  systemHealth: 0,
  activeModules: 0,
  totalModules: 6,
  industry: null,
  modules: [],
  priorityQueue: [],
  optimizations: [],
  recentActivity: [],
  stats: {
    projects: 0,
    websitesGenerated: 0,
    agentsInstalled: 0,
    activeAgents: 0,
    memoryEntries: 0,
    executions: 0,
    deployments: 0,
  },
  lastUpdated: null,
};

const OSContext = createContext<OSContextType>({
  state: null,
  isLoading: false,
  isOptimizing: false,
  optimizationReport: "",
  refresh: async () => {},
  syncEvent: async () => {},
  triggerOptimization: () => {},
  stopOptimization: () => {},
});

// ─── Provider ──────────────────────────────────────────────────────────────────

export function OSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OSState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationReport, setOptimizationReport] = useState("");
  const optimizeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/os/state", { credentials: "include" });
      if (!res.ok) return;
      const data: OSState = await res.json();
      setState(data);
    } catch { /* non-fatal */ }
  }, [user]);

  // Poll every 60 seconds
  useEffect(() => {
    if (!user) {
      setState(null);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));

    pollRef.current = setInterval(refresh, 60_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, refresh]);

  const syncEvent = useCallback(async (module: string, event: string, details?: string) => {
    if (!user) return;
    try {
      await fetch("/api/os/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, event, details }),
      });
      // Refresh state after a sync
      await refresh();
    } catch { /* non-fatal */ }
  }, [user, refresh]);

  const triggerOptimization = useCallback(() => {
    if (!user || isOptimizing) return;
    setIsOptimizing(true);
    setOptimizationReport("");

    const run = async () => {
      try {
        const res = await fetch("/api/os/optimize", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemState: state }),
        });

        if (!res.ok || !res.body) {
          setIsOptimizing(false);
          return;
        }

        const reader = res.body.getReader();
        optimizeReaderRef.current = reader;
        const decoder = new TextDecoder();
        let carry = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = carry + decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          carry = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setOptimizationReport(prev => prev + parsed.content);
              }
              if (parsed.phase === "done" || parsed.phase === "error") {
                setIsOptimizing(false);
              }
            } catch { /* fragment */ }
          }
        }
      } catch {
        setIsOptimizing(false);
      } finally {
        optimizeReaderRef.current = null;
        setIsOptimizing(false);
        await refresh();
      }
    };

    run();
  }, [user, isOptimizing, state, refresh]);

  const stopOptimization = useCallback(() => {
    optimizeReaderRef.current?.cancel();
    setIsOptimizing(false);
  }, []);

  return (
    <OSContext.Provider value={{
      state,
      isLoading,
      isOptimizing,
      optimizationReport,
      refresh,
      syncEvent,
      triggerOptimization,
      stopOptimization,
    }}>
      {children}
    </OSContext.Provider>
  );
}

export function useOS() {
  return useContext(OSContext);
}
