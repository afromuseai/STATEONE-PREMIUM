import { Router } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Static agent catalog — all available agents in the store
const AGENT_CATALOG = [
  {
    id: "sales-prospector",
    name: "Sales Prospector",
    category: "Sales",
    description: "Automatically research leads, enrich contact data, and score prospects based on ICP fit.",
    capabilities: ["Lead enrichment", "ICP scoring", "Outreach sequencing", "CRM sync"],
    integrations: ["Salesforce", "HubSpot", "LinkedIn", "Apollo"],
    rating: 4.8,
    installCount: 2341,
    icon: "🎯",
    tier: "pro",
  },
  {
    id: "support-resolver",
    name: "Support Resolver",
    category: "Support",
    description: "Resolve Tier-1 support tickets autonomously using your knowledge base and escalation rules.",
    capabilities: ["Ticket resolution", "Knowledge base search", "Escalation routing", "CSAT tracking"],
    integrations: ["Zendesk", "Intercom", "Slack", "Notion"],
    rating: 4.7,
    installCount: 1876,
    icon: "🛟",
    tier: "free",
  },
  {
    id: "content-generator",
    name: "Content Generator",
    category: "Marketing",
    description: "Generate SEO-optimized blog posts, social copy, and email campaigns from a single brief.",
    capabilities: ["Blog generation", "Social copy", "Email campaigns", "SEO optimization"],
    integrations: ["WordPress", "HubSpot", "Mailchimp", "Buffer"],
    rating: 4.6,
    installCount: 3102,
    icon: "✍️",
    tier: "free",
  },
  {
    id: "market-researcher",
    name: "Market Researcher",
    category: "Research",
    description: "Deep-dive competitive analysis, market sizing, and trend identification in minutes.",
    capabilities: ["Competitor analysis", "Market sizing", "Trend detection", "Report generation"],
    integrations: ["SimilarWeb", "Crunchbase", "SEMrush", "Perplexity"],
    rating: 4.9,
    installCount: 987,
    icon: "🔬",
    tier: "pro",
  },
  {
    id: "ops-automator",
    name: "Ops Automator",
    category: "Operations",
    description: "Automate repetitive operations tasks — approvals, reporting, data syncing, and scheduling.",
    capabilities: ["Workflow automation", "Approval routing", "Data sync", "Scheduled reports"],
    integrations: ["Zapier", "Make", "Airtable", "Google Workspace"],
    rating: 4.5,
    installCount: 1543,
    icon: "⚙️",
    tier: "free",
  },
  {
    id: "revenue-analyst",
    name: "Revenue Analyst",
    category: "Analytics",
    description: "Monitor revenue metrics, detect anomalies, and surface growth opportunities automatically.",
    capabilities: ["MRR tracking", "Churn prediction", "Cohort analysis", "Anomaly alerts"],
    integrations: ["Stripe", "Chargebee", "Mixpanel", "Amplitude"],
    rating: 4.8,
    installCount: 756,
    icon: "📊",
    tier: "pro",
  },
  {
    id: "security-watcher",
    name: "Security Watcher",
    category: "Cybersecurity",
    description: "Monitor for vulnerabilities, suspicious activity, and compliance drift across your stack.",
    capabilities: ["Threat detection", "Compliance monitoring", "Vulnerability scanning", "Incident alerts"],
    integrations: ["AWS Security Hub", "Datadog", "PagerDuty", "GitHub"],
    rating: 4.7,
    installCount: 432,
    icon: "🛡️",
    tier: "enterprise",
  },
  {
    id: "email-outreach",
    name: "Email Outreach",
    category: "Sales",
    description: "Personalized cold email sequences with A/B testing, follow-ups, and reply handling.",
    capabilities: ["Personalization", "A/B testing", "Follow-up sequences", "Reply detection"],
    integrations: ["Gmail", "Outlook", "Apollo", "Lemlist"],
    rating: 4.5,
    installCount: 2109,
    icon: "📧",
    tier: "free",
  },
  {
    id: "social-listener",
    name: "Social Listener",
    category: "Marketing",
    description: "Track brand mentions, competitor activity, and industry trends across social platforms.",
    capabilities: ["Brand monitoring", "Competitor tracking", "Sentiment analysis", "Trend alerts"],
    integrations: ["Twitter/X", "LinkedIn", "Reddit", "Product Hunt"],
    rating: 4.4,
    installCount: 1234,
    icon: "👂",
    tier: "free",
  },
  {
    id: "invoice-collector",
    name: "Invoice Collector",
    category: "Operations",
    description: "Automate invoice creation, payment follow-ups, and reconciliation with your accounting system.",
    capabilities: ["Invoice generation", "Payment reminders", "Reconciliation", "Tax reporting"],
    integrations: ["QuickBooks", "Xero", "Stripe", "Wise"],
    rating: 4.6,
    installCount: 891,
    icon: "🧾",
    tier: "free",
  },
  {
    id: "hiring-screener",
    name: "Hiring Screener",
    category: "Operations",
    description: "Screen resumes, schedule interviews, and rank candidates against your job requirements.",
    capabilities: ["Resume screening", "Candidate scoring", "Interview scheduling", "ATS sync"],
    integrations: ["Greenhouse", "Lever", "Calendly", "Slack"],
    rating: 4.3,
    installCount: 567,
    icon: "👤",
    tier: "pro",
  },
  {
    id: "knowledge-curator",
    name: "Knowledge Curator",
    category: "Research",
    description: "Continuously curate, summarize, and organize knowledge from your team's favorite sources.",
    capabilities: ["Content curation", "Auto-summarization", "Knowledge base updates", "Digest emails"],
    integrations: ["Notion", "Confluence", "Slack", "RSS feeds"],
    rating: 4.5,
    installCount: 678,
    icon: "📚",
    tier: "free",
  },
];

const InstallAgentBody = z.object({
  agentId: z.string().min(1),
  config: z.record(z.unknown()).optional().default({}),
  behaviorRules: z.array(z.string()).optional().default([]),
  integrations: z.array(z.string()).optional().default([]),
});

const UpdateAgentBody = z.object({
  config: z.record(z.unknown()).optional(),
  behaviorRules: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// Get the full agent catalog
router.get("/agents/catalog", requireAuth, (_req, res) => {
  res.json({ agents: AGENT_CATALOG });
});

// Get all installed agents for the user
router.get("/agents", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const installed = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.userId, userId))
    .orderBy(desc(agentsTable.installedAt));
  res.json({ agents: installed });
});

// Install an agent
router.post("/agents", requireAuth, async (req, res): Promise<void> => {
  const parsed = InstallAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;

  const catalogEntry = AGENT_CATALOG.find((a) => a.id === parsed.data.agentId);
  if (!catalogEntry) {
    res.status(404).json({ error: "Agent not found in catalog" });
    return;
  }

  // Check if already installed
  const [existing] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.userId, userId), eq(agentsTable.agentId, parsed.data.agentId)));
  if (existing) {
    res.status(409).json({ error: "Agent already installed", agent: existing });
    return;
  }

  const [agent] = await db
    .insert(agentsTable)
    .values({
      userId,
      agentId: parsed.data.agentId,
      name: catalogEntry.name,
      category: catalogEntry.category,
      config: parsed.data.config,
      behaviorRules: parsed.data.behaviorRules,
      integrations:
        parsed.data.integrations.length > 0
          ? parsed.data.integrations
          : catalogEntry.integrations,
      status: "active",
    })
    .returning();

  res.status(201).json({ agent });
});

// Get a single installed agent
router.get("/agents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, id), eq(agentsTable.userId, userId)));
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

  const catalogEntry = AGENT_CATALOG.find((a) => a.id === agent.agentId);
  res.json({ agent, catalog: catalogEntry ?? null });
});

// Update agent config / behavior rules
router.patch("/agents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.config !== undefined) updates.config = parsed.data.config;
  if (parsed.data.behaviorRules !== undefined) updates.behaviorRules = parsed.data.behaviorRules;
  if (parsed.data.integrations !== undefined) updates.integrations = parsed.data.integrations;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  const [agent] = await db
    .update(agentsTable)
    .set(updates)
    .where(and(eq(agentsTable.id, id), eq(agentsTable.userId, userId)))
    .returning();
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  res.json({ agent });
});

// Uninstall an agent
router.delete("/agents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(agentsTable)
    .where(and(eq(agentsTable.id, id), eq(agentsTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Agent not found" }); return; }
  res.sendStatus(204);
});

export default router;
