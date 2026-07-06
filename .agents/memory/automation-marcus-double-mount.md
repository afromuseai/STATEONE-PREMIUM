---
name: Automation/Orchestrator Marcus double-mount
description: Marcus navigation to automation-builder can genuinely double-mount the page; typewriter/populate effects must be resumable across mounts, not just deduped within one mount.
---

Marcus's copilot panel drives Automation Builder navigation through two separate legacy tag paths ({{WORKSPACE|automation}} for direct routing, {{WORKSPACE|idea|...}} for a queued workspace signal). This combination can cause the page to genuinely mount twice in a row (~10ms apart, two distinct CONTROLLER_REGISTER ids), each with its own independent per-instance refs/state.

**Why:** Any populate/typewriter effect that stores progress only in a per-component ref (useRef) has no way to hand off progress if the first mount instance gets torn down mid-animation and a second instance takes over — it looks like the animation "freezes" after 1 character.

**How to apply:** For any Marcus-populated typewriter/animation effect on this page (or Orchestrator, which shares the same navigation pattern), keep transient progress in a module-scoped variable keyed by the content being typed (not per-instance refs alone), so a later mount can resume instead of restarting or silently dying. Don't try to "fix" the double-mount itself by touching ExecutionBus/Marcus/routing — that's out of bounds per project constraints; make the local effect resilient instead.
