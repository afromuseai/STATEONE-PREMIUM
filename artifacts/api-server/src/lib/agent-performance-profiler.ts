// ─── Agent Performance Profiler — Per-Specialist Performance Tracking ───────
// Phase 13.9
//
// Tracks every specialist's performance across executions.
// Provides historical success rates, average durations, and trend data
// so the adaptive router can make informed decisions.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { getAgentStatsFromHistory } from "./execution-analytics-engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentPerformanceStats {
  /** Total executions assigned to this agent. */
  count: number;
  /** Fraction of executions where validation passed. */
  successRate: number;
  /** Average execution duration in ms. */
  averageDuration: number;
  /** Fraction of executions requiring repairs. */
  repairRate: number;
  /** Fraction of executions that passed validation. */
  validationRate: number;
  /** Average confidence score (0-100). */
  averageConfidence: number;
  /** Average change impact score (0-100). */
  averageImpact: number;
  /** Average retries per execution. */
  averageRetries: number;
  /** Average number of tasks per execution. */
  averageTaskSize: number;
  /** Average planning F1 score (0-1). */
  averagePlanningAccuracy: number;
  /** Last updated timestamp. */
  lastUpdated: string;
}

export interface AgentPerformanceStore {
  /** Per-agent performance stats. */
  agents: Record<string, AgentPerformanceStats>;
  /** Ranked list of agent IDs by performance. */
  ranking: string[];
  /** When the ranking was last computed. */
  lastRankingUpdate: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "agent-performance.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): AgentPerformanceStore {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as AgentPerformanceStore;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[profiler] Failed to load agent performance, starting fresh");
  }
  return { agents: {}, ranking: [], lastRankingUpdate: new Date().toISOString() };
}

function saveStore(store: AgentPerformanceStore): void {
  try {
    ensureDataDir();
    store.lastRankingUpdate = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[profiler] Failed to persist agent performance");
  }
}

// ─── Update Agent Performance ────────────────────────────────────────────────

export function updateAgentPerformance(
  projectId: string | undefined,
  agentSelections: Array<{ agentId: string; success: boolean; durationMs: number; repairAttempts: number; taskCount: number; confidenceScore: number; impactScore: number; planningAccuracy: number }>,
): void {
  if (!projectId || agentSelections.length === 0) return;

  const store = loadStore();

  for (const sel of agentSelections) {
    if (!store.agents[sel.agentId]) {
      store.agents[sel.agentId] = {
        count: 0,
        successRate: 0,
        averageDuration: 0,
        repairRate: 0,
        validationRate: 0,
        averageConfidence: 0,
        averageImpact: 0,
        averageRetries: 0,
        averageTaskSize: 0,
        averagePlanningAccuracy: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    const a = store.agents[sel.agentId];
    // Exponential moving average (α = 0.3) for smooth, continuous learning
    const alpha = 0.3;
    const prevCount = a.count;

    a.count += 1;
    a.successRate = prevCount === 0
      ? (sel.success ? 1 : 0)
      : a.successRate + alpha * ((sel.success ? 1 : 0) - a.successRate);
    a.averageDuration = prevCount === 0
      ? sel.durationMs
      : a.averageDuration + alpha * (sel.durationMs - a.averageDuration);
    a.averageConfidence = prevCount === 0
      ? sel.confidenceScore
      : a.averageConfidence + alpha * (sel.confidenceScore - a.averageConfidence);
    a.averageImpact = prevCount === 0
      ? sel.impactScore
      : a.averageImpact + alpha * (sel.impactScore - a.averageImpact);
    a.averageTaskSize = prevCount === 0
      ? sel.taskCount
      : a.averageTaskSize + alpha * (sel.taskCount - a.averageTaskSize);
    a.averagePlanningAccuracy = prevCount === 0
      ? sel.planningAccuracy
      : a.averagePlanningAccuracy + alpha * (sel.planningAccuracy - a.averagePlanningAccuracy);

    // Repair rate tracks fraction with >0 repairs
    const hadRepair = sel.repairAttempts > 0 ? 1 : 0;
    a.repairRate = prevCount === 0
      ? hadRepair
      : a.repairRate + alpha * (hadRepair - a.repairRate);

    // Validation rate tracks fraction that passed
    const passed = sel.success ? 1 : 0;
    a.validationRate = prevCount === 0
      ? passed
      : a.validationRate + alpha * (passed - a.validationRate);

    // Average retries
    const retries = Math.max(0, sel.repairAttempts - 1);
    a.averageRetries = prevCount === 0
      ? retries
      : a.averageRetries + alpha * (retries - a.averageRetries);

    a.lastUpdated = new Date().toISOString();
  }

  // Re-rank agents
  store.ranking = computeRanking(store.agents);
  rankingRevisionCount++;
  persistStore(store);
}

// ─── Persist (wraps saveStore with tracking) ─────────────────────────────────

let cachedStore: AgentPerformanceStore | null = null;

function getStore(): AgentPerformanceStore {
  if (!cachedStore) cachedStore = loadStore();
  return cachedStore;
}

function persistStore(s: AgentPerformanceStore): void {
  cachedStore = s;
  saveStore(s);
}

function computeRanking(agents: Record<string, AgentPerformanceStats>): string[] {
  return Object.entries(agents)
    .map(([id, stats]) => ({
      id,
      score:
        stats.successRate * 0.35 +
        (1 - stats.repairRate) * 0.15 +
        stats.validationRate * 0.20 +
        (stats.averageConfidence / 100) * 0.15 +
        stats.averagePlanningAccuracy * 0.15,
    }))
    .sort((a, b) => b.score - a.score)
    .map((e) => e.id);
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getAgentPerformance(agentId: string): AgentPerformanceStats | null {
  return getStore().agents[agentId] ?? null;
}

export function getAllAgentPerformance(): Record<string, AgentPerformanceStats> {
  return { ...getStore().agents };
}

export function rankAgents(): string[] {
  return [...getStore().ranking];
}

export function getAgentSuccessRate(agentId: string): number {
  return getStore().agents[agentId]?.successRate ?? 0.5;
}

export function getAgentValidationRate(agentId: string): number {
  return getStore().agents[agentId]?.validationRate ?? 0.5;
}

export function getAgentRepairRate(agentId: string): number {
  return getStore().agents[agentId]?.repairRate ?? 0.5;
}

export function getAgentAverageConfidence(agentId: string): number {
  return getStore().agents[agentId]?.averageConfidence ?? 50;
}

export function getAgentAveragePlanningAccuracy(agentId: string): number {
  return getStore().agents[agentId]?.averagePlanningAccuracy ?? 0.5;
}

/** Number of ranking revisions (for telemetry). */
let rankingRevisionCount = 0;

export function getRankingRevisionCount(): number {
  return rankingRevisionCount;
}
