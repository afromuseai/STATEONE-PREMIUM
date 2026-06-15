---
name: Six missing capability fixes
description: Architecture decisions and gotchas from implementing transactional email, onboarding, error tracking, retention analytics, RBAC, and referral program.
---

## Features implemented

### #4 Transactional Email
- Added to `artifacts/api-server/src/lib/email.ts`: `sendWelcomeEmail`, `sendUsageWarningEmail`, `sendUpgradePromptEmail`, `sendReferralRewardEmail`
- Welcome email fires on signup (fire-and-forget). Usage warning fires exactly once at 80% threshold in `increment-usage` route.
- All guarded by `isEmailConfigured()` — silently skip if SMTP env vars absent.

### #5 In-App Onboarding
- Existing `onboarding-checklist.tsx` already had localStorage-based approach. Kept it, removed required props, made self-contained using `useAuth`.
- Component reads `user.createdAt` and only shows for accounts < 30 days old.
- DB table `onboarding_progress` created but component stays localStorage-based for simplicity.
- `GET /api/onboarding`, `POST /api/onboarding/step`, `POST /api/onboarding/dismiss` added.

### #6 Error Tracking (built-in, no Sentry)
- DB table `error_events` for both server and client errors.
- Express 4-arg error handler added to `app.ts` — fires AFTER router registration.
- `POST /api/errors/report` is a **public** endpoint (no auth) — error boundary calls it before login is possible.
- React `ErrorBoundary` class component wraps inner app, catches render errors and reports them.

**Critical:** `ErrorBoundary` must be placed INSIDE `AuthProvider` (and all other context providers) in `App.tsx`. If placed outside, it catches context-initialization errors during HMR and shows the crash screen instead of the app.

### #8 Cohort & Retention Analytics
- `GET /admin/retention` computes D7/D30 retention from `eventsTable` + `usersTable` in-process (JS, not SQL) — fine for current scale.
- `AdminRetentionPanel` React component: DAU bar chart, cohort table, monthly signups, plan distribution — all pure CSS, no chart library.

### #9 RBAC Enforcement
- `artifacts/api-server/src/middleware/rbac.ts` — `requirePermission(permission)` middleware.
- **Fail-open design**: if a user has NO roles configured, access is allowed (backward compatible). Only denies when roles exist but the required permission is absent. Admins always bypass.
- Applied to enterprise audit/compliance (GET) and roles CRUD (POST/PATCH/DELETE).

### #10 Referral Program
- Added `referralCode` (unique) + `referredBy` columns to `usersTable`.
- New `referralsTable` tracks referrer→referred pairs with `bonusGenerations`.
- On signup: generate 8-char alphanumeric referral code for new user; if `referralCode` param provided, look up referrer, insert referral record, +5 to referrer's `aiGenerationsLimit`, fire reward email.
- `GET /api/referrals/me` returns code + link + stats.
- Settings page `/settings` shows referral link with copy button and earned bonus count.
- `APP_URL` env var used for referral link base; falls back to `https://app.stageone.ai`.

## New DB tables
- `onboarding_progress` — per-user onboarding state
- `error_events` — server + client error log
- `referrals` — referrer→referred tracking

## New routes registered in routes/index.ts
- `onboardingRouter`, `referralsRouter`, `adminErrorsRouter`, `adminRetentionRouter`
