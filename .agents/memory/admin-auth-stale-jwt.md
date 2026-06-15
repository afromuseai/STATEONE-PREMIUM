---
name: Admin auth stale JWT fix
description: requireAdmin middleware must re-check isAdmin from DB when JWT claim is false/absent
---

## Rule
`requireAdmin` must always fall back to a live DB query when the JWT does not carry `isAdmin: true`. Never trust only the JWT claim for admin gating.

**Why:** JWTs are minted at login and are valid for 7 days. When an account is promoted to admin after login, the existing cookie doesn't carry `isAdmin: true` — every admin API call returns 403 silently, making the entire admin panel appear broken with empty states and no visible error.

**How to apply:** After verifying the JWT, if `payload.isAdmin !== true`, query `usersTable` for the current `is_admin` value. Only deny if both the JWT claim and the DB say false.
