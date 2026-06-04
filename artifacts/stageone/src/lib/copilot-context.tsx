import { createContext, useContext, useState, type ReactNode } from "react"

interface CopilotContextValue {
  open: boolean
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void
}

const CopilotContext = createContext<CopilotContextValue | null>(null)

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <CopilotContext.Provider value={{ open, setOpen }}>
      {children}
    </CopilotContext.Provider>
  )
}

export function useCopilot() {
  const ctx = useContext(CopilotContext)
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider")
  return ctx
}
