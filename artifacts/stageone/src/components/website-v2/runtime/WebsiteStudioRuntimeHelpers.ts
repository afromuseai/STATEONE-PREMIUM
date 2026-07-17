// ─── Website Studio Runtime Helpers ───────────────────────────────────────────
// Shared utilities for WebsiteStudioRuntime

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function wsNowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

// Naive recursive file tree builder (2 levels)
export async function wsBuildFileTree(
  listDir: (p: string) => Promise<string[]>,
  path = "/",
  depth = 0,
): Promise<string> {
  if (depth > 2) return ""
  const lines: string[] = []
  try {
    const entries = await listDir(path)
    for (const e of entries.slice(0, 40)) {
      const indent = "  ".repeat(depth)
      lines.push(`${indent}${e}`)
      if (e.endsWith("/") && depth < 1) {
        const sub = await wsBuildFileTree(listDir, wsJoinPath(path, e.slice(0, -1)), depth + 1)
        if (sub) lines.push(sub)
      }
    }
  } catch { /* non-critical */ }
  return lines.join("\n")
}

function wsJoinPath(base: string, name: string): string {
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`
}