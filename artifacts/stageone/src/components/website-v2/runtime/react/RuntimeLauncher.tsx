import { useEffect } from "react"
import { runtimeBridge } from "../controller/RuntimeBridge"

interface Props {
  files: any
  enabled?: boolean
  projectId?: string
}

export function RuntimeLauncher({
  files,
  enabled = true,
  projectId,
}: Props) {

  useEffect(() => {
    if (!enabled) return

    runtimeBridge
      .startProject(files, projectId)
      .catch((error) => {
        console.error(
          "[RuntimeLauncher]",
          error
        )
      })

  }, [files, enabled, projectId])


  return null
}