import { Router } from "express";
import { db, waitlistTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const joinSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  plan: z.string().optional().default("enterprise"),
});

router.post("/waitlist", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { name, email, plan } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(waitlistTable)
      .where(eq(waitlistTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, alreadyJoined: true });
    }

    await db.insert(waitlistTable).values({ name, email, plan });
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to join waitlist" });
  }
});

router.get("/waitlist", requireAuth, async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(waitlistTable)
      .orderBy(waitlistTable.createdAt);
    return res.json({ entries });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch waitlist" });
  }
});

export default router;
