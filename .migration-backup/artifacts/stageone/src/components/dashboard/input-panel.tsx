
import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2 } from "lucide-react"

interface InputPanelProps {
  onGenerate: (idea: string) => void
  isLoading: boolean
}

export function InputPanel({ onGenerate, isLoading }: InputPanelProps) {
  const [idea, setIdea] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (idea.trim() && !isLoading) {
      onGenerate(idea.trim())
    }
  }

  const exampleIdeas = [
    "A subscription box service for sustainable home products",
    "An AI-powered personal finance app for millennials",
    "A B2B marketplace for unused manufacturing capacity",
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="flex h-full flex-col"
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Business Idea Input
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your business concept in detail for comprehensive AI analysis
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="flex-1">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your business idea here. Include your target market, unique value proposition, and any specific goals you have in mind..."
            className="h-full min-h-[200px] w-full resize-none rounded-lg border border-border bg-input p-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={!idea.trim() || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 gold-glow"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Intelligence...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Business Intelligence
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 border-t border-border pt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Example Ideas
        </p>
        <div className="space-y-2">
          {exampleIdeas.map((example, index) => (
            <button
              key={index}
              onClick={() => setIdea(example)}
              disabled={isLoading}
              className="w-full rounded-md border border-border bg-secondary/30 p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-secondary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
