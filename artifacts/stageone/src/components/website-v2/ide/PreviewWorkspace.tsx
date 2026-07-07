import { useState } from "react"
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Lock, ZapOff } from "lucide-react"

type ViewportSize = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<ViewportSize, {
  label: string
  icon:  React.ElementType
  width: string
  px:    string
}> = {
  desktop: { label: "Desktop", icon: Monitor,    width: "100%",  px: "—" },
  tablet:  { label: "Tablet",  icon: Tablet,     width: "768px", px: "768" },
  mobile:  { label: "Mobile",  icon: Smartphone, width: "390px", px: "390" },
}

interface PreviewWorkspaceProps {
  preview:     string | null
  projectName: string
}

export function PreviewWorkspace({ preview, projectName }: PreviewWorkspaceProps) {
  const [viewport,    setViewport]    = useState<ViewportSize>("desktop")
  const [refreshKey,  setRefreshKey]  = useState(0)

  const vp     = VIEWPORTS[viewport]
  const isLive = !!preview
  const slug   = projectName.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="flex h-full flex-col bg-[#0c0c0c]">

      {/* ── Browser chrome ────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.05] bg-[#0c0c0c] px-3 py-2">

        {/* macOS traffic lights */}
        <div className="flex items-center gap-[5px]">
          <div className="h-[10px] w-[10px] rounded-full bg-[#ff5f56]/60 ring-1 ring-[#ff5f56]/20" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#ffbd2e]/60 ring-1 ring-[#ffbd2e]/20" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#27c93f]/60 ring-1 ring-[#27c93f]/20" />
        </div>

        {/* Address bar */}
        <div className="flex flex-1 items-center gap-2 rounded-md border border-white/[0.06] bg-black/25 px-2.5 py-[5px] transition-colors hover:border-white/[0.10]">
          <Lock className="h-3 w-3 flex-shrink-0 text-white/18" />
          <span className="flex-1 truncate font-mono text-[11px] text-white/30">
            stageone.dev / preview / <span className="text-white/45">{slug}</span>
          </span>
          {/* Live/building pill */}
          <div className={`ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-px transition-all duration-500
            ${isLive
              ? "border-emerald-400/20 bg-emerald-400/8"
              : "border-amber-400/20 bg-amber-400/8"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            <span className={`text-[10px] font-medium ${isLive ? "text-emerald-400/80" : "text-amber-400/80"}`}>
              {isLive ? "Live" : "Building"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Viewport switcher */}
          {(Object.keys(VIEWPORTS) as ViewportSize[]).map((v) => {
            const Icon   = VIEWPORTS[v].icon
            const active = viewport === v
            const label  = `${VIEWPORTS[v].label}${VIEWPORTS[v].px !== "—" ? ` (${VIEWPORTS[v].px}px)` : ""}`
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={`flex h-6 w-6 items-center justify-center rounded transition-all duration-100
                  ${active
                    ? "bg-white/[0.08] text-white/75"
                    : "text-white/22 hover:bg-white/[0.05] hover:text-white/52"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}

          <div className="mx-1 h-3.5 w-px bg-white/[0.07]" />

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Reload preview"
            aria-label="Reload preview"
            className="flex h-6 w-6 items-center justify-center rounded text-white/22 transition-colors hover:bg-white/[0.05] hover:text-white/52"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            title="Open in new tab (scripts disabled)"
            aria-label="Open preview in new tab (scripts disabled)"
            onClick={() => {
              if (!preview) return
              // Strip scripts before opening outside the sandbox — prevents XSS
              // from AI-generated HTML running outside the iframe content security policy.
              const safe = preview.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
              const cspMeta = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none';">`
              const withCsp = safe.replace(/(<head[^>]*>)/i, `$1${cspMeta}`)
              const blob = new Blob([withCsp], { type: "text/html" })
              const url  = URL.createObjectURL(blob)
              window.open(url, "_blank", "noopener,noreferrer")
              // Revoke after a short delay to free memory
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
            }}
            disabled={!preview}
            className="flex h-6 w-6 items-center justify-center rounded text-white/22 transition-colors hover:bg-white/[0.05] hover:text-white/52 disabled:opacity-30"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Preview canvas ─────────────────────────────────────────────── */}
      <div className="relative flex flex-1 items-start justify-center overflow-auto bg-[#0f0f0f]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "24px 24px" }}
      >
        {!preview ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                <ZapOff className="h-6 w-6 text-white/12" />
              </div>
              <p className="text-[13px] font-medium text-white/22">No preview yet</p>
              <p className="mt-1 text-[11px] text-white/14">Ask Marcus to build your website</p>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-1 items-start justify-center p-6">
            <div className="relative transition-all duration-300" style={{ width: vp.width, maxWidth: "100%" }}>
              {/* Viewport label for non-desktop */}
              {viewport !== "desktop" && (
                <div className="absolute -top-7 left-0 right-0 flex items-center justify-center gap-2">
                  <span className="rounded-full border border-white/[0.07] bg-black/50 px-2.5 py-0.5 font-mono text-[10px] text-white/28 backdrop-blur-sm">
                    {vp.px}px · {vp.label}
                  </span>
                </div>
              )}

              {/* Frame */}
              <div className="overflow-hidden rounded-lg border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_32px_80px_rgba(0,0,0,0.7)]">
                <iframe
                  key={refreshKey}
                  srcDoc={preview}
                  title={`Preview — ${projectName}`}
                  sandbox="allow-scripts allow-same-origin"
                  className="block w-full border-0 bg-white"
                  style={{ height: "calc(100vh - 156px)", minHeight: "520px" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
