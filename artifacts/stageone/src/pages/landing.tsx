import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/landing/hero"
import { LogoMarquee } from "@/components/landing/logo-marquee"
import { BackToTop } from "@/components/landing/back-to-top"
import { CookieBanner } from "@/components/landing/cookie-banner"
import { OSShowcase } from "@/components/landing/os-showcase"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Features } from "@/components/landing/features"
import { Trust } from "@/components/landing/trust"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/footer"
import { ThemeWrapper } from "@/lib/theme-context"

export default function LandingPage() {
  return (
    <ThemeWrapper>
      <main className="min-h-screen bg-background">
        <Navbar />
        <Hero />
        <LogoMarquee />
        <OSShowcase />
        <HowItWorks />
        <Features />
        <Trust />
        <CTA />
        <Footer />
        <BackToTop />
        <CookieBanner />
      </main>
    </ThemeWrapper>
  )
}
