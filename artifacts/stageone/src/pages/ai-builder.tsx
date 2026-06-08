import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Download, RefreshCw, ChevronLeft, Sparkles, Trash2, Clock,
  Globe, Maximize2, Minimize2, Code2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2, AlertTriangle, RotateCcw, History,
  Terminal,
} from "lucide-react";

const STYLES = [
  "Modern SaaS", "Dark Futuristic", "Luxury Premium", "Bold Brutalist",
  "Minimal Clean", "Glassmorphism", "Cinematic Dark", "Startup Bold", "Enterprise Professional",
];

const INDUSTRIES = [
  "SaaS", "Fintech", "Healthcare", "E-commerce", "Agency / Creative",
  "Cybersecurity", "Education", "Marketplace", "Hospitality & Luxury",
  "Legal / Professional Services", "Gaming & Entertainment", "Real Estate",
];

interface SavedProject {
  id: string;
  prompt: string;
  style: string;
  industry: string;
  createdAt: string;
}

interface GenerationArtifact {
  id: string;
  prompt: string;
  style: string;
  industry: string;
  generationStatus: "generating" | "completed" | "failed";
  modelUsed: string | null;
  durationMs: number | null;
  tokenCount: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface DebugInfo {
  prompt: string;
  style: string;
  industry: string;
  model: string;
  durationMs: number | null;
  tokenCount: number | null;
  generationId: string | null;
  startedAt: string;
}

type PreviewMode = "desktop" | "mobile";
type RightView = "preview" | "code";
type SidebarTab = "generate" | "history" | "debug";

export default function AiBuilderPage() {
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Modern SaaS");
  const [industry, setIndustry] = useState("SaaS");

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingHtml, setStreamingHtml] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [rightView, setRightView] = useState<RightView>("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("generate");

  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [generations, setGenerations] = useState<GenerationArtifact[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  const [tokenCount, setTokenCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadProjects();
    loadGenerations();
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/ai-builder/projects", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { projects: SavedProject[] };
        setProjects(data.projects);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadGenerations = async () => {
    setLoadingGenerations(true);
    try {
      const res = await fetch("/api/ai-builder/generations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { generations: GenerationArtifact[] };
        setGenerations(data.generations);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingGenerations(false);
    }
  };

  const generate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsGenerating(true);
    setError(null);
    setFailedPrompt(null);
    setStreamingHtml("");
    setGeneratedHtml("");
    setTokenCount(0);
    setDebugInfo(null);
    startTimeRef.current = Date.now();

    const capturedPrompt = prompt.trim();
    const capturedStyle = style;
    const capturedIndustry = industry;
    const startedAt = new Date().toISOString();

    try {
      const res = await fetch("/api/ai-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({ prompt: capturedPrompt, style: capturedStyle, industry: capturedIndustry }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Generation failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let htmlBuffer = "";
      let resolvedGenerationId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = carry + decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        carry = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const parsed = JSON.parse(raw) as {
              content?: string;
              done?: boolean;
              fullHtml?: string;
              error?: string;
              generationId?: string;
              durationMs?: number;
              tokenCount?: number;
              modelUsed?: string;
            };

            if (parsed.generationId && !resolvedGenerationId) {
              resolvedGenerationId = parsed.generationId;
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.content) {
              htmlBuffer += parsed.content;
              setStreamingHtml(htmlBuffer);
              setTokenCount(t => t + 1);
            }

            if (parsed.done && parsed.fullHtml) {
              const elapsedMs = parsed.durationMs ?? (Date.now() - startTimeRef.current);
              const finalTokenCount = parsed.tokenCount ?? Math.round(htmlBuffer.length / 4);
              const modelUsed = parsed.modelUsed ?? "nvidia/llama-3.3-nemotron-super-49b-v1";

              setGeneratedHtml(parsed.fullHtml);
              setStreamingHtml("");
              setDebugInfo({
                prompt: capturedPrompt,
                style: capturedStyle,
                industry: capturedIndustry,
                model: modelUsed,
                durationMs: elapsedMs,
                tokenCount: finalTokenCount,
                generationId: resolvedGenerationId,
                startedAt,
              });
              setIsDebugOpen(true);
              await loadGenerations();
              await loadProjects();
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      // Fallback: if done event was missed
      if (htmlBuffer && !generatedHtml) {
        setGeneratedHtml(htmlBuffer);
        setStreamingHtml("");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setFailedPrompt(capturedPrompt);
      await loadGenerations();
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, style, industry, generatedHtml]);

  const retryGeneration = useCallback(() => {
    if (failedPrompt) setPrompt(failedPrompt);
    setError(null);
    setFailedPrompt(null);
  }, [failedPrompt]);

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-builder/projects/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { project: SavedProject & { fullHtml?: string } };
        if (data.project.fullHtml) {
          setGeneratedHtml(data.project.fullHtml);
          setPrompt(data.project.prompt);
          setStyle(data.project.style);
          setIndustry(data.project.industry);
          setSidebarTab("generate");
        }
      }
    } catch {}
  };

  const loadGeneration = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-builder/generations/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { generation: GenerationArtifact & { generatedHtml?: string } };
        const gen = data.generation;
        if (gen.generatedHtml) {
          setGeneratedHtml(gen.generatedHtml);
          setPrompt(gen.prompt);
          setStyle(gen.style);
          setIndustry(gen.industry);
          setDebugInfo({
            prompt: gen.prompt,
            style: gen.style,
            industry: gen.industry,
            model: gen.modelUsed ?? "unknown",
            durationMs: gen.durationMs ?? null,
            tokenCount: gen.tokenCount ?? null,
            generationId: gen.id,
            startedAt: gen.createdAt,
          });
          setSidebarTab("generate");
        } else if (gen.generationStatus === "failed") {
          setPrompt(gen.prompt);
          setStyle(gen.style);
          setIndustry(gen.industry);
          setError(gen.errorMessage ?? "Generation failed");
          setFailedPrompt(gen.prompt);
          setSidebarTab("generate");
        }
      }
    } catch {}
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ai-builder/projects/${id}`, { method: "DELETE", credentials: "include" });
      setProjects(p => p.filter(pr => pr.id !== id));
    } catch {}
  };

  const deleteGeneration = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ai-builder/generations/${id}`, { method: "DELETE", credentials: "include" });
      setGenerations(g => g.filter(gen => gen.id !== id));
    } catch {}
  };

  const downloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${style.toLowerCase().replace(/ /g, "-")}-website.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasOutput = generatedHtml || isGenerating;
  const progress = Math.min(tokenCount / 200, 0.95);

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTokens = (count: number | null) => {
    if (count === null) return "—";
    return count.toLocaleString();
  };

  const statusIcon = (status: GenerationArtifact["generationStatus"]) => {
    if (status === "completed") return <CheckCircle2 size={12} className="gen-status-icon gen-status-icon--ok" />;
    if (status === "failed") return <XCircle size={12} className="gen-status-icon gen-status-icon--fail" />;
    return <Loader2 size={12} className="gen-status-icon gen-status-icon--pending ab-spin" />;
  };

  return (
    <div className={`ai-builder ${isFullscreen ? "ai-builder--fullscreen" : ""}`}>
      <style>{builderStyles}</style>

      {/* ── Top Bar ── */}
      <header className="ab-header">
        <div className="ab-header-left">
          <button className="ab-back" onClick={() => navigate("/dashboard")}>
            <ChevronLeft size={16} />
            Dashboard
          </button>
          <div className="ab-logo">
            <Zap size={16} className="ab-logo-icon" />
            <span>AI Builder</span>
            <span className="ab-badge">BETA</span>
          </div>
        </div>

        <div className="ab-header-right">
          {generatedHtml && (
            <>
              <div className="ab-view-toggle">
                <button
                  className={`ab-view-btn ${rightView === "preview" ? "active" : ""}`}
                  onClick={() => setRightView("preview")}
                >
                  <Globe size={14} /> Preview
                </button>
                <button
                  className={`ab-view-btn ${rightView === "code" ? "active" : ""}`}
                  onClick={() => setRightView("code")}
                >
                  <Code2 size={14} /> Code
                </button>
              </div>
              <div className="ab-device-toggle">
                <button
                  className={`ab-device-btn ${previewMode === "desktop" ? "active" : ""}`}
                  onClick={() => setPreviewMode("desktop")}
                >
                  Desktop
                </button>
                <button
                  className={`ab-device-btn ${previewMode === "mobile" ? "active" : ""}`}
                  onClick={() => setPreviewMode("mobile")}
                >
                  Mobile
                </button>
              </div>
              <button className="ab-action-btn" onClick={downloadHtml} title="Download HTML">
                <Download size={14} /> Download
              </button>
            </>
          )}
          <button
            className="ab-action-btn ab-action-btn--ghost"
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      <div className="ab-body">
        {/* ── Left Sidebar ── */}
        {!isFullscreen && (
          <aside className="ab-sidebar">
            {/* Tab bar */}
            <div className="ab-tabs">
              <button
                className={`ab-tab ${sidebarTab === "generate" ? "active" : ""}`}
                onClick={() => setSidebarTab("generate")}
              >
                <Sparkles size={13} /> Generate
              </button>
              <button
                className={`ab-tab ${sidebarTab === "history" ? "active" : ""}`}
                onClick={() => setSidebarTab("history")}
              >
                <History size={13} />
                History
                {generations.length > 0 && (
                  <span className="ab-tab-count">{generations.length}</span>
                )}
              </button>
              <button
                className={`ab-tab ${sidebarTab === "debug" ? "active" : ""}`}
                onClick={() => setSidebarTab("debug")}
              >
                <Terminal size={13} /> Debug
              </button>
            </div>

            {/* ── Generate Tab ── */}
            {sidebarTab === "generate" && (
              <div className="ab-sidebar-top">
                <div className="ab-field">
                  <label className="ab-label">Describe your business</label>
                  <textarea
                    className="ab-textarea"
                    placeholder="e.g. A luxury skincare brand targeting women 30–50 who want clean, science-backed beauty products with eco-friendly packaging..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={7}
                  />
                </div>

                <div className="ab-field-row">
                  <div className="ab-field">
                    <label className="ab-label">Design Style</label>
                    <select className="ab-select" value={style} onChange={e => setStyle(e.target.value)}>
                      {STYLES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="ab-field">
                    <label className="ab-label">Industry</label>
                    <select className="ab-select" value={industry} onChange={e => setIndustry(e.target.value)}>
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  className={`ab-generate-btn ${isGenerating ? "loading" : ""}`}
                  onClick={generate}
                  disabled={!prompt.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={16} className="ab-spin" />
                      Building… {tokenCount > 0 ? `(${tokenCount} tokens)` : ""}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {generatedHtml ? "Regenerate" : "Generate Website"}
                    </>
                  )}
                </button>

                {isGenerating && (
                  <div className="ab-progress">
                    <div className="ab-progress-bar" style={{ width: `${progress * 100}%` }} />
                  </div>
                )}

                {/* ── Error / Failure State ── */}
                {error && (
                  <div className="ab-error">
                    <div className="ab-error-header">
                      <AlertTriangle size={14} className="ab-error-icon" />
                      <strong>Generation Failed</strong>
                    </div>
                    <p className="ab-error-msg">{error}</p>
                    {failedPrompt && (
                      <button className="ab-retry-btn" onClick={retryGeneration}>
                        <RotateCcw size={12} /> Retry with same prompt
                      </button>
                    )}
                  </div>
                )}

                {/* ── Inline Debug Panel ── */}
                {debugInfo && !error && (
                  <div className="ab-debug-inline">
                    <button
                      className="ab-debug-toggle"
                      onClick={() => setIsDebugOpen(o => !o)}
                    >
                      <Terminal size={12} />
                      <span>Debug Info</span>
                      {isDebugOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {isDebugOpen && (
                      <div className="ab-debug-body">
                        <div className="ab-debug-row">
                          <span className="ab-debug-key">Model</span>
                          <span className="ab-debug-val ab-debug-val--mono">{debugInfo.model.split("/").pop()}</span>
                        </div>
                        <div className="ab-debug-row">
                          <span className="ab-debug-key">Duration</span>
                          <span className="ab-debug-val">{formatDuration(debugInfo.durationMs)}</span>
                        </div>
                        <div className="ab-debug-row">
                          <span className="ab-debug-key">Tokens</span>
                          <span className="ab-debug-val">~{formatTokens(debugInfo.tokenCount)}</span>
                        </div>
                        <div className="ab-debug-row">
                          <span className="ab-debug-key">Gen ID</span>
                          <span className="ab-debug-val ab-debug-val--mono ab-debug-val--small">
                            {debugInfo.generationId ? debugInfo.generationId.slice(0, 8) + "…" : "—"}
                          </span>
                        </div>
                        <div className="ab-debug-row">
                          <span className="ab-debug-key">Started</span>
                          <span className="ab-debug-val">{new Date(debugInfo.startedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="ab-debug-prompt-wrap">
                          <span className="ab-debug-key">Prompt sent</span>
                          <div className="ab-debug-prompt">{debugInfo.prompt}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── History Tab ── */}
            {sidebarTab === "history" && (
              <div className="ab-history-tab">
                <div className="ab-history-header">
                  <span className="ab-history-title-text">
                    <Clock size={13} /> Generation Artifacts
                  </span>
                  <button className="ab-history-refresh" onClick={loadGenerations} title="Refresh">
                    <RefreshCw size={12} className={loadingGenerations ? "ab-spin" : ""} />
                  </button>
                </div>

                {loadingGenerations ? (
                  <div className="ab-history-empty">
                    <Loader2 size={18} className="ab-spin" style={{ opacity: 0.4 }} />
                  </div>
                ) : generations.length === 0 ? (
                  <div className="ab-history-empty">
                    <History size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                    No generations yet.<br />Generate your first website!
                  </div>
                ) : (
                  <div className="ab-gen-list">
                    {generations.map(gen => (
                      <button
                        key={gen.id}
                        className={`ab-gen-item ${gen.generationStatus === "failed" ? "ab-gen-item--failed" : ""}`}
                        onClick={() => loadGeneration(gen.id)}
                        disabled={gen.generationStatus === "generating"}
                      >
                        <div className="ab-gen-item-top">
                          <div className="ab-gen-status-row">
                            {statusIcon(gen.generationStatus)}
                            <span className={`ab-gen-status-label ab-gen-status-label--${gen.generationStatus}`}>
                              {gen.generationStatus}
                            </span>
                          </div>
                          <button
                            className="ab-history-delete"
                            onClick={e => deleteGeneration(gen.id, e)}
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div className="ab-gen-prompt">
                          {gen.prompt.slice(0, 72)}{gen.prompt.length > 72 ? "…" : ""}
                        </div>
                        <div className="ab-gen-meta">
                          <span className="ab-gen-style">{gen.style}</span>
                          <span className="ab-gen-sep">·</span>
                          <span>{new Date(gen.createdAt).toLocaleDateString()}</span>
                          {gen.durationMs !== null && (
                            <>
                              <span className="ab-gen-sep">·</span>
                              <span>{formatDuration(gen.durationMs)}</span>
                            </>
                          )}
                        </div>
                        {gen.generationStatus === "failed" && gen.errorMessage && (
                          <div className="ab-gen-error-msg">{gen.errorMessage.slice(0, 80)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Debug Tab ── */}
            {sidebarTab === "debug" && (
              <div className="ab-debug-tab">
                <div className="ab-debug-tab-header">
                  <Terminal size={14} />
                  <span>Debug Panel</span>
                </div>
                {!debugInfo ? (
                  <div className="ab-history-empty" style={{ textAlign: "center" }}>
                    <Terminal size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                    No generation yet.<br />
                    Run a generation to see debug info.
                  </div>
                ) : (
                  <div className="ab-debug-full">
                    <div className="ab-debug-section-title">Generation</div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Generation ID</span>
                      <span className="ab-debug-val ab-debug-val--mono ab-debug-val--small">
                        {debugInfo.generationId ?? "—"}
                      </span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Started at</span>
                      <span className="ab-debug-val">{new Date(debugInfo.startedAt).toLocaleString()}</span>
                    </div>

                    <div className="ab-debug-section-title" style={{ marginTop: 16 }}>Performance</div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Model</span>
                      <span className="ab-debug-val ab-debug-val--mono">{debugInfo.model}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Duration</span>
                      <span className="ab-debug-val ab-debug-val--highlight">{formatDuration(debugInfo.durationMs)}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Token usage</span>
                      <span className="ab-debug-val ab-debug-val--highlight">~{formatTokens(debugInfo.tokenCount)} tokens</span>
                    </div>

                    <div className="ab-debug-section-title" style={{ marginTop: 16 }}>Parameters</div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Style</span>
                      <span className="ab-debug-val">{debugInfo.style}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Industry</span>
                      <span className="ab-debug-val">{debugInfo.industry}</span>
                    </div>

                    <div className="ab-debug-section-title" style={{ marginTop: 16 }}>Prompt sent to AI</div>
                    <div className="ab-debug-prompt-full">{debugInfo.prompt}</div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* ── Preview Panel ── */}
        <main className="ab-preview-area">
          <AnimatePresence mode="wait">
            {!hasOutput ? (
              <motion.div
                key="empty"
                className="ab-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="ab-empty-icon">
                  <Zap size={40} />
                </div>
                <h2 className="ab-empty-title">AI Website Builder</h2>
                <p className="ab-empty-sub">
                  Describe your business and the AI will write a complete, unique website from scratch —
                  raw HTML, CSS, and JavaScript. No templates. No constraints.
                </p>
                <div className="ab-empty-pills">
                  {["Full HTML/CSS/JS", "Unique per business", "Animations included", "Download ready"].map(t => (
                    <span key={t} className="ab-empty-pill">{t}</span>
                  ))}
                </div>
              </motion.div>
            ) : isGenerating && !generatedHtml ? (
              <motion.div
                key="generating"
                className="ab-generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="ab-gen-header">
                  <div className="ab-gen-dot" />
                  <span>Generating — AI is writing your website…</span>
                </div>
                <div className="ab-gen-code">
                  <pre className="ab-gen-pre">{streamingHtml || "Starting…"}</pre>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                className="ab-result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {rightView === "code" ? (
                  <div className="ab-code-view">
                    <div className="ab-code-toolbar">
                      <span className="ab-code-lang">HTML</span>
                      <button
                        className="ab-code-copy"
                        onClick={() => navigator.clipboard.writeText(generatedHtml)}
                      >
                        Copy all
                      </button>
                    </div>
                    <pre className="ab-code-pre"><code>{generatedHtml}</code></pre>
                  </div>
                ) : (
                  <div className={`ab-iframe-wrap ab-iframe-wrap--${previewMode}`}>
                    <div className="ab-browser-chrome">
                      <div className="ab-chrome-dots">
                        <span /><span /><span />
                      </div>
                      <div className="ab-chrome-bar">
                        <span className="ab-chrome-url">
                          {style.toLowerCase().replace(/ /g, "-")}-website.html
                        </span>
                      </div>
                    </div>
                    <iframe
                      ref={iframeRef}
                      className="ab-iframe"
                      srcDoc={generatedHtml}
                      sandbox="allow-scripts allow-same-origin"
                      title="AI Generated Website Preview"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

const builderStyles = `
/* ── AI Builder Shell ───────────────────────────────────────────────────────── */
.ai-builder {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0f;
  color: #e8e8f0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
.ai-builder--fullscreen .ab-sidebar { display: none; }
.ai-builder--fullscreen .ab-preview-area { flex: 1; }

/* ── Header ─────────────────────────────────────────────────────────────────── */
.ab-header {
  height: 52px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  background: rgba(10,10,15,0.95);
  backdrop-filter: blur(12px);
  z-index: 10;
}
.ab-header-left { display: flex; align-items: center; gap: 16px; }
.ab-header-right { display: flex; align-items: center; gap: 8px; }

.ab-back {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; color: rgba(255,255,255,0.45);
  background: none; border: none; cursor: pointer;
  padding: 6px 8px; border-radius: 6px;
  transition: color .2s, background .2s;
}
.ab-back:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); }

.ab-logo {
  display: flex; align-items: center; gap: 7px;
  font-size: 14px; font-weight: 700; letter-spacing: -0.01em;
}
.ab-logo-icon { color: #7c3aed; }
.ab-badge {
  font-size: 9px; font-weight: 800; letter-spacing: 0.1em;
  background: rgba(124,58,237,0.2); color: #a78bfa;
  border: 1px solid rgba(124,58,237,0.35);
  border-radius: 4px; padding: 2px 6px;
}

.ab-view-toggle, .ab-device-toggle {
  display: flex; align-items: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 2px;
}
.ab-view-btn, .ab-device-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 5px;
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45);
  background: none; border: none; cursor: pointer;
  transition: all .15s;
}
.ab-view-btn.active, .ab-device-btn.active {
  background: rgba(124,58,237,0.3); color: #c4b5fd;
}
.ab-view-btn:hover:not(.active), .ab-device-btn:hover:not(.active) {
  color: rgba(255,255,255,0.7);
}

.ab-action-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 7px;
  font-size: 12px; font-weight: 600;
  background: #7c3aed; color: white; border: none; cursor: pointer;
  transition: all .2s;
}
.ab-action-btn:hover { background: #6d28d9; }
.ab-action-btn--ghost {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.ab-action-btn--ghost:hover { background: rgba(255,255,255,0.1); color: white; }

/* ── Body Layout ─────────────────────────────────────────────────────────────── */
.ab-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.ab-sidebar {
  width: 340px;
  min-width: 340px;
  border-right: 1px solid rgba(255,255,255,0.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d0d14;
}

/* ── Tabs ────────────────────────────────────────────────────────────────────── */
.ab-tabs {
  display: flex;
  align-items: center;
  padding: 8px 8px 0;
  gap: 2px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ab-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 12px;
  border-radius: 7px 7px 0 0;
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.38);
  background: none; border: none; cursor: pointer;
  transition: all .15s;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.ab-tab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }
.ab-tab.active {
  color: #c4b5fd;
  background: rgba(124,58,237,0.1);
  border-bottom-color: #7c3aed;
}
.ab-tab-count {
  background: rgba(124,58,237,0.35);
  color: #c4b5fd;
  font-size: 10px; font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
}

.ab-sidebar-top {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  flex: 1;
}

.ab-field { display: flex; flex-direction: column; gap: 6px; }
.ab-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.ab-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
}

.ab-textarea {
  width: 100%; resize: vertical;
  padding: 11px 13px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px;
  color: #e8e8f0; font-size: 13px; line-height: 1.6;
  font-family: inherit;
  transition: border-color .2s;
  min-height: 120px;
  box-sizing: border-box;
}
.ab-textarea:focus {
  outline: none;
  border-color: rgba(124,58,237,0.5);
  background: rgba(124,58,237,0.04);
}
.ab-textarea::placeholder { color: rgba(255,255,255,0.22); }

.ab-select {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  color: #e8e8f0; font-size: 12px;
  font-family: inherit; cursor: pointer;
}
.ab-select:focus { outline: none; border-color: rgba(124,58,237,0.5); }
.ab-select option { background: #1a1a2e; }

.ab-generate-btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px;
  background: linear-gradient(135deg, #7c3aed, #5b21b6);
  color: white; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all .2s;
  box-shadow: 0 4px 20px rgba(124,58,237,0.35);
}
.ab-generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9, #4c1d95);
  box-shadow: 0 6px 28px rgba(124,58,237,0.5);
  transform: translateY(-1px);
}
.ab-generate-btn:disabled {
  opacity: 0.45; cursor: not-allowed; transform: none;
}
.ab-generate-btn.loading { background: linear-gradient(135deg, #5b21b6, #4c1d95); }

.ab-spin { animation: ab-spin 1s linear infinite; }
@keyframes ab-spin { to { transform: rotate(360deg); } }

.ab-progress {
  height: 2px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden;
}
.ab-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* ── Error / Failure Panel ───────────────────────────────────────────────────── */
.ab-error {
  padding: 12px 14px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.22);
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.ab-error-header {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 700; color: #f87171;
}
.ab-error-icon { flex-shrink: 0; }
.ab-error-msg {
  font-size: 12px; color: rgba(248,113,113,0.8); line-height: 1.5;
  margin: 0;
}
.ab-retry-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 7px;
  font-size: 12px; font-weight: 600; color: #fca5a5;
  cursor: pointer; transition: all .15s;
  align-self: flex-start;
}
.ab-retry-btn:hover {
  background: rgba(239,68,68,0.25);
  border-color: rgba(239,68,68,0.45);
}

/* ── Debug Inline Panel ──────────────────────────────────────────────────────── */
.ab-debug-inline {
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 10px;
  overflow: hidden;
}
.ab-debug-toggle {
  width: 100%;
  display: flex; align-items: center; gap: 7px;
  padding: 10px 12px;
  background: rgba(124,58,237,0.08);
  border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: #a78bfa;
  text-align: left;
  transition: background .15s;
}
.ab-debug-toggle:hover { background: rgba(124,58,237,0.14); }
.ab-debug-toggle span { flex: 1; }

.ab-debug-body {
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(10,10,20,0.6);
}
.ab-debug-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
}
.ab-debug-key {
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap;
  flex-shrink: 0;
}
.ab-debug-val {
  font-size: 12px; color: rgba(255,255,255,0.7);
  text-align: right; word-break: break-all;
}
.ab-debug-val--mono { font-family: 'Menlo', 'Monaco', monospace; font-size: 11px; }
.ab-debug-val--small { font-size: 10px; opacity: 0.7; }
.ab-debug-val--highlight { color: #a78bfa; font-weight: 600; }
.ab-debug-prompt-wrap {
  display: flex; flex-direction: column; gap: 4px; margin-top: 4px;
}
.ab-debug-prompt {
  font-size: 11px; color: rgba(255,255,255,0.45); line-height: 1.5;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px; padding: 8px;
  white-space: pre-wrap; word-break: break-word;
  max-height: 100px; overflow-y: auto;
}

/* ── History Tab ─────────────────────────────────────────────────────────────── */
.ab-history-tab {
  display: flex; flex-direction: column;
  flex: 1; overflow: hidden;
}
.ab-history-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.ab-history-title-text {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: rgba(255,255,255,0.35);
}
.ab-history-refresh {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.3); padding: 4px;
  border-radius: 5px; transition: color .15s, background .15s;
}
.ab-history-refresh:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); }

.ab-history-empty {
  padding: 40px 24px;
  text-align: center;
  font-size: 12px; color: rgba(255,255,255,0.25);
  line-height: 1.7;
  display: flex; flex-direction: column; align-items: center; gap: 0;
}

.ab-gen-list {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 6px;
}

.ab-gen-item {
  width: 100%;
  display: flex; flex-direction: column; gap: 5px;
  padding: 11px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  cursor: pointer; text-align: left;
  transition: all .15s;
}
.ab-gen-item:hover:not(:disabled) {
  background: rgba(124,58,237,0.08);
  border-color: rgba(124,58,237,0.25);
}
.ab-gen-item:disabled { cursor: not-allowed; opacity: 0.6; }
.ab-gen-item--failed {
  border-color: rgba(239,68,68,0.2);
  background: rgba(239,68,68,0.04);
}
.ab-gen-item--failed:hover:not(:disabled) {
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.3);
}

.ab-gen-item-top {
  display: flex; align-items: center; justify-content: space-between;
}
.ab-gen-status-row {
  display: flex; align-items: center; gap: 5px;
}
.gen-status-icon { flex-shrink: 0; }
.gen-status-icon--ok { color: #4ade80; }
.gen-status-icon--fail { color: #f87171; }
.gen-status-icon--pending { color: #a78bfa; }

.ab-gen-status-label {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.ab-gen-status-label--completed { color: #4ade80; }
.ab-gen-status-label--failed { color: #f87171; }
.ab-gen-status-label--generating { color: #a78bfa; }

.ab-gen-prompt {
  font-size: 12px; color: rgba(255,255,255,0.7);
  line-height: 1.5;
}
.ab-gen-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  font-size: 10px; color: rgba(255,255,255,0.28);
}
.ab-gen-style {
  background: rgba(255,255,255,0.07);
  border-radius: 4px; padding: 1px 5px;
  font-weight: 600;
}
.ab-gen-sep { opacity: 0.4; }
.ab-gen-error-msg {
  font-size: 10px; color: rgba(248,113,113,0.7);
  line-height: 1.4; padding-top: 2px;
}

.ab-history-delete {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.2);
  padding: 4px; border-radius: 5px;
  transition: color .15s, background .15s;
  flex-shrink: 0;
}
.ab-history-delete:hover { color: #f87171; background: rgba(239,68,68,0.1); }

/* ── Debug Tab ───────────────────────────────────────────────────────────────── */
.ab-debug-tab {
  display: flex; flex-direction: column;
  flex: 1; overflow: hidden;
}
.ab-debug-tab-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: rgba(255,255,255,0.35);
  flex-shrink: 0;
}
.ab-debug-full {
  flex: 1; overflow-y: auto;
  padding: 14px 18px;
  display: flex; flex-direction: column; gap: 6px;
}
.ab-debug-section-title {
  font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(124,58,237,0.7);
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(124,58,237,0.15);
}
.ab-debug-prompt-full {
  font-size: 12px; color: rgba(255,255,255,0.5);
  line-height: 1.6;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 10px;
  white-space: pre-wrap; word-break: break-word;
  margin-top: 4px;
}

/* ── Preview Area ────────────────────────────────────────────────────────────── */
.ab-preview-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
}

.ab-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 40px;
  flex: 1;
  gap: 16px;
}
.ab-empty-icon {
  width: 72px; height: 72px;
  background: rgba(124,58,237,0.1);
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  color: #7c3aed;
}
.ab-empty-title {
  font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
  color: rgba(255,255,255,0.9);
  margin: 0;
}
.ab-empty-sub {
  font-size: 14px; color: rgba(255,255,255,0.35);
  max-width: 420px; line-height: 1.65;
  margin: 0;
}
.ab-empty-pills {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
  margin-top: 8px;
}
.ab-empty-pill {
  padding: 5px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 20px;
  font-size: 12px; color: rgba(255,255,255,0.45);
}

.ab-generating {
  display: flex; flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.ab-gen-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 13px; color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}
.ab-gen-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #7c3aed;
  animation: ab-pulse 1.4s ease-in-out infinite;
}
@keyframes ab-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.ab-gen-code { flex: 1; overflow: auto; padding: 20px; }
.ab-gen-pre {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px; line-height: 1.7;
  color: rgba(255,255,255,0.55);
  white-space: pre-wrap; word-break: break-word;
  margin: 0;
}

.ab-result { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

.ab-code-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-code-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ab-code-lang {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.ab-code-copy {
  font-size: 12px; font-weight: 600;
  color: #a78bfa; background: none; border: none; cursor: pointer;
  padding: 4px 8px; border-radius: 5px;
  transition: background .15s;
}
.ab-code-copy:hover { background: rgba(124,58,237,0.15); }
.ab-code-pre {
  flex: 1; overflow: auto;
  padding: 20px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11.5px; line-height: 1.7;
  color: rgba(255,255,255,0.65);
  white-space: pre-wrap; word-break: break-all;
  margin: 0;
}

.ab-iframe-wrap {
  display: flex; flex-direction: column;
  flex: 1; overflow: hidden;
}
.ab-iframe-wrap--mobile {
  align-items: center;
  background: #06060d;
  padding: 20px;
}
.ab-iframe-wrap--mobile .ab-browser-chrome { width: 390px; }
.ab-iframe-wrap--mobile .ab-iframe { width: 390px; }

.ab-browser-chrome {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.ab-iframe-wrap--mobile .ab-browser-chrome {
  border: 1px solid rgba(255,255,255,0.08);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
}

.ab-chrome-dots { display: flex; gap: 5px; flex-shrink: 0; }
.ab-chrome-dots span {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.12);
}
.ab-chrome-bar {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border-radius: 5px;
  padding: 4px 10px;
}
.ab-chrome-url { font-size: 11px; color: rgba(255,255,255,0.3); }

.ab-iframe {
  flex: 1;
  border: none;
  width: 100%;
  background: white;
}
.ab-iframe-wrap--mobile .ab-iframe {
  border: 1px solid rgba(255,255,255,0.08);
  border-top: none;
  border-radius: 0 0 12px 12px;
  flex: none;
  height: calc(100% - 44px);
}
`;
