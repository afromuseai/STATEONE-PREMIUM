// ─── Builder Conversation — UI message types ───────────────────────────────────
// These are pure UI message types for the AI Builder's *conversation* surface.
// They exist alongside `GenerationActivity` (which owns build progress) and are
// never emitted onto the generation event bus themselves — they are derived,
// read-only, from `GenerationEvent`s that already flow through it. Nothing in
// this file talks to the backend, the adapter, or the streaming transport.
//
// Division of responsibility:
//   - GenerationActivity → "what phase is running, what's done, what % complete"
//   - Builder conversation → "why this phase, what was decided, what to watch for"
// The two must never restate the same fact — see `derive.ts` for how each
// message's copy is kept complementary to `GenerationActivity`'s own text.

/** A senior-engineer-style explanation of what's happening and why. */
export interface BuilderExplanationMessage {
  kind: "explanation"
  id: string
  timestamp: number
  text: string
}

/** A concrete choice made during generation, with the reasoning behind it. */
export interface BuilderDecisionMessage {
  kind: "decision"
  id: string
  timestamp: number
  decision: string
  reason?: string
}

/** Something worth flagging — a failure, retry, or risk — never silent. */
export interface BuilderWarningMessage {
  kind: "warning"
  id: string
  timestamp: number
  text: string
}

/** A wrap-up once a build run finishes, distinct from GenerationActivity's
 *  own itemized file counts — this is the narrative "here's what you got". */
export interface BuilderSummaryMessage {
  kind: "summary"
  id: string
  timestamp: number
  text: string
}

export type BuilderConversationMessage =
  | BuilderExplanationMessage
  | BuilderDecisionMessage
  | BuilderWarningMessage
  | BuilderSummaryMessage
