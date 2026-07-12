"use client"

import type { ReactNode } from "react"
import { RuntimeEngineProvider } from "./react/RuntimeEngineProvider"

interface Props {
  children: ReactNode
  project?: any
  enabled?: boolean
}

export function WebContainerProviderNew({
  children,
  project,
  enabled,
}: Props) {
  return (
    <RuntimeEngineProvider project={project} enabled={enabled}>
      {children}
    </RuntimeEngineProvider>
  )
}