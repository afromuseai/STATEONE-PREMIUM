# STAGEONE Chatbot Module — Complete Architecture Audit

**Generated:** 2025-07-10
**Scope:** Read-only reverse engineering of the Chatbot module as canonical Marcus Operation Layer implementation
**Constraint:** No code modifications. Document only.

---

## 1. COMPLETE LIFECYCLE TRACE

**User Input:** "Build me a chatbot for a dental clinic."

### Stage 1: Marcus Receives Message
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/api-server/src/lib/agents/marcus-conversation.ts` | `marcusConversation()` | LLM conversation handler; intent detection via `{{WORKSPACE\|run\|chatbot\|...}}` tag parsing | API route `/api/copilot` | `executeRun()` on ExecutionBus |
| `artifacts/api-server/src/routes/copilot.ts` | `POST /api/copilot` | Auth → rate limit → invoke `marcusConversation()` → stream response | HTTP response | HTTP client (frontend CopilotPanel) | `marcusConversation()` |

**Flow:** User message → `/api/copilot` → `marcusConversation()` → LLM detects intent → emits `{{WORKSPACE|run|chatbot|Build me a chatbot for a dental clinic.}}` tag → parsed by `marcusConversation()` → `bus.executeRun("chatbot", idea, false, traceId)`

---

### Stage 2: Intent Detection & ExecutionBus Entry
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `executeRun(rawModule, idea, autoGenerate, traceId)` | Parse module alias → construct `ExecutionCommand` → delegate to `execute()` | `marcusConversation()` | `execute()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `execute(command)` | Create ExecutionRecord → ROUTING → resolve controller → if missing navigate + WAITING_FOR_CONTROLLER → run action pipeline | `executeRun()` | `resolveExecutionModule()`, `_waitForController()`, `_runAction()` |

**ExecutionBus Events Emitted:**
- `execution:routing` (ROUTING phase)
- `execution:waiting_for_controller` (if controller not mounted)
- `execution:resumed` (when controller registers)

---

### Stage 3: Navigation (ROUTING → WAITING_FOR_CONTROLLER)
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_waitForController()` | Register pending execution → 60s timeout → resolve on `subscribeControllerRegistration()` callback | `execute()` (when `!mod`) | `resolveExecutionModule()`, `subscribeControllerRegistration()` |
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `MODULE_ROUTES['chatbot'] = '/chatbot-generator'` | Route mapping for bus navigation | `ExecutionBus` | `_navigator(route)` |
| `artifacts/stageone/src/App.tsx` | `ExecutionBusNavigatorSetup` (useEffect) | Inject `navigate` from `useLocation()` into `bus.setNavigator()` | App mount (inside WouterRouter) | `bus.setNavigator()` |

**Navigation Flow:** Bus calls `_navigator('/chatbot-generator')` → Wouter router mounts `ChatbotGeneratorPage` → page `useEffect` registers controller → `subscribeControllerRegistration` fires → pending execution resumes.

---

### Stage 4: Controller Registration & Resume
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/module-architecture/registry.ts` | `registerController('chatbot', chatbotController)` | Store controller → notify subscribers (ExecutionBus) | `ChatbotGeneratorPage` mount `useEffect` (via `useGeneratorOrchestration`) | `_registrationHandlers.forEach()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_waitForController` callback | Delete pending → `resolve(immediateModule)` → emit `execution:resumed` | `subscribeControllerRegistration` | `_runAction()` |

---

### Stage 5: Action Pipeline — Populate (POPULATING)
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_runAction()` for `action === 'populate' | 'run'` | Navigate → `safeTransition(executionId, 'POPULATING')` → `emitBusEvent('execution:populate_started')` → `mod.populate(payload)` | `execute()` |
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `populate(payload)` adapter | Build `ModuleContext` from payload → `controller.populate(context)` | `ExecutionBus._runAction()` | `chatbotController.populate()` |
| `artifacts/stageone/src/lib/module-architecture/controllers/chatbot-controller.ts` | `populate(context)` | `emitLifecycleEvent('populate.started')` → `bridge.populate(idea, onComplete)` → await promise | `module-registry populate()` | `chatbotBridge.populate()` |
| `artifacts/stageone/src/lib/module-architecture/chatbot-bridge.ts` | `populate(idea, onComplete)` | Store `onComplete` in `populateCompleteCallbackRef` → call page's `typewriterPopulate(idea)` | `chatbotController.populate()` | `ChatbotGeneratorPage.typewriterPopulate()` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `typewriterPopulate(text)` | Typewriter animation into `businessDesc` state (20ms/char) → on complete: `populateCompleteCallbackRef.current?.()` | `chatbotBridge.populate()` | `populateCompleteCallbackRef` → controller promise resolves |

**Lifecycle Events Emitted:**
- `populate.started` (module-architecture)
- `execution:populate_started` (bus)
- `populate.complete` (module-architecture)
- `execution:populate_complete` (bus)

---

### Stage 6: Confirmation Gate (CONFIRMATION_WAIT)
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_runAction()` after populate | `safeTransition(executionId, 'CONFIRMATION_WAIT')` → `emitBusEvent('execution:confirmation_required')` → `await _waitForConfirmationTraced()` | `_runAction()` | `_waitForConfirmation()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_waitForConfirmation()` | Create promise stored in `_confirmationGates[executionId]` → resolves on `bus.approve()` or rejects on `bus.cancel()` | `_runAction()` | (waits) |
| `artifacts/stageone/src/components/copilot/copilot-panel.tsx` | Generate button click → `bus.approve(executionId)` | User clicks "Generate" → calls `bus.approve()` → gate resolves | User UI interaction | `_confirmationGates[executionId](true)` |

**Auto-approve path:** If `payload.autoGenerate === true` (from `executeRun(..., true)`), gate auto-resolves immediately, emits `execution:confirmation_approved` with `{auto: true}`.

---

### Stage 7: Generation (GENERATING → STREAMING → SAVING → COMPLETED)
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_runGenerate()` | `safeTransition('GENERATING')` → `emitBusEvent('execution:generate_started')` → `await mod.generate(payload)` → `safeTransition('COMPLETED')` → `emitBusEvent('execution:generate_complete')` + `execution:completed` | `_runAction()` after confirmation | `mod.generate()` |
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `generate(payload)` adapter | Build `ModuleContext` → `controller.generate(context)` | `ExecutionBus._runGenerate()` | `chatbotController.generate()` |
| `artifacts/stageone/src/lib/module-architecture/controllers/chatbot-controller.ts` | `generate(context?)` | `emitLifecycleEvent('generate.started')` → `bridge.triggerGenerate(idea)` → await → `emitLifecycleEvent('generate.complete')` | `module-registry generate()` | `chatbotBridge.triggerGenerate()` |
| `artifacts/stageone/src/lib/module-architecture/chatbot-bridge.ts` | `triggerGenerate(idea)` → `Promise<void>` | Store `resolve` in `generateCompleteCallbackRef` → call `generateWith(idea, type, industry, tone)` | `chatbotController.generate()` | `ChatbotGeneratorPage.generateWith()` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `generateWith(desc, type, ind, tn)` | **Full SSE pipeline:** POST `/api/generate/chatbot` → stream parse → `setData(out)` → `initChat(out)` → `setStep('done')` → `await completeGeneration(out, idea)` → `generateCompleteCallbackRef.current?.()` | `chatbotBridge.triggerGenerate()` | `fetch('/api/generate/chatbot')`, `completeGeneration()` |
| `artifacts/api-server/src/routes/generate-chatbot.ts` | `POST /api/generate/chatbot` | Build prompt with type/industry/tone guides → `streamNvidia()` → `forwardStream()` → `extractJson()` → SSE `data: {... done: true, data }` | `ChatbotGeneratorPage.generateWith()` | `streamNvidia()`, `extractJson()` |
| `artifacts/api-server/src/lib/nvidia.ts` | `streamNvidia({model, messages, ...})` → `ReadableStream` | Call NVIDIA Nemotron API with SSE → return body stream | `generate-chatbot.ts` | NVIDIA HTTP API |
| `artifacts/api-server/src/lib/nvidia.ts` | `forwardStream(stream, res, model)` → `Promise<string>` | Pipe SSE chunks to HTTP response → accumulate raw buffer → return concatenated string | `generate-chatbot.ts` | HTTP response write |
| `artifacts/api-server/src/routes/generate-chatbot.ts` | `extractJson(stripped)` | Parse JSON from model output (stri` blocks) | `generate-chatbot.ts` | `JSON.parse()` |

**Lifecycle/Bus Events During Generation:**
- `generate.started` (module-architecture)
- `execution:generate_started` (bus)
- Streaming: raw SSE chunks (no bus event)
- `generate.complete` (module-architecture)
- `execution:generate_complete` (bus)
- `execution:completed` (bus)

---

### Stage 8: Project Persistence (SAVING)
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/hooks/use-generator-orchestration.ts` | `completeGeneration(output, idea)` | `ensureProject({type: 'chatbot', idea, outputField: 'chatbotOutput', output})` → emit `chatbot.generated` workspace event → dispatch `project-updated` CustomEvent | `ChatbotGeneratorPage.generateWith()` done block | `ensureProject()` |
| `artifacts/stageone/src/lib/ensure-project.ts` | `ensureProject(opts)` | Load `sessionStorage` project context → if continuation mode + valid ID: PATCH existing project; else POST `/api/projects` → save new context → PATCH output field | `completeGeneration()` | `fetch('/api/projects')`, `patchProject()` |
| `artifacts/stageone/src/lib/generation-context.ts` | `saveProjectContext(ctx)` / `loadProjectContext()` | sessionStorage persistence for `projectId`, `continuityMode`, `source` | `ensureProject()` | `sessionStorage.setItem/getItem` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `bridge.save()` | `ensureProject()` with `latestDataRef.current` + `chatbotIdeaRef.current` | `chatbotController.save()` → `bridge.save()` | `ensureProject()` |

**Project Metadata Saved:**
- `projectId` (UUID from `/api/projects` POST)
- `title` (truncated idea)
- `businessIdea` (full description)
- `type: "chatbot"`
- `status: "active"`
- `chatbotOutput` (full ChatbotOutput JSON)
- `continuityMode: "continuation"` (for subsequent saves)
- `source: "Standalone Generator"`

---

### Stage 9: Marcus Completion Message
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/api-server/src/lib/agents/marcus-conversation.ts` | `marcusConversation()` streaming response | After `bus.executeRun()` returns, LLM continues streaming final response to user | `/api/copilot` SSE stream | (terminal) |
| `artifacts/stageone/src/hooks/use-generator-orchestration.ts` | `emitRef.current({type: 'chatbot.generated', data: {saved: true}})` | Workspace event for CopilotPanel to display completion | `completeGeneration()` | `WorkspaceControllerContext.emit()` |

---

## 2. FILE × FUNCTION × RESPONSIBILITY MATRIX (PER LIFECYCLE STAGE)

### Stage: Marcus Receives Message
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/api-server/src/routes/copilot.ts` | `POST /api/copilot` | Auth, rate-limit, invoke conversation | HTTP client | `marcusConversation()` |
| `artifacts/api-server/src/lib/agents/marcus-conversation.ts` | `marcusConversation()` | LLM chat + WORKSPACE tag parsing + `bus.executeRun()` | `/api/copilot` | `bus.executeRun()` |

### Stage: Intent Detection → ExecutionBus
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `executeRun()` | Parse module alias → build command → `execute()` | `marcusConversation()` | `execute()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `execute()` | Create record → ROUTING → resolve controller → wait or run | `executeRun()` | `resolveExecutionModule()`, `_waitForController()`, `_runAction()` |

### Stage: Navigation
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `MODULE_ROUTES` | Map moduleId → route path | `ExecutionBus` | — |
| `artifacts/stageone/src/App.tsx` | `ExecutionBusNavigatorSetup` | Provide `navigate` to bus | App mount | `bus.setNavigator()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_waitForController()` | Park execution → 60s timeout → resume on registration | `execute()` | `subscribeControllerRegistration()` |

### Stage: Controller Registration
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/module-architecture/registry.ts` | `registerController()` | Store controller → notify subscribers | Page mount (`useGeneratorOrchestration`) | `_registrationHandlers.forEach()` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | registration callback | Resume pending execution | `subscribeControllerRegistration` | `_runAction()` |

### Stage: Population
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_runAction()` populate branch | POPULATING phase → `mod.populate()` | `_runAction()` | `module-registry populate()` |
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `populate()` adapter | Build `ModuleContext` → `controller.populate()` | `ExecutionBus` | `chatbotController.populate()` |
| `artifacts/stageone/src/lib/module-architecture/controllers/chatbot-controller.ts` | `populate()` | Emit `populate.started` → `bridge.populate()` → await | `module-registry` | `chatbotBridge.populate()` |
| `artifacts/stageone/src/lib/module-architecture/chatbot-bridge.ts` | `populate(idea, onComplete)` | Store callback → call page `typewriterPopulate()` | `chatbotController` | `ChatbotGeneratorPage.typewriterPopulate()` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `typewriterPopulate()` | Animate textarea → call `populateCompleteCallbackRef` | `chatbotBridge` | `populateCompleteCallbackRef()` |

### Stage: Confirmation
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_waitForConfirmation()` | Promise gate stored in `_confirmationGates` | `_runAction()` | (waits for `approve()`) |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `approve(executionId)` | Resolve gate → emit `confirmation_approved` | UI (Generate button) | `_confirmationGates[id](true)` |
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `cancel(executionId)` | Reject gate + cancel pending controller wait | UI (Cancel) | `_confirmationGates[id](false)`, `_pendingExecutions` cleanup |

### Stage: Generation
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts` | `_runGenerate()` | GENERATING → `mod.generate()` → COMPLETED | `_runAction()` | `module-registry generate()` |
| `artifacts/stageone/src/lib/execution-bus/module-registry.ts` | `generate()` adapter | Build `ModuleContext` → `controller.generate()` | `ExecutionBus` | `chatbotController.generate()` |
| `artifacts/stageone/src/lib/module-architecture/controllers/chatbot-controller.ts` | `generate()` | Emit `generate.started` → `bridge.triggerGenerate()` → await | `module-registry` | `chatbotBridge.triggerGenerate()` |
| `artifacts/stageone/src/lib/module-architecture/chatbot-bridge.ts` | `triggerGenerate(idea)` | Store resolve → call `generateWith()` | `chatbotController` | `ChatbotGeneratorPage.generateWith()` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `generateWith()` | Full SSE pipeline: POST → stream → parse → setData → initChat → completeGeneration → callback | `chatbotBridge` | `fetch('/api/generate/chatbot')`, `completeGeneration()` |
| `artifacts/api-server/src/routes/generate-chatbot.ts` | `POST /api/generate/chatbot` | Build prompt → `streamNvidia()` → `forwardStream()` → `extractJson()` → SSE done | `generateWith()` | `streamNvidia()`, `extractJson()` |
| `artifacts/api-server/src/lib/nvidia.ts` | `streamNvidia()` / `forwardStream()` | NVIDIA Nemotron SSE → pipe to response | `generate-chatbot.ts` | NVIDIA API |
| `artifacts/api-server/src/routes/generate-chatbot.ts` | `extractJson()` | Strip think tags → parse JSON | `generate-chatbot.ts` | `JSON.parse()` |

### Stage: Save / Project Continuity
| File | Function | Responsibility | Called By | Calls Into |
|------|----------|----------------|-----------|------------|
| `artifacts/stageone/src/hooks/use-generator-orchestration.ts` | `completeGeneration()` | `ensureProject()` → emit workspace event → dispatch `project-updated` | `generateWith()` done | `ensureProject()` |
| `artifacts/stageone/src/lib/ensure-project.ts` | `ensureProject()` | Continuation logic: reuse projectId or create new → PATCH output | `completeGeneration()` | `fetch('/api/projects')`, `patchProject()` |
| `artifacts/stageone/src/lib/generation-context.ts` | `saveProjectContext()` / `loadProjectContext()` | sessionStorage for projectId/continuityMode/source | `ensureProject()` | `sessionStorage` |
| `artifacts/stageone/src/pages/chatbot-generator.tsx` | `bridge.save()` | `ensureProject()` with current output + idea | `chatbotController.save()` | `ensureProject()` |

---

## 3. EXECUTION BUS — COMPLETE SPECIFICATION

### 3.1 Creation & Singleton
- **File:** `artifacts/stageone/src/lib/execution-bus/ExecutionBus.ts`
- **Export:** `export const bus = new ExecutionBus()` (singleton)
- **Initialization:** Constructor subscribes to `subscribeControllerRegistration()` (module-architecture registry) to resume parked executions.

### 3.2 Navigator Injection
- **File:** `artifacts/stageone/src/App.tsx` → `ExecutionBusNavigatorSetup`
- **Mechanism:** `useLocation()` → `bus.setNavigator(navigate)` inside `WouterRouter`
- **Timing:** Runs once on app mount (inside `WouterRouter` tree)

### 3.3 Event Flow & Ordering
**Bus-Level Events** (`artifacts/stageone/src/lib/execution-bus/events.ts`):
| Event Type | Phase | Payload | Emitted By |
|------------|-------|---------|------------|
| `execution:routing` | ROUTING | `{action}` | `execute()` start |
| `execution:waiting_for_controller` | WAITING_FOR_CONTROLLER | `{route}` | controller not mounted |
| `execution:resumed` | (resume) | — | registration callback |
| `execution:populate_started` | POPULATING | `{idea}` | `_runAction()` before populate |
| `execution:populate_complete` | POPULATING → CONFIRMATION_WAIT | — | `_runAction()` after populate |
| `execution:confirmation_required` | CONFIRMATION_WAIT | `{executionId}` | `_runAction()` (manual) |
| `execution:confirmation_approved` | CONFIRMATION_WAIT → GENERATING | `{auto: boolean}` | `approve()` or auto-generate |
| `execution:generate_started` | GENERATING | — | `_runGenerate()` |
| `execution:generate_complete` | GENERATING → COMPLETED | — | `_runGenerate()` after generate |
| `execution:saving` | SAVING | — | (not yet emitted; module-level) |
| `execution:completed` | COMPLETED | — | `_runGenerate()` end |
| `execution:cancelled` | (terminal) | `{manual: true}` | `cancel()` |
| `execution:error` | ERROR | `{error}` | `_fail()` |

**Module-Architecture Lifecycle Events** (`artifacts/stageone/src/lib/module-architecture/lifecycle.ts`):
| Event | Payload | Emitted By |
|-------|---------|------------|
| `populate.started` | `{moduleId, idea}` | `chatbotController.populate()` |
| `populate.complete` | `{moduleId, idea}` | `chatbotController.populate()` after bridge callback |
| `generate.started` | `{moduleId, idea}` | `chatbotController.generate()` |
| `generate.complete` | `{moduleId, idea}` | `chatbotController.generate()` after bridge callback |

**Ordering Enforcement:**
- `ExecutionBus` uses `transitionPhase()` with `TRANSITIONS` map (legal successor phases).
- `lifecycle-manager.ts` throws on illegal transitions.
- Module controller methods are awaited sequentially inside `_runAction()` → `_runGenerate()`.

### 3.4 Subscription & Consumption
- **Bus events:** `subscribeBusEvent(type, handler)`, `subscribeBusEventAll(handler)` — return unsubscribe fn.
- **Lifecycle events:** `subscribeLifecycleEvent(type, handler)` — return unsubscribe fn.
- **Controller registration:** `subscribeControllerRegistration((id, controller) => ...)` — called synchronously after registry set.
- **Consumers:**
  - `CopilotPanel` subscribes to bus events for UI overlay
  - `ExecutionBus` subscribes to controller registration
  - Future: analytics, orchestration layers

### 3.5 Confirmation Handling
- **Gate storage:** `_confirmationGates = Map<executionId, (approved: boolean) => void>`
- **Approve:** `bus.approve(id)` → calls stored resolver with `true` → emits `execution:confirmation_approved`
- **Cancel:** `bus.cancel(id)` → calls resolver with `false` + cleans pending controller wait + `cancelExecution()`
- **Auto-approve:** `payload.autoGenerate === true` skips `CONFIRMATION_WAIT`, emits `confirmation_approved` with `{auto: true}`

### 3.6 Execution Triggering
- **Entry points:**
  - `bus.execute({module, action, payload})` — programmatic
  - `bus.executeRun(rawModule, idea, autoGenerate, traceId)` — Copilot `{{WORKSPACE|run|...}}` tag
  - `bus.approve(executionId)` — user clicks Generate
- **Actions:** `populate` | `generate` | `run` (populate → confirm → generate)

---

## 4. CONTROLLERS — COMPLETE INVENTORY

### 4.1 Base Contract (`artifacts/stageone/src/lib/module-architecture/controller.ts`)
```typescript
interface ModuleController {
  navigate(): Promise<void>;
  populate(context: ModuleContext): Promise<void>;
  generate(context?: ModuleContext): Promise<void>;
  save(): Promise<void>;
}
```

### 4.2 Chatbot Controller (`artifacts/stageone/src/lib/module-architecture/controllers/chatbot-controller.ts`)
| Method | Input | Output | Dependencies | Responsibility |
|--------|-------|--------|--------------|----------------|
| `navigate()` | — | `Promise<void>` | `chatbotBridge` | `bridge.navigate()` → `setLocation('/chatbot-generator')` |
| `populate(context)` | `ModuleContext` | `Promise<void>` | `chatbotBridge`, `emitLifecycleEvent` | Bridge `populate(idea, onComplete)`; emits `populate.started`/`complete` |
| `generate(context?)` | `ModuleContext?` | `Promise<void>` | `chatbotBridge`, `emitLifecycleEvent` | Bridge `triggerGenerate(idea)`; emits `generate.started`/`complete` |
| `save()` | — | `Promise<void>` | `chatbotBridge` | Bridge `save()` |

**Fallback logic:** `generate()` uses `bridge.getCurrentIdea() || context?.businessIdea || ''` to survive remount.

### 4.3 Other Controllers (for dependency graph)
| Module | File | Methods |
|--------|------|---------|
| intelligence | `intelligence-controller.ts` | navigate, populate, generate, save |
| website | `website-controller.ts` | navigate, populate, generate, save |
| automation | `automation-controller.ts` | navigate, populate, generate, save |
| orchestrator | `orchestrator-controller.ts` | navigate, populate, generate, save |

All follow identical pattern: delegate to their respective bridge.

---

## 5. BRIDGES — COMPLETE INVENTORY

### 5.1 Bridge Interface (`artifacts/stageone/src/lib/module-architecture/chatbot-bridge.ts`)
```typescript
interface ChatbotBridge {
  navigate(): void;
  populate(idea: string, onComplete: () => void): void;
  triggerGenerate(idea: string): Promise<void>;
  save(): Promise<void>;
  getCurrentIdea(): string;
}
```

### 5.2 Chatbot Bridge Implementation
| Method | Caller | Implementation |
|--------|--------|----------------|
| `navigate()` | `chatbotController.navigate()` | `setLocation('/chatbot-generator')` |
| `populate(idea, onComplete)` | `chatbotController.populate()` | `chatbotIdeaRef.current = idea`; `populateCompleteCallbackRef.current = onComplete`; `typewriterPopulate(idea)` |
| `triggerGenerate(idea)` | `chatbotController.generate()` | `generateCompleteCallbackRef.current = resolve`; `generateWith(idea, type, industry, tone)` |
| `save()` | `chatbotController.save()` | `ensureProject({type:'chatbot', idea: chatbotIdeaRef.current || businessDescRef.current, outputField:'chatbotOutput', output: latestDataRef.current})` |
| `getCurrentIdea()` | `chatbotController.generate()` fallback | `chatbotIdeaRef.current || businessDescRef.current` |

**Registration:** `ChatbotGeneratorPage` mount → `registerBridge(bridgeImpl)` returns `regId`; unmount → `unregisterBridge(regId)`. Stale cleanup prevented by monotonically increasing `_currentRegId`.

### 5.3 Other Bridges (for dependency graph)
| Module | File | Exposed Methods |
|--------|------|-----------------|
| intelligence | `intelligence-bridge.ts` | navigate, populate, triggerGenerate, save, getCurrentIdea |
| website | `website-bridge.ts` | navigate, populate, triggerGenerate, save, getCurrentIdea |
| automation | `automation-bridge.ts` | navigate, populate, triggerGenerate, save, getCurrentIdea |
| orchestrator | `orchestrator-bridge.ts` | navigate, populate, triggerGenerate, save, getCurrentIdea |

---

## 6. NAVIGATION — COMPLETE FLOW

### 6.1 Routing
- **Router:** Wouter (`artifacts/stageone/src/App.tsx`)
- **Route:** `/chatbot-generator` → `ProtectedRoute` → `ChatbotGeneratorPage`
- **Route Map:** `MODULE_ROUTES['chatbot'] = '/chatbot-generator'` (`module-registry.ts`)

### 6.2 Workspace Activation
- **Context:** `WorkspaceControllerProvider` (`artifacts/stageone/src/lib/workspace-controller-context.tsx`)
- **Signal:** `MarcusWorkspaceSignal` via `sessionStorage` key `marcus_workspace_signal` + live `emitWorkspaceSignal`
- **Queue:** `stageone_ws_signal_queue` (persists signals across navigation race)

### 6.3 Tab Selection
- **Not applicable** for Chatbot (single-page generator). Other modules (e.g., Intelligence) have tabbed views.

### 6.4 Pending Intents
- **Key:** `stageone_pending_intent` (`generation-context.ts`)
- **Shape:** `PendingIntent` from `@workspace/api-zod` — `{type: 'chatbot', idea: string, timestamp}`
- **Flow:** Copilot writes → page mount `consumePendingIntent('chatbot')` → `cacheConsumedIdea()` → `onPopulate(idea, true)`

### 6.5 ExecutionBus Events in Navigation
- `execution:routing` → `execution:waiting_for_controller` (if page not mounted) → navigation → page mount → controller registration → `execution:resumed` → `execution:populate_started`

---

## 7. POPULATION — COMPLETE TRACE

### 7.1 ExecutionBus → Controller → Bridge → React
| Step | Component | Function | Mechanism |
|------|-----------|----------|-----------|
| 1 | `ExecutionBus._runAction()` | `mod.populate(payload)` | Calls module-registry adapter |
| 2 | `module-registry.populate()` | `controller.populate(context)` | Builds `ModuleContext` from payload |
| 3 | `chatbotController.populate()` | `bridge.populate(idea, onComplete)` | Emits `populate.started`; awaits promise |
| 4 | `chatbotBridge.populate()` | `populateCompleteCallbackRef = onComplete`; `typewriterPopulate(idea)` | Stores callback; triggers page method |
| 5 | `ChatbotGeneratorPage.typewriterPopulate()` | `setInterval` → `setBusinessDesc(text.slice(0, i))` | 20ms/char animation into `businessDesc` state |
| 6 | Animation complete | `populateCompleteCallbackRef.current?.()` | Resolves controller promise |
| 7 | Controller | `emitLifecycleEvent('populate.complete')` | Emits module-architecture event |
| 8 | ExecutionBus | `emitBusEvent('execution:populate_complete')` | Emits bus event |

### 7.2 State Updates
- **React State:** `businessDesc` (string) — controlled textarea value
- **Refs:** `chatbotIdeaRef` (stable idea for bridge), `businessDescRef` (mirror)
- **Textarea:** `descTextareaRef` — focused after animation

### 7.3 Form Fields Populated
| Field | State | Source |
|-------|-------|--------|
| Business Description | `businessDesc` | Typewriter animation |
| Chatbot Type | `chatbotType` | `deriveChatbotType(ctx.chatbotRole)` from GenerationContext |
| Industry | `industry` | `deriveChatbotIndustry(ctx.industry)` |
| Tone | `tone` | `deriveChatbotTone(ctx.industry)` |

---

## 8. CONFIRMATION ARCHITECTURE

### 8.1 Where Marcus Stops
- **Phase:** `CONFIRMATION_WAIT` (ExecutionBus lifecycle)
- **Trigger:** After `populate.complete` + `execution:populate_complete`
- **Condition:** `action === 'populate'` OR (`action === 'run'` AND `!payload.autoGenerate`)

### 8.2 Confirmation Storage
- **Map:** `_confirmationGates = Map<executionId, (approved: boolean) => void>`
- **Key:** `executionId` (generated at `createExecution()`)

### 8.3 Resume Mechanism
- **User clicks Generate** → `CopilotPanel` or page button → `bus.approve(executionId)`
- **Resolver:** `_confirmationGates.get(id)(true)` → promise resolves → `_runGenerate()` proceeds

### 8.4 Waiting Component
- **Bus internal:** `_waitForConfirmation()` returns `Promise<void>` that parks `_runAction()`
- **UI:** `CopilotPanel` shows "Generate" button; page shows Generate button in input panel

### 8.5 Auto-Approve Path
- **Condition:** `payload.autoGenerate === true` (set by `executeRun(..., true)`)
- **Effect:** Emits `execution:confirmation_approved` with `{auto: true}` immediately; skips `CONFIRMATION_WAIT`

---

## 9. GENERATION — STANDALONE PIPELINE

### 9.1 generate() Entry
- **File:** `artifacts/stageone/src/pages/chatbot-generator.tsx`
- **Function:** `generateWith(desc, type, ind, tn)`
- **Trigger:** `chatbotBridge.triggerGenerate()` → `generateCompleteCallbackRef = resolve` → `generateWith()`

### 9.2 API Request
- **Endpoint:** `POST /api/generate/chatbot`
- **Body:** `{businessDescription, chatbotType, tone, industry, language}`
- **Headers:** `Content-Type: application/json`, `credentials: include`
- **Response:** SSE (`text/event-stream`)

### 9.3 SSE Stream Processing (Frontend)
```typescript
const reader = res.body.getReader()
while (true) {
  const {done, value} = await reader.read()
  const chunk = carry + dec.decode(value)
  for (const line of chunk.split('\n')) {
    if (line.startsWith('data: ')) {
      const msg = JSON.parse(line.slice(6))
      if (msg.content) buffer += msg.content
      if (msg.done && msg.data) { setData(msg.data); initChat(msg.data); setStep('done'); break }
    }
  }
}
```

### 9.4 Backend Streaming (`artifacts/api-server/src/routes/generate-chatbot.ts`)
1. Build `SYSTEM_PROMPT` + `userMessage` with type/industry/tone guides
2. `streamNvidia({model: MODELS.CHATBOT, messages, temperature: 0.7, maxTokens: 8000, nvextParams: {thinking: {enabled: false}}})`
3. `forwardStream(streamBody, res, MODELS.CHATBOT)` → pipes SSE chunks to HTTP response
4. Accumulate `rawBuffer` → strip` → `extractJson()` → parse `ChatbotOutput`
5. SSE final: `data: {"done": true, "data": <ChatbotOutput>}`

### 9.5 NVIDIA Nemotron Call (`artifacts/api-server/src/lib/nvidia.ts`)
- **Function:** `streamNvidia({model, messages, temperature, maxTokens, nvextParams})` → `ReadableStream`
- **Model:** `MODELS.CHATBOT` (Nemotron 49B)
- **Thinking:** Disabled (`thinking: {enabled: false}`) to avoid reasoning tokens in output

### 9.6 Completion & Save
- **Frontend:** `setData(out)` → `initChat(out)` → `setStep('done')` → `await completeGeneration(out, idea)`
- **completeGeneration:** `ensureProject({type: 'chatbot', idea, outputField: 'chatbotOutput', output})` → emit `chatbot.generated` workspace event → dispatch `project-updated` CustomEvent
- **Bridge callback:** `generateCompleteCallbackRef.current?.()` → resolves `chatbotController.generate()` promise → ExecutionBus `generate.complete` + `execution:completed`

---

## 10. PROJECT CONTINUITY — EXACT MECHANICS

### 10.1 Project Identity
- **Project ID:** UUID from `POST /api/projects` response (`project.id`)
- **Storage:** `sessionStorage` key `stageone_project_ctx` → `ProjectContext`
  ```typescript
  interface ProjectContext {
    projectId: string;
    projectTitle: string;
    originatingBusinessIntelligenceId?: string;
    continuityMode: 'continuation' | 'standalone';
    source?: 'Marcus' | 'Existing Project' | 'Standalone Generator';
  }
  ```

### 10.2 Save Decision Logic (`ensure-project.ts`)
| Condition | Action |
|-----------|--------|
| `existingId && mode === 'continuation' && project exists` | PATCH `/api/projects/:id` with output field → reuse |
| `existingId && mode !== 'continuation'` | Clear context → create new |
| No existingId | POST `/api/projects` → create new → save context with `continuityMode: 'continuation'` |

### 10.3 Timestamps & Metadata
- **Created:** `project.createdAt` (server)
- **Updated:** `PATCH` updates `updatedAt` (server)
- **Output Field:** `chatbotOutput` (JSON column on `projects` table)
- **Continuity Mode:** `'continuation'` after first save; `'standalone'` initially

### 10.4 Restoration
- **Key:** `stageone_chatbot_restore` (`generation-context.ts`)
- **Flow:** ProjectPage → `saveChatbotRestoreContext(output)` → navigate to `/chatbot-generator` → page mount `loadChatbotRestoreContext()` → `setData(output)` → `setStep('done')` → `initChat(data)`

---

## 11. STATE MANAGEMENT — REACT STATE INVENTORY

### 11.1 ChatbotGeneratorPage State (`chatbot-generator.tsx`)
| State Variable | Type | Owner | Updated By | Read By |
|----------------|------|-------|------------|---------|
| `step` | `'input' \| 'generating' \| 'done'` | Page | `setStep()` in generateWith, populate, restore | Render (AnimatePresence) |
| `businessDesc` | `string` | Page | `setBusinessDesc()` (typewriter, manual, restore) | Textarea, generateWith, bridge.getCurrentIdea |
| `chatbotType` | `ChatbotType` | Page | `setChatbotType()` (button click, restore) | generateWith, UI |
| `industry` | `Industry` | Page | `setIndustry()` (select, restore) | generateWith, UI |
| `tone` | `Tone` | Page | `setTone()` (button click, restore) | generateWith, UI |
| `data` | `ChatbotOutput \| null` | Page | `setData()` (generateWith done, restore) | Right panel tabs, initChat, bridge.save |
| `genStep` | `number` | Page | `setGenStep()` (interval during generating) | Generating panel progress |
| `genError` | `string` | Page | `setGenError()` (SSE error, HTTP error) | Input panel error banner |
| `rightTab` | `RightTab` | Page | `setRightTab()` (tab bar) | Right panel content |
| `previewMode` | `PreviewMode` | Page | `setPreviewMode()` (device toggle) | ChatWidget |
| `messages` | `ChatMessage[]` | Page | `setMessages()` (initChat, sendMessage) | ChatWidget |
| `isTyping` | `boolean` | Page | `setIsTyping()` (sendMessage) | ChatWidget |
| `quickReplies` | `string[]` | Page | `setQuickReplies()` (initChat, sendMessage) | ChatWidget |
| `editedPrompt` | `string` | Page | `setEditedPrompt()` (Prompt tab textarea) | Prompt tab, export |
| `copiedKey` | `string` | Page | `setCopiedKey()` (copy buttons) | Copy feedback |
| `chatInput` | `string` | Page | `setChatInput()` (ChatWidget input) | ChatWidget |
| `contextBanner` | `boolean` | Page | `setContextBanner()` (populate, restore) | Input panel banner |
| `isLocked` | `boolean` | Page | `setIsLocked()` (subscription check) | Locked overlay |
| `autoGenPending` | `ref` | Page | `autoGenPending.current = {type, ind, tn}` (Phase 1) | Phase 2 effect |
| `autoGenFired` | `ref` | Page | `autoGenFired.current = true` (Phase 2) | Phase 2 guard |
| `chatbotIdeaRef` | `ref<string>` | Page | `chatbotIdeaRef.current = idea` (populate, bridge) | bridge.getCurrentIdea, generateWith fallback |
| `businessDescRef` | `ref<string>` | Page | Sync effect from `businessDesc` | bridge.getCurrentIdea fallback |
| `populateCompleteCallbackRef` | `ref<() => void>` | Page | `populateCompleteCallbackRef.current = onComplete` (bridge) | typewriterPopulate complete |
| `generateCompleteCallbackRef` | `ref<() => void>` | Page | `generateCompleteCallbackRef.current = resolve` (bridge) | generateWith done |
| `latestDataRef` | `ref<ChatbotOutput>` | Page | Sync effect from `data` | bridge.save |

### 11.2 Shared Module State (via hooks/context)
| State | Location | Scope |
|-------|----------|-------|
| `generationContext` | `sessionStorage` + `loadGenerationContext()` | Cross-page (BI → generators) |
| `projectContext` | `sessionStorage` + `loadProjectContext()` | Project continuity |
| `pendingIntent` | `sessionStorage` + `consumePendingIntent()` | Copilot → generator |
| `workspaceSignal` | `sessionStorage` + `WorkspaceControllerContext` | Marcus → generators |
| `copilotAutorun` | `sessionStorage` + `consumeCopilotAutorun()` | Copilot → page auto-run |

---

## 12. EVENT FLOW DIAGRAM

```
USER MESSAGE
    │
    ▼
/api/copilot (POST)
    │
    ▼
marcusConversation() ──detects {{WORKSPACE|run|chatbot|...}}──► bus.executeRun('chatbot', idea, false, traceId)
    │
    ▼
ExecutionBus.execute({module: 'chatbot', action: 'run', payload: {idea, autoGenerate: false}})
    │
    ├─► createExecution() → ExecutionRecord{phase: 'IDLE'}
    │
    ├─► safeTransition('ROUTING') → emitBusEvent('execution:routing')
    │
    ├─► resolveExecutionModule('chatbot') → null (controller not mounted)
    │       │
    │       ├─► _navigator('/chatbot-generator')  (Wouter navigation)
    │       │
    │       ├─► safeTransition('WAITING_FOR_CONTROLLER')
    │       │       emitBusEvent('execution:waiting_for_controller')
    │       │
    │       └─► _waitForController() → Promise parks
    │               │
    │               ▼ (page mounts)
    │       ChatbotGeneratorPage useEffect → registerController('chatbot', chatbotController)
    │               │
    │               ▼
    │       subscribeControllerRegistration callback fires
    │               │
    │               ▼
    │       _waitForController resolves → mod = ExecutionModule
    │               emitBusEvent('execution:resumed')
    │
    ▼
_runAction(executionId, 'chatbot', mod, 'run', payload)
    │
    ├─► await mod.navigate() → bridge.navigate() → setLocation('/chatbot-generator')
    │
    ├─► safeTransition('POPULATING')
    │       emitBusEvent('execution:populate_started')
    │       await mod.populate(payload)
    │               │
    │               ├─► module-registry.populate() → controller.populate(context)
    │               │       │
    │               │       ├─► emitLifecycleEvent('populate.started')
    │               │       │
    │               │       ├─► bridge.populate(idea, onComplete)
    │               │       │       │
    │               │       │       ├─► chatbotIdeaRef.current = idea
    │               │       │       ├─► populateCompleteCallbackRef.current = onComplete
    │               │       │       ├─► typewriterPopulate(idea)
    │               │       │       │       │
    │               │       │       │       ├─► setInterval → setBusinessDesc(slice)
    │               │       │       │       │
    │               │       │       │       └─► on complete: populateCompleteCallbackRef.current?.()
    │               │       │       │
    │               │       │       └─► controller promise resolves
    │               │       │
    │               │       └─► emitLifecycleEvent('populate.complete')
    │               │
    │               └─► emitBusEvent('execution:populate_complete')
    │
    ├─► safeTransition('CONFIRMATION_WAIT')
    │       emitBusEvent('execution:confirmation_required')
    │       await _waitForConfirmation()  // parks here
    │               │
    │               ▼ (user clicks Generate → bus.approve(executionId))
    │       _confirmationGates.get(id)(true)
    │       emitBusEvent('execution:confirmation_approved', {auto: false})
    │
    ▼
_runGenerate(executionId, 'chatbot', mod, traceId, payload)
    │
    ├─► safeTransition('GENERATING')
    │       emitBusEvent('execution:generate_started')
    │
    ├─► await mod.generate(payload)
    │       │
    │       ├─► module-registry.generate() → controller.generate(context)
    │       │       │
    │       │       ├─► emitLifecycleEvent('generate.started')
    │       │       │
    │       │       ├─► bridge.triggerGenerate(idea)
    │       │       │       │
    │       │       │       ├─► generateCompleteCallbackRef.current = resolve
    │       │       │       ├─► generateWith(idea, type, industry, tone)
    │       │       │       │       │
    │       │       │       │       ├─► POST /api/generate/chatbot (SSE)
    │       │       │       │       │       │
    │       │       │       │       │       ├─► streamNvidia() → NVIDIA Nemotron
    │       │       │       │       │       │
    │       │       │       │       │       ├─► forwardStream() → SSE chunks
    │       │       │       │       │       │
    │       │       │       │       │       └─► extractJson() → ChatbotOutput
    │       │       │       │       │
    │       │       │       │       ├─► setData(out) → setStep('done') → initChat(out)
    │       │       │       │       │
    │       │       │       │       ├─► await completeGeneration(out, idea)
    │       │       │       │       │       │
    │       │       │       │       │       ├─► ensureProject() → PATCH/POST /api/projects
    │       │       │       │       │       │
    │       │       │       │       │       ├─► emit workspace event 'chatbot.generated'
    │       │       │       │       │       │
    │       │       │       │       │       └─► dispatch 'project-updated' CustomEvent
    │       │       │       │       │
    │       │       │       │       └─► generateCompleteCallbackRef.current?.()
    │       │       │       │
    │       │       │       └─► controller promise resolves
    │       │       │
    │       │       └─► emitLifecycleEvent('generate.complete')
    │       │
    │       └─► emitBusEvent('execution:generate_complete')
    │
    ├─► safeTransition('COMPLETED')
    │       emitBusEvent('execution:completed')
    │
    └─► tracer.endExecution(traceId, true)
```

---

## 13. DEPENDENCY GRAPH

### 13.1 File → File Dependencies (Chatbot Module Core)

```
chatbot-generator.tsx
├── @/lib/module-architecture/chatbot-bridge
│   └── registerBridge, unregisterBridge, getBridge
├── @/lib/module-architecture/controllers/chatbot-controller
│   └── chatbotController (uses bridge via getBridge)
├── @/lib/hooks/use-generator-orchestration
│   └── useGeneratorOrchestration (registers controller, handles pendingIntent, signals)
├── @/lib/generation-context
│   └── loadGenerationContext, clearGenerationContext, loadChatbotRestoreContext,
│       clearChatbotRestoreContext, deriveChatbotType/Industry/Tone, buildChatbotDesc,
│       setPendingIntent, consumePendingIntent, cacheConsumedIdea,
│       setMarcusWorkspaceSignal, consumeMarcusWorkspaceSignal,
│       enqueueWorkspaceSignal, dequeueWorkspaceSignals
├── @/lib/ensure-project
│   └── ensureProject
├── @/lib/execution-tracer
│   └── tracer
├── @/lib/workspace-controller-context
│   └── useWorkspaceController
├── @/lib/upgrade-modal-context
│   └── useUpgradeModal
├── @/lib/i18n
│   └── useLang
├── @/components/dashboard/dashboard-shell
│   └── useDashboardShell
└── @/lib/module-architecture/registry
    └── registerController, unregisterController (via useGeneratorOrchestration)

chatbot-controller.ts
├── @/lib/module-architecture/controller (ModuleController interface)
├── @/lib/module-architecture/chatbot-bridge (getBridge)
└── @/lib/module-architecture/lifecycle (emitLifecycleEvent)

chatbot-bridge.ts
├── (no internal imports — pure singleton with registration API)

ensure-project.ts
├── @/lib/generation-context (loadProjectContext, saveProjectContext, clearProjectContext)

generation-context.ts
├── @workspace/api-zod (PendingIntent type)

execution-bus/ExecutionBus.ts
├── @/lib/execution-bus/events (emitBusEvent)
├── @/lib/execution-bus/lifecycle-manager (createExecution, transitionPhase, failExecution, cancelExecution, getExecution, getActiveExecution, getAllExecutions)
├── @/lib/execution-bus/module-registry (resolveExecutionModule, MODULE_ROUTES)
├── @/lib/module-architecture/registry (subscribeControllerRegistration)
└── @/lib/execution-tracer (tracer)

execution-bus/module-registry.ts
├── @/lib/module-architecture/registry (getController)
├── @/lib/module-architecture/intelligence-bridge (getBridge)
├── @/lib/module-architecture/website-bridge (getBridge)
├── @/lib/module-architecture/chatbot-bridge (getBridge)
├── @/lib/module-architecture/automation-bridge (getBridge)
├── @/lib/module-architecture/orchestrator-bridge (getBridge)
└── @/lib/module-architecture/types (ModuleContext)

module-architecture/registry.ts
├── @/lib/module-architecture/controller (ModuleController)
└── @/lib/module-architecture/types (ModuleId)

module-architecture/lifecycle.ts
└── @/lib/module-architecture/types (LifecycleEvent, LifecycleEventType, ModuleId)

use-generator-orchestration.ts
├── @/lib/workspace-controller-context (useWorkspaceController)
├── @/lib/generation-context (consumePendingIntent, cacheConsumedIdea, loadProjectContext, clearProjectContext, dequeueWorkspaceSignals)
├── @/lib/module-architecture/registry (registerController, unregisterController)
├── @/lib/module-architecture (ModuleController type)
├── @/lib/ensure-project (ensureProject)
└── @/lib/execution-tracer (tracer)

generate-chatbot.ts (API route)
├── @/lib/models (MODELS)
├── @/lib/nvidia (streamNvidia, forwardStream, extractJson)
├── @/lib/language (getLanguageInstruction)
├── @/lib/log-event (logEventFireForget)
└── @/lib/usage (trackUsageFireForget)

nvidia.ts
├── (external: NVIDIA API)
```

### 13.2 Cross-Module Shared Infrastructure
| Shared File | Consumers |
|-------------|-----------|
| `execution-bus/ExecutionBus.ts` | `marcus-conversation.ts`, `copilot-panel.tsx`, future modules |
| `execution-bus/events.ts` | `ExecutionBus`, `CopilotPanel` (subscribes) |
| `module-architecture/registry.ts` | All generator pages, `ExecutionBus` |
| `module-architecture/lifecycle.ts` | All controllers, future orchestration |
| `hooks/use-generator-orchestration.ts` | All generator pages (chatbot, website, automation, intelligence) |
| `lib/ensure-project.ts` | All generator pages via `completeGeneration` |
| `lib/generation-context.ts` | All generator pages, Copilot, Marcus |
| `lib/workspace-controller-context.tsx` | `CopilotPanel`, generator pages |

---

## 14. CANONICAL RULES — INFERRED FROM CHATBOT IMPLEMENTATION

### 14.1 Required (Every Module MUST Implement)

| Rule | Evidence |
|------|----------|
| **ModuleController interface** — `navigate()`, `populate(context)`, `generate(context?)`, `save()` | `controller.ts` + all 5 controllers |
| **Bridge singleton** — `registerBridge()`, `unregisterBridge()`, `getBridge()` with registration ID guard | `chatbot-bridge.ts`, `intelligence-bridge.ts`, etc. |
| **Bridge methods** — `navigate()`, `populate(idea, onComplete)`, `triggerGenerate(idea)`, `save()`, `getCurrentIdea()` | All bridges |
| **Controller registration** — `registerController(moduleId, controller)` in page mount `useEffect` | `useGeneratorOrchestration` hook |
| **Bridge registration** — `registerBridge(impl)` in page mount `useEffect` | `ChatbotGeneratorPage` bridge effect |
| **ExecutionBus integration** — Module must be in `MODULE_ROUTES` and `BRIDGE_GETTERS` | `module-registry.ts` |
| **Lifecycle events** — Emit `populate.started`, `populate.complete`, `generate.started`, `generate.complete` | All controllers |
| **useGeneratorOrchestration** — Consume pendingIntent, subscribe workspace signals, register controller | All generator pages |
| **Project continuity** — `completeGeneration(output, idea)` → `ensureProject()` → emit `<module>.generated` | All generator pages |
| **Typewriter populate** — Bridge `populate()` drives animated typewriter; callback fires after animation | `chatbot-bridge.ts` + `typewriterPopulate()` |
| **Stable idea ref** — `chatbotIdeaRef` (or `marcusBiIdeaRef` for BI) set synchronously on populate | Both bridges |
| **Generation callback ref** — `generateCompleteCallbackRef` resolves bridge `triggerGenerate()` promise | All bridges |
| **Save uses latestDataRef** — Bridge `save()` reads `latestDataRef.current` | All bridges |

### 14.2 Optional (Module-Specific)

| Feature | Module(s) |
|---------|-----------|
| Chat preview widget (`ChatWidget`) | Chatbot only |
| Conversation flows rendering (welcome, leadCapture, support, escalation, closing) | Chatbot only |
| System prompt editor (Prompt tab) | Chatbot only |
| Integration/automation/export tabs | Chatbot, Website, Automation |
| Derivation helpers (`deriveChatbotType`, etc.) | Chatbot, Website, Automation |
| Pending intent consumption | All generators (but shape differs) |
| Workspace signal queue draining | All generators |
| Copilot autorun consumption | All generators |

### 14.3 Legacy (Present But Not Required for New Modules)

| Pattern | Location | Status |
|---------|----------|--------|
| `loadGenerationContext()` / `clearGenerationContext()` Phase 1/2 auto-generate | `ChatbotGeneratorPage` (Phase 1/2 effects) | Superseded by ExecutionBus + pendingIntent |
| `autoGenPending` / `autoGenFired` refs | `ChatbotGeneratorPage` | Legacy — ExecutionBus handles auto-generate |
| `setMarcusWebsiteGenerateIntent` / `consumeMarcusWebsiteGenerateIntent` | Website only | Module-specific signal |
| `copilot_autorun` sessionStorage key | All generators | Still used but ExecutionBus preferred |
| `MARCUS_WEBSITE_GENERATE_KEY` | Website only | Legacy |

---

## 15. REGRESSION CHECK — INCONSISTENCIES VS. STAGEONE ENGINEERING CONSTITUTION

> **Note:** The "STAGEONE Engineering Constitution" was not provided as a file. The following identifies inconsistencies *within the Chatbot module itself* and against common architectural principles visible in the codebase (single source of truth, no duplication, ExecutionBus as canonical orchestration, etc.).

| # | Inconsistency | File(s) | Severity |
|---|---------------|---------|----------|
| 1 | **Duplicate generation logic** — `generateWith()` in `chatbot-generator.tsx` contains full SSE pipeline, parsing, save, UI update. The controller/bridge merely delegates to it. This violates "controller as single operational interface" — the page *is* the implementation. | `chatbot-generator.tsx`, `chatbot-controller.ts`, `chatbot-bridge.ts` | High |
| 2 | **Legacy Phase 1/2 effects** — `chatbot-generator.tsx` lines 284-309 (`loadGenerationContext` → `autoGenPending` → Phase 2 effect) duplicate ExecutionBus populate+generate flow. Creates race with `useGeneratorOrchestration` pendingIntent consumption. | `chatbot-generator.tsx` | High |
| 3 | **Two confirmation gates** — ExecutionBus `CONFIRMATION_WAIT` + page-level Generate button (both can trigger). No single source of truth for "user approved". | `ExecutionBus.ts`, `chatbot-generator.tsx` (line 749) | Medium |
| 4 | **Bridge `save()` bypasses controller** — `chatbotController.save()` → `bridge.save()` → `ensureProject()` directly. Controller adds no logic. | `chatbot-controller.ts`, `chatbot-bridge.ts` | Low |
| 5 | **Inconsistent `autoGenerate` handling** — ExecutionBus treats `autoGenerate=true` as skip-confirmation. `useGeneratorOrchestration` `onAutoGenerate` is called from pendingIntent but ExecutionBus also has `executeRun(..., autoGenerate)`. Two paths. | `ExecutionBus.ts`, `use-generator-orchestration.ts` | Medium |
| 6 | **Module ID mismatch** — ExecutionBus uses `'chatbot'`; module-architecture registry uses `'chatbot'` (consistent). But `PendingIntent.type` uses `'chatbot'` (consistent). No issue found. | — | — |
| 7 | **Missing `execution:saving` bus event** — Defined in `BusEventType` but never emitted. `ensureProject()` runs inside `completeGeneration` (hook), not in ExecutionBus. | `events.ts`, `use-generator-orchestration.ts` | Low |
| 8 | **Controller `generate(context?)` fallback** — Uses `bridge.getCurrentIdea() || context?.businessIdea`. The `context` comes from ExecutionBus payload but bridge ref may be stale after remount. Works due to `chatbotIdeaRef` but fragile. | `chatbot-controller.ts` | Low |
| 9 | **`subscribeControllerRegistration` fires synchronously** — If controller registers *before* `_pendingExecutions.set()`, the TOCTOU guard at line 305-310 handles it. But registration handlers run *before* `registerController` returns — potential reentrancy. | `registry.ts` line 46-50, `ExecutionBus.ts` line 298-310 | Low |
| 10 | **No cleanup of `populateCompleteCallbackRef`/`generateCompleteCallbackRef` on error** — If generation fails, callbacks remain set; next populate/generate may fire stale callback. | `chatbot-generator.tsx` lines 157-159, 241-244 | Medium |
| 11 | **`ensureProject` called twice** — Once in `completeGeneration` (hook), once in `bridge.save()`. Different code paths for same operation. | `use-generator-orchestration.ts`, `chatbot-bridge.ts` | Medium |
| 12 | **Hardcoded `'chatbot'` string in bridge `save()`** — `type: 'chatbot'` literal. Should derive from moduleId. | `chatbot-generator.tsx` line 256 | Low |
| 13 | **ExecutionBus `_runAction` has dead code** — Lines 337-370 (populate branch with `action === 'populate'` and `action === 'run'` logic) but the actual `_runAction` implementation in the provided file is truncated/incomplete. The actual flow uses `_runGenerate` directly. | `ExecutionBus.ts` | High (code discrepancy) |
| 14 | **`tracer.getActiveExecutionId('chatbot')` vs `tracer.getActiveExecutionId(effectiveRegistryId)`** — Inconsistent module key for trace lookup. | `chatbot-generator.tsx` line 466, `use-generator-orchestration.ts` line 195 | Low |
| 15 | **`completionEvent` in `useGeneratorOrchestration` is `'chatbot.generated'` but workspace event is `'chatbot.generated'`** — Consistent, but hardcoded per module. Should be derived. | `use-generator-orchestration.ts` line 218, `chatbot-generator.tsx` line 203 | Low |

---

## 16. SUMMARY: CANONICAL BLUEPRINT FOR FUTURE MODULES

To replicate the Chatbot module as the Marcus Operation Layer reference:

1. **Create ModuleController** implementing 4 methods (`navigate`, `populate`, `generate`, `save`) — delegate to bridge.
2. **Create Bridge** singleton with 5 methods + registration API (`registerBridge`, `unregisterBridge`, `getBridge`) using monotonically increasing registration ID guard.
3. **Register in module-architecture** — Add to `registry.ts` via `registerController(moduleId, controller)` in page mount effect (use `useGeneratorOrchestration`).
4. **Register bridge** in page mount effect — `registerBridge({navigate, populate, triggerGenerate, save, getCurrentIdea})`.
5. **Add to ExecutionBus** — Entry in `MODULE_ROUTES` and `BRIDGE_GETTERS` in `module-registry.ts`.
6. **Implement page** — Use `useGeneratorOrchestration` with module-specific `onPopulate` (typewriter) and `onAutoGenerate` (calls `generateWith`).
7. **Implement `generateWith`** — SSE pipeline to module-specific API endpoint → stream parse → `setData` → `initChat`/`initPreview` → `completeGeneration` → bridge callback.
8. **API route** — `POST /api/generate/<module>` → build prompt → `streamNvidia` → `forwardStream` → `extractJson` → SSE done with data.
9. **Project continuity** — `completeGeneration` calls `ensureProject({type, idea, outputField, output})` → emits `<module>.generated` workspace event.
10. **Emit lifecycle events** — Controller emits `populate.started|complete`, `generate.started|complete` around bridge calls.

---

**END OF AUDIT**