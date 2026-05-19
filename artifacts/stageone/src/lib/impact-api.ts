const API_BASE = "/api";

export interface ImpactEntry {
  id: string;
  outputType: string;
  expectedImpact: string;
  confidenceScore: number;
  optimizationGoal: string;
  feedbackRating: number | null;
  usefulnessScore: number | null;
  feedbackNote: string | null;
  implementationStatus: string;
  createdAt: string;
}

export interface ImpactSummary {
  totalOutputs: number;
  avgUsefulnessScore: number;
  avgFeedbackRating: number;
  implementationRate: number;
  feedbackCount: number;
  byOutputType: Record<string, { count: number; avgRating: number; avgUsefulness: number }>;
  recommendationSuccessRate: number;
  totalRecommendations: number;
  acceptedRecommendations: number;
  systemLearningVelocity: number;
  topPerformingModule: string;
  recentEntries: ImpactEntry[];
}

export async function trackImpact(data: {
  projectId?: string;
  outputType: string;
  expectedImpact: string;
  confidenceScore: number;
  optimizationGoal: string;
}): Promise<ImpactEntry> {
  const res = await fetch(`${API_BASE}/impact/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to track impact");
  return res.json();
}

export async function submitFeedback(data: {
  impactTrackingId: string;
  feedbackRating: number;
  usefulnessScore: number;
  feedbackNote?: string;
  implementationStatus?: string;
}): Promise<ImpactEntry> {
  const res = await fetch(`${API_BASE}/impact/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit feedback");
  return res.json();
}

export async function trackRecommendationOutcome(data: {
  impactTrackingId?: string;
  projectId?: string;
  recommendationType: string;
  recommendationText: string;
  outcome: "accepted" | "rejected" | "pending" | "implemented";
}): Promise<void> {
  await fetch(`${API_BASE}/impact/recommendation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
}

export async function getImpactSummary(): Promise<ImpactSummary> {
  const res = await fetch(`${API_BASE}/impact/summary`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch impact summary");
  return res.json();
}
