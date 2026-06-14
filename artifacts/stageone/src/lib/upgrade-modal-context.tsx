import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface UpgradeModalOptions {
  feature?: string
  featureLabel?: string
  requiredPlan?: string
}

interface UpgradeModalContextValue {
  open: boolean
  feature: string | null
  featureLabel: string | null
  requiredPlan: string | null
  openUpgradeModal: (opts?: UpgradeModalOptions) => void
  closeUpgradeModal: () => void
}

const UpgradeModalCtx = createContext<UpgradeModalContextValue>({
  open: false,
  feature: null,
  featureLabel: null,
  requiredPlan: null,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
})

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [feature, setFeature] = useState<string | null>(null)
  const [featureLabel, setFeatureLabel] = useState<string | null>(null)
  const [requiredPlan, setRequiredPlan] = useState<string | null>(null)

  const openUpgradeModal = useCallback((opts?: UpgradeModalOptions) => {
    setFeature(opts?.feature ?? null)
    setFeatureLabel(opts?.featureLabel ?? null)
    setRequiredPlan(opts?.requiredPlan ?? null)
    setOpen(true)
  }, [])

  const closeUpgradeModal = useCallback(() => {
    setOpen(false)
    setFeature(null)
    setFeatureLabel(null)
    setRequiredPlan(null)
  }, [])

  return (
    <UpgradeModalCtx.Provider value={{ open, feature, featureLabel, requiredPlan, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalCtx.Provider>
  )
}

export function useUpgradeModal() {
  return useContext(UpgradeModalCtx)
}
