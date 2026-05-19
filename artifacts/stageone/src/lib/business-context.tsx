import { createContext, useContext, useState, type ReactNode } from "react"

export interface CrossSystemContext {
  industry: string | null
  lastBusinessIdea: string | null
  websiteGenerated: boolean
  agentsInstalled: number
  automationsConfigured: number
  projectCount: number
}

interface BusinessContextValue {
  businessData: Record<string, unknown> | null
  setBusinessData: (data: Record<string, unknown> | null) => void
  crossSystem: CrossSystemContext
  updateCrossSystem: (updates: Partial<CrossSystemContext>) => void
}

const defaultCrossSystem: CrossSystemContext = {
  industry: null,
  lastBusinessIdea: null,
  websiteGenerated: false,
  agentsInstalled: 0,
  automationsConfigured: 0,
  projectCount: 0,
}

const BusinessCtx = createContext<BusinessContextValue>({
  businessData: null,
  setBusinessData: () => {},
  crossSystem: defaultCrossSystem,
  updateCrossSystem: () => {},
})

export function BusinessContextProvider({ children }: { children: ReactNode }) {
  const [businessData, setBusinessData] = useState<Record<string, unknown> | null>(null)
  const [crossSystem, setCrossSystem] = useState<CrossSystemContext>(defaultCrossSystem)

  const updateCrossSystem = (updates: Partial<CrossSystemContext>) => {
    setCrossSystem(prev => ({ ...prev, ...updates }))
  }

  return (
    <BusinessCtx.Provider value={{ businessData, setBusinessData, crossSystem, updateCrossSystem }}>
      {children}
    </BusinessCtx.Provider>
  )
}

export function useBusinessContext() {
  return useContext(BusinessCtx)
}
