import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson, callNvidia } from "../lib/nvidia";
import { getLanguageInstruction } from "../lib/language";

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

const SYSTEM_PROMPT = `You are an enterprise AI chatbot architect with deep expertise in conversational design, CRM integrations, and business automation. Generate a complete, deployable AI chatbot system.

Return ONLY valid JSON starting with { and ending with }. No markdown, no explanation.

Shape:
{
  "identity": {
    "name": "ChatbotName",
    "role": "one-sentence role",
    "objective": "primary objective in 1-2 sentences",
    "personality": "personality description in 2-3 sentences",
    "greeting": "Full opening message (2-3 sentences, warm, with a question to engage)"
  },
  "systemPrompt": {
    "main": "Complete system prompt (200-300 words). Role, company context, behavior, constraints, tone. Use second-person 'You are...'",
    "behavior": "3-4 behavioral guidelines as a paragraph",
    "responseStyle": "How responses should be formatted and delivered",
    "constraints": ["Never do X", "Never do Y", "Never do Z", "Never do W"],
    "fallbacks": ["I'm not sure about that — let me connect you with a specialist.", "That's a great question. Let me pull up the right information for you.", "I want to make sure I give you the right answer — could you clarify what you mean by...?"]
  },
  "conversationFlows": {
    "welcome": {
      "trigger": "User opens chat",
      "botMessage": "Full greeting message",
      "quickReplies": ["Option 1", "Option 2", "Option 3", "Option 4"]
    },
    "leadCapture": {
      "trigger": "User shows buying interest",
      "steps": [
        { "bot": "message text", "type": "message" },
        { "bot": "What's your full name?", "type": "input", "inputLabel": "Full name", "field": "name" },
        { "bot": "Your email so we can follow up?", "type": "input", "inputLabel": "Email address", "field": "email" },
        { "bot": "final message after capture", "type": "message" }
      ]
    },
    "support": {
      "trigger": "User has issue or question",
      "responses": {
        "pricing": "Response about pricing",
        "technical": "Response about technical issues",
        "billing": "Response about billing",
        "cancel": "Response about cancellation"
      }
    },
    "escalation": {
      "trigger": "Bot cannot resolve or user is frustrated",
      "botMessage": "Full escalation message",
      "humanHandoff": "How to connect to human agent"
    },
    "closing": {
      "trigger": "Conversation ending",
      "botMessage": "Warm closing message",
      "followUp": "Follow-up action or message"
    }
  },
  "suggestedPrompts": [
    "Question users commonly ask 1?",
    "Question users commonly ask 2?",
    "Question users commonly ask 3?",
    "Question users commonly ask 4?",
    "Question users commonly ask 5?",
    "Question users commonly ask 6?"
  ],
  "integrations": {
    "crm": [
      { "name": "HubSpot", "purpose": "Lead capture and pipeline", "priority": "high" },
      { "name": "Salesforce", "purpose": "Enterprise CRM sync", "priority": "medium" }
    ],
    "email": [
      { "name": "Mailchimp", "purpose": "Email sequence enrollment", "priority": "high" }
    ],
    "support": [
      { "name": "Zendesk", "purpose": "Ticket creation and status", "priority": "high" },
      { "name": "Intercom", "purpose": "Live chat handoff", "priority": "medium" }
    ],
    "automation": [
      { "name": "Zapier", "purpose": "Multi-app workflow automation", "priority": "high" },
      { "name": "n8n", "purpose": "Self-hosted automation", "priority": "medium" }
    ],
    "calendar": [
      { "name": "Calendly", "purpose": "Meeting booking links", "priority": "high" }
    ]
  },
  "automation": {
    "triggers": [
      { "event": "New lead captured", "condition": "Email collected", "action": "Enroll in email sequence + notify sales" },
      { "event": "User asks about pricing", "condition": "Intent score > 7", "action": "Escalate to sales rep within 5 min" },
      { "event": "Support issue unresolved", "condition": "2+ failed bot responses", "action": "Create Zendesk ticket + alert support team" }
    ],
    "workflows": [
      { "name": "Lead Qualification Workflow", "steps": ["Capture name/email", "Score intent (1-10)", "Route to appropriate team", "Send welcome sequence"] },
      { "name": "Support Deflection Workflow", "steps": ["Detect support intent", "Search knowledge base", "Provide answer with confidence score", "Escalate if confidence < 70%"] }
    ],
    "notifications": [
      { "event": "Hot lead identified", "recipient": "Sales team", "channel": "slack" },
      { "event": "Support ticket created", "recipient": "Support agent", "channel": "email" }
    ]
  },
  "deployment": {
    "recommended": ["website_widget", "whatsapp", "slack"],
    "widgetSnippet": "<script>\\n  window.ChatbotConfig = {\\n    botId: 'YOUR_BOT_ID',\\n    theme: { primary: '#d4af37', background: '#0a0a0a' },\\n    position: 'bottom-right'\\n  };\\n</script>\\n<script src=\\"https://cdn.stageone.ai/widget.js\\" defer></script>",
    "whatsappSetup": "Connect via Twilio WhatsApp API or Meta Business Suite. Use the system prompt above with GPT-4/Claude. Map conversation flows to WhatsApp message templates.",
    "slackSetup": "Create a Slack App at api.slack.com. Subscribe to message events. Route to bot engine using system prompt. Use Block Kit for quick replies."
  },
  "kpis": {
    "deflectionRate": "Target: 65-75% of inquiries resolved without human",
    "responseTime": "Target: < 3 seconds average response",
    "satisfactionScore": "Target: CSAT > 4.2/5.0",
    "leadConversion": "Target: 15-25% of captured leads convert to qualified"
  }
}

Rules:
- All content must be SPECIFIC to the business described — no generic templates
- System prompt must be production-ready, deployable as-is
- Conversation flows must reflect the actual chatbot type and industry
- Integrations must be prioritized by relevance to the business
- Return ONLY the JSON object, nothing else`;


// POST /api/generate/chatbot/message — real-time NVIDIA-powered chat reply
router.post("/generate/chatbot/message", requireAuth, async (req, res): Promise<void> => {
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
      streamBody = await streamNvidia({ model: MODELS.CHATBOT, messages, temperature: 0.7, maxTokens: 300 });
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

router.post("/generate/chatbot", requireAuth, async (req, res): Promise<void> => {
  try {
    const { businessDescription, chatbotType = "Customer Support", tone = "Professional", industry = "SaaS", language } = req.body;

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

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({
        model: MODELS.CHATBOT,
        messages: [{ role: "system", content: SYSTEM_PROMPT + getLanguageInstruction(language) }, { role: "user", content: userMessage }],
        temperature: 0.7,
        maxTokens: 5000,
      });
    } catch (err) {
      req.log.error({ err, model: MODELS.CHATBOT }, `[AI:${MODELS.CHATBOT}] Chatbot stream failed`);
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      res.end(); return;
    }

    try {
      const rawBuffer = await forwardStream(streamBody, res, MODELS.CHATBOT);
      const data = extractJson(rawBuffer);
      res.write(`data: ${JSON.stringify({ done: true, data })}\n\n`);
    } catch (parseErr) {
      req.log.error({ parseErr, model: MODELS.CHATBOT }, `[AI:${MODELS.CHATBOT}] Chatbot JSON parse failed`);
      res.write(`data: ${JSON.stringify({ error: "Failed to parse response — please try again" })}\n\n`);
    }
    res.end();
  } catch (error) {
    req.log.error({ error }, "Generate chatbot error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
