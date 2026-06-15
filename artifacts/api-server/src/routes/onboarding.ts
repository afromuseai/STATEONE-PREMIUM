import { Router } from "express";
import { db, onboardingProgressTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

export const ONBOARDING_STEPS = [
  "first_bi_generation",
  "first_website",
  "install_agent",
  "chat_with_marcus",
  "first_project_saved",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

async function getOrCreateProgress(userId: string) {
  const [existing] = await db
    .select()
    .from(onboardingProgressTable)
    .where(eq(onboardingProgressTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(onboardingProgressTable)
    .values({ userId })
    .returning();
  return created;
}

router.get("/onboarding", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const progress = await getOrCreateProgress(userId);
  res.json({
    progress: {
      ...progress,
      steps: ONBOARDING_STEPS.map(key => ({
        key,
        completed: (progress.completedSteps as string[]).includes(key),
      })),
    },
  });
});

const CompleteStepBody = z.object({
  step: z.enum(ONBOARDING_STEPS),
});

router.post("/onboarding/step", requireAuth, async (req, res): Promise<void> => {
  const parsed = CompleteStepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid step" });
    return;
  }
  const userId = req.user!.userId;
  const progress = await getOrCreateProgress(userId);
  const currentSteps = progress.completedSteps as string[];
  if (currentSteps.includes(parsed.data.step)) {
    res.json({ progress });
    return;
  }
  const newSteps = [...currentSteps, parsed.data.step];
  const isComplete = ONBOARDING_STEPS.every(s => newSteps.includes(s));
  const [updated] = await db
    .update(onboardingProgressTable)
    .set({ completedSteps: newSteps, isDismissed: isComplete, updatedAt: new Date() })
    .where(eq(onboardingProgressTable.userId, userId))
    .returning();
  res.json({ progress: updated });
});

router.post("/onboarding/dismiss", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const progress = await getOrCreateProgress(userId);
  const [updated] = await db
    .update(onboardingProgressTable)
    .set({ isDismissed: true, updatedAt: new Date() })
    .where(eq(onboardingProgressTable.userId, userId))
    .returning();
  res.json({ progress: updated ?? progress });
});

export default router;
