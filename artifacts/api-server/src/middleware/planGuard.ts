// ─── STAGEONE Plan Guard Middleware ───────────────────────────────────────────
// Factory that returns an Express middleware enforcing feature-level plan access.
// Must be placed AFTER requireAuth (depends on req.user being set).
//
// Usage:
//   router.post("/generate/website", requireAuth, requireFeature("website_generator"), handler)
//
// On access denied, returns HTTP 403 with:
//   { error: "UPGRADE_REQUIRED", feature, requiredPlan, currentPlan, message }

import type { Request, Response, NextFunction } from "express";
import { getOrCreateSubscription } from "../routes/subscriptions";
import { canAccessFeature, getRequiredPlan, FEATURE_LABELS, type Feature } from "../lib/feature-matrix";

export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Admins bypass all feature gating
    if (req.user?.isAdmin) {
      next();
      return;
    }

    try {
      const sub = await getOrCreateSubscription(userId);

      if (!canAccessFeature(sub.plan, feature)) {
        const requiredPlan = getRequiredPlan(feature);
        const featureLabel = FEATURE_LABELS[feature];
        res.status(403).json({
          error: "UPGRADE_REQUIRED",
          feature,
          featureLabel,
          requiredPlan,
          currentPlan: sub.plan,
          message: `${featureLabel} requires the ${requiredPlan} plan or higher.`,
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: "Failed to verify plan access" });
    }
  };
}
