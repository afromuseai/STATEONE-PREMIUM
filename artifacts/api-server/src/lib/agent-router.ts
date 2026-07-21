// ─── Agent Router — Route Tasks to Specialist Agents ────────────────────────
// Phase 13.6
//
// Routes an ExecutionTask to the most appropriate SpecialistAgent based on
// task characteristics (title, objective, files, extensions, strategy).
// The router uses the agent registry and is fully extensible — new agents
// are automatically discovered from the registry.
//
// Phase 13.9: Historical performance data augments the routing score.
// Agents with strong track records get a scoring bonus. The router
// continuously learns from past execution outcomes.

import type { ExecutionTask } from "./task-planner";
import type { ExecutionPlan } from "./execution-planner";
import type { WorkspaceContext } from "./workspace-context";
import {
  getRegisteredAgents,
  getAgentById,
  type SpecialistAgent,
} from "./agent-registry";
// Phase 13.9: Historical performance data for adaptive routing
import { getAgentSuccessRate, getAgentValidationRate, getAgentRepairRate, getAgentAverageConfidence, getAgentAveragePlanningAccuracy, rankAgents } from "./agent-performance-profiler";

// ─── Routing Result ──────────────────────────────────────────────────────────

export interface RoutingResult {
  /** The selected agent. */
  agent: SpecialistAgent;
  /** Human-readable explanation of why this agent was chosen. */
  reason: string;
  /** Confidence score (0-1) for the routing decision. */
  confidence: number;
}

// ─── Route a task to the best specialist ─────────────────────────────────────
//
// Routing logic:
// 1. Score each agent by how many of its capabilities match the task
// 2. Break ties by agent priority (higher wins)
// 3. If no specialist matches above threshold, fall back to GeneralAgent
// 4. Consider file extensions as strong signals (e.g., .css → Styling)
//
// The router is fully data-driven — no switch statements on agent names.

export function routeTask(
  task: ExecutionTask,
  workspaceContext?: WorkspaceContext,
  executionPlan?: ExecutionPlan,
): RoutingResult {
  const agents = getRegisteredAgents();
  const lowerTitle = task.title.toLowerCase();
  const lowerObjective = task.objective.toLowerCase();
  const allFiles = [...task.filesToModify, ...task.filesToRead];
  const allExtensions = allFiles.map((f) => getExtension(f));

  // Score each agent
  const scored = agents.map((agent) => {
    let score = 0;
    const matchedCaps: string[] = [];

    // Skip GeneralAgent for scoring — it's the fallback
    if (agent.id === "general") {
      return { agent, score: 0, matchedCaps: [] };
    }

    for (const cap of agent.capabilities) {
      // Title match (strong signal)
      if (lowerTitle.includes(cap)) {
        score += 3;
        matchedCaps.push(cap);
      }
      // Objective match
      if (lowerObjective.includes(cap)) {
        score += 2;
        if (!matchedCaps.includes(cap)) matchedCaps.push(cap);
      }
      // File path match
      for (const file of allFiles) {
        if (file.toLowerCase().includes(cap)) {
          score += 1;
          if (!matchedCaps.includes(cap)) matchedCaps.push(cap);
          break;
        }
      }
    }

    // File extension boost
    for (const ext of allExtensions) {
      const extBoost = getExtensionBoost(agent.id, ext);
      if (extBoost > 0) {
        score += extBoost;
      }
    }

    // Strategy boost
    if (executionPlan) {
      const strategyBoost = getStrategyBoost(agent.id, executionPlan.strategy);
      if (strategyBoost > 0) {
        score += strategyBoost;
      }
    }

    // Phase 13.9: Historical performance bonus
    // Agents with high success/validation rates get a scoring bonus.
    // This makes routing decisions evolve over time based on actual outcomes.
    const histSuccess = getAgentSuccessRate(agent.id);
    const histValidation = getAgentValidationRate(agent.id);
    const histConfidence = getAgentAverageConfidence(agent.id);
    const histPlanning = getAgentAveragePlanningAccuracy(agent.id);
    const histRepair = getAgentRepairRate(agent.id);

    // Composite historical score (0-5 bonus)
    // Base: success rate contributes 0-2 points
    // Bonus: low repair rate contributes 0-1 points
    // Bonus: validation rate contributes 0-1 points
    // Bonus: planning accuracy contributes 0-1 points
    const histScore =
      histSuccess * 2.0 +
      (1 - histRepair) * 1.0 +
      histValidation * 1.0 +
      histPlanning * 1.0;

    // Only apply if there's meaningful data (count > 0 means at least 1 observation)
    // This ensures the router starts with capability-based matching and gradually
    // incorporates historical performance as data accumulates.
    if (histScore > 0) {
      // Scale: at most 3 bonus points from history
      score += Math.min(3, histScore * 0.6);
    }

    return { agent, score, matchedCaps };
  });

  // Sort by score (desc), then by priority (desc) for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.agent.priority - a.agent.priority;
  });

  // Select the best agent
  const best = scored[0];

  // If no specialist scored above threshold, use GeneralAgent
  if (!best || best.score < 1) {
    const generalAgent = getAgentById("general")!;
    return {
      agent: generalAgent,
      reason: "No specialist matched — using GeneralAgent fallback",
      confidence: 0.3,
    };
  }

  const reason = buildReason(best.agent, best.matchedCaps, allExtensions);
  const confidence = Math.min(1, best.score / 10);

  return {
    agent: best.agent,
    reason,
    confidence,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : "";
}

/** File extension boosts for each agent type. */
function getExtensionBoost(agentId: string, ext: string): number {
  const boosts: Record<string, Record<string, number>> = {
    styling:       { ".css": 5, ".scss": 5, ".less": 5, ".module.css": 5, ".module.scss": 5 },
    routing:       { ".ts": 0, ".tsx": 0 }, // routing is detected by file name, not extension
    component:     { ".tsx": 3, ".jsx": 3 },
    state:         { ".ts": 1, ".tsx": 1 },
    data:          { ".ts": 1, ".tsx": 1 },
    performance:   { ".ts": 0, ".tsx": 0 },
    accessibility: { ".tsx": 1, ".ts": 0 },
    validation:    { ".ts": 2, ".tsx": 1 },
  };
  return boosts[agentId]?.[ext] ?? 0;
}

/** Strategy boost for each agent type. */
function getStrategyBoost(agentId: string, strategy: string): number {
  const boosts: Record<string, Record<string, number>> = {
    styling:       { "single-file": 2, "multi-file": 0, "refactor": -2, "architecture": -5 },
    routing:       { "single-file": 0, "multi-file": 2, "refactor": 3, "architecture": 4 },
    component:     { "single-file": 1, "multi-file": 2, "refactor": 2, "architecture": 1 },
    state:         { "single-file": 0, "multi-file": 1, "refactor": 3, "architecture": 5 },
    data:          { "single-file": 0, "multi-file": 1, "refactor": 2, "architecture": 3 },
    performance:   { "single-file": 2, "multi-file": 1, "refactor": 0, "architecture": 0 },
    accessibility: { "single-file": 2, "multi-file": 1, "refactor": 0, "architecture": 0 },
    validation:    { "single-file": 1, "multi-file": 1, "refactor": 2, "architecture": 1 },
  };
  return boosts[agentId]?.[strategy] ?? 0;
}

function buildReason(agent: SpecialistAgent, matchedCaps: string[], extensions: string[]): string {
  const parts: string[] = [];

  if (matchedCaps.length > 0) {
    parts.push(`matched keywords: ${matchedCaps.slice(0, 3).join(", ")}`);
  }

  const relevantExts = extensions.filter((e) => e);
  if (relevantExts.length > 0) {
    parts.push(`file types: ${relevantExts.join(", ")}`);
  }

  return parts.length > 0
    ? `${agent.name} selected (${parts.join("; ")})`
    : `${agent.name} selected`;
}
