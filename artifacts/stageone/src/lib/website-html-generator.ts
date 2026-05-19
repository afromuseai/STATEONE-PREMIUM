export interface WebsiteOutput {
  colorPalette: {
    primary: string; secondary: string; accent: string; background: string;
    surface: string; text: string; textMuted: string; border: string;
  }
  typography: { headingFont: string; bodyFont: string; headingStyle?: string; headingWeight?: string; bodySize?: string }
  brand: { name: string; tagline: string; voice: string }
  design: { style: string; uiDirection: string; animations: string[]; borderRadius: string; glassmorphism: boolean }
  designVariant?: string
  sections: {
    nav: { logo: string; links: string[] }
    hero: {
      badge: string; headline: string; subheadline: string;
      ctaPrimary: string; ctaSecondary: string; socialProof: string;
      stats?: Array<{ value: string; label: string }>;
      trustedBy?: string[];
    }
    howItWorks?: {
      title: string; subtitle: string;
      steps: Array<{ step: string; title: string; description: string; icon: string }>;
    }
    features: { title: string; subtitle: string; items: Array<{ icon: string; title: string; description: string }> }
    testimonials: { title: string; items: Array<{ quote: string; author: string; role: string; company: string; metric?: string | null }> }
    pricing: { title: string; subtitle: string; annual?: boolean; tiers: Array<{ name: string; price: string; period: string; description: string; features: string[]; cta: string; highlighted: boolean; badge: string | null }> }
    cta: { headline: string; subheadline: string; buttonText: string; subtext?: string }
    faq: { title: string; items: Array<{ question: string; answer: string }> }
    footer: { tagline: string; columns: Array<{ title: string; links: string[] }>; legal: string }
  }
  seoMeta: { title: string; description: string; keywords: string[] }
  componentCode: Record<string, string>
  websiteStrategy?: {
    conversionApproach: string
    sectionOrderRationale: string
    trustSignals: string[]
    ctaStrategy: string
    audiencePsychology: string
    industryOptimizations: string[]
    conversionFunnel: string
  }
}

// ─── Variant Configuration ─────────────────────────────────────────────────────
interface VariantConfig {
  heroLayout: "split" | "centered" | "fullscreen" | "editorial" | "cinematic" | "glass"
  cardStyle: "solid" | "outlined" | "glass" | "brutalist" | "glow"
  cornerRadius: string
  sectionPadding: string
  showHeroImage: boolean
  showHeroBadge: boolean
  showHeroStats: boolean
  gridOverlay: boolean
  glassCards: boolean
  seriffHeadings: boolean
  brutalistBorders: boolean
  cinematicSpacing: boolean
  navMinimal: boolean
  ctaStyle: "glow" | "stark" | "gradient" | "minimal" | "brutalist"
  extraCss: string
}

const VARIANT_CONFIGS: Record<string, VariantConfig> = {
  "Futuristic": {
    heroLayout: "fullscreen",
    cardStyle: "glow",
    cornerRadius: "4px",
    sectionPadding: "clamp(80px,10vw,120px)",
    showHeroImage: false,
    showHeroBadge: true,
    showHeroStats: true,
    gridOverlay: true,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "glow",
    extraCss: `
@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
@keyframes glitch{0%,100%{clip-path:inset(40% 0 61% 0)}20%{clip-path:inset(92% 0 1% 0)}40%{clip-path:inset(43% 0 1% 0)}60%{clip-path:inset(25% 0 58% 0)}80%{clip-path:inset(54% 0 7% 0)}}
@keyframes borderPulse{0%,100%{box-shadow:0 0 8px var(--p),0 0 16px var(--p)20}50%{box-shadow:0 0 24px var(--p),0 0 48px var(--p)40}}
.var-card{border-radius:4px!important;border:1px solid var(--p)30!important;background:rgba(0,212,255,0.03)!important;animation:borderPulse 3s ease-in-out infinite}
.var-card:hover{border-color:var(--p)!important;box-shadow:0 0 32px var(--p)30,inset 0 0 32px var(--p)05!important}
.grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.var-hero-bg{background:radial-gradient(ellipse 60% 50% at 50% 30%,var(--p)20,transparent),var(--bg)!important}
.var-badge{border-radius:4px!important;border:1px solid var(--p)!important;font-family:monospace!important;letter-spacing:.15em!important;font-size:11px!important;text-transform:uppercase!important}
.var-stat-val{font-family:monospace!important;letter-spacing:-.02em}
.var-cta-btn{border-radius:4px!important;border:1px solid var(--p)!important;position:relative;overflow:hidden}
.var-cta-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--p)20,transparent);transform:translateX(-100%);transition:transform .5s}
.var-cta-btn:hover::before{transform:translateX(100%)}
.var-nav{border-bottom:1px solid var(--p)20!important;background:var(--bg)ee!important}
`,
  },
  "Premium SaaS": {
    heroLayout: "split",
    cardStyle: "solid",
    cornerRadius: "14px",
    sectionPadding: "clamp(80px,10vw,140px)",
    showHeroImage: true,
    showHeroBadge: true,
    showHeroStats: true,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "glow",
    extraCss: `
.var-card{border-radius:14px!important}
.var-card:hover{box-shadow:0 20px 60px rgba(0,0,0,.3),0 0 0 1px var(--p)20!important}
.var-cta-btn{border-radius:12px!important;box-shadow:0 0 40px var(--p)50!important}
`,
  },
  "Luxury Editorial": {
    heroLayout: "editorial",
    cardStyle: "outlined",
    cornerRadius: "0px",
    sectionPadding: "clamp(100px,12vw,160px)",
    showHeroImage: false,
    showHeroBadge: false,
    showHeroStats: false,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: true,
    brutalistBorders: false,
    cinematicSpacing: true,
    navMinimal: true,
    ctaStyle: "minimal",
    extraCss: `
h1,h2,h3{letter-spacing:.04em!important;line-height:1.14!important}
.var-card{background:transparent!important;border:none!important;border-top:1px solid var(--p)30!important;border-radius:0!important;padding:40px 0!important}
.var-card:hover{background:transparent!important;border-color:var(--p)!important;transform:none!important;box-shadow:none!important}
.var-hero-text h1{letter-spacing:.06em!important;font-size:clamp(48px,7vw,96px)!important;line-height:1.05!important}
.var-hero-sub{letter-spacing:.02em!important;font-weight:300!important;font-size:clamp(16px,1.6vw,20px)!important}
.var-cta-btn{background:transparent!important;border:1px solid var(--p)!important;color:var(--p)!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-size:12px!important;font-weight:500!important;border-radius:0!important;padding:16px 40px!important}
.var-cta-btn:hover{background:var(--p)!important;color:var(--bg)!important}
.var-section-label{letter-spacing:.2em!important;font-size:10px!important;text-transform:uppercase!important;font-weight:400!important}
section{padding-left:max(40px,8vw)!important;padding-right:max(40px,8vw)!important}
`,
  },
  "Enterprise Minimal": {
    heroLayout: "split",
    cardStyle: "outlined",
    cornerRadius: "8px",
    sectionPadding: "clamp(72px,8vw,120px)",
    showHeroImage: true,
    showHeroBadge: true,
    showHeroStats: true,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "stark",
    extraCss: `
.var-card{border-radius:8px!important;border:1px solid rgba(0,0,0,0.1)!important;background:#fff!important}
.var-card:hover{border-color:var(--p)30!important;box-shadow:0 4px 20px rgba(0,0,0,0.08)!important}
.var-cta-btn{border-radius:6px!important;background:var(--p)!important;box-shadow:none!important}
.var-badge{background:var(--p)10!important;border:1px solid var(--p)30!important;color:var(--p)!important;border-radius:4px!important}
`,
  },
  "Startup Modern": {
    heroLayout: "centered",
    cardStyle: "solid",
    cornerRadius: "20px",
    sectionPadding: "clamp(80px,10vw,140px)",
    showHeroImage: false,
    showHeroBadge: true,
    showHeroStats: true,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "glow",
    extraCss: `
@keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.var-card{border-radius:20px!important}
.var-card:hover{transform:translateY(-6px)!important;box-shadow:0 24px 48px rgba(0,0,0,.25)!important}
.var-cta-btn{border-radius:16px!important;background:linear-gradient(135deg,var(--p),var(--a))!important;background-size:200% 200%!important;animation:gradientShift 3s ease infinite!important}
.var-hero-stats{display:flex;gap:40px;justify-content:center;flex-wrap:wrap;margin-top:56px}
.var-stat-val{font-size:clamp(36px,5vw,56px)!important;font-weight:900!important;color:var(--p)!important}
`,
  },
  "Bold Brutalist": {
    heroLayout: "fullscreen",
    cardStyle: "brutalist",
    cornerRadius: "0px",
    sectionPadding: "clamp(64px,8vw,100px)",
    showHeroImage: false,
    showHeroBadge: false,
    showHeroStats: false,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: true,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "brutalist",
    extraCss: `
*{border-radius:0!important}
.var-card{background:transparent!important;border:3px solid var(--tx)!important;padding:28px!important}
.var-card:hover{background:var(--tx)!important;color:var(--bg)!important;transform:translate(-3px,-3px)!important;box-shadow:6px 6px 0 var(--p)!important}
.var-card:hover *{color:var(--bg)!important;stroke:var(--bg)!important}
.var-cta-btn{background:var(--tx)!important;color:var(--bg)!important;border:none!important;font-size:18px!important;letter-spacing:.02em!important;box-shadow:none!important}
.var-cta-btn:hover{background:var(--p)!important;transform:translate(-4px,-4px)!important;box-shadow:8px 8px 0 var(--tx)!important}
.var-hero-text h1{font-size:clamp(56px,10vw,140px)!important;line-height:.95!important;letter-spacing:-.03em!important;text-transform:uppercase!important}
.var-section-title{font-size:clamp(36px,5vw,72px)!important;text-transform:uppercase!important;letter-spacing:-.02em!important}
nav{border-bottom:3px solid var(--tx)!important}
`,
  },
  "Glassmorphism": {
    heroLayout: "glass",
    cardStyle: "glass",
    cornerRadius: "24px",
    sectionPadding: "clamp(80px,10vw,130px)",
    showHeroImage: false,
    showHeroBadge: true,
    showHeroStats: true,
    gridOverlay: false,
    glassCards: true,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: false,
    navMinimal: false,
    ctaStyle: "gradient",
    extraCss: `
@keyframes meshMove{0%{background-position:0% 0%}50%{background-position:100% 100%}100%{background-position:0% 0%}}
body{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e)!important;background-size:400% 400%;animation:meshMove 12s ease infinite!important}
.var-card{background:rgba(255,255,255,0.07)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;border:1px solid rgba(255,255,255,0.13)!important;border-radius:24px!important;box-shadow:0 8px 32px rgba(0,0,0,.3)!important}
.var-card:hover{background:rgba(255,255,255,0.12)!important;border-color:var(--p)40!important;transform:translateY(-4px)!important}
.var-cta-btn{background:linear-gradient(135deg,var(--p),var(--a))!important;border-radius:16px!important;backdrop-filter:blur(12px)!important}
.var-nav{background:rgba(255,255,255,0.05)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;border-bottom:1px solid rgba(255,255,255,0.1)!important}
.var-badge{background:rgba(255,255,255,0.1)!important;backdrop-filter:blur(10px)!important;border:1px solid rgba(255,255,255,0.2)!important;border-radius:100px!important}
.var-hero-panel{background:rgba(255,255,255,0.06)!important;backdrop-filter:blur(30px)!important;border:1px solid rgba(255,255,255,0.15)!important;border-radius:32px!important;padding:48px!important}
`,
  },
  "Cinematic Dark": {
    heroLayout: "cinematic",
    cardStyle: "solid",
    cornerRadius: "6px",
    sectionPadding: "clamp(100px,12vw,160px)",
    showHeroImage: false,
    showHeroBadge: false,
    showHeroStats: false,
    gridOverlay: false,
    glassCards: false,
    seriffHeadings: false,
    brutalistBorders: false,
    cinematicSpacing: true,
    navMinimal: true,
    ctaStyle: "minimal",
    extraCss: `
.var-hero-text h1{font-size:clamp(52px,8vw,110px)!important;letter-spacing:.06em!important;text-transform:uppercase!important;line-height:1.0!important;font-weight:900!important}
.var-hero-text p{letter-spacing:.08em!important;font-size:clamp(13px,1.4vw,16px)!important;text-transform:uppercase!important;font-weight:300!important;opacity:.7!important}
.var-card{background:rgba(255,255,255,0.03)!important;border:none!important;border-top:1px solid rgba(255,255,255,0.08)!important;border-radius:6px!important;padding:40px 32px!important}
.var-card:hover{background:rgba(255,255,255,0.05)!important;border-top-color:var(--p)50!important;transform:none!important;box-shadow:none!important}
.var-cta-btn{background:transparent!important;border:1px solid var(--p)!important;border-radius:4px!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-size:13px!important;color:var(--p)!important;font-weight:400!important}
.var-cta-btn:hover{background:var(--p)20!important}
.var-section-title{letter-spacing:.1em!important;text-transform:uppercase!important;font-weight:900!important}
section+section{border-top:1px solid rgba(255,255,255,0.06)!important}
nav{border-bottom:1px solid rgba(255,255,255,0.06)!important}
`,
  },
}

function getVariantConfig(variant: string): VariantConfig {
  return VARIANT_CONFIGS[variant] ?? VARIANT_CONFIGS["Premium SaaS"]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function e(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function f(name: string): string {
  return (name ?? "Inter").replace(/ /g, "+") + ":wght@300;400;500;600;700;800;900"
}

const ICON_SVG: Record<string, (c: string) => string> = {
  Zap: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  Target: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  Shield: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  Rocket: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 11l-4 4 1 4 4-1 4-4M15 9l-2.5-2.5M3 21l3-3M13 4l7 7-9 9-7-7z"/></svg>`,
  Globe: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>`,
  Sparkles: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.7.7m14.14 14.14.7.7M3 12H2m20 0h-1M4.22 19.78l.7-.7M19.07 4.93l.7-.7"/><circle cx="12" cy="12" r="4" fill="${c}" stroke="none" opacity=".3"/></svg>`,
  BarChart: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="6" width="4" height="15" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`,
  Lock: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path stroke-linecap="round" d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  Users: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path stroke-linecap="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M1 21v-2a4 4 0 013-3.87"/></svg>`,
  Layers: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  Brain: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7v0A2.5 2.5 0 012 9.5v5A2.5 2.5 0 004.5 17v0A2.5 2.5 0 007 19.5v0A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7v0A2.5 2.5 0 0017 4.5v0A2.5 2.5 0 0014.5 2z"/></svg>`,
  TrendingUp: c => `<svg width="20" height="20" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  Check: c => `<svg width="14" height="14" fill="none" stroke="${c}" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
  Star: c => `<svg width="14" height="14" fill="${c}" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  Quote: c => `<svg width="28" height="20" fill="${c}" opacity=".15" viewBox="0 0 32 24"><path d="M0 24V14C0 6.268 4.477 1.619 13.43 0l1.906 3.047C11.142 4.239 9.048 6.273 8.571 9.143H13V24H0zm19 0V14c0-7.732 4.477-12.381 13.43-13.953L34.335 3.094C30.142 4.239 28.048 6.273 27.571 9.143H32V24H19z"/></svg>`,
  ArrowRight: c => `<svg width="16" height="16" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  Play: c => `<svg width="14" height="14" fill="${c}" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
}

function icon(name: string, color: string): string {
  return (ICON_SVG[name] ?? ICON_SVG["Sparkles"])(color)
}

// ─── Asset Intelligence Layer ──────────────────────────────────────────────────
// Industry-specific images: purpose-built for each business category (8 per industry for rotation)
const INDUSTRY_HERO_IMAGES: Record<string, string[]> = {
  Cybersecurity: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Fintech: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1642790551116-18e150f248e3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  SaaS: [
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1555421689-491a97ff2040?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744173-05336fcc7ad4?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Healthcare: [
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Education: [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b6f69?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Marketplace: [
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1472851156868-0b8a07c9c6b7?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1576867757603-05b134ebc379?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Agency: [
    "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1453928582365-b6ad33cbcf64?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Luxury: [
    "https://images.unsplash.com/photo-1547555999-14e818e09e33?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  "E-commerce": [
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1472851156868-0b8a07c9c6b7?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  "Creator Economy": [
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1516321165247-4aa89a48be4d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1536240478700-b869ad10e2f6?w=900&h=700&fit=crop&auto=format&q=85",
  ],
}

// Variant-level fallback images — used when no industry match is found
const VARIANT_HERO_IMAGES: Record<string, string[]> = {
  "Premium SaaS": [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1487014679447-9f8336841d58?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744173-05336fcc7ad4?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  "Enterprise Minimal": [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  "Startup Modern": [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&h=700&fit=crop&auto=format&q=85",
  ],
}

// Style-level final fallback
const STYLE_HERO_IMAGES: Record<string, string[]> = {
  SaaS: [
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Corporate: [
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Startup: [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Luxury: [
    "https://images.unsplash.com/photo-1547555999-14e818e09e33?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1611418534757-f3d1b48d94f3?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=900&h=700&fit=crop&auto=format&q=85",
  ],
  Minimal: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1593642532400-2682810df593?w=900&h=700&fit=crop&auto=format&q=85",
    "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=900&h=700&fit=crop&auto=format&q=85",
  ],
}

// Asset Intelligence: pick the most business-relevant hero image
// Priority: industry-specific → variant-specific → style fallback
// variantSeed rotates the image on every regeneration so the same business never gets the same photo twice
function pickHeroImage(variant: string, industry: string, seed: string, variantSeed = 0): string {
  const baseIdx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0))
  // Multiply by a prime to stride across the pool differently on each regeneration
  const idx = baseIdx + variantSeed * 3
  const industryList = INDUSTRY_HERO_IMAGES[industry]
  if (industryList) return industryList[idx % industryList.length]
  const variantList = VARIANT_HERO_IMAGES[variant]
  if (variantList) return variantList[idx % variantList.length]
  const styleList = STYLE_HERO_IMAGES["SaaS"]
  return styleList[idx % styleList.length]
}

const AVATAR_PHOTOS = [
  "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=80&h=80&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format&q=80",
]

function baseCss(c: WebsiteOutput["colorPalette"], t: WebsiteOutput["typography"]): string {
  const hw = t.headingWeight ?? "800"
  const hs = t.headingStyle === "ultra-tight" ? "-0.05em" : t.headingStyle === "tight" ? "-0.03em" : "-0.015em"
  const isDark = c.background.startsWith("#0") || c.background.startsWith("#1") || c.background === "#000" || c.background === "#000000"
  return `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --p:${c.primary};--s:${c.secondary};--a:${c.accent};
  --bg:${c.background};--sf:${c.surface};
  --tx:${c.text};--tm:${c.textMuted};--br:${c.border};
  --hf:'${t.headingFont}',system-ui,sans-serif;
  --bf:'${t.bodyFont}',system-ui,sans-serif;
  --is-dark:${isDark ? 1 : 0};
}
html{scroll-behavior:smooth}
body{font-family:var(--bf);background:var(--bg);color:var(--tx);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
h1,h2,h3,h4,h5,h6{font-family:var(--hf);font-weight:${hw};letter-spacing:${hs};line-height:1.08}
a{text-decoration:none;color:inherit}
button{font-family:var(--bf);cursor:pointer;border:none;outline:none;transition:all .25s ease}
button:hover{opacity:.9;transform:translateY(-1px)}
img{max-width:100%;display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.animate-fadeUp{animation:fadeUp .65s ease both}
.animate-fadeIn{animation:fadeIn .5s ease both}
.animate-slideRight{animation:slideRight .7s ease both}
.animate-float{animation:float 4s ease-in-out infinite}
.d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}.d4{animation-delay:.4s}.d5{animation-delay:.5s}.d6{animation-delay:.6s}.d7{animation-delay:.7s}.d8{animation-delay:.8s}
@media(max-width:768px){
  .hero-grid{grid-template-columns:1fr !important}
  .hero-image-col{display:none !important}
  .footer-grid{grid-template-columns:1fr !important}
  .feature-grid{grid-template-columns:1fr !important}
  .testimonial-grid{grid-template-columns:1fr !important}
  .pricing-grid{grid-template-columns:1fr !important}
}
`
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function navHtml(
  nav: WebsiteOutput["sections"]["nav"],
  c: WebsiteOutput["colorPalette"],
  brand: WebsiteOutput["brand"],
  vc: VariantConfig
): string {
  const links = (nav?.links ?? []).slice(0, 5).map(l =>
    `<a href="#" style="color:var(--tm);font-size:14px;font-weight:500;transition:color .2s;white-space:nowrap" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tm)'">${e(l)}</a>`
  ).join("")
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"

  if (vc.navMinimal) {
    return `
<nav class="var-nav" style="position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:${c.background}ee;padding:0 max(40px,8vw)">
  <div style="max-width:1200px;margin:0 auto;height:72px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-family:var(--hf);font-size:16px;font-weight:700;color:var(--tx);letter-spacing:.08em;text-transform:uppercase">${e(nav?.logo ?? brand.name)}</div>
    <div style="display:flex;align-items:center;gap:40px">${links}</div>
    <a href="#" style="font-size:12px;font-weight:500;color:var(--tm);letter-spacing:.08em;text-transform:uppercase">Enquire</a>
  </div>
</nav>`
  }

  return `
<nav class="var-nav" style="position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:${c.background}dd;border-bottom:1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"};padding:0 max(24px,5vw)">
  <div style="max-width:1200px;margin:0 auto;height:64px;display:flex;align-items:center;justify-content:space-between;gap:32px">
    <div style="font-family:var(--hf);font-size:19px;font-weight:900;color:var(--tx);letter-spacing:-0.5px;white-space:nowrap;flex-shrink:0">${e(nav?.logo ?? brand.name)}</div>
    <div style="display:flex;align-items:center;gap:32px;flex:1;justify-content:center">${links}</div>
    <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
      <a href="#" style="font-size:14px;font-weight:500;color:var(--tm)">Log in</a>
      <button class="var-cta-btn" style="background:var(--p);color:${isLight ? "#fff" : c.background};padding:10px 22px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:-.1px;box-shadow:0 0 24px ${c.primary}35">Get Started</button>
    </div>
  </div>
</nav>`
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function heroHtml(
  hero: WebsiteOutput["sections"]["hero"],
  c: WebsiteOutput["colorPalette"],
  style: string,
  brandName: string,
  vc: VariantConfig,
  variant: string,
  industry: string,
  variantSeed = 0,
  aiHeroImage: string | null = null
): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const stats = vc.showHeroStats ? (hero?.stats ?? []) : []
  const trustedBy = hero?.trustedBy ?? []

  const statsHtml = stats.length > 0 ? `
    <div style="display:grid;grid-template-columns:repeat(${Math.min(stats.length, 4)},1fr);gap:20px;margin-top:44px;padding-top:36px;border-top:1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"}">
      ${stats.map((s, i) => `
      <div class="animate-fadeUp d${i + 5}">
        <div class="var-stat-val" style="font-family:var(--hf);font-size:clamp(22px,3vw,32px);font-weight:900;color:var(--p);line-height:1;margin-bottom:4px">${e(s.value)}</div>
        <div style="font-size:12px;color:var(--tm);font-weight:500;letter-spacing:.2px">${e(s.label)}</div>
      </div>`).join("")}
    </div>` : ""

  const trustedHtml = trustedBy.length > 0 ? `
    <div style="margin-top:40px">
      <p style="font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:16px">Trusted by teams at</p>
      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">
        ${trustedBy.map(name => `<span style="font-family:var(--hf);font-size:15px;font-weight:800;color:${isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)"};letter-spacing:-.3px">${e(name)}</span>`).join("")}
      </div>
    </div>` : ""

  const badgeHtml = vc.showHeroBadge && hero?.badge ? `
    <div class="animate-fadeUp var-badge" style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:100px;border:1px solid ${c.primary}45;background:${c.primary}12;color:${c.primary};font-size:12px;font-weight:700;letter-spacing:.4px;margin-bottom:28px;text-transform:uppercase">
      <span style="width:6px;height:6px;border-radius:50%;background:${c.primary};flex-shrink:0;box-shadow:0 0 8px ${c.primary}80"></span>${e(hero.badge)}
    </div>` : ""

  // ── Centered hero (Startup Modern) ──
  if (vc.heroLayout === "centered") {
    return `
<section class="var-hero-bg" style="position:relative;padding:clamp(80px,10vw,130px) max(24px,5vw);overflow:hidden;background:var(--bg);text-align:center">
  ${vc.gridOverlay ? `<div class="grid-overlay"></div>` : ""}
  <div style="position:relative;max-width:900px;margin:0 auto">
    ${badgeHtml}
    <div class="var-hero-text">
      <h1 class="animate-fadeUp d1" style="font-size:clamp(40px,6vw,80px);color:var(--tx);margin-bottom:24px;line-height:1.04">${e(hero?.headline ?? "")}</h1>
    </div>
    <p class="animate-fadeUp d2 var-hero-sub" style="font-size:clamp(16px,1.8vw,20px);line-height:1.7;color:var(--tm);max-width:560px;margin:0 auto 44px">
      ${e(hero?.subheadline ?? "")}
    </p>
    <div class="animate-fadeUp d3" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:17px 40px;border-radius:16px;background:var(--p);color:${isLight ? "#fff" : c.background};font-weight:700;font-size:17px;box-shadow:0 4px 40px ${c.primary}50">
        ${e(hero?.ctaPrimary ?? "Get Started")} ${icon("ArrowRight", isLight ? "#fff" : c.background)}
      </button>
      <button style="display:inline-flex;align-items:center;gap:8px;padding:17px 32px;border-radius:16px;background:transparent;color:var(--tx);font-weight:600;font-size:16px;border:1.5px solid ${isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}">
        ${icon("Play", c.primary)} ${e(hero?.ctaSecondary ?? "Watch Demo")}
      </button>
    </div>
    ${stats.length > 0 ? `<div class="var-hero-stats animate-fadeUp d5">${stats.map(s => `<div><div class="var-stat-val" style="font-family:var(--hf);font-size:clamp(32px,4vw,52px);font-weight:900;color:var(--p);line-height:1;margin-bottom:6px">${e(s.value)}</div><div style="font-size:12px;color:var(--tm);font-weight:500;letter-spacing:.2px">${e(s.label)}</div></div>`).join("")}</div>` : ""}
    ${trustedHtml}
  </div>
</section>`
  }

  // ── Editorial hero (Luxury Editorial) ──
  if (vc.heroLayout === "editorial") {
    return `
<section class="var-hero-bg" style="position:relative;padding:clamp(100px,14vw,180px) max(40px,8vw);overflow:hidden;background:var(--bg)">
  <div style="max-width:900px;margin:0 auto">
    <div class="animate-fadeUp" style="width:48px;height:1px;background:var(--p);margin-bottom:40px"></div>
    <div class="var-hero-text">
      <h1 class="animate-fadeUp d1" style="font-size:clamp(48px,7vw,96px);color:var(--tx);margin-bottom:40px;line-height:1.04;letter-spacing:.04em">
        ${e(hero?.headline ?? "")}
      </h1>
    </div>
    <p class="animate-fadeUp d2 var-hero-sub" style="font-size:clamp(15px,1.5vw,18px);line-height:1.9;color:var(--tm);max-width:520px;margin-bottom:52px;font-weight:300;letter-spacing:.02em">
      ${e(hero?.subheadline ?? "")}
    </p>
    <div class="animate-fadeUp d3" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:12px;padding:16px 40px;background:transparent;color:var(--p);font-weight:500;font-size:12px;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--p)">
        ${e(hero?.ctaPrimary ?? "Request Consultation")}
        ${icon("ArrowRight", c.primary)}
      </button>
      <span style="font-size:13px;color:var(--tm);letter-spacing:.06em;text-transform:uppercase;font-weight:300">${e(hero?.ctaSecondary ?? "")}</span>
    </div>
    ${trustedBy.length > 0 ? `<div style="margin-top:72px;display:flex;align-items:center;gap:32px;flex-wrap:wrap">${trustedBy.map(n => `<span style="font-family:var(--hf);font-size:13px;font-weight:700;color:${isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)"};letter-spacing:.06em;text-transform:uppercase">${e(n)}</span>`).join("")}</div>` : ""}
  </div>
</section>`
  }

  // ── Fullscreen hero (Futuristic, Bold Brutalist) ──
  if (vc.heroLayout === "fullscreen") {
    return `
<section class="var-hero-bg" style="position:relative;min-height:92vh;display:flex;align-items:center;padding:clamp(60px,8vw,100px) max(24px,5vw);overflow:hidden;background:var(--bg)">
  ${vc.gridOverlay ? `<div class="grid-overlay"></div>` : ""}
  <div style="position:relative;max-width:1000px;margin:0 auto;width:100%">
    ${badgeHtml}
    <div class="var-hero-text">
      <h1 class="animate-fadeUp d1" style="font-size:clamp(44px,7vw,88px);color:var(--tx);margin-bottom:28px;line-height:1.04;max-width:820px">
        ${e(hero?.headline ?? "")}
      </h1>
    </div>
    <p class="animate-fadeUp d2 var-hero-sub" style="font-size:clamp(16px,1.8vw,20px);line-height:1.7;color:var(--tm);max-width:500px;margin-bottom:44px">
      ${e(hero?.subheadline ?? "")}
    </p>
    <div class="animate-fadeUp d3" style="display:flex;gap:14px;flex-wrap:wrap">
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:var(--p);color:${isLight ? "#fff" : c.background};font-weight:700;font-size:16px">
        ${e(hero?.ctaPrimary ?? "Get Started")} ${icon("ArrowRight", isLight ? "#fff" : c.background)}
      </button>
      ${hero?.ctaSecondary ? `<button style="display:inline-flex;align-items:center;gap:8px;padding:16px 28px;background:transparent;color:var(--tx);font-weight:600;font-size:16px;border:1.5px solid ${isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}">
        ${icon("Play", c.primary)} ${e(hero.ctaSecondary)}
      </button>` : ""}
    </div>
    ${statsHtml}
    ${!stats.length && trustedHtml ? trustedHtml : ""}
  </div>
</section>`
  }

  // ── Cinematic hero ──
  if (vc.heroLayout === "cinematic") {
    return `
<section class="var-hero-bg" style="position:relative;min-height:100vh;display:flex;align-items:center;padding:0 max(40px,8vw);overflow:hidden;background:var(--bg)">
  <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--p)40,transparent)"></div>
  <div style="position:relative;max-width:1100px;margin:0 auto;width:100%">
    <div class="animate-fadeUp" style="font-size:11px;color:var(--tm);letter-spacing:.3em;text-transform:uppercase;margin-bottom:48px;font-weight:400">${e(hero?.badge ?? hero?.socialProof ?? "")}</div>
    <div class="var-hero-text">
      <h1 class="animate-fadeUp d1" style="font-size:clamp(52px,8vw,110px);color:var(--tx);line-height:1.0;letter-spacing:.06em;text-transform:uppercase;font-weight:900;margin-bottom:48px;max-width:900px">
        ${e(hero?.headline ?? "")}
      </h1>
    </div>
    <div style="display:flex;align-items:center;gap:40px;flex-wrap:wrap">
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:12px;padding:16px 40px;background:transparent;color:var(--p);font-size:12px;letter-spacing:.15em;text-transform:uppercase;border:1px solid var(--p);font-weight:400">
        ${e(hero?.ctaPrimary ?? "Discover More")}
      </button>
      <p class="var-hero-sub" style="font-size:14px;line-height:1.8;color:var(--tm);max-width:380px;letter-spacing:.06em;text-transform:uppercase;font-weight:300">
        ${e(hero?.subheadline ?? "")}
      </p>
    </div>
  </div>
</section>`
  }

  // ── Glassmorphism hero ──
  if (vc.heroLayout === "glass") {
    const statsArr = hero?.stats ?? []
    return `
<section style="position:relative;padding:clamp(80px,10vw,130px) max(24px,5vw);overflow:hidden">
  <div style="position:relative;max-width:1100px;margin:0 auto">
    <div class="animate-fadeUp var-hero-panel" style="text-align:center">
      ${badgeHtml}
      <h1 class="animate-fadeUp d1 var-hero-text" style="font-size:clamp(38px,5.5vw,72px);color:var(--tx);margin-bottom:24px;line-height:1.05;font-weight:900">
        ${e(hero?.headline ?? "")}
      </h1>
      <p class="animate-fadeUp d2 var-hero-sub" style="font-size:clamp(16px,1.8vw,20px);line-height:1.7;color:var(--tm);max-width:560px;margin:0 auto 44px">
        ${e(hero?.subheadline ?? "")}
      </p>
      <div class="animate-fadeUp d3" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
        <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:16px 40px;border-radius:16px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-weight:700;font-size:16px;box-shadow:0 4px 40px var(--p)40">
          ${e(hero?.ctaPrimary ?? "Get Started")} ${icon("ArrowRight", "#fff")}
        </button>
        ${hero?.ctaSecondary ? `<button style="display:inline-flex;align-items:center;gap:8px;padding:16px 28px;border-radius:16px;background:rgba(255,255,255,0.07);backdrop-filter:blur(10px);color:var(--tx);font-weight:600;font-size:15px;border:1px solid rgba(255,255,255,0.15)">
          ${icon("Play", c.primary)} ${e(hero.ctaSecondary)}
        </button>` : ""}
      </div>
      ${statsArr.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(statsArr.length, 4)},1fr);gap:20px;margin-top:48px;padding-top:40px;border-top:1px solid rgba(255,255,255,0.1)">
        ${statsArr.map((s, i) => `<div class="animate-fadeUp d${i+5}"><div style="font-family:var(--hf);font-size:clamp(24px,3vw,36px);font-weight:900;color:var(--p);margin-bottom:4px">${e(s.value)}</div><div style="font-size:12px;color:var(--tm);font-weight:500">${e(s.label)}</div></div>`).join("")}
      </div>` : ""}
    </div>
  </div>
</section>`
  }

  // ── Default split hero ──
  // AI-generated FLUX image takes priority; falls back to Unsplash pool
  const imgUrl = aiHeroImage ?? pickHeroImage(variant, industry, brandName, variantSeed)
  const floatingBadgeLabel = hero?.socialProof
    ? hero.socialProof.replace(/[+\d,]+\s*/g, "").trim().slice(0, 28)
    : "Active users"
  const floatingBadgeNum = (hero?.socialProof ?? "").match(/[\d,k+]+/)?.[0] ?? "2.4k+"

  return `
<section class="var-hero-bg" style="position:relative;padding:clamp(60px,8vw,100px) max(24px,5vw) clamp(60px,8vw,100px);overflow:hidden;background:${isLight ? c.background : `radial-gradient(ellipse 80% 60% at 30% 20%, ${c.primary}14, transparent),var(--bg)`}">
  ${!isLight ? `<div style="position:absolute;inset:0;background:radial-gradient(ellipse 50% 40% at 80% 80%, ${c.secondary}12, transparent);pointer-events:none"></div>` : ""}
  ${vc.gridOverlay ? `<div class="grid-overlay"></div>` : ""}
  <div class="hero-grid" style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.1fr 0.9fr;gap:clamp(48px,6vw,88px);align-items:center">

    <div class="var-hero-text">
      ${badgeHtml}
      <h1 class="animate-fadeUp d1" style="font-size:clamp(36px,5.5vw,68px);color:var(--tx);margin-bottom:22px;line-height:1.06;max-width:560px">${e(hero?.headline ?? "")}</h1>
      <p class="animate-fadeUp d2 var-hero-sub" style="font-size:clamp(16px,1.8vw,19px);line-height:1.7;color:var(--tm);max-width:480px;margin-bottom:38px;font-weight:400">${e(hero?.subheadline ?? "")}</p>

      <div class="animate-fadeUp d3" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">
        <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:15px 32px;border-radius:12px;background:var(--p);color:${isLight ? "#fff" : c.background};font-weight:700;font-size:16px;box-shadow:0 4px 32px ${c.primary}45,0 2px 12px rgba(0,0,0,.2)">
          ${e(hero?.ctaPrimary ?? "Get Started")}
          ${icon("ArrowRight", isLight ? "#fff" : c.background)}
        </button>
        <button style="display:inline-flex;align-items:center;gap:8px;padding:15px 28px;border-radius:12px;background:transparent;color:var(--tx);font-weight:600;font-size:16px;border:1.5px solid ${isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)"}">
          ${icon("Play", c.primary)}
          ${e(hero?.ctaSecondary ?? "Watch Demo")}
        </button>
      </div>

      ${statsHtml}
      ${!stats.length && trustedHtml ? trustedHtml : ""}
    </div>

    <div class="hero-image-col animate-slideRight d2" style="position:relative">
      <div style="position:absolute;inset:-20px;background:radial-gradient(ellipse 80% 80% at 50% 50%, ${c.primary}20, transparent);border-radius:32px;filter:blur(30px);pointer-events:none"></div>
      <div style="position:relative;border-radius:24px;overflow:hidden;border:1px solid ${isLight ? "rgba(0,0,0,0.08)" : `${c.primary}20`};box-shadow:0 32px 80px rgba(0,0,0,${isLight ? "0.12" : "0.5"}),0 0 0 1px ${isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"}">
        <img src="${imgUrl}" alt="${e(brandName)}" style="width:100%;height:clamp(300px,40vw,480px);object-fit:cover;display:block" loading="eager" onerror="this.style.display='none';this.parentElement.style.background='${c.surface}'">
        ${!isLight ? `<div style="position:absolute;inset:0;background:linear-gradient(135deg, ${c.primary}15 0%, transparent 60%);pointer-events:none"></div>` : ""}
      </div>
      <div class="animate-float" style="position:absolute;top:clamp(12px,3%,24px);left:clamp(-8px,-3%,-16px);display:flex;align-items:center;gap:10px;background:${isLight ? "#fff" : "#0e0e0e"};border:1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"};border-radius:100px;padding:8px 16px;box-shadow:0 8px 32px rgba(0,0,0,${isLight ? "0.12" : "0.4"})">
        <div style="display:flex;margin-right:-4px">
          ${[0,1,2].map(i => `<img src="${AVATAR_PHOTOS[i]}" style="width:24px;height:24px;border-radius:50%;border:2px solid ${isLight ? "#fff" : "#0e0e0e"};margin-left:${i > 0 ? "-8px" : "0"};object-fit:cover" onerror="this.style.background='${c.primary}40';this.removeAttribute('src')">`).join("")}
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--tx);white-space:nowrap">${e(floatingBadgeNum)} ${e(floatingBadgeLabel)}</span>
        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;box-shadow:0 0 6px #22c55e"></span>
      </div>
      ${stats.length > 0 ? `
      <div class="animate-float" style="position:absolute;bottom:clamp(12px,4%,28px);right:clamp(-8px,-3%,-20px);background:${isLight ? "#fff" : "#0e0e0e"};border:1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"};border-radius:18px;padding:14px 20px;box-shadow:0 8px 32px rgba(0,0,0,${isLight ? "0.1" : "0.4"});min-width:130px;animation-delay:1s">
        <div style="font-family:var(--hf);font-size:26px;font-weight:900;color:var(--p);line-height:1">${e(stats[0]?.value ?? "")}</div>
        <div style="font-size:11px;color:var(--tm);margin-top:3px;font-weight:500">${e(stats[0]?.label ?? "")}</div>
      </div>` : ""}
    </div>
  </div>
</section>

${trustedBy.length > 0 && stats.length > 0 ? `
<div style="padding:clamp(28px,4vw,40px) max(24px,5vw);border-top:1px solid ${isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)"};border-bottom:1px solid ${isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)"};background:${isLight ? "#f8f9fa" : c.surface}">
  <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:clamp(24px,4vw,56px);flex-wrap:wrap">
    <span style="font-size:11px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap;flex-shrink:0">Trusted by</span>
    ${trustedBy.map(name => `<span style="font-family:var(--hf);font-size:16px;font-weight:800;color:${isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.18)"};letter-spacing:-.3px;white-space:nowrap;transition:color .2s" onmouseover="this.style.color='var(--p)'" onmouseout="this.style.color='${isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.18)"}'\">${e(name)}</span>`).join("")}
  </div>
</div>` : ""}
`
}

// ─── How It Works ──────────────────────────────────────────────────────────────
function howItWorksHtml(hiw: WebsiteOutput["sections"]["howItWorks"], c: WebsiteOutput["colorPalette"]): string {
  if (!hiw?.steps?.length) return ""
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const altBg = isLight ? "#f8f9fa" : c.surface
  const steps = hiw.steps.map((s, i) => `
  <div class="animate-fadeUp d${Math.min(i + 2, 6)}" style="position:relative;flex:1;min-width:220px;text-align:center;padding:0 16px">
    <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:${c.primary}15;border:2px solid ${c.primary}35;margin-bottom:20px">
      <div style="position:absolute;inset:-6px;border-radius:50%;border:1px dashed ${c.primary}25"></div>
      ${icon(s.icon ?? "Sparkles", c.primary)}
      <div style="position:absolute;top:-4px;right:-4px;width:22px;height:22px;border-radius:50%;background:var(--p);display:flex;align-items:center;justify-content:center;font-family:var(--hf);font-size:9px;font-weight:900;color:${isLight ? "#fff" : c.background}">${e(s.step)}</div>
    </div>
    <h3 style="font-size:16px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-.2px">${e(s.title)}</h3>
    <p style="font-size:14px;color:var(--tm);line-height:1.7;max-width:220px;margin:0 auto">${e(s.description)}</p>
  </div>`).join(`
  <div style="display:flex;align-items:flex-start;padding-top:36px;color:${c.primary};opacity:.4;font-size:20px;flex-shrink:0">→</div>`)
  return `
<section id="how-it-works" style="padding:clamp(80px,10vw,130px) max(24px,5vw);background:${altBg}">
  <div style="max-width:1100px;margin:0 auto">
    <div class="animate-fadeUp" style="text-align:center;margin-bottom:72px">
      <h2 style="font-size:clamp(28px,4vw,52px);color:var(--tx);margin-bottom:14px">${e(hiw.title)}</h2>
      <p style="font-size:18px;color:var(--tm);max-width:460px;margin:0 auto;line-height:1.65">${e(hiw.subtitle)}</p>
    </div>
    <div style="display:flex;align-items:flex-start;justify-content:center;gap:0;flex-wrap:wrap;gap:8px">
      ${steps}
    </div>
  </div>
</section>`
}

// ─── Features ─────────────────────────────────────────────────────────────────
function featuresHtml(
  features: WebsiteOutput["sections"]["features"],
  c: WebsiteOutput["colorPalette"],
  vc: VariantConfig
): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"

  const items = (features?.items ?? []).map((f, i) => {
    if (vc.glassCards) {
      return `
  <div class="animate-fadeUp var-card d${Math.min(i + 1, 6)}" style="padding:32px;cursor:default">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:${c.primary}25;margin-bottom:20px">${icon(f.icon, c.primary)}</div>
    <h3 style="font-size:17px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-.3px">${e(f.title)}</h3>
    <p style="font-size:14px;color:var(--tm);line-height:1.7">${e(f.description)}</p>
  </div>`
    }
    if (vc.brutalistBorders) {
      return `
  <div class="animate-fadeUp var-card d${Math.min(i + 1, 6)}" style="padding:28px;cursor:default;position:relative">
    <div style="font-family:var(--hf);font-size:48px;font-weight:900;color:var(--p);opacity:.15;position:absolute;top:16px;right:20px;line-height:1">${String(i + 1).padStart(2, "0")}</div>
    <div style="margin-bottom:16px">${icon(f.icon, c.primary)}</div>
    <h3 style="font-size:18px;font-weight:900;color:var(--tx);margin-bottom:10px;text-transform:uppercase;letter-spacing:-.01em">${e(f.title)}</h3>
    <p style="font-size:14px;color:var(--tm);line-height:1.65">${e(f.description)}</p>
  </div>`
    }
    return `
  <div class="animate-fadeUp var-card d${Math.min(i + 1, 6)}" style="padding:32px;border-radius:20px;background:${c.surface};border:1px solid ${isLight ? "rgba(0,0,0,0.07)" : "var(--br)"};transition:all .3s ease;cursor:default" onmouseover="this.style.borderColor='${c.primary}45';this.style.transform='translateY(-4px)';this.style.boxShadow='0 16px 48px rgba(0,0,0,0.15)'" onmouseout="this.style.borderColor='${isLight ? "rgba(0,0,0,0.07)" : "var(--br)"}';this.style.transform='translateY(0)';this.style.boxShadow='none'">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:${c.primary}18;border:1px solid ${c.primary}30;margin-bottom:20px">${icon(f.icon, c.primary)}</div>
    <h3 style="font-size:17px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-.3px">${e(f.title)}</h3>
    <p style="font-size:14px;color:var(--tm);line-height:1.7">${e(f.description)}</p>
  </div>`
  }).join("")

  const sectionBg = vc.glassCards ? "transparent" : "var(--bg)"

  return `
<section id="features" style="padding:${vc.sectionPadding} max(24px,5vw);background:${sectionBg}">
  <div style="max-width:1200px;margin:0 auto">
    <div class="animate-fadeUp" style="text-align:center;margin-bottom:72px;max-width:600px;margin-left:auto;margin-right:auto">
      <h2 class="var-section-title" style="font-size:clamp(30px,4vw,54px);color:var(--tx);margin-bottom:16px">${e(features?.title ?? "")}</h2>
      <p style="font-size:18px;color:var(--tm);line-height:1.65">${e(features?.subtitle ?? "")}</p>
    </div>
    <div class="feature-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${vc.brutalistBorders ? "0" : "22px"}">${items}</div>
  </div>
</section>`
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function testimonialsHtml(
  testimonials: WebsiteOutput["sections"]["testimonials"],
  c: WebsiteOutput["colorPalette"],
  vc: VariantConfig
): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const altBg = isLight ? "#f1f3f5" : (vc.glassCards ? "transparent" : "#050505")
  const stars = Array(5).fill(`${icon("Star", c.primary)}`).join("")

  // Editorial: show only 1-2 large testimonials
  if (vc.cinematicSpacing) {
    const item = testimonials?.items?.[0]
    if (!item) return ""
    return `
<section style="padding:${vc.sectionPadding} max(40px,8vw);background:var(--bg)">
  <div style="max-width:900px;margin:0 auto">
    <div style="width:48px;height:1px;background:var(--p);margin-bottom:48px"></div>
    <blockquote style="font-size:clamp(20px,2.5vw,28px);line-height:1.7;color:var(--tx);font-weight:300;letter-spacing:.02em;margin-bottom:40px;font-style:italic">"${e(item.quote)}"</blockquote>
    <div style="display:flex;align-items:center;gap:16px">
      <img src="${AVATAR_PHOTOS[0]}" alt="${e(item.author)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;opacity:.8" onerror="this.style.display='none'">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--tx);letter-spacing:.04em">${e(item.author)}</div>
        <div style="font-size:12px;color:var(--tm);margin-top:2px;letter-spacing:.04em">${e(item.role)}, ${e(item.company)}</div>
      </div>
    </div>
  </div>
</section>`
  }

  const items = (testimonials?.items ?? []).map((t, i) => {
    const cardStyle = vc.glassCards
      ? `background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.13);border-radius:24px`
      : vc.brutalistBorders
        ? `background:transparent;border:3px solid var(--tx)`
        : `padding:36px;border-radius:24px;background:${isLight ? "#fff" : c.surface};border:1px solid ${isLight ? "rgba(0,0,0,0.07)" : "var(--br)"}`

    return `
  <div class="animate-fadeUp var-card d${Math.min(i + 1, 3)}" style="${cardStyle};padding:36px;display:flex;flex-direction:column;gap:24px;box-shadow:0 4px 24px rgba(0,0,0,${isLight ? "0.05" : "0.15"})">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>${icon("Quote", c.primary)}</div>
      <div style="display:flex;gap:2px">${stars}</div>
    </div>
    <p style="font-size:16px;line-height:1.75;color:var(--tx);font-weight:400;flex:1">"${e(t.quote)}"</p>
    ${t.metric ? `<div style="display:inline-block;padding:5px 14px;border-radius:${vc.brutalistBorders ? "0" : "100px"};background:${c.primary}15;border:1px solid ${c.primary}30;color:${c.primary};font-size:12px;font-weight:700;letter-spacing:.5px;width:fit-content">${e(t.metric)}</div>` : ""}
    <div style="display:flex;align-items:center;gap:14px;border-top:1px solid ${isLight ? "rgba(0,0,0,0.07)" : vc.brutalistBorders ? "var(--tx)" : "var(--br)"};padding-top:22px">
      <img src="${AVATAR_PHOTOS[i % AVATAR_PHOTOS.length]}" alt="${e(t.author)}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid ${c.primary}30;flex-shrink:0" onerror="this.style.background='${c.primary}25'">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--tx)">${e(t.author)}</div>
        <div style="font-size:13px;color:var(--tm);margin-top:2px">${e(t.role)}, <span style="color:var(--p);font-weight:600">${e(t.company)}</span></div>
      </div>
    </div>
  </div>`
  }).join("")

  return `
<section id="testimonials" style="padding:${vc.sectionPadding} max(24px,5vw);background:${altBg}">
  <div style="max-width:1200px;margin:0 auto">
    <div class="animate-fadeUp" style="text-align:center;margin-bottom:72px">
      <h2 class="var-section-title" style="font-size:clamp(30px,4vw,54px);color:var(--tx);margin-bottom:14px">${e(testimonials?.title ?? "What customers say")}</h2>
    </div>
    <div class="testimonial-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${vc.brutalistBorders ? "0" : "22px"}">${items}</div>
  </div>
</section>`
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function pricingHtml(pricing: WebsiteOutput["sections"]["pricing"], c: WebsiteOutput["colorPalette"], vc: VariantConfig): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const tiers = (pricing?.tiers ?? []).map((t, i) => {
    const cardBg = vc.glassCards
      ? (t.highlighted ? `rgba(255,255,255,0.12)` : `rgba(255,255,255,0.06)`)
      : t.highlighted
        ? `linear-gradient(160deg, ${c.primary}12, ${c.surface})`
        : c.surface
    const cardBorder = vc.brutalistBorders
      ? `3px solid ${t.highlighted ? "var(--p)" : "var(--tx)"}`
      : vc.glassCards
        ? `1px solid ${t.highlighted ? `${c.primary}50` : "rgba(255,255,255,0.12)"}`
        : t.highlighted
          ? `1.5px solid ${c.primary}55`
          : `1px solid ${isLight ? "rgba(0,0,0,0.07)" : "var(--br)"}`

    return `
  <div class="animate-fadeUp var-card d${i + 1}" style="position:relative;padding:40px 36px;border-radius:${vc.cornerRadius};background:${cardBg};border:${cardBorder};display:flex;flex-direction:column;${t.highlighted && !vc.brutalistBorders ? `box-shadow:0 0 60px ${c.primary}20,0 24px 48px rgba(0,0,0,0.15)` : ""}${vc.glassCards ? ";backdrop-filter:blur(20px)" : ""}">
    ${t.badge ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:var(--p);color:${isLight ? "#fff" : c.background};padding:4px 18px;border-radius:${vc.brutalistBorders ? "0" : "100px"};font-size:12px;font-weight:700;white-space:nowrap;letter-spacing:.5px;box-shadow:0 4px 16px ${c.primary}40">${e(t.badge)}</div>` : ""}
    <div style="font-size:12px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">${e(t.name)}</div>
    <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:6px">
      <span style="font-family:var(--hf);font-size:clamp(38px,5vw,54px);font-weight:900;color:${t.highlighted ? "var(--p)" : "var(--tx)"};line-height:1">${e(t.price)}</span>
      ${t.period ? `<span style="font-size:15px;color:var(--tm);font-weight:500">${e(t.period)}</span>` : ""}
    </div>
    ${t.description ? `<p style="font-size:13px;color:var(--tm);margin-bottom:20px;line-height:1.55">${e(t.description)}</p>` : ""}
    <div style="flex:1;padding:20px 0;border-top:1px solid ${vc.brutalistBorders ? "var(--tx)" : isLight ? "rgba(0,0,0,0.07)" : "var(--br)"};border-bottom:1px solid ${vc.brutalistBorders ? "var(--tx)" : isLight ? "rgba(0,0,0,0.07)" : "var(--br)"};margin:12px 0;display:flex;flex-direction:column;gap:12px">
      ${(t.features ?? []).map(f => `
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex-shrink:0;width:20px;height:20px;border-radius:${vc.brutalistBorders ? "0" : "50%"};background:${c.primary}20;display:flex;align-items:center;justify-content:center;margin-top:1px">${icon("Check", c.primary)}</div>
        <span style="font-size:14px;color:var(--tm);line-height:1.4">${e(f)}</span>
      </div>`).join("")}
    </div>
    <button class="var-cta-btn" style="margin-top:24px;width:100%;padding:15px 24px;border-radius:${vc.cornerRadius};font-weight:700;font-size:15px;background:${t.highlighted ? "var(--p)" : "transparent"};color:${t.highlighted ? (isLight ? "#fff" : c.background) : "var(--tx)"};border:${t.highlighted ? "none" : `1.5px solid ${isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}`};${t.highlighted ? `box-shadow:0 4px 24px ${c.primary}40` : ""};transition:all .25s">${e(t.cta)}</button>
  </div>`
  }).join("")
  return `
<section id="pricing" style="padding:${vc.sectionPadding} max(24px,5vw);background:var(--bg)">
  <div style="max-width:1100px;margin:0 auto">
    <div class="animate-fadeUp" style="text-align:center;margin-bottom:72px">
      <h2 class="var-section-title" style="font-size:clamp(30px,4vw,54px);color:var(--tx);margin-bottom:16px">${e(pricing?.title ?? "Pricing")}</h2>
      <p style="font-size:18px;color:var(--tm);max-width:460px;margin:0 auto">${e(pricing?.subtitle ?? "")}</p>
    </div>
    <div class="pricing-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${vc.brutalistBorders ? "0" : "22px"};align-items:start">${tiers}</div>
  </div>
</section>`
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function ctaHtml(cta: WebsiteOutput["sections"]["cta"], c: WebsiteOutput["colorPalette"], vc: VariantConfig): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"

  if (vc.ctaStyle === "brutalist") {
    return `
<section style="padding:${vc.sectionPadding} max(24px,5vw);background:var(--tx)">
  <div style="max-width:1000px;margin:0 auto">
    <div class="animate-fadeUp">
      <h2 style="font-size:clamp(40px,7vw,88px);color:var(--bg);line-height:.96;text-transform:uppercase;letter-spacing:-.02em;margin-bottom:32px;font-weight:900">${e(cta?.headline ?? "")}</h2>
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <button class="var-cta-btn" style="padding:18px 48px;font-weight:900;font-size:17px;letter-spacing:.02em;text-transform:uppercase">
          ${e(cta?.buttonText ?? "Get Started")}
        </button>
        ${cta?.subtext ? `<span style="font-size:14px;color:var(--bg);opacity:.7">${e(cta.subtext)}</span>` : ""}
      </div>
    </div>
  </div>
</section>`
  }

  if (vc.ctaStyle === "minimal") {
    return `
<section style="padding:${vc.sectionPadding} max(40px,8vw);background:var(--bg)">
  <div style="max-width:900px;margin:0 auto">
    <div style="width:48px;height:1px;background:var(--p);margin-bottom:48px"></div>
    <div class="animate-fadeUp">
      <h2 class="var-section-title" style="font-size:clamp(32px,5vw,64px);color:var(--tx);margin-bottom:28px;letter-spacing:.04em">${e(cta?.headline ?? "")}</h2>
      <p style="font-size:clamp(14px,1.4vw,17px);color:var(--tm);margin-bottom:52px;max-width:480px;line-height:1.8;font-weight:300;letter-spacing:.02em">${e(cta?.subheadline ?? "")}</p>
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:12px;padding:16px 40px">
        ${e(cta?.buttonText ?? "Get Started")} ${icon("ArrowRight", c.primary)}
      </button>
      ${cta?.subtext ? `<p style="margin-top:16px;font-size:12px;color:var(--tm);letter-spacing:.06em;text-transform:uppercase">${e(cta.subtext)}</p>` : ""}
    </div>
  </div>
</section>`
  }

  if (vc.ctaStyle === "gradient") {
    return `
<section style="padding:${vc.sectionPadding} max(24px,5vw)">
  <div style="max-width:960px;margin:0 auto">
    <div class="animate-fadeUp var-card" style="position:relative;text-align:center;padding:clamp(64px,8vw,100px) clamp(32px,6vw,80px);overflow:hidden">
      <h2 style="position:relative;font-size:clamp(30px,5vw,60px);color:var(--tx);margin-bottom:20px;font-weight:900">${e(cta?.headline ?? "")}</h2>
      <p style="position:relative;font-size:18px;color:var(--tm);margin-bottom:44px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.65">${e(cta?.subheadline ?? "")}</p>
      <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:17px 48px;font-weight:700;font-size:17px;border-radius:16px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;box-shadow:0 0 60px var(--p)40">
        ${e(cta?.buttonText ?? "Get Started")} ${icon("ArrowRight", "#fff")}
      </button>
      ${cta?.subtext ? `<p style="position:relative;margin-top:18px;font-size:13px;color:var(--tm)">${e(cta.subtext)}</p>` : ""}
    </div>
  </div>
</section>`
  }

  return `
<section style="padding:${vc.sectionPadding} max(24px,5vw);background:var(--bg)">
  <div style="max-width:960px;margin:0 auto">
    <div class="animate-fadeUp" style="position:relative;text-align:center;padding:clamp(64px,8vw,100px) clamp(32px,6vw,80px);border-radius:32px;background:${isLight ? `linear-gradient(135deg, ${c.primary}08, ${c.secondary}08)` : `linear-gradient(135deg, ${c.primary}18, ${c.surface})`};border:1px solid ${c.primary}30;overflow:hidden">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:400px;height:2px;background:linear-gradient(90deg, transparent, ${c.primary}60, transparent)"></div>
      <div style="position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:240px;height:240px;background:${c.primary}12;border-radius:50%;filter:blur(60px);pointer-events:none"></div>
      <h2 style="position:relative;font-size:clamp(30px,5vw,60px);color:var(--tx);margin-bottom:20px">${e(cta?.headline ?? "")}</h2>
      <p style="position:relative;font-size:18px;color:var(--tm);margin-bottom:44px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.65">${e(cta?.subheadline ?? "")}</p>
      <div style="position:relative;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <button class="var-cta-btn" style="display:inline-flex;align-items:center;gap:8px;padding:17px 44px;border-radius:14px;background:var(--p);color:${isLight ? "#fff" : c.background};font-weight:700;font-size:17px;box-shadow:0 0 60px ${c.primary}45,0 4px 20px rgba(0,0,0,.25)">${e(cta?.buttonText ?? "Get Started")} ${icon("ArrowRight", isLight ? "#fff" : c.background)}</button>
      </div>
      ${cta?.subtext ? `<p style="position:relative;margin-top:18px;font-size:13px;color:var(--tm)">${e(cta.subtext)}</p>` : ""}
    </div>
  </div>
</section>`
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function faqHtml(faq: WebsiteOutput["sections"]["faq"], c: WebsiteOutput["colorPalette"], vc: VariantConfig): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const altBg = isLight ? "#f1f3f5" : (vc.glassCards ? "transparent" : "#040404")
  const items = (faq?.items ?? []).map((item, i) => `
  <details class="animate-fadeUp d${Math.min(i + 1, 5)}" style="border-radius:${vc.cornerRadius};border:${vc.brutalistBorders ? "3px solid var(--tx)" : `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "var(--br)"}`};overflow:hidden;transition:all .2s;background:${vc.glassCards ? "rgba(255,255,255,0.06)" : isLight ? "#fff" : c.surface}${vc.glassCards ? ";backdrop-filter:blur(16px)" : ""}" onmouseover="this.style.borderColor='${c.primary}'" onmouseout="this.style.borderColor='${vc.brutalistBorders ? "var(--tx)" : isLight ? "rgba(0,0,0,0.08)" : "var(--br)"}'">
    <summary style="padding:24px 28px;font-weight:600;font-size:16px;color:var(--tx);list-style:none;display:flex;justify-content:space-between;align-items:center;cursor:pointer;gap:16px;line-height:1.4">
      ${e(item.question)}
      <span style="color:var(--p);font-size:22px;flex-shrink:0;font-weight:300;line-height:1;transition:transform .2s">+</span>
    </summary>
    <div style="padding:0 28px 24px;font-size:15px;color:var(--tm);line-height:1.75;border-top:1px solid ${vc.brutalistBorders ? "var(--tx)" : isLight ? "rgba(0,0,0,0.06)" : "var(--br)"};padding-top:18px">${e(item.answer)}</div>
  </details>`).join("")
  return `
<section id="faq" style="padding:${vc.sectionPadding} max(24px,5vw);background:${altBg}">
  <div style="max-width:780px;margin:0 auto">
    <h2 class="animate-fadeUp var-section-title" style="text-align:center;font-size:clamp(30px,4vw,54px);color:var(--tx);margin-bottom:60px">${e(faq?.title ?? "FAQ")}</h2>
    <div style="display:flex;flex-direction:column;gap:${vc.brutalistBorders ? "0" : "12px"}">${items}</div>
  </div>
</section>`
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function footerHtml(footer: WebsiteOutput["sections"]["footer"], brand: WebsiteOutput["brand"], c: WebsiteOutput["colorPalette"], vc: VariantConfig): string {
  const isLight = c.background === "#ffffff" || c.background === "#fafafa" || c.background === "#f8f9fa"
  const cols = (footer?.columns ?? []).map(col => `
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--tx);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:18px">${e(col.title)}</div>
    ${(col.links ?? []).map(l => `<a href="#" style="display:block;font-size:14px;color:var(--tm);margin-bottom:12px;transition:color .2s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tm)'">${e(l)}</a>`).join("")}
  </div>`).join("")
  return `
<footer style="background:var(--bg);border-top:${vc.brutalistBorders ? "3px solid var(--tx)" : `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "var(--br)"}`};padding:clamp(56px,7vw,88px) max(24px,5vw) 36px">
  <div style="max-width:1200px;margin:0 auto">
    <div class="footer-grid" style="display:grid;grid-template-columns:1.8fr repeat(${Math.min((footer?.columns ?? []).length, 3)},1fr);gap:48px;margin-bottom:56px">
      <div>
        <div style="font-family:var(--hf);font-size:19px;font-weight:900;color:var(--tx);margin-bottom:14px;letter-spacing:-.5px">${e(brand?.name ?? "")}</div>
        <p style="font-size:14px;color:var(--tm);line-height:1.7;max-width:230px">${e(footer?.tagline ?? brand?.tagline ?? "")}</p>
      </div>
      ${cols}
    </div>
    <div style="border-top:1px solid ${isLight ? "rgba(0,0,0,0.07)" : "var(--br)"};padding-top:28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <span style="font-size:13px;color:var(--tm)">${e(footer?.legal ?? `© ${new Date().getFullYear()} ${brand?.name}. All rights reserved.`)}</span>
      <div style="display:flex;gap:20px">
        <a href="#" style="font-size:13px;color:var(--tm);transition:color .2s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tm)'">Privacy</a>
        <a href="#" style="font-size:13px;color:var(--tm);transition:color .2s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tm)'">Terms</a>
      </div>
    </div>
  </div>
</footer>`
}

// ─── Main HTML Builder ─────────────────────────────────────────────────────────
export function buildPreviewHtml(data: WebsiteOutput): string {
  const c = data.colorPalette ?? {
    primary: "#d4af37", secondary: "#1a1a1a", accent: "#d4af37",
    background: "#0a0a0a", surface: "#111111", text: "#ffffff", textMuted: "#888888", border: "#1f1f1f"
  }
  const t = data.typography ?? { headingFont: "Inter", bodyFont: "Inter", headingWeight: "800", headingStyle: "tight" }
  const s = data.sections ?? {} as WebsiteOutput["sections"]
  const brand = data.brand ?? { name: "Brand", tagline: "", voice: "professional" }
  const style = data.design?.style ?? "SaaS"
  const variant = data.designVariant ?? "Premium SaaS"
  const industry = (data as unknown as { _industry?: string })._industry ?? style
  const variantSeed = (data as unknown as { _variantSeed?: number })._variantSeed ?? 0
  const heroImage = (data as unknown as { _heroImage?: string })._heroImage ?? null
  const vc = getVariantConfig(variant)

  const headingFontName = vc.seriffHeadings
    ? (t.headingFont.toLowerCase().includes("cormorant") || t.headingFont.toLowerCase().includes("playfair")
        ? t.headingFont
        : "Cormorant Garamond")
    : t.headingFont

  const fonts = `https://fonts.googleapis.com/css2?family=${f(headingFontName)}&family=${f(t.bodyFont)}&display=swap`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fonts}" rel="stylesheet">
<link rel="preconnect" href="https://images.unsplash.com">
<title>${e(data.seoMeta?.title ?? brand.name)}</title>
<meta name="description" content="${e(data.seoMeta?.description ?? "")}">
<style>
${baseCss({ ...c, background: c.background }, { ...t, headingFont: headingFontName })}
${vc.extraCss}
</style>
</head>
<body>
${navHtml(s.nav, c, brand, vc)}
${heroHtml(s.hero, c, style, brand.name, vc, variant, industry, variantSeed, heroImage)}
${howItWorksHtml(s.howItWorks, c)}
${featuresHtml(s.features, c, vc)}
${testimonialsHtml(s.testimonials, c, vc)}
${pricingHtml(s.pricing, c, vc)}
${ctaHtml(s.cta, c, vc)}
${faqHtml(s.faq, c, vc)}
${footerHtml(s.footer, brand, c, vc)}
<script>
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0) translateX(0)'; } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.animate-fadeUp,.animate-slideRight').forEach(el => {
  el.style.opacity='0';
  el.style.transform=el.classList.contains('animate-slideRight') ? 'translateX(32px)' : 'translateY(28px)';
  el.style.transition='opacity .65s ease, transform .65s ease';
  const delay = el.classList.contains('d1') ? '0.1s' : el.classList.contains('d2') ? '0.2s' : el.classList.contains('d3') ? '0.3s' : el.classList.contains('d4') ? '0.4s' : el.classList.contains('d5') ? '0.5s' : el.classList.contains('d6') ? '0.6s' : el.classList.contains('d7') ? '0.7s' : '0.1s';
  el.style.transitionDelay=delay;
  obs.observe(el);
});
document.querySelectorAll('details').forEach(d => {
  d.addEventListener('toggle', () => {
    const plus = d.querySelector('summary span');
    if(plus) plus.textContent = d.open ? '−' : '+';
  });
});
</script>
</body>
</html>`
}

export function buildNextjsProject(data: WebsiteOutput): Record<string, string> {
  const c = data.colorPalette
  const brand = data.brand ?? { name: "My App", tagline: "", voice: "professional" }
  const code = data.componentCode ?? {}
  const slug = (brand.name ?? "my-app").toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return {
    "package.json": JSON.stringify({ name: slug, version: "0.1.0", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "14.2.0", react: "^18", "react-dom": "^18" }, devDependencies: { "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18", typescript: "^5", tailwindcss: "^3", autoprefixer: "^10", postcss: "^8" } }, null, 2),
    "tailwind.config.ts": `import type { Config } from 'tailwindcss'\nconst config: Config = {\n  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],\n  theme: { extend: { colors: { primary: '${c?.primary}', bg: '${c?.background}', surface: '${c?.surface}', muted: '${c?.textMuted}' }, fontFamily: { heading: ['${data.typography?.headingFont}', 'sans-serif'], body: ['${data.typography?.bodyFont}', 'sans-serif'] } } },\n  plugins: []\n}\nexport default config`,
    "postcss.config.js": `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    "app/globals.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { font-family: '${data.typography?.bodyFont}', system-ui, sans-serif; background: ${c?.background}; color: ${c?.text}; -webkit-font-smoothing: antialiased; }`,
    "app/layout.tsx": `import type { Metadata } from 'next'\nimport './globals.css'\nexport const metadata: Metadata = { title: '${(data.seoMeta?.title ?? brand.name).replace(/'/g, "\\'")}', description: '${(data.seoMeta?.description ?? "").replace(/'/g, "\\'")}' }\nexport default function RootLayout({ children }: { children: React.ReactNode }) { return (<html lang="en"><body>{children}</body></html>) }`,
    "app/page.tsx": `import { Nav } from '@/components/Nav'\nimport { Hero } from '@/components/Hero'\nimport { Features } from '@/components/Features'\nimport { Testimonials } from '@/components/Testimonials'\nimport { Pricing } from '@/components/Pricing'\nimport { CTA } from '@/components/CTA'\nimport { FAQ } from '@/components/FAQ'\nimport { Footer } from '@/components/Footer'\nexport default function Home() { return (<main><Nav /><Hero /><Features /><Testimonials /><Pricing /><CTA /><FAQ /><Footer /></main>) }`,
    "components/Hero.tsx": code.hero ?? "export function Hero() { return <section>Hero</section> }",
    "components/Features.tsx": code.features ?? "export function Features() { return <section>Features</section> }",
    "components/Testimonials.tsx": code.testimonials ?? "export function Testimonials() { return <section>Testimonials</section> }",
    "components/Pricing.tsx": code.pricing ?? "export function Pricing() { return <section>Pricing</section> }",
    "components/CTA.tsx": code.cta ?? "export function CTA() { return <section>CTA</section> }",
    "components/FAQ.tsx": code.faq ?? "export function FAQ() { return <section>FAQ</section> }",
    "components/Footer.tsx": code.footer ?? "export function Footer() { return <footer>Footer</footer> }",
    "components/Nav.tsx": `'use client'\nexport function Nav() { return (<nav className="sticky top-0 z-50 border-b backdrop-blur-xl bg-[${c?.background}]/80 px-6"><div className="max-w-6xl mx-auto h-16 flex items-center justify-between"><span className="text-xl font-black">${e(brand.name)}</span><button className="px-5 py-2 rounded-lg font-semibold text-sm" style={{background:'${c?.primary}'}}>Get Started</button></div></nav>) }`,
    "README.md": `# ${brand.name}\n\n${brand.tagline}\n\nGenerated by STAGEONE AI Website Builder.\n\nDesign Variant: ${data.designVariant ?? "Premium SaaS"}\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``,
  }
}
