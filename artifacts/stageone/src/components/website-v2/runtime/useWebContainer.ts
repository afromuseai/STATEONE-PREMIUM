"use client"

import { useState } from "react"
import type { RuntimeStatus } from "./runtime-types"

/**
 * useWebContainer — No-op replacement hook.
 *
 * WebContainer is no longer used. File operations are handled by the
 * api-server and database. This hook returns mock implementations that
 * satisfy the existing interface so consuming components (StudioShell,
 * AgentConversation) continue to work without changes.
 */

export function useWebContainer() {
  const [terminalLines] = useState<any[]>([])

  return {
    status: "ready" as RuntimeStatus,

    wcUrl: null,

    terminalLines,

    nodeVersion: null,

    depCount: 0,

    writeFile: async (_path: string, _content: string) => {
      // No-op: files are persisted server-side
    },

    writeFileForReview: async (
      path: string,
      content: string
    ) => {
      return {
        oldContent: "",
        newContent: content,
        path,
      }
    },

    readFile: async (_path: string) => {
      return ""
    },

    listDir: async (_path: string) => {
      return []
    },

    runCommand: async (
      _cmd: string,
      _args: string[]
    ) => {
      return {
        output: "",
        exitCode: 0,
      }
    },

    clearTerminal: () => {
      // No-op
    },

    wc: null,
    container: null,
    isReady: true,
  }
}