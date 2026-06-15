import { Router } from "express";
import { db, featureFlagsTable, featureFlagRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { logAdminAuditFireForget } from "../lib/admin-audit";
import { FeatureFlagService, INITIAL_FLAGS } from "../lib/feature-flag-service";

const router = Router();

// ─── Public: check a single flag for the current user ─────────────────────────
router.get("/feature-flags/:key", requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.user!.userId;
    const enabled = await FeatureFlagService.isEnabledForUser(key, userId);
    res.json({ enabled });
  } catch {
    res.json({ enabled: false });
  }
});

// ─── Admin: list all flags with rules ─────────────────────────────────────────
router.get("/admin/feature-flags", requireAdmin, async (_req, res) => {
  try {
    const flags = await FeatureFlagService.getAllWithRules();
    res.json({ flags });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Admin: seed initial flags ────────────────────────────────────────────────
router.post("/admin/feature-flags/seed", requireAdmin, async (req, res) => {
  try {
    let created = 0;
    for (const flag of INITIAL_FLAGS) {
      const existing = await db
        .select()
        .from(featureFlagsTable)
        .where(eq(featureFlagsTable.key, flag.key))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(featureFlagsTable).values({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          enabled: true,
          rolloutPercentage: 100,
        });
        created++;
      }
    }
    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action: "feature_flags_seeded",
      details: { created },
      req,
    });
    res.json({ seeded: created, total: INITIAL_FLAGS.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Admin: create flag ───────────────────────────────────────────────────────
router.post("/admin/feature-flags", requireAdmin, async (req, res) => {
  try {
    const { key, name, description, enabled = false, rolloutPercentage = 100 } = req.body as {
      key: string; name: string; description?: string; enabled?: boolean; rolloutPercentage?: number;
    };

    if (!key || !name) {
      res.status(400).json({ error: "key and name are required" });
      return;
    }

    const [flag] = await db
      .insert(featureFlagsTable)
      .values({ key, name, description: description ?? null, enabled, rolloutPercentage })
      .returning();

    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action: "feature_created",
      details: { flagId: flag.id, key, name, enabled },
      req,
    });

    res.status(201).json({ flag });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("unique")) {
      res.status(409).json({ error: "A flag with that key already exists" });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── Admin: update flag ───────────────────────────────────────────────────────
router.patch("/admin/feature-flags/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, rolloutPercentage, name, description } = req.body as {
      enabled?: boolean; rolloutPercentage?: number; name?: string; description?: string;
    };

    const updates: Record<string, unknown> = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (rolloutPercentage !== undefined) updates.rolloutPercentage = rolloutPercentage;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const [flag] = await db
      .update(featureFlagsTable)
      .set(updates)
      .where(eq(featureFlagsTable.id, id))
      .returning();

    if (!flag) {
      res.status(404).json({ error: "Flag not found" });
      return;
    }

    const action = enabled === true ? "feature_enabled"
      : enabled === false ? "feature_disabled"
      : "feature_updated";

    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action,
      details: { flagId: id, key: flag.key, ...updates },
      req,
    });

    res.json({ flag });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Admin: delete flag ───────────────────────────────────────────────────────
router.delete("/admin/feature-flags/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.id, id))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Flag not found" });
      return;
    }

    await db.delete(featureFlagsTable).where(eq(featureFlagsTable.id, id));

    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action: "feature_deleted",
      details: { flagId: id, key: existing[0].key },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Admin: add rule to flag ──────────────────────────────────────────────────
router.post("/admin/feature-flags/:id/rules", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ruleType, ruleValue } = req.body as { ruleType: "plan" | "user" | "segment"; ruleValue: string };

    if (!ruleType || !ruleValue) {
      res.status(400).json({ error: "ruleType and ruleValue are required" });
      return;
    }

    const flag = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.id, id))
      .limit(1);

    if (!flag[0]) {
      res.status(404).json({ error: "Flag not found" });
      return;
    }

    const [rule] = await db
      .insert(featureFlagRulesTable)
      .values({ featureFlagId: id, ruleType, ruleValue })
      .returning();

    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action: "rule_added",
      details: { flagId: id, key: flag[0].key, ruleType, ruleValue },
      req,
    });

    res.status(201).json({ rule });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Admin: delete rule ───────────────────────────────────────────────────────
router.delete("/admin/feature-flags/rules/:ruleId", requireAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;

    const existing = await db
      .select()
      .from(featureFlagRulesTable)
      .where(eq(featureFlagRulesTable.id, ruleId))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    await db.delete(featureFlagRulesTable).where(eq(featureFlagRulesTable.id, ruleId));

    logAdminAuditFireForget({
      adminId: req.user!.userId,
      adminEmail: req.user!.email,
      action: "rule_removed",
      details: { ruleId, featureFlagId: existing[0].featureFlagId, ruleType: existing[0].ruleType, ruleValue: existing[0].ruleValue },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
