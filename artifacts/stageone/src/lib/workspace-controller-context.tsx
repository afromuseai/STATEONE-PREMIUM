import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { useAuth } from "./auth-context"
import { setCopilotAutorun, type MarcusWorkspaceSignal } from "./generation-context"

// MarcusWorkspaceSignal is defined in generation-context.ts and re-exported for convenience.
export type { MarcusWorkspaceSignal }

// ─── Event types ──────────────────────────────────────────────────────────────

export type WorkspaceEventType =
  | "generation.complete"
  | "project.created"
  | "task.completed"
  | "website.generated"
  | "automation.generated"
  | "chatbot.generated"

export interface WorkspaceEvent {
  type: WorkspaceEventType
  projectId?: string
  data?: Record<string, unknown>
  timestamp: number
}

export interface WorkspaceTask {
  id: string
  userId: string
  projectId: string | null
  title: string
  status: "pending" | "done"
  category: string
  sortOrder: number
  createdAt: string
  completedAt: string | null
}

type EventCallback = (event: WorkspaceEvent) => void

// ─── Context shape ────────────────────────────────────────────────────────────

interface WorkspaceControllerContextValue {
  emit: (event: Omit<WorkspaceEvent, "timestamp">) => void
  subscribe: (callback: EventCallback) => () => void
  tasks: WorkspaceTask[]
  tasksLoading: boolean
  createTasks: (titles: string[], projectId?: string | null) => Promise<WorkspaceTask[]>
  toggleTask: (id: string, status: "pending" | "done") => Promise<void>
  deleteTask: (id: string) => Promise<void>
  refetchTasks: () => void
  openTab: (path: string, navigate: (path: string) => void) => void
  populateAndTrigger: (action: string, idea?: string) => void
  emitWorkspaceSignal: (signal: MarcusWorkspaceSignal) => void
  subscribeWorkspaceSignal: (cb: (signal: MarcusWorkspaceSignal) => void) => () => void
}

const WorkspaceControllerContext = createContext<WorkspaceControllerContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WorkspaceControllerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const subscribersRef = useRef<Set<EventCallback>>(new Set())
  const workspaceSubscribersRef = useRef<Set<(signal: MarcusWorkspaceSignal) => void>>(new Set())

  const fetchTasks = useCallback(async () => {
    if (!user) return
    setTasksLoading(true)
    try {
      const res = await fetch("/api/workspace/tasks", { credentials: "include" })
      if (!res.ok) return
      const data = (await res.json()) as { tasks: WorkspaceTask[] }
      setTasks(data.tasks)
    } catch { /* non-fatal */ } finally {
      setTasksLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchTasks()
    else setTasks([])
  }, [user, fetchTasks])

  const emit = useCallback((event: Omit<WorkspaceEvent, "timestamp">) => {
    const full: WorkspaceEvent = { ...event, timestamp: Date.now() }
    subscribersRef.current.forEach(cb => {
      try { cb(full) } catch { /* subscriber errors are non-fatal */ }
    })
  }, [])

  const subscribe = useCallback((callback: EventCallback) => {
    subscribersRef.current.add(callback)
    return () => { subscribersRef.current.delete(callback) }
  }, [])

  const createTasks = useCallback(async (
    titles: string[],
    projectId?: string | null,
  ): Promise<WorkspaceTask[]> => {
    const res = await fetch("/api/workspace/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        tasks: titles.map(title => ({ title })),
        projectId: projectId ?? null,
      }),
    })
    if (!res.ok) throw new Error("Failed to create tasks")
    const data = (await res.json()) as { tasks: WorkspaceTask[] }
    setTasks(prev => [...prev, ...data.tasks])
    return data.tasks
  }, [])

  const toggleTask = useCallback(async (id: string, status: "pending" | "done") => {
    const res = await fetch(`/api/workspace/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { task: WorkspaceTask }
    setTasks(prev => prev.map(t => t.id === id ? data.task : t))
    if (status === "done") {
      emit({ type: "task.completed", data: { taskId: id } })
    }
  }, [emit])

  const deleteTask = useCallback(async (id: string) => {
    await fetch(`/api/workspace/tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const openTab = useCallback((path: string, navigate: (path: string) => void) => {
    navigate(path)
  }, [])

  const populateAndTrigger = useCallback((action: string, idea?: string) => {
    setCopilotAutorun({ action, idea, timestamp: Date.now() })
  }, [])

  const emitWorkspaceSignal = useCallback((signal: MarcusWorkspaceSignal) => {
    workspaceSubscribersRef.current.forEach(cb => {
      try { cb(signal) } catch { /* non-fatal */ }
    })
  }, [])

  const subscribeWorkspaceSignal = useCallback((cb: (signal: MarcusWorkspaceSignal) => void) => {
    workspaceSubscribersRef.current.add(cb)
    return () => { workspaceSubscribersRef.current.delete(cb) }
  }, [])

  return (
    <WorkspaceControllerContext.Provider value={{
      emit,
      subscribe,
      tasks,
      tasksLoading,
      createTasks,
      toggleTask,
      deleteTask,
      refetchTasks: fetchTasks,
      openTab,
      populateAndTrigger,
      emitWorkspaceSignal,
      subscribeWorkspaceSignal,
    }}>
      {children}
    </WorkspaceControllerContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkspaceController() {
  const ctx = useContext(WorkspaceControllerContext)
  if (!ctx) throw new Error("useWorkspaceController must be used within WorkspaceControllerProvider")
  return ctx
}
