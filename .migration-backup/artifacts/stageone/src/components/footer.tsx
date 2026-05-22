import { Link } from "wouter"

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S1</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              STAGEONE
            </span>
          </div>

          <div className="flex items-center gap-8">
            <a
              href="/#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="/#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </a>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} STAGEONE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
