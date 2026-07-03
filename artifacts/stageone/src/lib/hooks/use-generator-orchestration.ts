/**
 * useGeneratorOrchestration — Shared orchestration lifecycle for all STAGEONE generator modules.
 *
 * Encapsulates the identical lifecycle every module must execute:
 *   Marcus → workspace command → PendingIntent → navigation → page mount →
 *   consumePendingIntent → workspace signal restore → textarea population →
 *   confirmation → markPendingIntentAutoGenerate → generation →
 *   streaming → persistence (ensureProject) → completion event
 *
 * Each generator page provides module-specific callbacks (onPopulate, onAutoGenerate)
 * and calls completeGeneration() in its done block.
 *
 * The ONLY things that differ per module are:
 *   - route, API endpoint, generator implementation, parser schema, generated output
 */

import { useEffect, useRef, useCallback } from "react"
import { useWorkspaceController, type WorkspaceEventType } from "@/lib/workspace-controller-context"
import {
  consumePendingIntent,
  cacheConsumedIdea,
  loadProjectContext,
  clearProjectContext,
  dequeueWorkspaceSignals,
  type PendingIntent,
  type MarcusWorkspaceSignal,
} from "@/lib/generation-context"
import {
  registerController,
  unregisterController,
  type ModuleId,
} from "@/lib/module-architecture"
import type { ModuleController } from "@/lib/module-architecture"
import { ensureProject, type ProjectType, type OutputField, type EnsureProjectResult } from "@/lib/ensure-project"

// ─── Module-level mount cache ──────────────────────────────────────────────────
// Survives AnimatePresence unmount/remount cycles: first mount stores the intent,
// second mount reads it and clears it so subsequent visits start fresh.
const _mountCaches = new Map<string, { idea: string; autoGenerate: boolean } | null>()

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseGeneratorOrchestrationConfig {
  /** PendingIntent type — used to consume the intent and filter autoGenerate events */
  moduleId: PendingIntent["type"]
  /** Workspace signal target — used for populate signal subscription */
  signalTarget: MarcusWorkspaceSignal["target"]
  /** Controller to register in the module registry */
  controller: ModuleController
  /**
   * Registry key for registerController. Defaults to moduleId.
   * Override for BI which keeps "intelligence" for execution-bus compatibility.
   */
  registryId?: string
  /** WorkspaceEvent type emitted after completeGeneration */
  completionEvent: WorkspaceEventType
  /** ProjectType for ensureProject */
  projectType: ProjectType
  /** OutputField for ensureProject */
  outputField: OutputField
  /** Returns the current idea text from state/ref (used as fallback when intent.idea is empty) */
  getIdea: () => string
  /**
   * Called to populate the textarea.
   * animate=true  → typewriter animation (populate-only, user will confirm)
   * animate=false → direct set (about to auto-generate, no animation needed)
   */
  onPopulate: (idea: string, animate: boolean) => void
  /** Called to trigger generation. The hook passes the resolved idea string. */
  onAutoGenerate: (idea: string) => void
}

export interface UseGeneratorOrchestrationResult {
  /** Call in the done block after streaming. Calls ensureProject then emits the completion event. */
  completeGeneration: (output: Record<string, unknown>, idea: string) => Promise<EnsureProjectResult>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeneratorOrchestration({
  moduleId,
  signalTarget,
  controller,
  registryId,
  completionEvent,
  projectType,
  outputField,
  getIdea,
  onPopulate,
  onAutoGenerate,
}: UseGeneratorOrchestrationConfig): UseGeneratorOrchestrationResult {
  const { emit, subscribeWorkspaceSignal } = useWorkspaceController()

  // Stable refs so stale event-handler closures always call the latest callback versions
  const getIdeaRef = useRef(getIdea)
  const onPopulateRef = useRef(onPopulate)
  const onAutoGenerateRef = useRef(onAutoGenerate)
  const emitRef = useRef(emit)
  useEffect(() => { getIdeaRef.current = getIdea })
  useEffect(() => { onPopulateRef.current = onPopulate })
  useEffect(() => { onAutoGenerateRef.current = onAutoGenerate })
  useEffect(() => { emitRef.current = emit })

  const effectiveRegistryId = (registryId ?? moduleId) as ModuleId

  // ── 1. Register / unregister module controller ─────────────────────────────
  useEffect(() => {
    registerController(effectiveRegistryId, controller)
    return () => unregisterController(effectiveRegistryId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Mount: consume durable pending intent ───────────────────────────────
  // AnimatePresence-safe via module-level cache: first mount removes from sessionStorage
  // and caches locally; second mount reads from cache; subsequent visits start fresh.
  useEffect(() => {
    const _mountCtx = loadProjectContext()
    console.log(
      `[ORCH] GENERATOR_MOUNT | module=${moduleId}` +
      ` | projectId=${_mountCtx?.projectId ?? "(none)"}` +
      ` | continuityMode=${_mountCtx?.continuityMode ?? "(none)"}`,
    )

    const cached = _mountCaches.get(moduleId) ?? undefined
    let intent: { idea: string; autoGenerate: boolean } | null = null

    if (cached !== undefined && cached !== null) {
      // Second mount (AnimatePresence remount) — restore from cache
      intent = cached
      _mountCaches.set(moduleId, null)
    } else {
      const fresh = consumePendingIntent(moduleId)
      if (fresh) {
        _mountCaches.set(moduleId, { idea: fresh.idea, autoGenerate: fresh.autoGenerate })
        intent = { idea: fresh.idea, autoGenerate: fresh.autoGenerate }
      }
    }

    if (!intent) {
      // No pending intent — preserve project context if continuation, clear if standalone
      const isContinuation = _mountCtx?.continuityMode === "continuation" && !!_mountCtx?.projectId
      if (!isContinuation) {
        console.log(`[ORCH] standalone mount — clearing stale project context | module=${moduleId}`)
        clearProjectContext()
      }
      return
    }

    console.log(
      `[ORCH] intent consumed | module=${moduleId}` +
      ` | autoGenerate=${intent.autoGenerate}` +
      ` | idea(50)="${intent.idea.slice(0, 50)}"`,
    )
    if (intent.idea) {
      cacheConsumedIdea(moduleId, intent.idea)
      onPopulateRef.current(intent.idea, !intent.autoGenerate)
    }
    if (intent.autoGenerate) {
      const ideaText = intent.idea
      setTimeout(() => {
        const text = ideaText || getIdeaRef.current()
        if (text.trim()) onAutoGenerateRef.current(text)
      }, 300)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Already-mounted: stageone:autoGenerate event ────────────────────────
  // Fired by markPendingIntentAutoGenerate when generate_<module> fires while the page
  // is already mounted. Consume the refreshed intent and trigger generation directly.
  useEffect(() => {
    const handler = (e: Event) => {
      const { type } = (e as CustomEvent<{ type: string }>).detail
      if (type !== moduleId) return
      console.log(`[ORCH] stageone:autoGenerate | module=${moduleId}`)
      const intent = consumePendingIntent(moduleId)
      const text = intent?.idea || getIdeaRef.current()
      if (text.trim()) {
        if (!getIdeaRef.current().trim()) onPopulateRef.current(text, false)
        setTimeout(() => onAutoGenerateRef.current(text), 100)
      }
    }
    window.addEventListener("stageone:autoGenerate", handler)
    return () => window.removeEventListener("stageone:autoGenerate", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Workspace signal subscription — populate only ─────────────────────────
  // Handles {{WORKSPACE|<module>_idea|...}} populate signals when the page is already
  // mounted. Generation is triggered exclusively via the pendingIntent path above,
  // not via a "generate" signal type. Drains the queue first to catch signals that
  // arrived during the race window between navigation and subscriber registration.
  useEffect(() => {
    const queued = dequeueWorkspaceSignals(signalTarget)
    for (const signal of queued) {
      if (signal.type === "populate" && signal.payload?.trim()) {
        console.log(`[ORCH] queued signal drained | module=${moduleId} | length=${signal.payload.length}`)
        cacheConsumedIdea(moduleId, signal.payload)
        onPopulateRef.current(signal.payload, true)
      }
    }
    return subscribeWorkspaceSignal((signal) => {
      if (signal.target !== signalTarget) return
      if (signal.type === "populate" && signal.payload?.trim()) {
        console.log(`[ORCH] live populate signal | module=${moduleId} | length=${signal.payload.length}`)
        cacheConsumedIdea(moduleId, signal.payload)
        onPopulateRef.current(signal.payload, true)
      }
    }, signalTarget)
  }, [subscribeWorkspaceSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── completeGeneration ────────────────────────────────────────────────────────
  // Called by each module's streaming done block. Runs ensureProject then emits
  // the standardised <module>.generated completion event to Marcus.
  const projectTypeStable = useRef(projectType).current
  const outputFieldStable = useRef(outputField).current
  const completionEventStable = useRef(completionEvent).current

  const completeGeneration = useCallback(async (
    output: Record<string, unknown>,
    idea: string,
  ): Promise<EnsureProjectResult> => {
    const result = await ensureProject({
      type: projectTypeStable,
      idea,
      outputField: outputFieldStable,
      output,
    }).catch(() => ({ projectId: "", created: false, saved: false }))
    emitRef.current({ type: completionEventStable, data: { saved: result.saved } })
    return result
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { completeGeneration }
}
