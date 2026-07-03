---
name: ExecutionBus migration — generate_* dispatch
description: Which generate_* commands are on the bus vs legacy, and why orchestrator stays legacy for now.
---

## Rule
All `generate_*` WORKSPACE commands and ACTION tags now route through `bus.execute({ module, action: 'generate' })` **except `generate_orchestrator`**, which stays on legacy dispatch (`markPendingIntentAutoGenerate` + `navigate`).

## Why
`orchestratorController.generate()` in `lib/module-architecture/controllers/orchestrator-controller.ts` is a confirmed placeholder (warns and no-ops). The real generation logic is a local `generate()` function inside `pages/orchestrator.tsx` that is not yet connected to the controller. Routing through the bus would silently succeed without generating anything.

## How to apply
When wiring up the orchestrator controller (Phase 2), implement `orchestratorController.generate()` to call the page's actual generation logic, then replace the legacy `generate_orchestrator` handler in `copilot-panel.tsx` with `bus.execute({ module: "orchestrator", action: "generate" })`.

## Migrated paths (all in `copilot-panel.tsx`)
- `handleWorkspaceCmdAction`: generate_chatbot, generate_intelligence, generate_website, generate_automation → bus
- `executeAction` ({{ACTION:}} tag path): generate_website, generate_intelligence → bus
- `handleWorkspaceCmdAction`: generate_orchestrator → legacy (intentional, see above)
