import { Link } from "wouter"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"
import { useLang } from "@/lib/i18n"

export function Footer() {
  const { t } = useLang()

  return (
    <footer className="border-t backdrop-blur-sm transition-colors duration-300"
      style={{ borderColor: "var(--lp-border-sub)", background: "var(--lp-footer-bg)" }}>
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
              {t.footer.tagline}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">{t.footer.platform}</h4>
            <div className="space-y-2">
              <a href="/#features" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.features}</a>
              <a href="/#how-it-works" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.howItWorks}</a>
              <Link href="/pricing" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.pricing}</Link>
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.dashboard}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">{t.footer.tools}</h4>
            <div className="space-y-2">
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.businessIntelligence}</Link>
              <Link href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.websiteArchitect}</Link>
              <Link href="/agents" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.aiAgents}</Link>
              <Link href="/developer" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.developerApi}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">{t.footer.account}</h4>
            <div className="space-y-2">
              <Link href="/login" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.signIn}</Link>
              <Link href="/signup" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.createAccount}</Link>
              <Link href="/settings" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t.footer.settings}</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t"
          style={{ borderColor: "var(--lp-border-sub)" }}>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} STAGEONE. {t.footer.rights}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.footer.builtWith}
          </p>
        </div>

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
