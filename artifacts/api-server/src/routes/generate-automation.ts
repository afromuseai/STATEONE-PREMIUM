import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson } from "../lib/nvidia";

const router = Router();

const buildSystemPrompt = () => `You are STAGEONE Automation Architect, an elite AI system that designs intelligent business automation workflows.

Return ONLY valid JSON matching this exact schema:
{
  "overview": {
    "purpose": "One sentence describing what this workflow does",
    "objective": "Specific operational goal",
    "expectedOutcome": "Measurable business result",
    "complexityScore": 1-10,
    "executionEstimate": "e.g. ~1.2s avg per trigger"
  },
  "triggers": [
    {
      "id": "t1",
      "label": "Trigger name",
      "event": "Technical event name e.g. form.submitted",
      "description": "What initiates this workflow",
      "tool": "Tool that fires this trigger e.g. Typeform"
    }
  ],
  "nodes": [
    {
      "id": "n1",
      "type": "trigger|action|ai_agent|notification|crm|database|webhook",
      "label": "Node label",
      "tool": "Tool name e.g. HubSpot",
      "description": "What this node does",
      "config": "Key config detail"
    }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "optional condition label" }
  ],
  "integrations": [
    {
      "name": "Tool name e.g. Slack",
      "category": "CRM|Email|Messaging|Payment|Database|AI|Analytics",
      "role": "How it's used in this workflow",
      "tier": "required|recommended|optional"
    }
  ],
  "workflowLogic": [
    {
      "step": 1,
      "nodeId": "n1",
      "action": "What happens",
      "condition": "If/when condition or null",
      "fallback": "What happens if this fails"
    }
  ],
  "aiOpportunities": [
    {
      "type": "e.g. Lead Scoring",
      "description": "How AI enhances this step",
      "impact": "high|medium|low",
      "nodeId": "which node benefits"
    }
  ],
  "agentConfig": {
    "objectives": ["Primary agent goal 1", "Goal 2"],
    "behaviors": ["Behavior setting 1", "Behavior 2"],
    "modelRecommendation": "e.g. GPT-4o or Claude 3.5 Sonnet",
    "inputSources": ["Where agent gets data"],
    "outputActions": ["What agent triggers"]
  }
}

Rules:
- Generate 5-9 nodes in a logical left-to-right flow
- Edges must connect all nodes in sequence with optional branches
- Include at least one AI agent node
- Name real tools and platforms
- Be specific to the workflow type and complexity
- NO generic responses — tailor everything to the business`;

router.post("/generate/automation", requireAuth, async (req, res): Promise<void> => {
  try {
    const {
      businessDescription,
      workflowType = "Lead Capture",
      complexity = "Intermediate",
    } = req.body;

    if (!businessDescription?.trim()) {
      res.status(400).json({ error: "businessDescription is required" });
      return;
    }
    if (!process.env.NVIDIA_API_KEY) {
      res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
      return;
    }

    const userMessage = `Design a complete ${complexity} complexity "${workflowType}" automation workflow for this business:

"${businessDescription}"

Generate a production-ready workflow with real tool integrations, AI agent nodes, conditional logic, and measurable outcomes. Include 6-8 nodes in a clear flow.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({
        model: MODELS.AUTOMATION,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        maxTokens: 4000,
      });
    } catch (streamErr) {
      req.log.error({ streamErr, model: MODELS.AUTOMATION }, `[AI:${MODELS.AUTOMATION}] Failed to open stream`);
      res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
      res.end();
      return;
    }

    try {
      const buffer = await forwardStream(streamBody, res, MODELS.AUTOMATION);
      try {
        const finalData = extractJson(buffer);
        res.write(`data: ${JSON.stringify({ done: true, data: finalData })}\n\n`);
      } catch (parseErr) {
        req.log.error({ parseErr, model: MODELS.AUTOMATION }, `[AI:${MODELS.AUTOMATION}] JSON parse failed`);
        res.write(`data: ${JSON.stringify({ error: "Failed to parse AI response — please try again" })}\n\n`);
      }
      res.end();
    } catch (streamErr) {
      req.log.error({ streamErr, model: MODELS.AUTOMATION }, `[AI:${MODELS.AUTOMATION}] Stream error`);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    req.log.error({ error }, "Automation API error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
