import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { db, usersTable, passwordResetTokensTable, sessionsTable, userMonitorSessionsTable, referralsTable, subscriptionsTable } from "@workspace/db";
import { eq, and, gt, isNull, count } from "drizzle-orm";
import { parseUserAgent } from "../lib/parse-ua";
import { signToken, verifyToken } from "../middleware/auth";
import { logEventFireForget, hashToken } from "../lib/log-event";
import { sendWelcomeEmail, sendReferralRewardEmail } from "../lib/email";
import { z } from "zod";

const router = Router();

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  referralCode: z.string().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password, name, referralCode: incomingCode } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // Resolve referrer (if referral code provided)
  let referrer: { id: string; email: string; name: string } | null = null;
  if (incomingCode) {
    const [referrerUser] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.referralCode, incomingCode.toUpperCase()));
    if (referrerUser) referrer = referrerUser;
  }

  // Generate a unique referral code for the new user
  let newReferralCode = generateReferralCode();
  // Retry once on collision (astronomically rare)
  const [collision] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.referralCode, newReferralCode));
  if (collision) newReferralCode = generateReferralCode();

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    isAdmin: false,
    referralCode: newReferralCode,
    referredBy: referrer?.id ?? undefined,
  }).returning();

  // Process referral reward
  if (referrer) {
    // Record the referral
    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      referredUserId: user.id,
      bonusGenerations: 5,
    }).catch(() => {});

    // Add +5 aiGenerationsLimit to referrer's subscription
    const [referrerSub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, referrer.id));
    if (referrerSub) {
      await db
        .update(subscriptionsTable)
        .set({ aiGenerationsLimit: referrerSub.aiGenerationsLimit + 5 })
        .where(eq(subscriptionsTable.userId, referrer.id))
        .catch(() => {});
    }

    // Count total referrals by this referrer
    const [{ value: totalReferrals }] = await db
      .select({ value: count() })
      .from(referralsTable)
      .where(eq(referralsTable.referrerId, referrer.id));

    // Send reward email to referrer (fire-and-forget)
    sendReferralRewardEmail({
      to: referrer.email,
      name: referrer.name,
      referredName: name,
      bonusGenerations: 5,
      totalReferrals: Number(totalReferrals ?? 1),
    }).catch(() => {});
  }

  const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
  res.cookie("token", token, COOKIE_OPTS);

  db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash: hashToken(token),
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    country: (req.headers["cf-ipcountry"] as string) ?? null,
  }).catch(() => {});

  const _suaSignup = parseUserAgent(req.headers["user-agent"]);
  db.insert(userMonitorSessionsTable).values({
    userId: user.id,
    sessionToken: hashToken(token),
    country: (req.headers["cf-ipcountry"] as string) ?? null,
    browser: _suaSignup.browser,
    os: _suaSignup.os,
    device: _suaSignup.device,
    currentPage: "/dashboard",
    lastAction: "Signed up",
  }).catch(() => {});

  logEventFireForget({ userId: user.id, type: "user_signup", data: { email: user.email }, req });

  // Send welcome email (fire-and-forget)
  sendWelcomeEmail({ to: user.email, name: user.name, referralCode: newReferralCode }).catch(() => {});

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, createdAt: user.createdAt },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "No account found with this email" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
  res.cookie("token", token, COOKIE_OPTS);

  db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash: hashToken(token),
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    country: (req.headers["cf-ipcountry"] as string) ?? null,
  }).catch(() => {});

  const _suaLogin = parseUserAgent(req.headers["user-agent"]);
  db.insert(userMonitorSessionsTable).values({
    userId: user.id,
    sessionToken: hashToken(token),
    country: (req.headers["cf-ipcountry"] as string) ?? null,
    browser: _suaLogin.browser,
    os: _suaLogin.os,
    device: _suaLogin.device,
    currentPage: "/dashboard",
    lastAction: "Logged in",
  }).catch(() => {});

  logEventFireForget({ userId: user.id, type: "user_login", data: { email: user.email }, req });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, createdAt: user.createdAt },
  });
});

router.post("/auth/logout", (req, res): void => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const payload = verifyToken(token);
    if (payload?.userId) {
      db.update(userMonitorSessionsTable)
        .set({ isActive: false, endedAt: new Date() })
        .where(and(
          eq(userMonitorSessionsTable.sessionToken, hashToken(token)),
          eq(userMonitorSessionsTable.isActive, true),
        ))
        .catch(() => {});
      logEventFireForget({ userId: payload.userId, type: "user_logout", data: {}, req });
    }
  }
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, createdAt: user.createdAt } });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const { email } = parsed.data;

  // Always return 200 to avoid email enumeration
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.json({ ok: true });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    token: rawToken,
    expiresAt,
  });

  const origin = process.env.APP_ORIGIN ?? `${req.protocol}://${req.get("host")}`;
  const resetLink = `${origin}/reset-password?token=${rawToken}`;

  const mailer = getMailer();
  if (mailer) {
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? `STAGEONE <noreply@stageone.ai>`,
      to: user.email,
      subject: "Reset your STAGEONE password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#1a1a1a;color:#f0f0f0;border-radius:12px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#f0f0f0">Reset your password</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#aaa">Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#0a0a0a;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none">Reset Password</a>
          <p style="margin:24px 0 0;font-size:12px;color:#666">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Reset your STAGEONE password:\n${resetLink}\n\nThis link expires in 1 hour.`,
    });
    res.json({ ok: true });
  } else {
    // Dev mode: no SMTP configured — return the link directly
    console.log(`[auth] Password reset link for ${user.email}: ${resetLink}`);
    res.json({ ok: true, devLink: resetLink });
  }
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { token, password } = parsed.data;

  const now = new Date();
  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt),
      )
    );

  if (!record) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, record.userId));
  await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, record.id));

  res.json({ ok: true });
});

export default router;
