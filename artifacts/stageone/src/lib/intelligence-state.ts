const API_BASE = "/api";

export type DecisionType = "EXECUTE" | "SUGGEST" | "QUEUE" | "IGNORE";
export type PriorityLevel = 1 | 2 | 3 | 4;
export type RevenueTier = "high" | "medium" | "low";

export interface RevenueSignal {
  id: string;
  projectId: string | null;
  industry: string;
  businessSnapshot: string | null;
  estimatedArrUplift: number;
  conversionImpact: number;
  automationSavings: number;
  leadGenImprovement: number;
  engagementIncrease: number;
  overallRevenueScore: number;
  confidenceScore: number;
  tier: RevenueTier;
  decisionType: DecisionType;
  priority: PriorityLevel;
  createdAt: string;
}

export interface RevenueSummary {
  totalSignals: number;
  avgRevenueScore: number;
  totalEstimatedArrUplift: number;
  avgConversionImpact: number;
  avgAutomationSavings: number;
  highTierCount: number;
  mediumTierCount: number;
  lowTierCount: number;
  executeCount: number;
  suggestCount: number;
  topIndustry: string | null;
  recentSignals: RevenueSignal[];
  priorityBreakdown: { critical: number; high: number; medium: number; low: number };
}

export interface AutonomousSignal {
  id: string;
  issueType: string;
  title: string;
  description: string;
  detectedIn: string;
  priority: PriorityLevel;
  decisionType: DecisionType;
  revenueImpact: RevenueTier;
  isResolved: boolean;
  wasActedOn: boolean;
  actionPath: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AutonomousScanResult {
  scannedAt: string;
  issuesFound: number;
  signals: AutonomousSignal[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    executeActions: number;
    suggestActions: number;
    queueActions: number;
  };
}

export interface IntelligenceDecision {
  decisionType: DecisionType;
  priority: PriorityLevel;
  rationale: string;
  revenueImpact: RevenueTier;
}

// ── Revenue Intelligence ───────────────────────────────────────────────────────

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const res = await fetch(`${API_BASE}/revenue/summary`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch revenue summary");
  return res.json();
}

export async function getRevenueSignals(): Promise<{ signals: RevenueSignal[] }> {
  const res = await fetch(`${API_BASE}/revenue/signals`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch revenue signals");
  return res.json();
}

export async function recordRevenueSignal(data: {
  projectId?: string;
  industry: string;
  businessSnapshot?: string;
  sourceMetrics: Record<string, number>;
}): Promise<RevenueSignal> {
  const res = await fetch(`${API_BASE}/revenue/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to record revenue signal");
  return res.json();
}

export async function scoreRevenue(sourceMetrics: Record<string, number>): Promise<{
  overallRevenueScore: number;
  tier: RevenueTier;
  priority: PriorityLevel;
  decisionType: DecisionType;
  estimatedArrUplift: number;
  conversionImpact: number;
  automationSavings: number;
  confidenceScore: number;
}> {
  const res = await fetch(`${API_BASE}/revenue/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sourceMetrics }),
  });
  if (!res.ok) throw new Error("Failed to score revenue");
  return res.json();
}

// ── Autonomous Loop ────────────────────────────────────────────────────────────

export async function runAutonomousScan(): Promise<AutonomousScanResult> {
  const res = await fetch(`${API_BASE}/autonomous/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Autonomous scan failed");
  return res.json();
}

export async function getAutonomousSignals(): Promise<{
  signals: AutonomousSignal[];
  summary: {
    total: number;
    unresolved: number;
    critical: number;
    high: number;
    executeActions: number;
  };
}> {
  const res = await fetch(`${API_BASE}/autonomous/signals`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch autonomous signals");
  return res.json();
}

export async function resolveAutonomousSignal(
  id: string,
  wasActedOn: boolean
): Promise<AutonomousSignal> {
  const res = await fetch(`${API_BASE}/autonomous/signals/${id}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ wasActedOn }),
  });
  if (!res.ok) throw new Error("Failed to resolve signal");
  return res.json();
}
