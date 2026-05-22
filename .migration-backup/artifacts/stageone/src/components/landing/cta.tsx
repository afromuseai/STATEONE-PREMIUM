import { Link } from "wouter"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-card relative overflow-hidden rounded-2xl p-8 text-center md:p-16"
        >
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Ready to Transform Your Business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Start generating AI-powered business intelligence today. No credit
              card required, no commitment needed.
            </p>
            <div className="mt-8">
              <Link
                href="/dashboard"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-8 text-base font-medium text-primary-foreground transition-all hover:bg-primary/90 gold-glow"
              >
                Get Started Now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
