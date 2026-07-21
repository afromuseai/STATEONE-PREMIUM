// ─── EngineeringRoadmapPanel — Engineering Roadmap Intelligence UI ────────────
// Phase 16.3
//
// Persistent prioritized backlog of engineering work across all phases.
// Plans the optimal sequence over time, tracking what's done, what's next,
// and the overall health of the roadmap.
//
// Displays completion percentage, current focus, items grouped by priority,
// dependency chains, recently completed items, and roadmap health.
//
// Architecture:
//   Engineering Roadmap Engine → SSE → EngineeringRoadmapPanel
//                                   → Live Roadmap Display
//                                   → Every edit cycle (persistent)

import { useEffect, useReducer, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map,
  Target,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Layers,
  Zap,
  Palette,
  Code,
  GitBranch,
  Search,
  Eye,
  AlertOctagon,
  Users,
  DollarSign,
  Brain,
  TrendingUp,
  List,
  Filter,
  BarChart3,
  Activity,
  Sparkles,
} from "lucide-react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";
import type { WSRoadmapUpdate, WSRoadmapItem } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoadmapPanelState {
  /** All roadmap items. */
  items: WSRoadmapItem[];
  /** High-level summary text. */
  summary: string;
  /** Percentage of items completed (0–100). */
  completionPercentage: number;
  /** Items currently being worked on. */
  currentFocus: WSRoadmapItem[];
  /** Recently completed items. */
  recentlyCompleted: WSRoadmapItem[];
  /** Overall roadmap health. */
  roadmapHealth: string;
  /** Whether the panel has received at least one update. */
  initialized: boolean;
}

type RoadmapAction =
  | { type: "UPDATE"; payload: WSRoadmapUpdate }
  | { type: "RESET" };

function roadmapReducer(state: RoadmapPanelState, action: RoadmapAction): RoadmapPanelState {
  switch (action.type) {
    case "UPDATE": {
      const p = action.payload;
      return {
        ...state,
        items: p.items,
        summary: `${p.summary.completed}/${p.summary.total} completed (${p.summary.todo} todo, ${p.summary.inProgress} in progress)`,
        completionPercentage: p.completionPercentage,
        currentFocus: p.currentFocus,
        recentlyCompleted: p.recentlyCompleted,
        roadmapHealth: p.roadmapHealth >= 70 ? "healthy" : p.roadmapHealth >= 40 ? "needs-attention" : "stale",
        initialized: true,
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: RoadmapPanelState = {
  items: [],
  summary: "",
  completionPercentage: 0,
  currentFocus: [],
  recentlyCompleted: [],
  roadmapHealth: "healthy",
  initialized: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(category: string): React.ElementType {
  switch (category) {
    case "architecture":       return Layers;
    case "performance":        return Zap;
    case "design":             return Palette;
    case "components":         return Code;
    case "routing":            return GitBranch;
    case "seo":                return Search;
    case "accessibility":      return Eye;
    case "technical-debt":     return AlertOctagon;
    case "developer-experience": return Users;
    case "business":           return DollarSign;
    default:                   return Brain;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "architecture":       return "text-purple-400";
    case "performance":        return "text-cyan-400";
    case "design":             return "text-pink-400";
    case "components":         return "text-emerald-400";
    case "routing":            return "text-orange-400";
    case "seo":                return "text-blue-400";
    case "accessibility":      return "text-amber-400";
    case "technical-debt":     return "text-red-400";
    case "developer-experience": return "text-indigo-400";
    case "business":           return "text-yellow-400";
    default:                   return "text-white/40";
  }
}

function getStatusIcon(status: string): React.ElementType {
  switch (status) {
    case "completed":  return CheckCircle;
    case "in-progress": return Activity;
    case "pending":    return Circle;
    default:           return Circle;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":   return "text-emerald-400";
    case "in-progress": return "text-cyan-400";
    case "pending":     return "text-white/30";
    default:            return "text-white/30";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "text-red-400";
    case "high":     return "text-amber-400";
    case "medium":   return "text-cyan-400";
    case "low":      return "text-white/40";
    default:         return "text-white/40";
  }
}

function getPriorityBorder(priority: string): string {
  switch (priority) {
    case "critical": return "border-l-red-400";
    case "high":     return "border-l-amber-400";
    case "medium":   return "border-l-cyan-400";
    case "low":      return "border-l-white/20";
    default:         return "border-l-white/20";
  }
}

function getHealthLabel(health: string): string {
  switch (health) {
    case "healthy":      return "Healthy";
    case "needs-attention": return "Needs Attention";
    case "stale":        return "Stale";
    default:             return "Unknown";
  }
}

function getHealthColor(health: string): string {
  switch (health) {
    case "healthy":         return "text-emerald-400";
    case "needs-attention": return "text-amber-400";
    case "stale":           return "text-red-400";
    default:                return "text-white/40";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Circular progress indicator */
function ProgressRing({ percentage, size = 64 }: { percentage: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const circumference = 2 * Math.PI * (size / 2 - 4);
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 70 ? "#34d399" : clamped >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={4}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{Math.round(clamped)}%</span>
    </div>
  );
}

/** Progress bar */
function ProgressBar({ value, color = "bg-emerald-400" }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

/** Single roadmap item row */
function RoadmapItemRow({ item, isDependency }: { item: WSRoadmapItem; isDependency?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getStatusIcon(item.status);
  const statusColor = getStatusColor(item.status);
  const CatIcon = getCategoryIcon(item.category);
  const catColor = getCategoryColor(item.category);
  const priorityColor = getPriorityColor(item.priority);

  return (
    <div className={`rounded-lg border border-white/5 bg-white/[0.02] pl-3 pr-2 py-2 border-l-2 ${getPriorityBorder(item.priority)} ${isDependency ? "opacity-70" : ""}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="mt-0.5">
          <Icon className={`h-3.5 w-3.5 ${statusColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <CatIcon className={`h-3 w-3 ${catColor}`} />
            <span className="text-[11px] font-medium text-white/80">{item.title}</span>
            <span className={`text-[9px] font-medium uppercase ${priorityColor}`}>
              {item.priority}
            </span>
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed line-clamp-1">{item.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] text-white/30">
              Impact: <span className="text-emerald-400">{item.impact}</span>
            </span>
            <span className="text-[9px] text-white/30">
              Effort: <span className="text-amber-400">{item.effort}</span>
            </span>
            <span className="text-[9px] text-white/30">
              Confidence: <span className="text-cyan-400">{item.confidence}%</span>
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="mt-1 h-3 w-3 shrink-0 text-white/30" /> : <ChevronDown className="mt-1 h-3 w-3 shrink-0 text-white/30" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2 overflow-hidden border-t border-white/5 pt-2"
          >
            {item.dependencies.length > 0 && (
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">Dependencies</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.dependencies.map((depId, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
                      <ArrowRight className="h-2 w-2 text-amber-400" />
                      {depId}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-[9px] text-white/30">
              <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
              {item.updatedAt && <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>}
              {item.completedAt && <span>Completed: {new Date(item.completedAt).toLocaleDateString()}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Category filter bar */
function CategoryFilter({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string | null;
  onChange: (cat: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
          active === null
            ? "bg-white/10 text-white/80"
            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(active === cat ? null : cat)}
          className={`rounded-full px-2 py-0.5 text-[9px] font-medium capitalize transition-colors ${
            active === cat
              ? "bg-white/10 text-white/80"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
        >
          {cat.replace(/-/g, " ")}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EngineeringRoadmapPanel({
  externalState,
  compact: compactProp,
}: {
  externalState?: RoadmapPanelState | null;
  compact?: boolean;
}) {
  const [state, dispatch] = useReducer(roadmapReducer, initialState);
  const [compactInternal, setCompact] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Subscribe to wsRuntimeEmitter only when not using external state
  useEffect(() => {
    if (externalState) return;

    const handler = (event: WSRuntimeEvent) => {
      if (event.type === "RoadmapUpdate") {
        const payload = event.payload as unknown as WSRoadmapUpdate;
        dispatch({ type: "UPDATE", payload });
      }
    };

    const unsubscribe = wsRuntimeEmitter.subscribe(handler);
    return () => unsubscribe();
  }, [externalState]);

  // Use external state if provided, otherwise internal state
  const displayState = externalState ?? state;
  const compact = compactProp ?? compactInternal;

  // Derive unique categories from items
  const categories = useMemo(() => {
    const cats = new Set(displayState.items.map((i) => i.category));
    return Array.from(cats).sort();
  }, [displayState.items]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = displayState.items;

    // Category filter
    if (categoryFilter) {
      items = items.filter((i) => i.category === categoryFilter);
    }

    // Completed filter
    if (!showCompleted) {
      items = items.filter((i) => i.status !== "completed");
    }

    return items;
  }, [displayState.items, categoryFilter, showCompleted]);
  // Group by priority
  const groupedByPriority = useMemo(() => {
    const groups: Record<string, WSRoadmapItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const item of filteredItems) {
      if (groups[item.priority]) {
        groups[item.priority].push(item);
      } else {
        groups.low.push(item);
      }
    }
    return groups;
  }, [filteredItems]);

  const priorityOrder = ["critical", "high", "medium", "low"] as const;

  if (!displayState.initialized && !externalState) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Map className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-2 text-xs text-white/30">Awaiting roadmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white/80">Roadmap</span>
          <span className={`text-[9px] font-medium uppercase ${getHealthColor(displayState.roadmapHealth)}`}>
            {getHealthLabel(displayState.roadmapHealth)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompact(!compact)}
            className={`rounded p-1 transition-colors ${
              compact ? "bg-white/10 text-white/60" : "text-white/30 hover:bg-white/5 hover:text-white/50"
            }`}
            title={compact ? "Detailed view" : "Compact view"}
          >
            <List className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-white/40">{displayState.items.length} items</span>
        </div>
      </div>

      {compact ? (
        /* ── Compact view ── */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-3">
            <ProgressRing percentage={displayState.completionPercentage} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white/70 truncate">{displayState.summary}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  <Activity className="h-2.5 w-2.5 text-cyan-400" />
                  {displayState.currentFocus.length} active
                </span>
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                  {displayState.items.filter((i) => i.status === "completed").length} done
                </span>
              </div>
            </div>
          </div>
          <ProgressBar value={displayState.completionPercentage} />
        </div>
      ) : (
        /* ── Detailed view ── */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Progress summary */}
          <div className="flex items-center gap-3">
            <ProgressRing percentage={displayState.completionPercentage} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white/70 truncate">{displayState.summary}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  <Activity className="h-2.5 w-2.5 text-cyan-400" />
                  {displayState.currentFocus.length} active
                </span>
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                  {displayState.items.filter((i) => i.status === "completed").length} done
                </span>
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  <Clock className="h-2.5 w-2.5 text-white/30" />
                  {displayState.items.filter((i) => i.status === "pending").length} pending
                </span>
              </div>
              <ProgressBar value={displayState.completionPercentage} />
            </div>
          </div>

          {/* Current focus */}
          {displayState.currentFocus.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3 w-3 text-cyan-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Current Focus</span>
              </div>
              <div className="space-y-1.5">
                {displayState.currentFocus.map((item) => (
                  <RoadmapItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Category filter */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Filter className="h-3 w-3 text-white/30" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Filter</span>
            </div>
            <CategoryFilter
              categories={categories}
              active={categoryFilter}
              onChange={setCategoryFilter}
            />
          </div>

          {/* Toggle completed */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="h-3 w-3 rounded border-white/20 bg-white/5 text-emerald-400 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[10px] text-white/40">Show completed items</span>
          </label>

          {/* Items grouped by priority */}
          {priorityOrder.map((priority) => {
            const items = groupedByPriority[priority];
            if (items.length === 0) return null;
            return (
              <div key={priority}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${getPriorityColor(priority)}`}>
                    {priority}
                  </span>
                  <span className="text-[9px] text-white/30">({items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <RoadmapItemRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Recently completed */}
          {displayState.recentlyCompleted.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Recently Completed</span>
              </div>
              <div className="space-y-1.5">
                {displayState.recentlyCompleted.map((item) => (
                  <RoadmapItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="py-8 text-center">
              <Map className="mx-auto h-6 w-6 text-white/20" />
              <p className="mt-2 text-[11px] text-white/30">
                {displayState.items.length === 0
                  ? "No roadmap items yet. The roadmap will populate as engineering work progresses."
                  : "No items match the current filter."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
