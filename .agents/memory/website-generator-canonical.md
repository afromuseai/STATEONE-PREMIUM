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
