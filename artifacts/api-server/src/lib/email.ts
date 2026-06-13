import nodemailer from "nodemailer";

// ─── SMTP configuration (optional) ────────────────────────────────────────────
// If SMTP_HOST is not set, email delivery is silently skipped and only
// in-app notifications are sent. Set these env vars to enable email:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

// ─── Color palette per broadcast type ─────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; accent: string; label: string; emoji: string }> = {
  info:    { bg: "#1a1f35", accent: "#6366F1", label: "Info",    emoji: "ℹ️" },
  update:  { bg: "#0d2318", accent: "#10B981", label: "Update",  emoji: "✅" },
  feature: { bg: "#1a2435", accent: "#D4AF37", label: "Feature", emoji: "⭐" },
  warning: { bg: "#2a1a0e", accent: "#F59E0B", label: "Warning", emoji: "⚠️" },
};

// ─── HTML email template ───────────────────────────────────────────────────────
export function buildEmailHtml(opts: {
  title: string;
  message: string;
  type: string;
  recipientName?: string;
}): string {
  const { title, message, type, recipientName } = opts;
  const palette = TYPE_COLORS[type] ?? TYPE_COLORS.info;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0f;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;background:${palette.accent};border-radius:8px;display:inline-block;"></div>
            <span style="color:#ffffff;font-size:18px;font-weight:900;letter-spacing:0.08em;">STAGEONE</span>
          </div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${palette.bg};border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

          <!-- Accent bar -->
          <div style="height:4px;background:linear-gradient(90deg,${palette.accent},${palette.accent}88);"></div>

          <!-- Body -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:36px 36px 28px;">

              <!-- Type badge -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;background:${palette.accent}22;color:${palette.accent};border:1px solid ${palette.accent}44;border-radius:100px;padding:4px 12px;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
                  ${palette.emoji}&nbsp; ${palette.label}
                </span>
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 14px;color:#ffffff;font-size:22px;font-weight:900;line-height:1.3;">${escHtml(title)}</h1>

              <!-- Greeting -->
              ${recipientName ? `<p style="margin:0 0 16px;color:#a0a0b0;font-size:14px;">Hi ${escHtml(recipientName)},</p>` : ""}

              <!-- Message -->
              <p style="margin:0 0 28px;color:#c8c8d8;font-size:15px;line-height:1.7;">${escHtml(message).replace(/\n/g, "<br/>")}</p>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:24px;"></div>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-radius:12px;background:${palette.accent};">
                  <a href="${process.env.APP_URL ?? "https://app.stageone.ai"}"
                    style="display:inline-block;padding:12px 28px;color:#000000;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">
                    Open STAGEONE →
                  </a>
                </td></tr>
              </table>

            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;color:#4a4a5a;font-size:11px;line-height:1.6;">
            You're receiving this because you have a STAGEONE account.<br/>
            © ${year} STAGEONE. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Send a single email ───────────────────────────────────────────────────────
export async function sendBroadcastEmail(opts: {
  to: string;
  recipientName: string;
  title: string;
  message: string;
  type: string;
}): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const html = buildEmailHtml({ title: opts.title, message: opts.message, type: opts.type, recipientName: opts.recipientName });

  await transporter.sendMail({
    from: `STAGEONE <${from}>`,
    to: opts.to,
    subject: opts.title,
    html,
    text: `${opts.title}\n\n${opts.message}\n\n— STAGEONE`,
  });
}

// ─── Bulk send with concurrency cap ───────────────────────────────────────────
export async function sendBulkEmails(
  recipients: Array<{ email: string; name: string }>,
  title: string,
  message: string,
  type: string,
): Promise<{ sent: number; failed: number }> {
  if (!isEmailConfigured()) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const CONCURRENCY = 5;

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(r =>
        sendBroadcastEmail({ to: r.email, recipientName: r.name, title, message, type })
          .then(() => sent++)
          .catch(() => failed++),
      ),
    );
  }

  return { sent, failed };
}
