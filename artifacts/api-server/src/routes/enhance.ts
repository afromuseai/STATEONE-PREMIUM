import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { callNvidia } from "../lib/nvidia";
import { getLanguageInstruction } from "../lib/language";

const router = Router();

router.post("/generate/enhance", requireAuth, async (req, res): Promise<void> => {
  const { idea, language } = req.body;

  if (!idea || typeof idea !== "string" || !idea.trim()) {
    res.status(400).json({ error: "Idea is required" });
    return;
  }

  try {
    const langInstruction = getLanguageInstruction(language);
    const enhanced = await callNvidia({
      model: MODELS.ENHANCE,
      messages: [
        {
          role: "system",
          content: `You are a business idea enhancer for an AI business intelligence platform. Your job is to take a vague, short, or underdeveloped business idea and expand it into a clear, specific, analysis-ready business concept.

Expand the idea to include:
1. The specific target customer segment (be precise — job title, company size, industry)
2. The primary revenue model (SaaS subscription, marketplace fees, transaction %, etc.)
3. The core value proposition in one specific, quantifiable claim
4. One key differentiator vs. existing solutions

Keep it to 2-4 sentences. Be concrete and specific. Use business terminology. Return ONLY the enhanced idea text — no headers, no labels, no explanations.${langInstruction}`,
        },
        {
          role: "user",
          content: `Enhance this business idea: "${idea.trim()}"`,
        },
      ],
      temperature: 0.6,
      maxTokens: 250,
    });

    res.json({ enhanced: enhanced.trim() || idea });
  } catch (err) {
    req.log.error({ err }, `[AI:${MODELS.ENHANCE}] Enhancement failed`);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
