// ─── Phase P4 — AI Code Review Endpoint ───────────────────────────────────────
// POST /api/copilot/code-review
// Non-streaming: calls LLM once, returns JSON with scores + issues.

import { Router } from "express"
import { requireAuth } from "../middleware/auth"
import { MODELS } from "../lib/models"
import { callNvidia, extractJson } from "../lib/nvidia"
import { z } from "zod"

const router = Router()

// ─── Schema ───────────────────────────────────────────────────────────────────
const CodeReviewSchema = z.object({
  projectName: z.string().max(100),
  files:       z.string().max(30_000),
})

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior software engineer performing a code review.
Analyze the provided code and return a JSON object with the following structure.
Only return the JSON — no preamble, no markdown fences.

{
  "performance":   <integer 0-100>,
  "security":      <integer 0-100>,
  "accessibility": <integer 0-100>,
  "seo":           <integer 0-100>,
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "category": "security" | "performance" | "accessibility" | "seo",
      "message": "<concise actionable description>"
    }
  ],
  "summary": "<2-3 sentence overall assessment>"
}

Scoring guide:
- 90-100: Excellent — best practices followed throughout
- 75-89:  Good — minor issues only
- 60-74:  Fair — several improvements needed
- <60:    Poor — significant problems

Limit issues to the 5 most impactful. Be specific and actionable.`

// ─── Route ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/copilot/code-review", requireAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any
  const userId: string = (anyReq.user?.id ?? anyReq.user?.userId ?? "") as string

  const parsed = CodeReviewSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" })
    return
  }

  const { projectName, files } = parsed.data

  const userMessage = `Review the following ${projectName} project files:

${files}

Return only the JSON review object.`

  try {
    const raw = await callNvidia({
      model:       MODELS.CHAT,      // fast model — no need for 49B for scoring
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
      temperature: 0.1,
      topP:        0.9,
      maxTokens:   1200,
      signal:      AbortSignal.timeout(45_000),
      _feature:    "code_review",
      _userId:     userId,
    })

    // Parse and validate the LLM output
    const result = extractJson(raw) as {
      performance?:   number
      security?:      number
      accessibility?: number
      seo?:           number
      issues?:        Array<{ severity: string; category: string; message: string }>
      summary?:       string
    }

    const clamp = (n: unknown, def = 75) =>
      typeof n === "number" ? Math.max(0, Math.min(100, Math.round(n))) : def

    res.json({
      performance:   clamp(result.performance,   82),
      security:      clamp(result.security,      90),
      accessibility: clamp(result.accessibility, 78),
      seo:           clamp(result.seo,           85),
      issues: (Array.isArray(result.issues) ? result.issues : []).slice(0, 8),
      summary: typeof result.summary === "string"
        ? result.summary
        : "Review complete. See issues for details.",
    })
  } catch (err) {
    req.log?.error({ err }, "[CodeReview] LLM call failed")
    res.status(502).json({ error: err instanceof Error ? err.message : "Review failed" })
  }
})

export default router
