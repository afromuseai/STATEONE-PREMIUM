import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth-context"

export type Feature =
  | "bi_generator"
  | "website_generator"
  | "chatbot_generator"
  | "automation_builder"
  | "marcus_copilot"
  | "ai_builder"

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  startup: 2,
  enterprise: 3,
}

const FEATURE_REQUIRED_PLAN: Record<Feature, string> = {
  bi_generator:       "free",
  website_generator:  "pro",
  chatbot_generator:  "pro",
  automation_builder: "pro",
  marcus_copilot:     "pro",
  ai_builder:         "pro",
}

export const FEATURE_LABELS: Record<Feature, string> = {
  bi_generator:       "Business Intelligence",
  website_generator:  "AI Website Builder",
  chatbot_generator:  "AI Chatbot Generator",
  automation_builder: "Automation Builder",
  marcus_copilot:     "Marcus AI Copilot",
  ai_builder:         "AI Builder",
}

export const PLAN_UPGRADE_TARGET: Record<Feature, string> = {
  bi_generator:       "free",
  website_generator:  "pro",
  chatbot_generator:  "pro",
  automation_builder: "pro",
  marcus_copilot:     "pro",
  ai_builder:         "pro",
}

export interface Subscription {
  id: string
  userId: string
  plan: string
  status: string
  aiGenerationsUsed: number
  aiGenerationsLimit: number
  deploymentsUsed: number
  deploymentsLimit: number
  workspacesUsed: number
  workspacesLimit: number
  currentPeriodStart: string
  currentPeriodEnd: string
}

export function usePlan() {
  const { user } = useAuth()

  const { data: subscription, isLoading, refetch } = useQuery<Subscription>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/me", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch subscription")
      const json = await res.json()
      return json.subscription as Subscription
    },
    enabled: !!user,
    staleTime: 30_000,
  })

  const currentPlan = subscription?.plan ?? "free"
  const userLevel = PLAN_ORDER[currentPlan] ?? 0

  function canAccess(feature: Feature): boolean {
    if (!user) return feature === "bi_generator"
    const requiredLevel = PLAN_ORDER[FEATURE_REQUIRED_PLAN[feature]] ?? 0
    return userLevel >= requiredLevel
  }

  function isBlocked(feature: Feature): boolean {
    return !canAccess(feature)
  }

  const usageUsed = subscription?.aiGenerationsUsed ?? 0
  const usageLimit = subscription?.aiGenerationsLimit ?? 5
  const usageRemaining = Math.max(0, usageLimit - usageUsed)
  const isAtLimit = usageUsed >= usageLimit

  return {
    currentPlan,
    isLoading,
    subscription: subscription ?? null,
    canAccess,
    isBlocked,
    usageUsed,
    usageLimit,
    usageRemaining,
    isAtLimit,
    refetch,
  }
}
