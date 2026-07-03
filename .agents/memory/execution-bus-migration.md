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
- `handleWorkspaceCmdAction`: all 5 generate_* commands → bus (orchestrator now included, controller is real)
- `executeAction` ({{ACTION:}} tag path): generate_website, generate_intelligence → bus

## Orchestrator bridge wiring notes
- Bridge: `lib/module-architecture/orchestrator-bridge.ts` (singleton, same pattern as automation-bridge)
- Controller: `lib/module-architecture/controllers/orchestrator-controller.ts` (real, delegates to bridge)
- Page: `pages/orchestrator.tsx` — generate() has `ideaOverride?` param; try/finally ensures completion callback always fires; latest-ref pattern (goalRef.current = goal, generateRef.current = generate in render body) ensures bridge never sees stale/null refs; triggerGenerate resolves prior orphaned promise before replacing.
