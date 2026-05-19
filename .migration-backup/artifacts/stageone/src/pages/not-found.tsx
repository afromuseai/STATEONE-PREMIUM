import { Link } from "wouter"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-muted-foreground mb-8">Page not found</p>
        <Link href="/" className="text-primary hover:underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
