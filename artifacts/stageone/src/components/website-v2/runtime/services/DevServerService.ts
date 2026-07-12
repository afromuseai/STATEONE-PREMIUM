/**
 * DevServerService — Calls the api-server preview endpoint instead of
 * spawning a dev server inside WebContainer.
 *
 * The preview endpoint (POST /api/website-v2/projects/:id/preview) generates
 * a self-contained HTML preview from the project's source files using AI.
 * The result is persisted to the database and picked up by the UI on refresh.
 */

export class DevServerService {
  private abortController: AbortController | null = null

  /**
   * Start preview generation by calling the api-server SSE endpoint.
   * @param projectId - The UUID of the project to generate a preview for.
   */
  async execute(projectId: string): Promise<void> {
    this.abortController = new AbortController()

    const response = await fetch(
      `/api/website-v2/projects/${projectId}/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: this.abortController.signal,
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error")
      throw new Error(`Preview generation failed (${response.status}): ${text}`)
    }

    // Read the SSE stream to completion — the preview is saved server-side.
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Preview response body is not readable")
    }

    // Drain the stream. We don't need to parse individual events here;
    // the UI refreshes project data separately.
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      decoder.decode(value, { stream: true })
    }
  }

  /**
   * Wait for the preview to be ready. In the new architecture this is a
   * no-op because execute() already waits for the SSE stream to complete.
   * Returns a placeholder URL that signals "preview ready" to the UI.
   */
  async waitForReady(): Promise<string> {
    // The preview is already generated and saved by execute().
    // Return a sentinel value that the UI can use to know preview is ready.
    return "preview://ready"
  }

  /** Cancel an in-flight preview generation request. */
  cancel() {
    this.abortController?.abort()
    this.abortController = null
  }
}