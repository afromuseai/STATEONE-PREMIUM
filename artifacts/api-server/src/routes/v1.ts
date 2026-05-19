import { Router } from "express";
import { db, apiKeysTable, apiUsageLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireApiKey } from "../middleware/apiKey";
import { MODELS } from "../lib/models";
import { callNvidia, extractJson } from "../lib/nvidia";

const router = Router();

async function callModel(model: string, systemPrompt: string, userMessage: string, maxTokens = 4000): Promise<string> {
  return callNvidia({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], maxTokens });
}

async function trackUsage(apiKeyId: string, userId: string, endpoint: string, statusCode: number, responseTimeMs: number) {
  try {
    await Promise.all([
      db.update(apiKeysTable).set({
        requestsUsed: sql`${apiKeysTable.requestsUsed} + 1`,
        lastUsedAt: new Date(),
      }).where(eq(apiKeysTable.id, apiKeyId)),
      db.insert(apiUsageLogsTable).values({
        apiKeyId,
        userId,
        endpoint,
        method: "POST",
        statusCode,
        responseTimeMs,
      }),
    ]);
  } catch { /* non-fatal */ }
}

const ANALYZE_SYSTEM_PROMPT = `You are STAGEONE, an elite AI Business Operating System. Analyze businesses with deep industry expertise.

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
  "growthPlan": ["Phase 1...", "Phase 2...", "Phase 3...", "Phase 4...", "Phase 5..."],
  "chatbotRole": "Primary function + key integration + escalation path",
  "automations": ["[Trigger] → [Action] via [Tool]", "...", "...", "..."],
  "recommendedStack": {
    "frontend": ["Framework", "UI Library", "Hosting"],
    "backend": ["Runtime", "Database", "Auth"],
    "automation": ["Tool 1", "Tool 2"],
    "crm": "Primary CRM system",
    "payments": "Payment infrastructure"
  }
}`;

const WEBSITE_SYSTEM_PROMPT = `You are an elite UI/UX designer. Generate a complete website structure for a business.

Return ONLY valid JSON:
{
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "text": "#hex" },
  "typography": { "headingFont": "Google Font name", "bodyFont": "Google Font name" },
  "brand": { "name": "Company Name", "tagline": "Short memorable tagline" },
  "sections": {
    "hero": { "headline": "6-9 bold words", "subheadline": "2 sentences benefit-focused", "ctaPrimary": "Action verb + noun", "socialProof": "Trust signal" },
    "features": { "title": "Section headline", "items": [{ "title": "Feature", "description": "Under 20 words" }] },
    "pricing": { "tiers": [{ "name": "Starter", "price": "$X/mo", "features": ["f1","f2","f3"] }, { "name": "Pro", "price": "$X/mo", "highlighted": true }, { "name": "Enterprise", "price": "Custom" }] },
    "cta": { "headline": "Strong close", "buttonText": "Final CTA" },
    "faq": { "items": [{ "question": "?", "answer": "Answer." }] }
  },
  "seoMeta": { "title": "Page title 50-60 chars", "description": "150-160 char meta description", "keywords": ["kw1","kw2","kw3"] }
}`;

const CHATBOT_SYSTEM_PROMPT = `You are an enterprise AI chatbot architect. Generate a complete, deployable chatbot system.

Return ONLY valid JSON:
{
  "identity": { "name": "ChatbotName", "role": "one-sentence role", "greeting": "Full opening message" },
  "systemPrompt": { "main": "Complete system prompt 200-300 words", "constraints": ["Never do X"], "fallbacks": ["Fallback message"] },
  "conversationFlows": {
    "welcome": { "trigger": "User opens chat", "quickReplies": ["Option 1","Option 2","Option 3"] },
    "support": { "responses": { "pricing": "Response", "technical": "Response", "billing": "Response" } },
    "escalation": { "trigger": "Cannot resolve", "botMessage": "Escalation message" }
  },
  "suggestedPrompts": ["Question 1?", "Question 2?", "Question 3?", "Question 4?"],
  "integrations": {
    "crm": [{ "name": "HubSpot", "purpose": "Lead capture", "priority": "high" }],
    "support": [{ "name": "Zendesk", "purpose": "Ticket creation", "priority": "high" }]
  },
  "deployment": {
    "recommended": ["website_widget", "whatsapp", "slack"],
    "widgetSnippet": "<script>window.ChatbotConfig = { botId: 'YOUR_BOT_ID' };</script>"
  },
  "kpis": { "deflectionRate": "65-75%", "satisfactionScore": "CSAT > 4.2/5" }
}`;

const WORKFLOW_SYSTEM_PROMPT = `You are STAGEONE Automation Architect. Design intelligent business automation workflows.

Return ONLY valid JSON:
{
  "overview": { "purpose": "What this workflow does", "expectedOutcome": "Measurable result", "complexityScore": 5 },
  "triggers": [{ "id": "t1", "label": "Trigger name", "event": "form.submitted", "tool": "Typeform" }],
  "nodes": [
    { "id": "n1", "type": "trigger|action|ai_agent|notification|crm|database|webhook", "label": "Node label", "tool": "Tool name", "description": "What this node does" }
  ],
  "edges": [{ "from": "n1", "to": "n2", "label": "optional condition" }],
  "integrations": [{ "name": "Tool name", "category": "CRM|Email|Messaging|AI", "role": "How it's used", "tier": "required|recommended|optional" }],
  "workflowLogic": [{ "step": 1, "nodeId": "n1", "action": "What happens", "fallback": "If this fails" }],
  "agentConfig": { "objectives": ["Goal 1"], "modelRecommendation": "GPT-4o", "inputSources": ["Data source"], "outputActions": ["Action taken"] }
}`;

router.post("/v1/analyze-business", requireApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const { businessIdea, industry } = req.body as { businessIdea?: string; industry?: string };

  if (!businessIdea?.trim()) {
    res.status(400).json({ error: "businessIdea is required", example: { businessIdea: "A SaaS platform for..." } });
    return;
  }

  try {
    const raw = await callModel(
      MODELS.BUSINESS_INTELLIGENCE,
      ANALYZE_SYSTEM_PROMPT,
      `Analyze this business: "${businessIdea}"${industry ? ` Industry context: ${industry}` : ""}`,
      3000
    );
    const data = extractJson(raw);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/analyze-business", 200, ms);
    res.json({ success: true, data, responseTimeMs: ms, model: MODELS.BUSINESS_INTELLIGENCE });
  } catch (err) {
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/analyze-business", 500, ms);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/generate-website", requireApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const { businessIdea, style = "SaaS", tone = "Professional" } = req.body as { businessIdea?: string; style?: string; tone?: string };

  if (!businessIdea?.trim()) {
    res.status(400).json({ error: "businessIdea is required" });
    return;
  }

  try {
    const raw = await callModel(
      MODELS.WEBSITE_PLANNING,
      WEBSITE_SYSTEM_PROMPT,
      `Generate a complete website for: "${businessIdea}". Style: ${style}. Tone: ${tone}.`,
      5000
    );
    const data = extractJson(raw);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-website", 200, ms);
    res.json({ success: true, data, responseTimeMs: ms, model: MODELS.WEBSITE_PLANNING });
  } catch (err) {
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-website", 500, ms);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/generate-chatbot", requireApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const { businessDescription, chatbotType = "Customer Support", tone = "Professional", industry = "SaaS" } = req.body as {
    businessDescription?: string; chatbotType?: string; tone?: string; industry?: string;
  };

  if (!businessDescription?.trim()) {
    res.status(400).json({ error: "businessDescription is required" });
    return;
  }

  try {
    const raw = await callModel(
      MODELS.CHATBOT,
      CHATBOT_SYSTEM_PROMPT,
      `Generate a ${chatbotType} chatbot for: "${businessDescription}". Industry: ${industry}. Tone: ${tone}.`,
      5000
    );
    const data = extractJson(raw);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-chatbot", 200, ms);
    res.json({ success: true, data, responseTimeMs: ms, model: MODELS.CHATBOT });
  } catch (err) {
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-chatbot", 500, ms);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/generate-workflow", requireApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const { businessDescription, workflowType = "Lead Capture", complexity = "Intermediate" } = req.body as {
    businessDescription?: string; workflowType?: string; complexity?: string;
  };

  if (!businessDescription?.trim()) {
    res.status(400).json({ error: "businessDescription is required" });
    return;
  }

  try {
    const raw = await callModel(
      MODELS.AUTOMATION,
      WORKFLOW_SYSTEM_PROMPT,
      `Design a ${complexity} "${workflowType}" workflow for: "${businessDescription}". Include 6-8 nodes.`,
      4000
    );
    const data = extractJson(raw);
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-workflow", 200, ms);
    res.json({ success: true, data, responseTimeMs: ms, model: MODELS.AUTOMATION });
  } catch (err) {
    const ms = Date.now() - start;
    await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/generate-workflow", 500, ms);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/deploy", requireApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const { name, type, environment = "production", domain } = req.body as {
    name?: string; type?: string; environment?: string; domain?: string;
  };

  if (!name?.trim() || !type) {
    res.status(400).json({ error: "name and type are required", validTypes: ["website", "chatbot", "workflow"] });
    return;
  }

  if (!["website", "chatbot", "workflow", "slack", "discord", "whatsapp"].includes(type)) {
    res.status(400).json({ error: "Invalid type", validTypes: ["website", "chatbot", "workflow", "slack", "discord", "whatsapp"] });
    return;
  }

  const deploymentId = crypto.randomUUID();
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const url = domain ?? `https://${slug}.stageone.app`;

  const ms = Date.now() - start;
  await trackUsage(req.apiKey!.apiKeyId, req.apiKey!.userId, "/api/v1/deploy", 201, ms);

  res.status(201).json({
    success: true,
    deployment: {
      id: deploymentId,
      name,
      type,
      environment,
      status: "deploying",
      url,
      estimatedReadyIn: "30-60 seconds",
      createdAt: new Date().toISOString(),
    },
    responseTimeMs: ms,
  });
});

export default router;
