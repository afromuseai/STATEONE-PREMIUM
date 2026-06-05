import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface UpgradeModalContextValue {
  open: boolean
  openUpgradeModal: () => void
  closeUpgradeModal: () => void
}

const UpgradeModalCtx = createContext<UpgradeModalContextValue>({
  open: false,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
})

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openUpgradeModal = useCallback(() => setOpen(true), [])
  const closeUpgradeModal = useCallback(() => setOpen(false), [])

  return (
    <UpgradeModalCtx.Provider value={{ open, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalCtx.Provider>
  )
}

export function useUpgradeModal() {
  return useContext(UpgradeModalCtx)
}
