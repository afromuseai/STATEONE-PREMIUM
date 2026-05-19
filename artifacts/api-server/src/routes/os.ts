import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  db,
  projectsTable,
  agentsTable,
  aiMemoryTable,
  executionsTable,
  deploymentsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, desc, count, and, gte, sql } from "drizzle-orm";
import { emitNotification } from "./notifications";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream } from "../lib/nvidia";

const router = Router();

// ─── GET /api/os/state — Unified system state ─────────────────────────────────
router.get("/os/state", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const [
      projectRows,
      agentRows,
      memoryRows,
      executionRows,
      deploymentRows,
      recentNotifications,
    ] = await Promise.all([
      db
        .select({ id: projectsTable.id, title: projectsTable.title, output: projectsTable.output, createdAt: projectsTable.createdAt })
        .from(projectsTable)
        .where(eq(projectsTable.userId, userId))
        .orderBy(desc(projectsTable.createdAt))
        .limit(10),
      db
        .select({ id: agentsTable.id, name: agentsTable.name, category: agentsTable.category, isActive: agentsTable.isActive, createdAt: agentsTable.installedAt })
        .from(agentsTable)
        .where(eq(agentsTable.userId, userId))
        .orderBy(desc(agentsTable.installedAt)),
      db
        .select({ id: aiMemoryTable.id, key: aiMemoryTable.key, value: aiMemoryTable.value, importance: aiMemoryTable.importance, source: aiMemoryTable.source, updatedAt: aiMemoryTable.updatedAt })
        .from(aiMemoryTable)
        .where(eq(aiMemoryTable.userId, userId))
        .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt))
        .limit(20),
      db
        .select({ id: executionsTable.id, name: executionsTable.name, status: executionsTable.status, priority: executionsTable.priority, createdAt: executionsTable.createdAt, durationMs: executionsTable.durationMs })
        .from(executionsTable)
        .where(eq(executionsTable.userId, userId))
        .orderBy(desc(executionsTable.createdAt))
        .limit(10),
      db
        .select({ id: deploymentsTable.id, name: deploymentsTable.name, status: deploymentsTable.status, createdAt: deploymentsTable.createdAt })
        .from(deploymentsTable)
        .where(eq(deploymentsTable.userId, userId))
        .orderBy(desc(deploymentsTable.createdAt))
        .limit(5),
      db
        .select({ id: notificationsTable.id, type: notificationsTable.type, title: notificationsTable.title, severity: notificationsTable.severity, createdAt: notificationsTable.createdAt })
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(15),
    ]);

    // ─── Compute module states ──────────────────────────────────────────────────
    const latestProject = projectRows[0];
    const latestBi = latestProject?.output as Record<string, unknown> | null;
    const industry = (latestBi?.industry as string) ?? null;
    const websiteCount = projectRows.filter(p => {
      const o = p.output as Record<string, unknown> | null;
      return !!o?.websiteOutput;
    }).length;

    const activeAgents = agentRows.filter(a => a.isActive);
    const completedExecs = executionRows.filter(e => e.status === "completed");
    const runningExecs = executionRows.filter(e => e.status === "running");
    const activeDeployments = deploymentRows.filter(d => d.status === "active");

    // ─── Coordination score: what % of modules are active/populated ────────────
    const moduleScores = [
      projectRows.length > 0 ? 1 : 0,
      websiteCount > 0 ? 1 : 0,
      activeAgents.length > 0 ? 1 : 0,
      memoryRows.length > 0 ? 1 : 0,
      executionRows.length > 0 ? 1 : 0,
      activeDeployments.length > 0 ? 1 : 0,
    ];
    const coordinationScore = Math.round((moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length) * 100);

    // ─── System health: weighted quality score ─────────────────────────────────
    let healthScore = 20; // base
    if (projectRows.length > 0) healthScore += 15;
    if (projectRows.length >= 3) healthScore += 5;
    if (websiteCount > 0) healthScore += 15;
    if (activeAgents.length > 0) healthScore += 15;
    if (memoryRows.filter(m => m.importance >= 4).length > 0) healthScore += 10;
    if (completedExecs.length > 0) healthScore += 10;
    if (activeDeployments.length > 0) healthScore += 10;
    healthScore = Math.min(100, healthScore);

    // ─── Intelligence priority queue ───────────────────────────────────────────
    type PriorityTask = {
      id: string;
      priority: number;
      category: string;
      title: string;
      description: string;
      targetModule: string;
      estimatedImpact: string;
      actionPath: string;
    };

    const priorityQueue: PriorityTask[] = [];

    // Priority 1: Execution-critical
    if (runningExecs.length > 0) {
      priorityQueue.push({
        id: "running-execs",
        priority: 1,
        category: "execution",
        title: `${runningExecs.length} execution${runningExecs.length > 1 ? "s" : ""} in progress`,
        description: "Active executions require monitoring to ensure successful completion",
        targetModule: "Execution Engine",
        estimatedImpact: "Prevent workflow failures and data loss",
        actionPath: "/execution-engine",
      });
    }

    // Priority 2: Revenue-impacting
    if (projectRows.length > 0 && websiteCount === 0) {
      priorityQueue.push({
        id: "no-website",
        priority: 2,
        category: "revenue",
        title: "Generate your website",
        description: `${industry ?? "Your business"} analysis complete — launch a conversion-optimized site`,
        targetModule: "Website Architect",
        estimatedImpact: "Unlocks lead capture and conversion tracking",
        actionPath: "/dashboard?tab=new",
      });
    }

    if (activeDeployments.length === 0 && websiteCount > 0) {
      priorityQueue.push({
        id: "no-deployment",
        priority: 2,
        category: "revenue",
        title: "Deploy your generated site",
        description: "Website built but not live — deploy to start generating leads",
        targetModule: "STAGEONE Cloud",
        estimatedImpact: "Convert site visitors into qualified leads",
        actionPath: "/deployments",
      });
    }

    // Priority 3: Conversion improvements
    if (activeAgents.length === 0 && projectRows.length > 0) {
      priorityQueue.push({
        id: "no-agents",
        priority: 3,
        category: "conversion",
        title: "Install AI agents",
        description: `${industry ?? "Your"} business has untapped automation potential — install specialized agents`,
        targetModule: "Agent Store",
        estimatedImpact: "Automate lead qualification and customer handling",
        actionPath: "/agents",
      });
    }

    // Priority 4: Automation opportunities
    if (memoryRows.length < 5 && projectRows.length >= 2) {
      priorityQueue.push({
        id: "low-memory",
        priority: 4,
        category: "automation",
        title: "Build your AI memory base",
        description: "More analyses = richer cross-session intelligence. Run more business analyses.",
        targetModule: "AI Memory",
        estimatedImpact: "Progressively smarter recommendations across sessions",
        actionPath: "/memory",
      });
    }

    if (executionRows.length === 0) {
      priorityQueue.push({
        id: "no-executions",
        priority: 4,
        category: "automation",
        title: "Run your first AI execution",
        description: "Use the Execution Engine to trigger system-wide intelligence operations",
        targetModule: "Execution Engine",
        estimatedImpact: "Activate cross-system AI automation",
        actionPath: "/execution-engine",
      });
    }

    // Priority 5: Cosmetic / polish
    if (projectRows.length === 0) {
      priorityQueue.push({
        id: "first-analysis",
        priority: 5,
        category: "cosmetic",
        title: "Run your first business analysis",
        description: "Enter your business idea to generate a complete strategic blueprint",
        targetModule: "Business Intelligence",
        estimatedImpact: "Foundation for all STAGEONE modules",
        actionPath: "/dashboard?tab=new",
      });
    }

    // ─── Self-optimization opportunities ───────────────────────────────────────
    type OptimizationOpportunity = {
      id: string;
      inefficiency: string;
      suggestion: string;
      targetModule: string;
      impactScore: number;
      actionPath: string;
    };

    const optimizations: OptimizationOpportunity[] = [];

    if (projectRows.length > 0 && websiteCount === 0) {
      optimizations.push({
        id: "opt-website",
        inefficiency: "Business intelligence generated but no website deployed",
        suggestion: "Generate a site from your existing analysis — all copy and brand voice are already defined",
        targetModule: "Website Architect",
        impactScore: 92,
        actionPath: "/dashboard?tab=new",
      });
    }

    if (activeAgents.length === 0 && projectRows.length > 0) {
      const biMetrics = latestBi?.metrics as Record<string, number> | null;
      const autoPotential = biMetrics?.automationPotential ?? 50;
      optimizations.push({
        id: "opt-agents",
        inefficiency: `${autoPotential}% automation potential is completely manual`,
        suggestion: "Install Sales + Support agents to handle lead qualification automatically",
        targetModule: "Agent Store",
        impactScore: autoPotential,
        actionPath: "/agents",
      });
    }

    const highImportanceMemory = memoryRows.filter(m => m.importance >= 4);
    if (highImportanceMemory.length > 0 && projectRows.length >= 2) {
      optimizations.push({
        id: "opt-memory",
        inefficiency: `${highImportanceMemory.length} high-priority memory entries not yet cross-referenced`,
        suggestion: "Run a new Business Intelligence analysis — the system will automatically apply all stored context",
        targetModule: "Business Intelligence",
        impactScore: 78,
        actionPath: "/dashboard?tab=new",
      });
    }

    if (executionRows.length > 0 && completedExecs.length / executionRows.length < 0.6) {
      optimizations.push({
        id: "opt-executions",
        inefficiency: "Low execution success rate — potential workflow configuration issues",
        suggestion: "Review failed executions and retry with refined intent prompts",
        targetModule: "Execution Engine",
        impactScore: 85,
        actionPath: "/execution-engine",
      });
    }

    // ─── Recent activity feed ──────────────────────────────────────────────────
    type ActivityItem = {
      id: string;
      module: string;
      action: string;
      timestamp: string;
      impact: string;
      icon: string;
    };

    const recentActivity: ActivityItem[] = [
      ...projectRows.slice(0, 3).map(p => ({
        id: `proj-${p.id}`,
        module: "Business Intelligence",
        action: `Analysis: "${p.title}"`,
        timestamp: p.createdAt.toISOString(),
        impact: "high",
        icon: "BarChart3",
      })),
      ...agentRows.slice(0, 2).map(a => ({
        id: `agent-${a.id}`,
        module: "Agent Store",
        action: `Agent installed: ${a.name}`,
        timestamp: a.createdAt.toISOString(),
        impact: "medium",
        icon: "Bot",
      })),
      ...executionRows.slice(0, 2).map(e => ({
        id: `exec-${e.id}`,
        module: "Execution Engine",
        action: `Execution: ${e.name} [${e.status}]`,
        timestamp: e.createdAt.toISOString(),
        impact: e.status === "completed" ? "high" : e.status === "failed" ? "medium" : "low",
        icon: "Zap",
      })),
      ...memoryRows.slice(0, 2).map(m => ({
        id: `mem-${m.id}`,
        module: "AI Memory",
        action: `Memory stored: ${m.key}`,
        timestamp: m.updatedAt.toISOString(),
        impact: m.importance >= 4 ? "high" : "low",
        icon: "Database",
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // ─── Module definitions ────────────────────────────────────────────────────
    const modules = [
      {
        id: "bi",
        name: "Business Intelligence",
        status: projectRows.length > 0 ? "active" : "idle",
        activityCount: projectRows.length,
        lastActivity: projectRows[0]?.createdAt.toISOString() ?? null,
        health: projectRows.length > 0 ? 90 : 20,
        path: "/dashboard?tab=new",
        detail: projectRows.length > 0 ? `${industry ?? "Unknown"} · ${projectRows.length} project${projectRows.length !== 1 ? "s" : ""}` : "No analysis yet",
      },
      {
        id: "website",
        name: "Website Architect",
        status: websiteCount > 0 ? "active" : projectRows.length > 0 ? "ready" : "idle",
        activityCount: websiteCount,
        lastActivity: null,
        health: websiteCount > 0 ? 88 : projectRows.length > 0 ? 45 : 10,
        path: "/website-generator",
        detail: websiteCount > 0 ? `${websiteCount} site${websiteCount !== 1 ? "s" : ""} generated` : projectRows.length > 0 ? "Ready to generate" : "Waiting on BI",
      },
      {
        id: "agents",
        name: "AI Agents",
        status: activeAgents.length > 0 ? "active" : agentRows.length > 0 ? "ready" : "idle",
        activityCount: activeAgents.length,
        lastActivity: agentRows[0]?.createdAt.toISOString() ?? null,
        health: activeAgents.length > 0 ? 85 : agentRows.length > 0 ? 50 : 15,
        path: "/agents",
        detail: activeAgents.length > 0 ? `${activeAgents.length} active agent${activeAgents.length !== 1 ? "s" : ""}` : "No agents installed",
      },
      {
        id: "memory",
        name: "Global Memory",
        status: memoryRows.length > 0 ? "active" : "idle",
        activityCount: memoryRows.length,
        lastActivity: memoryRows[0]?.updatedAt.toISOString() ?? null,
        health: Math.min(100, 10 + memoryRows.length * 4),
        path: "/memory",
        detail: memoryRows.length > 0 ? `${memoryRows.length} memories · ${highImportanceMemory.length} high-priority` : "Empty memory",
      },
      {
        id: "execution",
        name: "Execution Engine",
        status: runningExecs.length > 0 ? "active" : executionRows.length > 0 ? "ready" : "idle",
        activityCount: executionRows.length,
        lastActivity: executionRows[0]?.createdAt.toISOString() ?? null,
        health: executionRows.length > 0 ? Math.round((completedExecs.length / executionRows.length) * 100) : 10,
        path: "/execution-engine",
        detail: runningExecs.length > 0 ? `${runningExecs.length} running` : `${completedExecs.length}/${executionRows.length} completed`,
      },
      {
        id: "deployments",
        name: "STAGEONE Cloud",
        status: activeDeployments.length > 0 ? "active" : deploymentRows.length > 0 ? "ready" : "idle",
        activityCount: deploymentRows.length,
        lastActivity: deploymentRows[0]?.createdAt.toISOString() ?? null,
        health: activeDeployments.length > 0 ? 95 : deploymentRows.length > 0 ? 40 : 5,
        path: "/deployments",
        detail: activeDeployments.length > 0 ? `${activeDeployments.length} live deployment${activeDeployments.length !== 1 ? "s" : ""}` : "No deployments yet",
      },
    ];

    res.json({
      coordinationScore,
      systemHealth: healthScore,
      activeModules: moduleScores.filter(s => s === 1).length,
      totalModules: modules.length,
      industry,
      modules,
      priorityQueue: priorityQueue.sort((a, b) => a.priority - b.priority),
      optimizations: optimizations.sort((a, b) => b.impactScore - a.impactScore),
      recentActivity,
      stats: {
        projects: projectRows.length,
        websitesGenerated: websiteCount,
        agentsInstalled: agentRows.length,
        activeAgents: activeAgents.length,
        memoryEntries: memoryRows.length,
        executions: executionRows.length,
        deployments: deploymentRows.length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "OS state error");
    res.status(500).json({ error: "Failed to fetch system state" });
  }
});

// ─── POST /api/os/optimize — AI self-optimization loop (streaming) ─────────────
router.post("/os/optimize", requireAuth, async (req, res): Promise<void> => {
  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
    return;
  }

  const userId = req.user!.userId;
  const { systemState } = req.body as { systemState?: Record<string, unknown> };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ phase: "init", message: "Initializing system-wide diagnostic scan..." });
    await new Promise(r => setTimeout(r, 300));
    send({ phase: "scanning", message: "Mapping cross-module dependency graph..." });
    await new Promise(r => setTimeout(r, 300));
    send({ phase: "scanning", message: "Evaluating intelligence flow efficiency..." });
    await new Promise(r => setTimeout(r, 300));
    send({ phase: "scanning", message: "Detecting operational bottlenecks and gaps..." });
    await new Promise(r => setTimeout(r, 300));
    send({ phase: "analyzing", message: "Running self-optimization algorithm..." });

    const state = systemState ?? {};
    const modules = (state.modules as Array<{ id: string; name: string; status: string; activityCount: number; health: number }>) ?? [];
    const stats = (state.stats as Record<string, number>) ?? {};
    const industry = (state.industry as string) ?? "Unknown";
    const coordinationScore = (state.coordinationScore as number) ?? 0;

    const systemSnapshot = `
STAGEONE OPERATING SYSTEM — LIVE STATE SNAPSHOT
=================================================
Industry Context: ${industry}
Coordination Score: ${coordinationScore}%

MODULE STATUS:
${modules.map(m => `• ${m.name}: ${m.status.toUpperCase()} | Health: ${m.health}% | Activity: ${m.activityCount}`).join("\n")}

PLATFORM STATISTICS:
• Projects analyzed: ${stats.projects ?? 0}
• Websites generated: ${stats.websitesGenerated ?? 0}
• Agents installed: ${stats.agentsInstalled ?? 0} (${stats.activeAgents ?? 0} active)
• Memory entries: ${stats.memoryEntries ?? 0}
• Executions run: ${stats.executions ?? 0}
• Deployments: ${stats.deployments ?? 0}
`;

    const systemPrompt = `You are STAGEONE's Self-Optimization Engine — an elite AI system architect that continuously monitors, evaluates, and improves a business AI operating system.

Your job is to analyze the current system state and generate a prioritized optimization report that makes STAGEONE progressively smarter, faster, and more revenue-generating over time.

OPTIMIZATION FRAMEWORK:
1. Identify disconnected systems that should be synced
2. Find automation gaps where manual work can be eliminated  
3. Detect intelligence leverage points (where one action unlocks multiple systems)
4. Surface revenue-critical gaps (what's missing that directly impacts monetization)
5. Recommend self-improving loops (actions that make future recommendations better)

RESPONSE FORMAT (use markdown):
## System Diagnosis
(2-3 sharp observations about current state — reference actual numbers)

## Critical Optimization: [Name]
(The single most impactful change the user can make right now — quantify the impact)

## Intelligence Loop Opportunities (3 items)
(Actions that create compounding value — each one makes future actions more effective)

## Automation Gaps Detected (3 items)
(Specific manual processes that should be automated — name the exact tool/agent/workflow)

## Self-Improving Actions
(2 actions that, if done today, make STAGEONE 30%+ smarter by next week)

Be hyper-specific. Reference actual module states and statistics. No generic advice.`;

    send({ phase: "streaming" });

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({
        model: MODELS.SELF_OPTIMIZE,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this system state and generate an optimization report:\n${systemSnapshot}` },
        ],
        temperature: 0.55,
        maxTokens: 1000,
      });
    } catch (err) {
      req.log.error({ err, model: MODELS.SELF_OPTIMIZE }, `[AI:${MODELS.SELF_OPTIMIZE}] Optimize stream failed`);
      send({ phase: "error", message: String(err) });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    const reader = streamBody.getReader();
    let carry = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = carry + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") { send({ phase: "done" }); continue; }
        try {
          const p = JSON.parse(data);
          const content = p.choices?.[0]?.delta?.content;
          if (content) send({ phase: "content", content });
        } catch { /* fragment */ }
      }
    }

    try {
      await emitNotification(userId, "system.optimized", "System Optimization Complete", "STAGEONE has analyzed your OS state and generated improvement recommendations.", "success", { coordinationScore });
    } catch { /* non-fatal */ }

  } catch (err) {
    req.log.error({ err }, "OS optimize error");
    send({ phase: "error", message: "Optimization failed — please retry" });
  }

  res.end();
});

// ─── POST /api/os/sync — Emit a cross-system sync event ───────────────────────
router.post("/os/sync", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { module, event, details } = req.body as { module?: string; event?: string; details?: string };

  if (!module || !event) {
    res.status(400).json({ error: "module and event are required" });
    return;
  }

  try {
    await emitNotification(
      userId,
      `os.sync.${module.toLowerCase()}`,
      `${module} → System Sync`,
      details ?? `${event} propagated across all connected modules`,
      "info",
      { module, event, syncedAt: new Date().toISOString() },
    );
    res.json({ synced: true, module, event });
  } catch (err) {
    req.log.error({ err }, "OS sync error");
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
