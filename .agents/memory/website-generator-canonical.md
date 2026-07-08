---
name: Website Generator canonical reference
description: Website Generator is the locked reference implementation for ExecutionBus, controller registration, bridge lifecycle, and shared orchestration — do not modify those layers without a demonstrated regression in Website first.
---

# Website Generator — Canonical Reference Implementation

## Rule
Website Generator is the canonical reference implementation for:
- ExecutionBus dispatch and event handling
- Controller registration patterns
- Bridge lifecycle (start / stop / reconnect)
- Shared orchestration hooks and patterns

**Do not modify any of these layers unless a regression is first demonstrated in the Website generator.**

**Why:** These subsystems were stabilized through the Website generator. Touching them speculatively risks breaking a working reference and cascading regressions across all generators that depend on the same bus/bridge/orchestration infrastructure.

**How to apply:**
- If a bug report or feature request touches ExecutionBus, controller registration, bridge lifecycle, or shared orchestration: first reproduce the failure in the Website generator flow. If it can't be reproduced there, treat it as isolated to the requesting generator and fix only that generator's layer without touching shared code.
- If a change *must* touch shared code, document the demonstrated Website regression before proceeding.

## Update: MarcusController now owns Website-v2 orchestration
The website-v2 generation route (generate-website-v2.ts) was deliberately thinned: all model calls (Architect, Design Review, Code Gen), blueprint scope/complexity guards, infra file injection, and persistence moved into `MarcusController.runWebsiteGeneration()` in marcus-controller.ts. The route now only does SSE setup, bus/engine wiring, input validation, project creation, and forwards `onSse` callbacks.

**Why:** Centralizes agent orchestration ownership so future generators (Automation, Chatbot, Agent Builder) can adopt the same controller-owns-pipeline pattern instead of duplicating model-call logic in each route. Prompts and data contracts (WebsiteBlueprint/GeneratedProject/ProjectFile[]/V2SseEvent) were kept byte-for-byte identical during the move — only ownership/location changed.

**How to apply:** When extending or debugging website-v2 generation, look in marcus-controller.ts first, not the route. The route should stay a thin shell — resist pulling orchestration logic back into it.
