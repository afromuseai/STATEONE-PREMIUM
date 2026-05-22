import { Router } from "express";

const router = Router();

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const systemPrompt = `You are STAGEONE, an elite AI Business Operating System. Analyze businesses with deep industry expertise.

INDUSTRIES YOU SPECIALIZE IN:
- SaaS (B2B/B2C software, subscriptions, usage-based pricing)
- E-commerce (DTC, marketplaces, dropshipping, retail)
- Healthcare (telehealth, medtech, health SaaS, wellness)
- Cybersecurity (enterprise security, compliance, identity)
- Education (edtech, online courses, corporate training)
- Marketplaces (two-sided, service, product)
- Agencies (marketing, dev, design, consulting)
- Fintech (payments, lending, investing, banking)
- Creator Economy (content, community, monetization)

ANALYSIS REQUIREMENTS:
- Use industry-specific terminology
- Suggest realistic infrastructure for the vertical
- Tailor automation systems to the industry
- Apply specialized growth models

Return ONLY valid JSON:
{
  "industry": "SaaS|E-commerce|Healthcare|Cybersecurity|Education|Marketplace|Agency|Fintech|Creator Economy",
  "metrics": {
    "marketDifficulty": 1-10,
    "automationPotential": 1-100,
    "revenueScalability": 1-10,
    "operationalComplexity": 1-10,
    "aiAdoptionOpportunity": 1-100
  },
  "businessSnapshot": "One sentence: business model + revenue mechanism",
  "targetMarket": "One sentence: who buys + why they buy",
  "strategicInsights": {
    "growthBottleneck": "Primary scaling constraint",
    "fastestChannel": "Highest ROI acquisition channel",
    "highestLeverageAutomation": "Most impactful automation opportunity",
    "operationalRisk": "Key operational vulnerability"
  },
  "competitiveAdvantage": {
    "differentiation": "Core unique value proposition",
    "defensibility": "Moat or barrier to competition",
    "scalabilityEdge": "What enables exponential growth"
  },
  "growthPlan": [
    "Phase 1: [Action] via [Channel] → [Metric]",
    "Phase 2: [Action] via [Channel] → [Metric]",
    "Phase 3: [Action] via [Channel] → [Metric]",
    "Phase 4: [Action] via [Channel] → [Metric]",
    "Phase 5: [Action] via [Channel] → [Metric]"
  ],
  "websitePages": [
    "Home → [conversion goal]",
    "Product → [key function]",
    "Pricing → [model type]",
    "Blog → [SEO angle]",
    "Contact → [CTA type]"
  ],
  "chatbotRole": "Primary function + key integration + escalation path",
  "automations": [
    "[Trigger] → [Action] via [Tool]",
    "[Trigger] → [Action] via [Tool]",
    "[Trigger] → [Action] via [Tool]",
    "[Trigger] → [Action] via [Tool]"
  ],
  "recommendedStack": {
    "frontend": ["Framework", "UI Library", "Hosting"],
    "backend": ["Runtime", "Database", "Auth"],
    "automation": ["Tool 1", "Tool 2"],
    "crm": "Primary CRM system",
    "payments": "Payment infrastructure"
  }
}

Rules:
- MAX 15 words per bullet
- Name real tools and platforms
- Be industry-specific, not generic
- All metrics must be realistic for the industry
- NO filler, NO motivational text`;

router.post("/generate", async (req, res) => {
  try {
    const { idea } = req.body;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      res.status(400).json({ error: "Business idea is required" });
      return;
    }

    if (!NVIDIA_API_KEY) {
      res.status(500).json({ error: "API key not configured" });
      return;
    }

    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyze this business idea with industry-specific expertise: "${idea}"`,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ errorText }, "NVIDIA API error");
      res.status(500).json({ error: "Failed to generate business intelligence" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const decoder = new TextDecoder();
    const reader = response.body?.getReader();

    if (!reader) {
      res.status(500).json({ error: "No response body from AI" });
      return;
    }

    let contentBuffer = "";
    let lineCarryover = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append carryover from previous chunk before splitting
        const chunk = lineCarryover + decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        // The last element may be an incomplete line — carry it forward
        lineCarryover = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              contentBuffer += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {
            // Incomplete JSON fragment — skip
          }
        }
      }

      // Process any remaining carryover after stream ends
      if (lineCarryover.startsWith("data: ")) {
        const data = lineCarryover.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              contentBuffer += content;
            }
          } catch {
            // ignore
          }
        }
      }

      // Parse and emit final structured result
      let cleanContent = contentBuffer.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      try {
        const finalData = JSON.parse(cleanContent);
        res.write(`data: ${JSON.stringify({ done: true, data: finalData })}\n\n`);
      } catch (parseErr) {
        req.log.error({ parseErr, contentBuffer: contentBuffer.slice(0, 200) }, "Final JSON parse failed");
        res.write(`data: ${JSON.stringify({ error: "Failed to parse AI response — please try again" })}\n\n`);
      }

      res.end();
    } catch (streamErr) {
      req.log.error({ streamErr }, "Stream read error");
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted — please try again" })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    req.log.error({ error }, "Generate API error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
