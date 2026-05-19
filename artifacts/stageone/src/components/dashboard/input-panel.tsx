import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Loader2, Zap, ShoppingBag, HeartPulse, GraduationCap,
  DollarSign, Shield, Users, Rocket, ChevronDown, ChevronUp, Wand2,
} from "lucide-react"
import { useLang } from "@/lib/i18n"

interface InputPanelProps {
  onGenerate: (idea: string) => void
  isLoading: boolean
}

const INDUSTRY_TEMPLATE_IDEAS = [
  "B2B SaaS platform that helps [target team] automate [core workflow] using AI, with a subscription model targeting SMEs.",
  "Direct-to-consumer brand selling [product] with a subscription box model, targeting [audience] through social commerce and influencer partnerships.",
  "Digital health platform connecting patients with [specialist type] for telehealth consultations, using AI diagnostics and insurance integrations.",
  "Online learning platform teaching [skill/subject] to [audience] through AI-personalized courses and live cohort-based programs.",
  "Fintech app that provides [financial service] to [underserved segment] using embedded finance infrastructure and open banking APIs.",
  "Enterprise cybersecurity SaaS that uses AI to detect and respond to threats in real-time, targeting mid-market companies with compliance needs.",
  "Two-sided marketplace connecting [service providers] with [buyers] in the [industry] space, with vetted listings and escrow-based payments.",
  "AI-powered marketing agency that delivers [specific output] for [industry] clients using automated creative generation and performance tracking.",
]

const TEMPLATE_ICONS = [Zap, ShoppingBag, HeartPulse, GraduationCap, DollarSign, Shield, Users, Rocket]
const TEMPLATE_COLORS = [
  "text-blue-400", "text-orange-400", "text-rose-400", "text-green-400",
  "text-yellow-400", "text-purple-400", "text-cyan-400", "text-pink-400",
]

export function InputPanel({ onGenerate, isLoading }: InputPanelProps) {
  const { t } = useLang()
  const wi = t.workspace.input
  const [idea, setIdea] = useState("")
  const [focused, setFocused] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [enhancedFrom, setEnhancedFrom] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const templateLabels = [
    wi.templateLabels.saas,
    wi.templateLabels.ecommerce,
    wi.templateLabels.health,
    wi.templateLabels.edtech,
    wi.templateLabels.fintech,
    wi.templateLabels.cybersecurity,
    wi.templateLabels.marketplace,
    wi.templateLabels.agency,
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (idea.trim() && !isLoading) {
      onGenerate(idea.trim())
    }
  }

  const handleEnhance = useCallback(async () => {
    if (!idea.trim() || enhancing) return
    setEnhancing(true)
    try {
      const res = await fetch("/api/generate/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: idea.trim() }),
      })
      if (res.ok) {
        const { enhanced } = await res.json()
        if (enhanced) {
          setEnhancedFrom(idea)
          setIdea(enhanced)
        }
      }
    } catch {}
    finally { setEnhancing(false) }
  }, [idea, enhancing])

  const applyTemplate = (template: string) => {
    setIdea(template)
    setShowTemplates(false)
    textareaRef.current?.focus()
  }

  const charCount = idea.length
  const charLimit = 1000

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-5 w-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <h2 className="text-base font-black text-foreground tracking-tight">{wi.title}</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {wi.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
        {/* Textarea with animated glow border */}
        <div className="flex-1 relative">
          <motion.div
            className="relative h-full rounded-xl overflow-hidden"
            animate={{
              boxShadow: focused
                ? "0 0 0 1px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.12)"
                : "0 0 0 1px rgba(255,255,255,0.06)",
            }}
            transition={{ duration: 0.2 }}
          >
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value.slice(0, charLimit))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={wi.placeholder}
              className="h-full min-h-[180px] w-full resize-none rounded-xl border-0 bg-secondary/30 p-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              disabled={isLoading}
            />
            <AnimatePresence>
              {focused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, transparent 60%)",
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Char count */}
          <div className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/40 font-mono">
            {charCount}/{charLimit}
          </div>
        </div>

        {/* Enhanced notice */}
        <AnimatePresence>
          {enhancedFrom && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
            >
              <Wand2 className="h-3 w-3 text-primary shrink-0" />
              <p className="text-[10px] text-primary/80 flex-1">{wi.ideaEnhanced}</p>
              <button
                type="button"
                onClick={() => { setIdea(enhancedFrom); setEnhancedFrom(null) }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {wi.undo}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleEnhance}
            disabled={!idea.trim() || enhancing || isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enhancing ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {wi.enhancing}</>
            ) : (
              <><Wand2 className="h-3.5 w-3.5" /> {wi.enhanceIdea}</>
            )}
          </button>

          <button
            type="submit"
            disabled={!idea.trim() || isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_28px_rgba(212,175,55,0.35)]"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {wi.generating}</>
            ) : (
              <><Sparkles className="h-4 w-4" /> {wi.generateIntelligence}</>
            )}
          </button>
        </div>
      </form>

      {/* Industry Templates */}
      <div className="mt-5 border-t border-border/40 pt-4">
        <button
          onClick={() => setShowTemplates(v => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <span>{wi.industryTemplates}</span>
          {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <AnimatePresence>
          {showTemplates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {templateLabels.map((label, i) => {
                  const Icon = TEMPLATE_ICONS[i]
                  const color = TEMPLATE_COLORS[i]
                  return (
                    <motion.button
                      key={label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => applyTemplate(INDUSTRY_TEMPLATE_IDEAS[i])}
                      disabled={isLoading}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/20 p-2.5 hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 group"
                    >
                      <Icon className={`h-4 w-4 ${color} group-hover:scale-110 transition-transform`} />
                      <span className="text-[9px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trending ideas */}
        <div>
          <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.15em] mb-2">{wi.trendingIdeas}</p>
          <div className="space-y-1.5">
            {wi.trendingList.map((example, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => { setIdea(example); textareaRef.current?.focus() }}
                disabled={isLoading}
                className="w-full rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-left text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed"
              >
                {example}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
