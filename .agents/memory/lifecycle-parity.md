---
name: Generator lifecycle parity
description: What was done to bring all non-Website generators to parity with the Website canonical lifecycle
---

## Rule
Every bridge module must use the `_currentRegId` counter pattern. Every page must capture the ID returned by `registerBridge` and `registerController`, and forward it to their corresponding `unregister*` calls. The `useGeneratorOrchestration` hook must also capture and forward the controller registration ID.

**Why:** React 18 Strict Mode double-invokes effects. Without the stale-ID guard, the cleanup from mount-1 fires after mount-2 has already re-registered, nullifying the live registration and leaving the controller/bridge absent when `generate()` is called.

## How to apply
Any new generator must replicate the Website bridge pattern exactly:
1. `let _currentRegId = 0` in the bridge module
2. `registerBridge` increments `_currentRegId`, stores it in a local `id`, sets `_bridge`, returns `id`
3. `unregisterBridge(registrationId)` returns early if `_currentRegId !== registrationId`
4. Page `useEffect` captures return of `registerBridge(...)` → `const bridgeRegId = registerBridge({...})`
5. Page cleanup: `unregisterBridge(bridgeRegId)`
6. Same pattern for `registerController`/`unregisterController`
7. Controller `generate(context?: ModuleContext)` uses `bridge.getCurrentIdea() || context?.businessIdea || ''`

## Files updated in parity pass (July 2026)
- chatbot-bridge.ts, automation-bridge.ts, orchestrator-bridge.ts — added guard
- intelligence-bridge.ts — comment corrected (guard was already live, comment said "NOT yet applied")
- chatbot-controller.ts, automation-controller.ts, orchestrator-controller.ts — `generate(context?)` + fallback
- chatbot-generator.tsx, automation-builder.tsx, orchestrator.tsx — ID capture on both bridge + controller
- use-generator-orchestration.ts — captures `registerController` return, passes to `unregisterController`
