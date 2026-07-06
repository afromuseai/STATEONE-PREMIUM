import { useState } from "react"
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from "lucide-react"

type ViewportSize = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<ViewportSize, { label: string; icon: React.ElementType; width: string }> = {
  desktop: { label: "Desktop", icon: Monitor,    width: "100%" },
  tablet:  { label: "Tablet",  icon: Tablet,     width: "768px" },
  mobile:  { label: "Mobile",  icon: Smartphone, width: "390px" },
}

interface PreviewPanelProps {
  preview: string | null
  projectName: string
}

export function PreviewPanel({ preview, projectName }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportSize>("desktop")
  const [refreshKey, setRefreshKey] = useState(0)

  const vp = VIEWPORTS[viewport]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Preview
        </span>

        <div className="flex items-center gap-1">
          {(Object.keys(VIEWPORTS) as ViewportSize[]).map((v) => {
            const Icon = VIEWPORTS[v].icon
            const active = viewport === v
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                title={VIEWPORTS[v].label}
                className={`flex h-6 w-6 items-center justify-center rounded transition-colors duration-150
                  ${active ? "bg-amber-400/15 text-amber-400" : "text-white/30 hover:bg-white/5 hover:text-white/60"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}

          <div className="mx-1 h-3.5 w-px bg-white/10" />

          <button
            onClick={() => setRefreshKey(k => k + 1)}
            title="Refresh preview"
            className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-zinc-950 p-3">
        {!preview ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <Monitor className="h-7 w-7 text-white/20" />
              </div>
              <p className="text-sm text-white/30">No preview available</p>
              <p className="mt-1 text-xs text-white/20">Generate a project to see the preview</p>
            </div>
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-lg border border-white/10 shadow-xl transition-all duration-300"
            style={{ width: vp.width, maxWidth: "100%", minHeight: "400px" }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-zinc-900 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500/60" />
              <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
              <div className="h-2 w-2 rounded-full bg-green-500/60" />
              <div className="ml-2 flex-1 rounded bg-black/40 px-2 py-0.5 text-center text-[10px] text-white/30">
                {projectName}
              </div>
              <ExternalLink className="h-3 w-3 text-white/20" />
            </div>

            <iframe
              key={refreshKey}
              srcDoc={preview}
              title={`Preview — ${projectName}`}
              sandbox="allow-scripts allow-same-origin"
              className="block w-full border-0 bg-white"
              style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
