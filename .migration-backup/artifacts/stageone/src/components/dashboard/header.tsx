import { Link } from "wouter"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"

export function DashboardHeader() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S1</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              STAGEONE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Dashboard
          </span>
        </div>
      </div>
    </motion.header>
  )
}
