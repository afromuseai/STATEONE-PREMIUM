import { Link } from "wouter"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img src={logoImg} alt="STAGEONE" className="h-8 w-auto object-contain" />
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-foreground">
                STAGEONE
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
              The AI Business Operating System for modern operators.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Platform</h4>
            <div className="space-y-2">
              <a href="/#features" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="/#how-it-works" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
              <Link href="/pricing" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Tools</h4>
            <div className="space-y-2">
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Business Intelligence</Link>
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Website Architect</Link>
              <Link href="/agents" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">AI Agents</Link>
              <Link href="/developer" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Developer API</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Account</h4>
            <div className="space-y-2">
              <Link href="/login" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/signup" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Create Account</Link>
              <Link href="/settings" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} STAGEONE. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with multi-model AI infrastructure.
          </p>
        </div>

        {/* Brand attribution */}
        <div className="mt-8 text-center">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground/50">
            StageOne by{" "}
            <span className="text-muted-foreground/70 tracking-[0.25em]">AURELIX SYSTEMS</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
