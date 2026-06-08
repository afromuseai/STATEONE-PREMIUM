import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Download, RefreshCw, ChevronLeft, Sparkles, Trash2, Clock,
  Globe, Maximize2, Minimize2, Code2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2, AlertTriangle, RotateCcw, History,
  Terminal, Map, Users, Target, Palette, Layout, Type, Layers,
  MousePointerClick, ArrowRight, Lightbulb,
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

interface WebsitePlan {
  business_summary: string;
  target_audience: string;
  value_proposition: string;
  brand_tone: string;
  design_direction: string;
  visual_style: string;
  section_order: string[];
  conversion_strategy: string;
  CTA_strategy: string;
}

interface DesignDna {
  typography_system: string;
  spacing_system: string;
  layout_style: string;
  color_direction: string;
  animation_style: string;
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
type SidebarTab = "generate" | "history" | "plan" | "debug";
type PlanningPhase = "idle" | "planning" | "generating";

export default function AiBuilderPage() {
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Modern SaaS");
  const [industry, setIndustry] = useState("SaaS");

  const [isGenerating, setIsGenerating] = useState(false);
  const [planningPhase, setPlanningPhase] = useState<PlanningPhase>("idle");
  const [streamingHtml, setStreamingHtml] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);

  const [websitePlan, setWebsitePlan] = useState<WebsitePlan | null>(null);
  const [designDna, setDesignDna] = useState<DesignDna | null>(null);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [rightView, setRightView] = useState<RightView>("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("generate");

  const [generations, setGenerations] = useState<GenerationArtifact[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(false);

  const [tokenCount, setTokenCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    setLoadingGenerations(true);
    try {
      const res = await fetch("/api/ai-builder/generations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { generations: GenerationArtifact[] };
        setGenerations(data.generations);
      }
    } catch { /* silently fail */ } finally {
      setLoadingGenerations(false);
    }
  };

  const generate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsGenerating(true);
    setPlanningPhase("planning");
    setError(null);
    setFailedPrompt(null);
    setStreamingHtml("");
    setGeneratedHtml("");
    setTokenCount(0);
    setDebugInfo(null);
    setWebsitePlan(null);
    setDesignDna(null);
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
              type?: string;
              content?: string;
              done?: boolean;
              fullHtml?: string;
              error?: string;
              generationId?: string;
              durationMs?: number;
              tokenCount?: number;
              modelUsed?: string;
              websitePlan?: WebsitePlan;
              designDna?: DesignDna;
            };

            if (parsed.generationId && !resolvedGenerationId) {
              resolvedGenerationId = parsed.generationId;
            }

            if (parsed.error) throw new Error(parsed.error);

            if (parsed.type === "plan_start") {
              setPlanningPhase("planning");
            }

            if (parsed.type === "plan" && parsed.websitePlan && parsed.designDna) {
              setWebsitePlan(parsed.websitePlan);
              setDesignDna(parsed.designDna);
              // Auto-switch to Plan tab so user sees the strategy
              setSidebarTab("plan");
            }

            if (parsed.type === "generation_start") {
              setPlanningPhase("generating");
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
              setPlanningPhase("idle");
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
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      if (htmlBuffer && !generatedHtml) {
        setGeneratedHtml(htmlBuffer);
        setStreamingHtml("");
        setPlanningPhase("idle");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setFailedPrompt(capturedPrompt);
      setPlanningPhase("idle");
      setSidebarTab("generate");
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

  const loadGeneration = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-builder/generations/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as {
          generation: GenerationArtifact & {
            generatedHtml?: string;
            websitePlan?: WebsitePlan;
            designDna?: DesignDna;
          }
        };
        const gen = data.generation;
        if (gen.generatedHtml) {
          setGeneratedHtml(gen.generatedHtml);
          setPrompt(gen.prompt);
          setStyle(gen.style);
          setIndustry(gen.industry);
          if (gen.websitePlan) setWebsitePlan(gen.websitePlan);
          if (gen.designDna) setDesignDna(gen.designDna);
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
          setSidebarTab(gen.websitePlan ? "plan" : "generate");
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
  const progress = planningPhase === "planning"
    ? 0.15
    : planningPhase === "generating"
      ? Math.min(0.15 + (tokenCount / 200) * 0.8, 0.95)
      : 0;

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
            <ChevronLeft size={16} /> Dashboard
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
                <button className={`ab-view-btn ${rightView === "preview" ? "active" : ""}`} onClick={() => setRightView("preview")}>
                  <Globe size={14} /> Preview
                </button>
                <button className={`ab-view-btn ${rightView === "code" ? "active" : ""}`} onClick={() => setRightView("code")}>
                  <Code2 size={14} /> Code
                </button>
              </div>
              <div className="ab-device-toggle">
                <button className={`ab-device-btn ${previewMode === "desktop" ? "active" : ""}`} onClick={() => setPreviewMode("desktop")}>Desktop</button>
                <button className={`ab-device-btn ${previewMode === "mobile" ? "active" : ""}`} onClick={() => setPreviewMode("mobile")}>Mobile</button>
              </div>
              <button className="ab-action-btn" onClick={downloadHtml}><Download size={14} /> Download</button>
            </>
          )}
          <button className="ab-action-btn ab-action-btn--ghost" onClick={() => setIsFullscreen(f => !f)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      <div className="ab-body">
        {!isFullscreen && (
          <aside className="ab-sidebar">
            {/* ── Tab bar ── */}
            <div className="ab-tabs">
              <button className={`ab-tab ${sidebarTab === "generate" ? "active" : ""}`} onClick={() => setSidebarTab("generate")}>
                <Sparkles size={12} /> Build
              </button>
              <button className={`ab-tab ${sidebarTab === "plan" ? "active" : ""}`} onClick={() => setSidebarTab("plan")}>
                <Map size={12} /> Plan
                {websitePlan && <span className="ab-tab-dot" />}
              </button>
              <button className={`ab-tab ${sidebarTab === "history" ? "active" : ""}`} onClick={() => setSidebarTab("history")}>
                <History size={12} />
                {generations.length > 0 && <span className="ab-tab-count">{generations.length}</span>}
              </button>
              <button className={`ab-tab ${sidebarTab === "debug" ? "active" : ""}`} onClick={() => setSidebarTab("debug")}>
                <Terminal size={12} />
              </button>
            </div>

            {/* ══ BUILD TAB ══════════════════════════════════════════════════ */}
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
                    planningPhase === "planning" ? (
                      <><Lightbulb size={16} className="ab-pulse-icon" /> Planning strategy…</>
                    ) : (
                      <><RefreshCw size={16} className="ab-spin" /> Building… {tokenCount > 0 ? `(${tokenCount} tokens)` : ""}</>
                    )
                  ) : (
                    <><Sparkles size={16} />{generatedHtml ? "Regenerate" : "Generate Website"}</>
                  )}
                </button>

                {/* Pipeline progress bar */}
                {isGenerating && (
                  <div className="ab-pipeline-progress">
                    <div className="ab-pipeline-bar" style={{ width: `${progress * 100}%` }} />
                    <div className="ab-pipeline-steps">
                      <div className={`ab-pipeline-step ${planningPhase !== "idle" ? "active" : ""} ${planningPhase === "generating" || planningPhase === "idle" && progress > 0 ? "done" : ""}`}>
                        <Lightbulb size={10} />
                        <span>Plan</span>
                      </div>
                      <div className="ab-pipeline-step-arrow"><ArrowRight size={8} /></div>
                      <div className={`ab-pipeline-step ${planningPhase === "generating" ? "active" : ""}`}>
                        <Zap size={10} />
                        <span>Build</span>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Inline debug toggle */}
                {debugInfo && !error && (
                  <div className="ab-debug-inline">
                    <button className="ab-debug-toggle" onClick={() => setIsDebugOpen(o => !o)}>
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
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ PLAN TAB ════════════════════════════════════════════════════ */}
            {sidebarTab === "plan" && (
              <div className="ab-plan-tab">
                {!websitePlan ? (
                  <div className="ab-plan-empty">
                    <Map size={28} style={{ opacity: 0.18 }} />
                    <p>No plan yet.</p>
                    <p className="ab-plan-empty-sub">Generate a website to see the AI's strategic plan — audience, design DNA, section structure, and conversion strategy.</p>
                  </div>
                ) : (
                  <div className="ab-plan-content">

                    {/* Website Plan */}
                    <div className="ab-plan-section">
                      <div className="ab-plan-section-title">
                        <Lightbulb size={12} /> Website Strategy
                      </div>

                      <div className="ab-plan-card">
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label"><Target size={11} /> Business</div>
                          <div className="ab-plan-field-value">{websitePlan.business_summary}</div>
                        </div>
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label"><Users size={11} /> Target Audience</div>
                          <div className="ab-plan-field-value">{websitePlan.target_audience}</div>
                        </div>
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label"><Zap size={11} /> Value Proposition</div>
                          <div className="ab-plan-field-value">{websitePlan.value_proposition}</div>
                        </div>
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label"><Sparkles size={11} /> Brand Tone</div>
                          <div className="ab-plan-field-value">{websitePlan.brand_tone}</div>
                        </div>
                      </div>
                    </div>

                    {/* Section Blueprint */}
                    <div className="ab-plan-section">
                      <div className="ab-plan-section-title">
                        <Layers size={12} /> Section Blueprint
                      </div>
                      <div className="ab-section-blueprint">
                        {websitePlan.section_order.map((section, i) => (
                          <div key={i} className="ab-blueprint-item">
                            <span className="ab-blueprint-num">{i + 1}</span>
                            <span className="ab-blueprint-name">{section}</span>
                          </div>
                        ))}
                        <div className="ab-blueprint-item ab-blueprint-item--footer">
                          <span className="ab-blueprint-num">{websitePlan.section_order.length + 1}</span>
                          <span className="ab-blueprint-name">Footer</span>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Strategy */}
                    <div className="ab-plan-section">
                      <div className="ab-plan-section-title">
                        <MousePointerClick size={12} /> Conversion & CTA
                      </div>
                      <div className="ab-plan-card">
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label">Conversion Strategy</div>
                          <div className="ab-plan-field-value">{websitePlan.conversion_strategy}</div>
                        </div>
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label">CTA Strategy</div>
                          <div className="ab-plan-field-value">{websitePlan.CTA_strategy}</div>
                        </div>
                      </div>
                    </div>

                    {/* Design DNA */}
                    {designDna && (
                      <div className="ab-plan-section">
                        <div className="ab-plan-section-title">
                          <Palette size={12} /> Design DNA
                        </div>
                        <div className="ab-plan-card">
                          <div className="ab-plan-field">
                            <div className="ab-plan-field-label"><Type size={10} /> Typography</div>
                            <div className="ab-plan-field-value">{designDna.typography_system}</div>
                          </div>
                          <div className="ab-plan-field">
                            <div className="ab-plan-field-label"><Layout size={10} /> Layout</div>
                            <div className="ab-plan-field-value">{designDna.layout_style}</div>
                          </div>
                          <div className="ab-plan-field">
                            <div className="ab-plan-field-label"><Palette size={10} /> Color Direction</div>
                            <div className="ab-plan-field-value">{designDna.color_direction}</div>
                          </div>
                          <div className="ab-plan-field">
                            <div className="ab-plan-field-label"><Zap size={10} /> Animation</div>
                            <div className="ab-plan-field-value">{designDna.animation_style}</div>
                          </div>
                          <div className="ab-plan-field">
                            <div className="ab-plan-field-label">Spacing</div>
                            <div className="ab-plan-field-value">{designDna.spacing_system}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visual direction */}
                    <div className="ab-plan-section">
                      <div className="ab-plan-section-title">
                        <Sparkles size={12} /> Visual Direction
                      </div>
                      <div className="ab-plan-card">
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label">Design Direction</div>
                          <div className="ab-plan-field-value">{websitePlan.design_direction}</div>
                        </div>
                        <div className="ab-plan-field">
                          <div className="ab-plan-field-label">Visual Style</div>
                          <div className="ab-plan-field-value">{websitePlan.visual_style}</div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ══ HISTORY TAB ═════════════════════════════════════════════════ */}
            {sidebarTab === "history" && (
              <div className="ab-history-tab">
                <div className="ab-history-header">
                  <span className="ab-history-title-text"><Clock size={13} /> Generation Artifacts</span>
                  <button className="ab-history-refresh" onClick={loadGenerations}>
                    <RefreshCw size={12} className={loadingGenerations ? "ab-spin" : ""} />
                  </button>
                </div>

                {loadingGenerations ? (
                  <div className="ab-history-empty"><Loader2 size={18} className="ab-spin" style={{ opacity: 0.4 }} /></div>
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
                          <button className="ab-history-delete" onClick={e => deleteGeneration(gen.id, e)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div className="ab-gen-prompt">{gen.prompt.slice(0, 72)}{gen.prompt.length > 72 ? "…" : ""}</div>
                        <div className="ab-gen-meta">
                          <span className="ab-gen-style">{gen.style}</span>
                          <span className="ab-gen-sep">·</span>
                          <span>{new Date(gen.createdAt).toLocaleDateString()}</span>
                          {gen.durationMs !== null && (
                            <><span className="ab-gen-sep">·</span><span>{formatDuration(gen.durationMs)}</span></>
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

            {/* ══ DEBUG TAB ════════════════════════════════════════════════════ */}
            {sidebarTab === "debug" && (
              <div className="ab-debug-tab">
                <div className="ab-debug-tab-header"><Terminal size={14} /><span>Debug Panel</span></div>
                {!debugInfo ? (
                  <div className="ab-history-empty" style={{ textAlign: "center" }}>
                    <Terminal size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                    No generation yet.<br />Run a generation to see debug info.
                  </div>
                ) : (
                  <div className="ab-debug-full">
                    <div className="ab-debug-section-title">Generation</div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Generation ID</span>
                      <span className="ab-debug-val ab-debug-val--mono ab-debug-val--small">{debugInfo.generationId ?? "—"}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Started at</span>
                      <span className="ab-debug-val">{new Date(debugInfo.startedAt).toLocaleString()}</span>
                    </div>

                    <div className="ab-debug-section-title" style={{ marginTop: 16 }}>Performance</div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">HTML Model</span>
                      <span className="ab-debug-val ab-debug-val--mono">{debugInfo.model.split("/").pop()}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Plan Model</span>
                      <span className="ab-debug-val ab-debug-val--mono">llama-4-maverick</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Total Duration</span>
                      <span className="ab-debug-val ab-debug-val--highlight">{formatDuration(debugInfo.durationMs)}</span>
                    </div>
                    <div className="ab-debug-row">
                      <span className="ab-debug-key">Token usage</span>
                      <span className="ab-debug-val ab-debug-val--highlight">~{formatTokens(debugInfo.tokenCount)}</span>
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
              <motion.div key="empty" className="ab-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="ab-empty-icon"><Zap size={40} /></div>
                <h2 className="ab-empty-title">AI Website Builder</h2>
                <p className="ab-empty-sub">
                  Describe your business — the AI will plan a strategy, design DNA, and section blueprint,
                  then build a complete website from scratch.
                </p>
                <div className="ab-empty-pills">
                  {["Strategy First", "Design DNA", "Custom Sections", "Full HTML/CSS/JS", "Download Ready"].map(t => (
                    <span key={t} className="ab-empty-pill">{t}</span>
                  ))}
                </div>
                <div className="ab-pipeline-diagram">
                  <div className="ab-pipeline-node">
                    <Lightbulb size={14} />
                    <span>Plan</span>
                  </div>
                  <ArrowRight size={12} className="ab-pipeline-arrow" />
                  <div className="ab-pipeline-node">
                    <Palette size={14} />
                    <span>Design DNA</span>
                  </div>
                  <ArrowRight size={12} className="ab-pipeline-arrow" />
                  <div className="ab-pipeline-node">
                    <Zap size={14} />
                    <span>Build</span>
                  </div>
                </div>
              </motion.div>
            ) : isGenerating && !generatedHtml ? (
              <motion.div key="generating" className="ab-generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {planningPhase === "planning" ? (
                  /* ── Planning Phase View ── */
                  <div className="ab-phase-view ab-phase-view--plan">
                    <div className="ab-phase-header">
                      <div className="ab-phase-dot ab-phase-dot--plan" />
                      <span>Phase 1 — Generating website strategy & design DNA…</span>
                    </div>
                    <div className="ab-phase-body">
                      <div className="ab-phase-steps">
                        {[
                          { icon: <Target size={16} />, label: "Analyzing business", sub: "audience, value proposition, brand tone" },
                          { icon: <Layers size={16} />, label: "Designing section blueprint", sub: "page structure, section order, conversion flow" },
                          { icon: <Palette size={16} />, label: "Creating design DNA", sub: "typography, color direction, animation style" },
                          { icon: <MousePointerClick size={16} />, label: "Planning CTA strategy", sub: "conversion mechanics, call-to-action placement" },
                        ].map((step, i) => (
                          <div key={i} className={`ab-phase-step ab-phase-step--active`} style={{ animationDelay: `${i * 0.2}s` }}>
                            <div className="ab-phase-step-icon">{step.icon}</div>
                            <div className="ab-phase-step-content">
                              <div className="ab-phase-step-label">{step.label}</div>
                              <div className="ab-phase-step-sub">{step.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Building Phase View ── */
                  <div className="ab-phase-view ab-phase-view--build">
                    <div className="ab-phase-header">
                      <div className="ab-phase-dot" />
                      <span>Phase 2 — Building website from strategic blueprint…</span>
                      {websitePlan && (
                        <span className="ab-phase-tag">
                          {websitePlan.section_order.length + 1} sections planned
                        </span>
                      )}
                    </div>
                    {streamingHtml && (
                      <div className="ab-gen-code">
                        <pre className="ab-gen-pre">{streamingHtml}</pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="result" className="ab-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {rightView === "code" ? (
                  <div className="ab-code-view">
                    <div className="ab-code-toolbar">
                      <span className="ab-code-lang">HTML</span>
                      <button className="ab-code-copy" onClick={() => navigator.clipboard.writeText(generatedHtml)}>Copy all</button>
                    </div>
                    <pre className="ab-code-pre"><code>{generatedHtml}</code></pre>
                  </div>
                ) : (
                  <div className={`ab-iframe-wrap ab-iframe-wrap--${previewMode}`}>
                    <div className="ab-browser-chrome">
                      <div className="ab-chrome-dots"><span /><span /><span /></div>
                      <div className="ab-chrome-bar">
                        <span className="ab-chrome-url">{style.toLowerCase().replace(/ /g, "-")}-website.html</span>
                      </div>
                    </div>
                    <iframe ref={iframeRef} className="ab-iframe" srcDoc={generatedHtml} sandbox="allow-scripts allow-same-origin" title="AI Generated Website Preview" />
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
.ai-builder {
  display: flex; flex-direction: column;
  height: 100vh; background: #0a0a0f; color: #e8e8f0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
.ai-builder--fullscreen .ab-sidebar { display: none; }
.ai-builder--fullscreen .ab-preview-area { flex: 1; }

/* ── Header ── */
.ab-header {
  height: 52px; border-bottom: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; flex-shrink: 0;
  background: rgba(10,10,15,0.95); backdrop-filter: blur(12px); z-index: 10;
}
.ab-header-left { display: flex; align-items: center; gap: 16px; }
.ab-header-right { display: flex; align-items: center; gap: 8px; }
.ab-back {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; color: rgba(255,255,255,0.45);
  background: none; border: none; cursor: pointer;
  padding: 6px 8px; border-radius: 6px; transition: color .2s, background .2s;
}
.ab-back:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); }
.ab-logo { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700; }
.ab-logo-icon { color: #7c3aed; }
.ab-badge {
  font-size: 9px; font-weight: 800; letter-spacing: 0.1em;
  background: rgba(124,58,237,0.2); color: #a78bfa;
  border: 1px solid rgba(124,58,237,0.35); border-radius: 4px; padding: 2px 6px;
}
.ab-view-toggle, .ab-device-toggle {
  display: flex; align-items: center;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px; padding: 2px;
}
.ab-view-btn, .ab-device-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 5px;
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45);
  background: none; border: none; cursor: pointer; transition: all .15s;
}
.ab-view-btn.active, .ab-device-btn.active { background: rgba(124,58,237,0.3); color: #c4b5fd; }
.ab-view-btn:hover:not(.active), .ab-device-btn:hover:not(.active) { color: rgba(255,255,255,0.7); }
.ab-action-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 7px;
  font-size: 12px; font-weight: 600;
  background: #7c3aed; color: white; border: none; cursor: pointer; transition: all .2s;
}
.ab-action-btn:hover { background: #6d28d9; }
.ab-action-btn--ghost {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.ab-action-btn--ghost:hover { background: rgba(255,255,255,0.1); color: white; }

/* ── Body / Sidebar ── */
.ab-body { display: flex; flex: 1; overflow: hidden; }
.ab-sidebar {
  width: 320px; min-width: 320px;
  border-right: 1px solid rgba(255,255,255,0.07);
  display: flex; flex-direction: column; overflow: hidden;
  background: #0d0d14;
}

/* ── Tabs ── */
.ab-tabs {
  display: flex; align-items: center;
  padding: 8px 8px 0; gap: 2px;
  border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.ab-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 11px; border-radius: 7px 7px 0 0;
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.35);
  background: none; border: none; cursor: pointer;
  transition: all .15s; border-bottom: 2px solid transparent; margin-bottom: -1px;
  position: relative;
}
.ab-tab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }
.ab-tab.active { color: #c4b5fd; background: rgba(124,58,237,0.1); border-bottom-color: #7c3aed; }
.ab-tab-count {
  background: rgba(124,58,237,0.35); color: #c4b5fd;
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px;
}
.ab-tab-dot {
  position: absolute; top: 6px; right: 6px;
  width: 6px; height: 6px; border-radius: 50%;
  background: #7c3aed; box-shadow: 0 0 6px #7c3aed;
}

/* ── Build sidebar ── */
.ab-sidebar-top {
  padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;
  overflow-y: auto; flex: 1;
}
.ab-field { display: flex; flex-direction: column; gap: 6px; }
.ab-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ab-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.35);
}
.ab-textarea {
  width: 100%; resize: vertical; padding: 11px 13px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; color: #e8e8f0; font-size: 13px; line-height: 1.6;
  font-family: inherit; transition: border-color .2s; min-height: 120px;
  box-sizing: border-box;
}
.ab-textarea:focus { outline: none; border-color: rgba(124,58,237,0.5); background: rgba(124,58,237,0.04); }
.ab-textarea::placeholder { color: rgba(255,255,255,0.22); }
.ab-select {
  width: 100%; padding: 8px 10px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px; color: #e8e8f0; font-size: 12px; font-family: inherit; cursor: pointer;
}
.ab-select:focus { outline: none; border-color: rgba(124,58,237,0.5); }
.ab-select option { background: #1a1a2e; }

.ab-generate-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px;
  background: linear-gradient(135deg, #7c3aed, #5b21b6);
  color: white; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s;
  box-shadow: 0 4px 20px rgba(124,58,237,0.35);
}
.ab-generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9, #4c1d95);
  box-shadow: 0 6px 28px rgba(124,58,237,0.5); transform: translateY(-1px);
}
.ab-generate-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
.ab-generate-btn.loading { background: linear-gradient(135deg, #5b21b6, #4c1d95); }

.ab-spin { animation: ab-spin 1s linear infinite; }
@keyframes ab-spin { to { transform: rotate(360deg); } }
.ab-pulse-icon { animation: ab-pulse-scale 1.4s ease-in-out infinite; }
@keyframes ab-pulse-scale { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(0.85); } }

/* ── Pipeline Progress ── */
.ab-pipeline-progress {
  position: relative; height: 28px;
  background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;
}
.ab-pipeline-bar {
  position: absolute; top: 0; left: 0; height: 100%;
  background: linear-gradient(90deg, rgba(124,58,237,0.4), rgba(167,139,250,0.5));
  border-radius: 8px; transition: width 0.8s ease;
}
.ab-pipeline-steps {
  position: relative; height: 100%;
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 0 12px;
}
.ab-pipeline-step {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3);
  text-transform: uppercase; letter-spacing: 0.06em;
  transition: color .3s;
}
.ab-pipeline-step.active { color: #c4b5fd; }
.ab-pipeline-step.done { color: #4ade80; }
.ab-pipeline-step-arrow { color: rgba(255,255,255,0.2); }

/* ── Error ── */
.ab-error {
  padding: 12px 14px; background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.22); border-radius: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.ab-error-header { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #f87171; }
.ab-error-msg { font-size: 12px; color: rgba(248,113,113,0.8); line-height: 1.5; margin: 0; }
.ab-retry-btn {
  display: flex; align-items: center; gap: 6px; padding: 7px 12px;
  background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 7px; font-size: 12px; font-weight: 600; color: #fca5a5;
  cursor: pointer; transition: all .15s; align-self: flex-start;
}
.ab-retry-btn:hover { background: rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.45); }

/* ── Debug Inline ── */
.ab-debug-inline { border: 1px solid rgba(124,58,237,0.2); border-radius: 10px; overflow: hidden; }
.ab-debug-toggle {
  width: 100%; display: flex; align-items: center; gap: 7px; padding: 10px 12px;
  background: rgba(124,58,237,0.08); border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: #a78bfa; text-align: left; transition: background .15s;
}
.ab-debug-toggle:hover { background: rgba(124,58,237,0.14); }
.ab-debug-toggle span { flex: 1; }
.ab-debug-body {
  padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;
  background: rgba(10,10,20,0.6);
}
.ab-debug-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ab-debug-key {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3);
  text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; flex-shrink: 0;
}
.ab-debug-val { font-size: 12px; color: rgba(255,255,255,0.7); text-align: right; word-break: break-all; }
.ab-debug-val--mono { font-family: 'Menlo','Monaco',monospace; font-size: 11px; }
.ab-debug-val--small { font-size: 10px; opacity: 0.7; }
.ab-debug-val--highlight { color: #a78bfa; font-weight: 600; }

/* ══ PLAN TAB ══════════════════════════════════════════════════════════════ */
.ab-plan-tab {
  display: flex; flex-direction: column; flex: 1; overflow: hidden;
}
.ab-plan-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; padding: 40px 24px;
  text-align: center; color: rgba(255,255,255,0.25); flex: 1;
}
.ab-plan-empty p { margin: 0; font-size: 13px; font-weight: 600; }
.ab-plan-empty-sub { font-size: 12px !important; font-weight: 400 !important; line-height: 1.6; }
.ab-plan-content { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 18px; }

.ab-plan-section { display: flex; flex-direction: column; gap: 8px; }
.ab-plan-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(124,58,237,0.8);
  padding-bottom: 6px; border-bottom: 1px solid rgba(124,58,237,0.15);
}
.ab-plan-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
}
.ab-plan-field { display: flex; flex-direction: column; gap: 3px; }
.ab-plan-field-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: rgba(255,255,255,0.3);
}
.ab-plan-field-value { font-size: 12px; color: rgba(255,255,255,0.72); line-height: 1.55; }

/* Section Blueprint */
.ab-section-blueprint {
  display: flex; flex-direction: column; gap: 3px;
}
.ab-blueprint-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 7px;
}
.ab-blueprint-item--footer {
  background: rgba(124,58,237,0.06); border-color: rgba(124,58,237,0.15);
}
.ab-blueprint-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(124,58,237,0.2); color: #a78bfa;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ab-blueprint-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); }

/* ══ HISTORY TAB ═══════════════════════════════════════════════════════════ */
.ab-history-tab { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-history-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
}
.ab-history-title-text {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: rgba(255,255,255,0.35);
}
.ab-history-refresh {
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3);
  padding: 4px; border-radius: 5px; transition: color .15s, background .15s;
}
.ab-history-refresh:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); }
.ab-history-empty {
  padding: 40px 24px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.25);
  line-height: 1.7; display: flex; flex-direction: column; align-items: center;
}
.ab-gen-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.ab-gen-item {
  width: 100%; display: flex; flex-direction: column; gap: 5px;
  padding: 11px 12px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07); border-radius: 10px;
  cursor: pointer; text-align: left; transition: all .15s;
}
.ab-gen-item:hover:not(:disabled) { background: rgba(124,58,237,0.08); border-color: rgba(124,58,237,0.25); }
.ab-gen-item:disabled { cursor: not-allowed; opacity: 0.6; }
.ab-gen-item--failed { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.04); }
.ab-gen-item--failed:hover:not(:disabled) { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); }
.ab-gen-item-top { display: flex; align-items: center; justify-content: space-between; }
.ab-gen-status-row { display: flex; align-items: center; gap: 5px; }
.gen-status-icon { flex-shrink: 0; }
.gen-status-icon--ok { color: #4ade80; }
.gen-status-icon--fail { color: #f87171; }
.gen-status-icon--pending { color: #a78bfa; }
.ab-gen-status-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.ab-gen-status-label--completed { color: #4ade80; }
.ab-gen-status-label--failed { color: #f87171; }
.ab-gen-status-label--generating { color: #a78bfa; }
.ab-gen-prompt { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5; }
.ab-gen-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 10px; color: rgba(255,255,255,0.28); }
.ab-gen-style { background: rgba(255,255,255,0.07); border-radius: 4px; padding: 1px 5px; font-weight: 600; }
.ab-gen-sep { opacity: 0.4; }
.ab-gen-error-msg { font-size: 10px; color: rgba(248,113,113,0.7); line-height: 1.4; padding-top: 2px; }
.ab-history-delete {
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.2);
  padding: 4px; border-radius: 5px; transition: color .15s, background .15s; flex-shrink: 0;
}
.ab-history-delete:hover { color: #f87171; background: rgba(239,68,68,0.1); }

/* ══ DEBUG TAB ═════════════════════════════════════════════════════════════ */
.ab-debug-tab { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-debug-tab-header {
  display: flex; align-items: center; gap: 8px; padding: 12px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: rgba(255,255,255,0.35); flex-shrink: 0;
}
.ab-debug-full { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; }
.ab-debug-section-title {
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(124,58,237,0.7); padding-bottom: 4px; border-bottom: 1px solid rgba(124,58,237,0.15);
}
.ab-debug-prompt-full {
  font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 10px; white-space: pre-wrap; word-break: break-word; margin-top: 4px;
}

/* ── Preview Area ── */
.ab-preview-area { flex: 1; overflow: hidden; position: relative; display: flex; }

/* Empty state */
.ab-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px; flex: 1; gap: 16px;
}
.ab-empty-icon {
  width: 72px; height: 72px; background: rgba(124,58,237,0.1);
  border: 1px solid rgba(124,58,237,0.2); border-radius: 20px;
  display: flex; align-items: center; justify-content: center; color: #7c3aed;
}
.ab-empty-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: rgba(255,255,255,0.9); margin: 0; }
.ab-empty-sub { font-size: 14px; color: rgba(255,255,255,0.35); max-width: 420px; line-height: 1.65; margin: 0; }
.ab-empty-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
.ab-empty-pill {
  padding: 5px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 20px; font-size: 12px; color: rgba(255,255,255,0.45);
}
.ab-pipeline-diagram {
  display: flex; align-items: center; gap: 10px; margin-top: 8px;
  padding: 12px 20px; background: rgba(124,58,237,0.06);
  border: 1px solid rgba(124,58,237,0.15); border-radius: 12px;
}
.ab-pipeline-node {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  color: #a78bfa; font-size: 11px; font-weight: 700;
}
.ab-pipeline-arrow { color: rgba(255,255,255,0.2); }

/* ── Generating Views ── */
.ab-generating { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

.ab-phase-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-phase-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 13px; color: rgba(255,255,255,0.5); flex-shrink: 0;
}
.ab-phase-tag {
  margin-left: auto; padding: 3px 8px;
  background: rgba(124,58,237,0.2); color: #c4b5fd;
  border-radius: 6px; font-size: 11px; font-weight: 600;
}
.ab-phase-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #7c3aed;
  animation: ab-pulse-dot 1.4s ease-in-out infinite; flex-shrink: 0;
}
.ab-phase-dot--plan { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
@keyframes ab-pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }

.ab-phase-body { flex: 1; overflow-y: auto; padding: 24px; }
.ab-phase-steps { display: flex; flex-direction: column; gap: 14px; max-width: 480px; margin: 0 auto; }
.ab-phase-step {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 16px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  animation: ab-step-appear 0.4s ease forwards; opacity: 0;
}
.ab-phase-step--active {
  border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.05);
}
@keyframes ab-step-appear { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.ab-phase-step-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(245,158,11,0.15); color: #f59e0b;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ab-phase-step-content { display: flex; flex-direction: column; gap: 3px; }
.ab-phase-step-label { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.8); }
.ab-phase-step-sub { font-size: 11px; color: rgba(255,255,255,0.35); }

.ab-phase-view--build .ab-gen-code { flex: 1; overflow: auto; padding: 20px; }
.ab-gen-code { flex: 1; overflow: auto; padding: 20px; }
.ab-gen-pre {
  font-family: 'Menlo','Monaco',monospace; font-size: 11px; line-height: 1.7;
  color: rgba(255,255,255,0.55); white-space: pre-wrap; word-break: break-word; margin: 0;
}

/* ── Result ── */
.ab-result { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-code-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-code-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.ab-code-lang { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
.ab-code-copy {
  font-size: 12px; font-weight: 600; color: #a78bfa; background: none; border: none; cursor: pointer;
  padding: 4px 8px; border-radius: 5px; transition: background .15s;
}
.ab-code-copy:hover { background: rgba(124,58,237,0.15); }
.ab-code-pre {
  flex: 1; overflow: auto; padding: 20px;
  font-family: 'Menlo','Monaco',monospace; font-size: 11.5px; line-height: 1.7;
  color: rgba(255,255,255,0.65); white-space: pre-wrap; word-break: break-all; margin: 0;
}
.ab-iframe-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.ab-iframe-wrap--mobile { align-items: center; background: #06060d; padding: 20px; }
.ab-iframe-wrap--mobile .ab-browser-chrome { width: 390px; }
.ab-iframe-wrap--mobile .ab-iframe { width: 390px; }
.ab-browser-chrome {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
}
.ab-iframe-wrap--mobile .ab-browser-chrome { border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 12px 12px 0 0; }
.ab-chrome-dots { display: flex; gap: 5px; flex-shrink: 0; }
.ab-chrome-dots span { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.12); }
.ab-chrome-bar { flex: 1; background: rgba(255,255,255,0.06); border-radius: 5px; padding: 4px 10px; }
.ab-chrome-url { font-size: 11px; color: rgba(255,255,255,0.3); }
.ab-iframe { flex: 1; border: none; width: 100%; background: white; }
.ab-iframe-wrap--mobile .ab-iframe { border: 1px solid rgba(255,255,255,0.08); border-top: none; border-radius: 0 0 12px 12px; flex: none; height: calc(100% - 44px); }
`;
