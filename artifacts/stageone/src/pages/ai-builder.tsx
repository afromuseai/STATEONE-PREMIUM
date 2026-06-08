import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Download, RefreshCw, ChevronLeft, Sparkles, Trash2, Clock, Globe, Maximize2, Minimize2, Code2 } from "lucide-react";

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

type PreviewMode = "desktop" | "mobile";
type RightView = "preview" | "code";

export default function AiBuilderPage() {
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Modern SaaS");
  const [industry, setIndustry] = useState("SaaS");

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingHtml, setStreamingHtml] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [rightView, setRightView] = useState<RightView>("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadProjects();
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
      // Silently fail — user may not be logged in
    } finally {
      setLoadingProjects(false);
    }
  };

  const generate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsGenerating(true);
    setError(null);
    setStreamingHtml("");
    setGeneratedHtml("");
    setTokenCount(0);

    try {
      const res = await fetch("/api/ai-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({ prompt: prompt.trim(), style, industry }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Generation failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let htmlBuffer = "";

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
            };

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.content) {
              htmlBuffer += parsed.content;
              setStreamingHtml(htmlBuffer);
              setTokenCount(t => t + 1);
            }

            if (parsed.done && parsed.fullHtml) {
              setGeneratedHtml(parsed.fullHtml);
              setStreamingHtml("");
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
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, style, industry, generatedHtml]);

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
                  title="Desktop"
                >
                  Desktop
                </button>
                <button
                  className={`ab-device-btn ${previewMode === "mobile" ? "active" : ""}`}
                  onClick={() => setPreviewMode("mobile")}
                  title="Mobile"
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

              {error && (
                <div className="ab-error">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>

            {/* ── Project History ── */}
            <div className="ab-history">
              <div className="ab-history-title">
                <Clock size={13} /> Recent Builds
              </div>
              {loadingProjects ? (
                <div className="ab-history-empty">Loading…</div>
              ) : projects.length === 0 ? (
                <div className="ab-history-empty">No builds yet. Generate your first website!</div>
              ) : (
                <div className="ab-history-list">
                  {projects.map(p => (
                    <button key={p.id} className="ab-history-item" onClick={() => loadProject(p.id)}>
                      <div className="ab-history-item-content">
                        <div className="ab-history-prompt">{p.prompt.slice(0, 60)}{p.prompt.length > 60 ? "…" : ""}</div>
                        <div className="ab-history-meta">
                          <span className="ab-history-style">{p.style}</span>
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        className="ab-history-delete"
                        onClick={e => deleteProject(p.id, e)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
.ab-sidebar-top {
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
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

.ab-error {
  padding: 10px 12px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  font-size: 12px; color: #fca5a5; line-height: 1.5;
}

/* ── History ─────────────────────────────────────────────────────────────────── */
.ab-history {
  flex: 1; overflow-y: auto; padding: 14px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.ab-history-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.ab-history-empty {
  font-size: 12px; color: rgba(255,255,255,0.25); line-height: 1.6;
}
.ab-history-list { display: flex; flex-direction: column; gap: 4px; }
.ab-history-item {
  display: flex; align-items: center; gap: 8px; text-align: left;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; cursor: pointer; width: 100%;
  transition: all .15s;
}
.ab-history-item:hover {
  background: rgba(124,58,237,0.08);
  border-color: rgba(124,58,237,0.25);
}
.ab-history-item-content { flex: 1; min-width: 0; }
.ab-history-prompt {
  font-size: 12px; color: rgba(255,255,255,0.7);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 4px;
}
.ab-history-meta {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; color: rgba(255,255,255,0.3);
}
.ab-history-style {
  background: rgba(124,58,237,0.15); color: #a78bfa;
  padding: 1px 6px; border-radius: 4px; font-size: 10px;
}
.ab-history-delete {
  flex-shrink: 0; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px; background: none; border: none;
  color: rgba(255,255,255,0.2); cursor: pointer; transition: all .15s;
}
.ab-history-delete:hover {
  background: rgba(239,68,68,0.15); color: #fca5a5;
}

/* ── Preview Area ────────────────────────────────────────────────────────────── */
.ab-preview-area {
  flex: 1; overflow: hidden;
  display: flex; flex-direction: column;
  background: #0a0a0f;
  position: relative;
}

/* ── Empty State ─────────────────────────────────────────────────────────────── */
.ab-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 16px; padding: 40px; text-align: center;
}
.ab-empty-icon {
  width: 72px; height: 72px; border-radius: 20px;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.3);
  display: flex; align-items: center; justify-content: center;
  color: #7c3aed;
}
.ab-empty-title { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
.ab-empty-sub {
  font-size: 14px; color: rgba(255,255,255,0.4);
  max-width: 440px; line-height: 1.7;
}
.ab-empty-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ab-empty-pill {
  padding: 5px 12px; border-radius: 100px;
  font-size: 12px; font-weight: 600;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
}

/* ── Generating State ────────────────────────────────────────────────────────── */
.ab-generating {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}
.ab-gen-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 13px; color: rgba(255,255,255,0.5);
  background: rgba(124,58,237,0.05);
}
.ab-gen-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #7c3aed; flex-shrink: 0;
  animation: ab-pulse 1.5s ease-in-out infinite;
}
@keyframes ab-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}
.ab-gen-code { flex: 1; overflow: auto; padding: 0; }
.ab-gen-pre {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 11px; line-height: 1.6;
  color: rgba(167,139,250,0.7);
  white-space: pre-wrap; word-break: break-all;
  padding: 20px;
  margin: 0;
}

/* ── Result ──────────────────────────────────────────────────────────────────── */
.ab-result { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* ── Code View ───────────────────────────────────────────────────────────────── */
.ab-code-view {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}
.ab-code-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
}
.ab-code-lang {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.ab-code-copy {
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 6px;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.3);
  color: #a78bfa; cursor: pointer; transition: all .15s;
}
.ab-code-copy:hover { background: rgba(124,58,237,0.3); }
.ab-code-pre {
  flex: 1; overflow: auto; margin: 0;
  padding: 20px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px; line-height: 1.65;
  color: #c4b5fd;
  white-space: pre; overflow-x: auto;
}

/* ── Iframe Preview ──────────────────────────────────────────────────────────── */
.ab-iframe-wrap {
  display: flex; flex-direction: column; height: 100%;
  transition: all .3s ease;
}
.ab-iframe-wrap--mobile {
  align-items: center;
  background: #06060a;
  padding: 12px 0;
}
.ab-iframe-wrap--mobile .ab-browser-chrome,
.ab-iframe-wrap--mobile .ab-iframe {
  width: 390px;
  border-radius: 12px;
}

.ab-browser-chrome {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ab-chrome-dots { display: flex; gap: 5px; }
.ab-chrome-dots span {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.12);
}
.ab-chrome-dots span:nth-child(1) { background: rgba(255,59,48,0.5); }
.ab-chrome-dots span:nth-child(2) { background: rgba(255,204,0,0.5); }
.ab-chrome-dots span:nth-child(3) { background: rgba(52,199,89,0.5); }
.ab-chrome-bar {
  flex: 1; display: flex; align-items: center; justify-content: center;
}
.ab-chrome-url {
  font-size: 11px; color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 5px; padding: 3px 12px;
  font-family: monospace;
}

.ab-iframe {
  flex: 1; width: 100%; border: none;
  background: white;
}
.ab-iframe-wrap--mobile .ab-iframe {
  flex: unset;
  height: calc(100% - 60px);
  overflow-y: auto;
  border: 1px solid rgba(255,255,255,0.1);
  border-top: none;
}
`;
