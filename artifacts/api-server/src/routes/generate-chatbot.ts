import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson, callNvidia } from "../lib/nvidia";
import { getLanguageInstruction } from "../lib/language";
import { logEventFireForget } from "../lib/log-event";
import { trackUsageFireForget } from "../lib/usage";

const router = Router();

const CHATBOT_TYPE_GUIDES: Record<string, string> = {
  "Customer Support": "Primary focus: deflect tickets, resolve issues autonomously, escalate only when necessary. Must handle complaints with empathy, provide order/account status, and reduce human agent load by 60%+. Include clear escalation paths to human agents.",
  "Sales Assistant": "Primary focus: qualify leads using BANT framework, book demo calls, nurture prospects. Capture contact info naturally. Understand buying intent. Push toward conversion. Handle pricing objections intelligently.",
  "Onboarding Assistant": "Primary focus: guide new users/customers through setup, feature discovery, and first value. Reduce time-to-value. Proactively surface relevant features. Track onboarding completion milestones.",
  "Booking Assistant": "Primary focus: capture appointment intent, collect availability preferences, confirm bookings. Handle rescheduling and cancellations. Send confirmations. Integrate with calendar systems.",
  "FAQ Assistant": "Primary focus: answer common questions accurately and concisely from a knowledge base. Handle variations of the same question. Know when to escalate. Continuously learn from unanswered questions.",
  "Internal Team Assistant": "Primary focus: answer HR policies, IT help, internal processes. Handle leave requests, expense approvals, tool access. Reduce internal ticket volume. Maintain confidentiality.",
};

const INDUSTRY_CONTEXT: Record<string, string> = {
  SaaS: "B2B software. Users are developers, PMs, founders. Technical questions are common. Trial conversion and churn reduction are critical KPIs. Pricing often involves seats, usage tiers.",
  Healthcare: "Sensitive industry. HIPAA awareness required. Patients need empathy and clarity. Cannot provide medical diagnoses. Must route urgent cases immediately. Appointment scheduling is core.",
  Fitness: "Motivational tone needed. Members ask about classes, trainers, memberships. Churn prevention through engagement. Goal tracking and accountability features valued.",
  Finance: "High-trust environment. Cannot give financial advice. Compliance-aware responses. Customers ask about accounts, transactions, loans. Security verification important before sensitive info.",
  Cybersecurity: "Technical-savvy audience. Incident response workflows important. Jargon-friendly but also able to explain to non-technical stakeholders. Speed and precision critical.",
  eCommerce: "Order tracking, returns, product questions dominate. Inventory awareness. Promotional codes. Abandoned cart recovery. Shipping status. Review collection post-purchase.",
  Education: "Students, parents, faculty. Enrollment, deadlines, course info, financial aid. Patient and clear communication. Multi-persona: different flows for different user types.",
};

const TONE_GUIDES: Record<string, string> = {
  Professional: "Clear, concise, authoritative. No slang. Direct answers. Business-appropriate language.",
  Friendly: "Warm, approachable, encouraging. Uses light humor appropriately. First-name basis. Emotive but not unprofessional.",
  Luxury: "Elegant, exclusive, white-glove. Every interaction feels premium. 'Certainly', 'Absolutely', 'My pleasure'. Never rushed.",
  Technical: "Precise, detailed, exact. Uses correct terminology. Comfortable with specifications, code snippets, technical steps.",
  Corporate: "Formal, structured, policy-aligned. Neutral, balanced, process-oriented. Minimizes risk.",
  Conversational: "Natural, human-like, relaxed. Contractions allowed. Feels like texting a knowledgeable friend.",
};

const SYSTEM_PROMPT = `You are STAGEONE's chatbot generation engine. Create a production-ready AI assistant.

CRITICAL CHATBOT BEHAVIOR:

The chatbot communicates with customers, visitors, and clients. Never address the business owner, staff, employees, or team.

Never use phrases like:
- "Hey team"
- "Hello staff"
- "Welcome clinic team"
- "Hi business owners"

The first message must welcome the customer or visitor. Good example: "Hi! Welcome to SmileCare Dental. How can I help you today?"

Quick replies must represent customer intents. Never create internal business actions, technical options, management options, or integration options in quick replies. Forbidden examples: "Explore Pricing/Integration", "Manage System", "Configure Settings".

The generated chatbot must behave like a human conversational assistant.

It is NOT:
- a form
- a questionnaire
- an onboarding wizard
- a document

Never generate inside any string value:
- "Before We Begin"
- "Please provide your information"
- "Patient Information:"
- "Full Name:"
- "Date of Birth:"
- "Select an option:"
- numbered forms or steps
- markdown headings or bold markers
- placeholder variables like [Clinic Name], [NAME], [DATE/TIME]

Ask one natural question at a time. Never request multiple pieces of information in one response.

Use vocabulary specific to the industry: healthcare uses "appointment", "provider", "patient"; restaurant uses "reservation", "dining", "menu"; real estate uses "listing", "tour", "property"; legal uses "consultation", "case", "retainer"; fitness uses "class", "session", "trainer".

OUTPUT CONTRACT
Return ONLY valid JSON. No markdown, no text before or after.

JSON STRUCTURE — Populate each field with specific content for this business:

{
  "identity": {
    "name": "Unique name for this assistant",
    "role": "One-sentence description",
    "objective": "Primary goal in 1-2 sentences",
    "personality": "How the assistant behaves in conversation — 2-3 sentences",
    "greeting": "Warm opening that asks ONE natural question. Never list options or say 'enter your...' or 'please provide...'. Example: 'Hi, I'm Sage. I'd love to help you find the perfect property. What kind of home are you looking for?'"
  },
  "systemPrompt": {
    "main": "Full system prompt in second-person. Include: role, company context, behavior (short responses, one question at a time, remember the user), tone (warm, natural), memory rules (remember name, never ask twice, summarize before confirming), and conversation rules (apologize if frustrated, answer unrelated questions briefly then return to task, escalate on second frustration). 200-300 words.",
    "behavior": "How to conduct conversations — one question at a time, remember context, adapt tone to the user",
    "responseStyle": "Short sentences. Warm. Natural. One question per response.",
    "constraints": ["4 specific rules this assistant must follow for this business"],
    "fallbacks": ["3 natural fallback messages"]
  },
  "conversationFlows": {
    "welcome": {
      "trigger": "User opens chat",
      "botMessage": "Warm one-sentence greeting that asks one question",
      "quickReplies": ["4 short options matching this business"]
    },
    "leadCapture": {
      "trigger": "User shows buying interest",
      "steps": [
        { "bot": "Acknowledge interest conversationally", "type": "message" },
        { "bot": "Ask for name only", "type": "input", "inputLabel": "Full name", "field": "name" },
        { "bot": "Ask for email only", "type": "input", "inputLabel": "Email", "field": "email" },
        { "bot": "Confirm naturally and mention next step", "type": "message" }
      ]
    },
    "support": {
      "trigger": "User has issue or question",
      "responses": {
        "pricing": "Natural response about pricing",
        "technical": "Natural troubleshooting",
        "billing": "Empathetic billing assistance",
        "cancel": "Understand why, handle gracefully"
      }
    },
    "escalation": {
      "trigger": "Bot cannot resolve or user is frustrated",
      "botMessage": "Empathetic escalation message",
      "humanHandoff": "How to connect to a human"
    },
    "closing": {
      "trigger": "Conversation ending",
      "botMessage": "Warm closing that references what was discussed",
      "followUp": "Follow-up specific to this conversation"
    }
  },
  "suggestedPrompts": [
    "6 real questions a customer would naturally ask about this specific business. Not generic templates."
  ],
  "integrations": {
    "crm": [
      { "name": "Relevant CRM", "purpose": "What it does", "priority": "high" },
      { "name": "Relevant CRM", "purpose": "What it does", "priority": "medium" }
    ],
    "email": [
      { "name": "Relevant email service", "purpose": "What it does", "priority": "high" }
    ],
    "support": [
      { "name": "Relevant support tool", "purpose": "What it does", "priority": "high" },
      { "name": "Relevant support tool", "purpose": "What it does", "priority": "medium" }
    ],
    "automation": [
      { "name": "Relevant automation tool", "purpose": "What it does", "priority": "high" },
      { "name": "Relevant automation tool", "purpose": "What it does", "priority": "medium" }
    ],
    "calendar": [
      { "name": "Relevant calendar tool", "purpose": "What it does", "priority": "high" }
    ]
  },
  "automation": {
    "triggers": [
      { "event": "Trigger event for this business", "condition": "Condition", "action": "Action" },
      { "event": "Trigger event for this business", "condition": "Condition", "action": "Action" },
      { "event": "Trigger event for this business", "condition": "Condition", "action": "Action" }
    ],
    "workflows": [
      { "name": "Workflow name", "steps": ["Step 1", "Step 2", "Step 3", "Step 4"] },
      { "name": "Workflow name", "steps": ["Step 1", "Step 2", "Step 3", "Step 4"] }
    ],
    "notifications": [
      { "event": "Event", "recipient": "Who", "channel": "slack" },
      { "event": "Event", "recipient": "Who", "channel": "email" }
    ]
  },
  "deployment": {
    "recommended": ["Channel 1", "Channel 2", "Channel 3"],
    "widgetSnippet": "<script>\\n  window.ChatbotConfig = {\\n    botId: 'YOUR_BOT_ID',\\n    theme: { primary: '#d4af37', background: '#0a0a0a' },\\n    position: 'bottom-right'\\n  };\\n</script>\\n<script src=\\"https://cdn.stageone.ai/widget.js\\" defer></script>",
    "whatsappSetup": "WhatsApp setup instructions",
    "slackSetup": "Slack setup instructions"
  },
  "kpis": {
    "deflectionRate": "Target percentage",
    "responseTime": "Target time",
    "satisfactionScore": "Target score",
    "leadConversion": "Target percentage"
  }
}

Every string value must be specific, human-sounding, and industry-appropriate. Return ONLY the JSON object.`;


// POST /api/generate/chatbot/message — real-time NVIDIA-powered chat reply
router.post("/generate/chatbot/message", requireAuth, requireFeature("chatbot_generator"), async (req, res): Promise<void> => {
  try {
    const { message, systemPrompt: botSystemPrompt, history = [], language: msgLanguage } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }
    if (!process.env.NVIDIA_API_KEY) { res.status(500).json({ error: "NVIDIA_API_KEY not configured" }); return; }

    const messages = [
      { role: "system" as const, content: (botSystemPrompt || "You are a helpful AI assistant. Be concise and friendly.") + getLanguageInstruction(msgLanguage) },
      ...history.slice(-8).map((m: { role: string; text: string }) => ({
        role: (m.role === "bot" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      })),
      { role: "user" as const, content: message.trim() },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({ model: MODELS.CHATBOT, messages, temperature: 0.7, maxTokens: 300, nvextParams: { thinking: { enabled: false } } });
    } catch (err) {
      req.log.error({ err, model: MODELS.CHATBOT }, `[AI:${MODELS.CHATBOT}] Chatbot message stream failed`);
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      res.end();
      return;
    }

    await forwardStream(streamBody, res, MODELS.CHATBOT);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ error }, "Chatbot message error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/generate/chatbot", requireAuth, requireFeature("chatbot_generator"), async (req, res): Promise<void> => {
  try {
    const { businessDescription, chatbotType = "Customer Support", tone = "Professional", industry = "SaaS", language } = req.body;

    req.log.info({ event: "CHATBOT_FLOW_1", chatbotType, tone, industry, descriptionLength: (businessDescription ?? "").length }, "[CHATBOT] CHATBOT_FLOW_1 — confirmation received, generation starting");

    if (!businessDescription?.trim()) {
      res.status(400).json({ error: "Business description is required" }); return;
    }
    if (!process.env.NVIDIA_API_KEY) {
      res.status(500).json({ error: "NVIDIA_API_KEY not configured" }); return;
    }

    const typeGuide = CHATBOT_TYPE_GUIDES[chatbotType] ?? CHATBOT_TYPE_GUIDES["Customer Support"];
    const industryCtx = INDUSTRY_CONTEXT[industry] ?? INDUSTRY_CONTEXT["SaaS"];
    const toneGuide = TONE_GUIDES[tone] ?? TONE_GUIDES["Professional"];

    const userMessage = `Generate a complete AI chatbot system for:

BUSINESS: "${businessDescription}"
CHATBOT TYPE: ${chatbotType}
${typeGuide}

INDUSTRY: ${industry}
${industryCtx}

TONE: ${tone}
${toneGuide}

Make every response, flow, and integration SPECIFIC to this business. This chatbot should feel custom-built, not templated.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    req.log.info({ event: "CHATBOT_FLOW_2", model: MODELS.CHATBOT, promptLength: userMessage.length, promptVersion: "V4-conversation", systemPromptFirst200: SYSTEM_PROMPT.slice(0, 200) }, "[CHATBOT] CHATBOT_FLOW_2 — generation request sent to model");

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({
        model: MODELS.CHATBOT,
        messages: [{ role: "system", content: SYSTEM_PROMPT + getLanguageInstruction(language) }, { role: "user", content: userMessage }],
        temperature: 0.7,
        maxTokens: 8000,
        // Disable thinking: Nemotron 49B emits its JSON in reasoning_content (which
        // forwardStream discards) when thinking is on, leaving rawBuffer empty → parse failure.
        // Automation uses the same fix. Without this flag the model silently swallows the output.
        nvextParams: { thinking: { enabled: false } },
      });
    } catch (err) {
      req.log.error({ err, model: MODELS.CHATBOT }, `[AI:${MODELS.CHATBOT}] Chatbot stream failed`);
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      res.end(); return;
    }

    try {
      const rawBuffer = await forwardStream(streamBody, res, MODELS.CHATBOT);

      // ── CHATBOT_PARSE_3 ───────────────────────────────────────────────────────
      req.log.info({ event: "CHATBOT_PARSE_3", responseType: typeof rawBuffer, responseLength: rawBuffer.length, first500: rawBuffer.slice(0, 500) }, "[CHATBOT] CHATBOT_PARSE_3 raw response");
      req.log.info({ event: "CHATBOT_FLOW_3", rawLength: rawBuffer.length, hasThinkTags: rawBuffer.includes("<think>"), first200: rawBuffer.slice(0, 200) }, "[CHATBOT] CHATBOT_FLOW_3 — raw model response received");

      // Strip <think>...</think> reasoning blocks (same as orchestrator route)
      const stripped = rawBuffer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      req.log.info({ event: "CHATBOT_FLOW_4", strippedLength: stripped.length, first200: stripped.slice(0, 200) }, "[CHATBOT] CHATBOT_FLOW_4 — parser input after think-tag stripping");

      let data: unknown;
      try {
        // ── CHATBOT_PARSE_4 ─────────────────────────────────────────────────────
        req.log.info({ event: "CHATBOT_PARSE_4", parserFunction: "extractJson", inputLength: stripped.length }, "[CHATBOT] CHATBOT_PARSE_4 entering parser");
        data = extractJson(stripped);
        // ── CHATBOT_PARSE_6 ─────────────────────────────────────────────────────
        const _p6 = data as Record<string, unknown>;
        req.log.info({
          event: "CHATBOT_PARSE_6",
          topLevelKeys: Object.keys(_p6),
          messageCount: Array.isArray(_p6.messages) ? (_p6.messages as unknown[]).length : undefined,
          hasIdentity: !!_p6.identity,
          hasSystemPrompt: !!_p6.systemPrompt,
          hasFlows: !!_p6.conversationFlows,
        }, "[CHATBOT] CHATBOT_PARSE_6 parsed successfully");
        req.log.info({ event: "CHATBOT_FLOW_6", hasIdentity: !!_p6.identity, hasSystemPrompt: !!_p6.systemPrompt, hasFlows: !!_p6.conversationFlows, topLevelKeys: Object.keys(_p6) }, "[CHATBOT] CHATBOT_FLOW_6 — parsed object");
      } catch (parseErr) {
        // ── CHATBOT_PARSE_5 ─────────────────────────────────────────────────────
        req.log.error({
          event: "CHATBOT_PARSE_5",
          exception: String(parseErr),
          stack: parseErr instanceof Error ? parseErr.stack : undefined,
          inputSnippet: stripped.slice(0, 500),
          inputLength: stripped.length,
        }, "[CHATBOT] CHATBOT_PARSE_5 parser failed");
        req.log.error({ event: "CHATBOT_FLOW_5", parseErr: String(parseErr), rawLength: stripped.length, rawSample: stripped.slice(0, 500) }, "[CHATBOT] CHATBOT_FLOW_5 — parser error");
        res.write(`data: ${JSON.stringify({ error: "Failed to parse response — please try again" })}\n\n`);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ done: true, data })}\n\n`);
      req.log.info({ event: "CHATBOT_FLOW_7", note: "Generation complete — client receives data and will call saveToProject()" }, "[CHATBOT] CHATBOT_FLOW_7 — generation delivered to client");
    } catch (streamErr) {
      // ── CHATBOT_PARSE_STREAM_ERR — failure before parser was ever reached ────
      req.log.error({ event: "CHATBOT_PARSE_STREAM_ERR", exception: String(streamErr), stack: streamErr instanceof Error ? streamErr.stack : undefined, note: "stream read failed before extractJson — PARSE_3 through PARSE_6 will be absent" }, "[CHATBOT] CHATBOT_PARSE_STREAM_ERR pre-parser stream failure");
      req.log.error({ streamErr, model: MODELS.CHATBOT }, `[AI:${MODELS.CHATBOT}] Chatbot stream read error`);
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
    }
    res.end();
    logEventFireForget({ userId: req.user!.userId, type: "chatbot_generated", data: { chatbotType, industry }, req });
    trackUsageFireForget(req.user!.userId, "chatbotGenerations");
  } catch (error) {
    req.log.error({ error }, "Generate chatbot error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
