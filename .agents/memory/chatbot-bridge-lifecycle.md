---
name: Chatbot bridge lifecycle — all exit paths
description: Every early-return in generateWith must resolve the bridge promise or triggerGenerate hangs forever
---

# Chatbot bridge — completion callback must fire on ALL exits

The bridge's `triggerGenerate` wraps `generateWith` in a `new Promise<void>((resolve) => { generateCompleteCallbackRef.current = resolve; ... })`. If `resolve` is never called, `chatbotController.generate()` blocks indefinitely and `generate.complete` is never emitted.

**Rule:** Every `return` in `generateWith` (and any future generator using this bridge pattern) must call and null the completion ref before returning.

**Exits that need the callback (as of fix):**
1. Empty-desc guard at top of function
2. `403 UPGRADE_REQUIRED` branch
3. `msg.error` SSE event handler
4. Post-loop "stream ended without completion data" fallback
5. `catch` block (both AbortError and real errors)

**Why:** The `finally` block does NOT call the callback — it only handles tracer cleanup. The callback must be called explicitly before each `return`.

**How to apply:** When adding any new early-return to a bridge-backed generator function, always add `generateCompleteCallbackRef.current?.(); generateCompleteCallbackRef.current = null` before the `return`.
