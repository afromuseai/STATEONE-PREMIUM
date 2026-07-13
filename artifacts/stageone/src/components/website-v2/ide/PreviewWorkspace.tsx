import { useState } from "react"
import {
  Monitor, Smartphone, Tablet, RefreshCw, ExternalLink,
  Lock, ZapOff, Globe, Loader,
} from "lucide-react"

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
  /**
   * Optional live WebContainer URL (e.g. "https://abc.webcontainer.io").
   * When provided, the iframe switches from srcDoc to src and the address
   * bar shows the real URL instead of the fake stageone.dev slug.
   */
  wcUrl?:      string | null
}

export function PreviewWorkspace({ preview, projectName, wcUrl }: PreviewWorkspaceProps) {
  const [viewport,   setViewport]   = useState<ViewportSize>("desktop")
  const [refreshKey, setRefreshKey] = useState(0)
  const [wcLoading,  setWcLoading]  = useState(true)

  const vp     = VIEWPORTS[viewport]
  const slug   = projectName.toLowerCase().replace(/\s+/g, "-")

  // Live = either wcUrl is present OR we have static preview HTML
  const isLive     = !!(wcUrl || preview)
  const isWcMode   = !!wcUrl
  const hasContent = isWcMode || !!preview

  // Address bar text
  const addressText = isWcMode
    ? wcUrl!.replace(/^https?:\/\//, "")
    : `stageone.dev / preview / ${slug}`

  return (
    <div className="flex h-full w-full flex-col bg-[#1A1A1A]">

      {/* ── Browser chrome ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-3 py-2">

        {/* macOS traffic lights */}
        <div className="flex items-center gap-[5px]">
          <div className="h-[10px] w-[10px] rounded-full bg-[#ff5f56]/60 ring-1 ring-[#ff5f56]/20" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#ffbd2e]/60 ring-1 ring-[#ffbd2e]/20" />
          <div className="h-[10px] w-[10px] rounded-full bg-[#27c93f]/60 ring-1 ring-[#27c93f]/20" />
        </div>

        {/* Address bar */}
        <div className="flex flex-1 items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#202020] px-2.5 py-[5px] transition-colors hover:border-[rgba(255,255,255,0.08)]">
          {isWcMode
            ? <Globe className="h-3 w-3 flex-shrink-0 text-emerald-400/60" />
            : <Lock  className="h-3 w-3 flex-shrink-0 text-[#ECECEC]/18" />
          }
          <span className={`flex-1 truncate font-mono text-[11px] ${isWcMode ? "text-[#ECECEC]/55" : "text-[#ECECEC]/30"}`}>
            {isWcMode ? (
              <>
                <span className="text-emerald-400/70">{wcUrl!.replace(/^https?:\/\//, "").split("/")[0]}</span>
                {wcUrl!.replace(/^https?:\/\//, "").includes("/") && (
                  <span className="text-[#ECECEC]/35">
                    /{wcUrl!.replace(/^https?:\/\//, "").split("/").slice(1).join("/")}
                  </span>
                )}
              </>
            ) : (
              <>
                stageone.dev / preview /{" "}
                <span className="text-[#ECECEC]/45">{slug}</span>
              </>
            )}
          </span>

          {/* Live / building pill */}
          <div className={`ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-px transition-all duration-500
            ${isLive
              ? "border-emerald-400/20 bg-emerald-400/8"
              : "border-[rgba(255,255,255,0.08)] bg-[#252525]"
            }`}
          >
            {isWcMode && wcLoading
              ? <Loader className="h-2.5 w-2.5 animate-spin text-[#ECECEC]" />
              : <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-[#ECECEC] text-[#1A1A1A] animate-pulse"}`} />
            }
            <span className={`text-[10px] font-medium ${isLive ? "text-emerald-400/80" : "text-[#ECECEC]"}`}>
              {isWcMode && wcLoading ? "Connecting…" : isLive ? (isWcMode ? "WC Live" : "Live") : "Building"}
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
                    ? "bg-[#252525] text-[#ECECEC]"
                    : "text-[#ECECEC]/22 hover:bg-[#252525] hover:text-[#ECECEC]/52"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}

          <div className="mx-1 h-3.5 w-px bg-[#252525]" />

          <button
            onClick={() => { setRefreshKey((k) => k + 1); setWcLoading(true) }}
            title="Reload preview"
            aria-label="Reload preview"
            className="flex h-6 w-6 items-center justify-center rounded text-[#ECECEC]/22 transition-colors hover:bg-[#252525] hover:text-[#ECECEC]/52"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            title="Open in new tab (scripts disabled for static previews)"
            aria-label="Open preview in new tab"
            onClick={() => {
              if (isWcMode && wcUrl) {
                // WebContainer URL is real — open directly
                window.open(wcUrl, "_blank", "noopener,noreferrer")
                return
              }
              if (!preview) return
              // Static HTML: strip scripts before opening outside the iframe sandbox
              const safe    = preview.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
              const cspMeta = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none';">`
              const withCsp = safe.replace(/(<head[^>]*>)/i, `$1${cspMeta}`)
              const blob    = new Blob([withCsp], { type: "text/html" })
              const url     = URL.createObjectURL(blob)
              window.open(url, "_blank", "noopener,noreferrer")
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
            }}
            disabled={!hasContent}
            className="flex h-6 w-6 items-center justify-center rounded text-[#ECECEC]/22 transition-colors hover:bg-[#252525] hover:text-[#ECECEC]/52 disabled:opacity-30"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Preview canvas ─────────────────────────────────────────────── */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-auto bg-[#1A1A1A]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {!hasContent ? (
          /* Empty state */
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525]">
                <ZapOff className="h-6 w-6 text-[#ECECEC]/12" />
              </div>
              <p className="text-[13px] font-medium text-[#ECECEC]/22">No preview yet</p>
              <p className="mt-1 text-[11px] text-[#ECECEC]/14">Ask Marcus to build your website</p>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-1 items-start justify-center p-6">
            <div
              className="relative transition-all duration-300"
              style={{ width: vp.width, maxWidth: "100%" }}
            >
              {/* Viewport label for non-desktop */}
              {viewport !== "desktop" && (
                <div className="absolute -top-7 left-0 right-0 flex items-center justify-center gap-2">
                  <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#202020] px-2.5 py-0.5 font-mono text-[10px] text-[#ECECEC]/28 backdrop-blur-sm">
                    {vp.px}px · {vp.label}
                  </span>
                </div>
              )}

              {/* WebContainer: connecting overlay */}
              {isWcMode && wcLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#1A1A1A]/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader className="h-6 w-6 animate-spin text-[#ECECEC]" />
                    <span className="text-[12px] text-[#ECECEC]/40">Connecting to WebContainer…</span>
                  </div>
                </div>
              )}

              {/* Frame */}
              <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] shadow-none">
                {isWcMode ? (
                  /* Live WebContainer iframe — uses src, not srcDoc */
                  <iframe
                    key={`wc-${refreshKey}`}
                    src={wcUrl!}
                    title={`Live — ${projectName}`}
                    onLoad={() => setWcLoading(false)}
                    className="block w-full border-0 bg-white"
                    style={{ height: "calc(100vh - 156px)", minHeight: "520px" }}
                    /* Note: no sandbox restriction for WebContainer iframes —
                       they need full access to the running dev server. */
                  />
                ) : (
                  /* Static HTML preview — uses srcDoc with sandbox */
                  <iframe
                    key={`static-${refreshKey}`}
                    srcDoc={preview!}
                    title={`Preview — ${projectName}`}
                    sandbox="allow-scripts allow-same-origin"
                    className="block w-full border-0 bg-white"
                    style={{ height: "calc(100vh - 156px)", minHeight: "520px" }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
