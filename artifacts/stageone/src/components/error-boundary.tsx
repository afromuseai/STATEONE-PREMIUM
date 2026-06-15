import { Component, type ReactNode, type ErrorInfo } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to the built-in error tracking endpoint (fire-and-forget)
    fetch("/api/errors/report", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message ?? "Unknown client error",
        stack: error.stack?.slice(0, 5000),
        path: window.location.pathname,
        type: "client",
        metadata: {
          componentStack: info.componentStack?.slice(0, 2000),
          userAgent: navigator.userAgent,
        },
      }),
    }).catch(() => {})
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = "/dashboard"
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            An unexpected error occurred. It has been automatically reported. Try reloading to continue.
          </p>
          {this.state.error && (
            <div className="mb-6 rounded-lg bg-secondary/30 border border-border p-3 text-left">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {this.state.error.message}
              </p>
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }
}
