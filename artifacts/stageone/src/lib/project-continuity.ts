export type ContinuityDecision = {
  action: "continue" | "create_new"
  reason: string
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "it", "to", "for", "of", "in", "on",
  "and", "or", "but", "with", "at", "by", "from", "as", "into",
  "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further",
  "then", "once", "this", "that", "these", "those", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "but", "if", "while", "about", "up",
  "can", "will", "would", "could", "should", "may", "might",
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOP_WORDS.has(t)),
  )
}

export function decideProjectContinuity(
  project: { id: string; businessIdea: string; title: string } | null,
  incomingIdea: string,
): ContinuityDecision {
  if (!project) {
    return { action: "create_new", reason: "No existing project" }
  }

  if (!incomingIdea || !project.businessIdea) {
    return { action: "continue", reason: "Cannot compare — fallback to continuation" }
  }

  const incomingTokens = tokenize(incomingIdea)
  const existingTokens = tokenize(project.businessIdea)

  if (incomingTokens.size === 0) {
    return { action: "continue", reason: "Incoming idea has no significant tokens — fallback to continuation" }
  }

  let intersection = 0
  for (const token of incomingTokens) {
    if (existingTokens.has(token)) intersection++
  }

  const overlapRatio = intersection / incomingTokens.size
  const THRESHOLD = 0.3

  if (overlapRatio >= THRESHOLD) {
    return { action: "continue", reason: `Token overlap ${(overlapRatio * 100).toFixed(0)}% ≥ ${(THRESHOLD * 100).toFixed(0)}% threshold` }
  }

  return { action: "create_new", reason: `Token overlap ${(overlapRatio * 100).toFixed(0)}% < ${(THRESHOLD * 100).toFixed(0)}% threshold` }
}
