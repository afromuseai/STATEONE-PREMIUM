import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/landing/hero"
import { OSShowcase } from "@/components/landing/os-showcase"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Features } from "@/components/landing/features"
import { Trust } from "@/components/landing/trust"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <OSShowcase />
      <HowItWorks />
      <Features />
      <Trust />
      <CTA />
      <Footer />
    </main>
  )
}
