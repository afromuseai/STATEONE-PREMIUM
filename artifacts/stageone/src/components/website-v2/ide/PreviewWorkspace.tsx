import { useState } from "react"
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Lock, Circle } from "lucide-react"

type ViewportSize = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<ViewportSize, { label: string; icon: React.ElementType; width: string; frameWidth?: string }> = {
  desktop: { label: "Desktop", icon: Monitor,    width: "100%" },
  tablet:  { label: "Tablet",  icon: Tablet,     width: "768px" },
  mobile:  { label: "Mobile",  icon: Smartphone, width: "393px" },
}

interface PreviewWorkspaceProps {
  preview: string | null
  projectName: string
}

export function PreviewWorkspace({ preview, projectName }: PreviewWorkspaceProps) {
  const [viewport, setViewport]     = useState<ViewportSize>("desktop")
  const [refreshKey, setRefreshKey] = useState(0)
  const [liveStatus]                = useState<"live" | "building">("live")

  const vp = VIEWPORTS[viewport]
  const isLive = liveStatus === "live" && !!preview

  return (
    <div className="flex h-full flex-col bg-[#0c0c0c]">

      {/* ── Browser chrome ───────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0d0d0d] px-3 py-2">

        {/* Traffic lights */}
        <div className="flex items-center gap-[5px]">
          <div className="h-[10px] w-[10px] rounded-full bg-[#ff5f56]/70" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#ffbd2e]/70" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#27c93f]/70" />
        </div>

        {/* Address bar */}
        <div className="flex flex-1 items-center gap-2 rounded-md border border-white/[0.07] bg-black/30 px-2.5 py-1">
          <Lock className="h-3 w-3 flex-shrink-0 text-white/20" />
          <span className="flex-1 truncate font-mono text-[11px] text-white/35">
            stageone.dev / preview / {encodeURIComponent(projectName.toLowerCase().replace(/\s+/g, "-"))}
          </span>
          {/* Runtime status */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
            <Circle
              className={`h-2 w-2 ${isLive ? "fill-emerald-400 text-emerald-400" : "fill-amber-400 text-amber-400 animate-pulse"}`}
            />
            <span className={`text-[10px] font-medium ${isLive ? "text-emerald-400/80" : "text-amber-400/80"}`}>
              {isLive ? "Live" : "Building"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Viewport selector */}
          {(Object.keys(VIEWPORTS) as ViewportSize[]).map((v) => {
            const Icon   = VIEWPORTS[v].icon
            const active = viewport === v
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                title={VIEWPORTS[v].label}
                className={`flex h-6 w-6 items-center justify-center rounded transition-colors
                  ${active ? "bg-white/[0.09] text-white/75" : "text-white/25 hover:bg-white/[0.05] hover:text-white/55"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}

          <div className="mx-1 h-3.5 w-px bg-white/[0.08]" />

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Reload"
            className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/55"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            title="Open in new tab"
            className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:bg-white/[0.05] hover:text-white/55"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Preview canvas ───────────────────────────────────────────── */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-[#111111] p-4">
        {!preview ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <Monitor className="h-7 w-7 text-white/15" />
              </div>
              <p className="text-[13px] font-medium text-white/25">No preview yet</p>
              <p className="mt-1 text-[11px] text-white/15">Ask Marcus to build your website</p>
            </div>
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-lg border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.6)] transition-all duration-300"
            style={{ width: vp.width, maxWidth: "100%" }}
          >
            {/* Viewport size label */}
            {viewport !== "desktop" && (
              <div className="absolute -top-6 left-0 right-0 flex items-center justify-center">
                <span className="rounded-full border border-white/[0.08] bg-black/60 px-2 py-0.5 text-[10px] text-white/30 backdrop-blur-sm">
                  {vp.width} · {VIEWPORTS[viewport].label}
                </span>
              </div>
            )}
            <iframe
              key={refreshKey}
              srcDoc={preview}
              title={`Preview — ${projectName}`}
              sandbox="allow-scripts allow-same-origin"
              className="block w-full border-0 bg-white"
              style={{ height: "calc(100vh - 140px)", minHeight: "520px" }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
