// ─── STAGEONE Website HTML Generator — v2 ────────────────────────────────────
// Produces modern, stunning websites that look like Linear/Vercel/Stripe tier.
// Class-based CSS (not inline style soup), gradient orbs, bento grids,
// animated counters, FAQ accordion, mobile menu, scroll reveal.

export interface WebsiteOutput {
  colorPalette: {
    primary: string; secondary: string; accent: string; background: string;
    surface: string; text: string; textMuted: string; border: string;
  }
  typography: {
    headingFont: string; bodyFont: string;
    headingStyle?: string; headingWeight?: string; bodySize?: string
  }
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
  componentCode?: Record<string, string>
  htmlCode?: string
  websiteStrategy?: {
    conversionApproach: string; sectionOrderRationale: string; trustSignals: string[];
    ctaStrategy: string; audiencePsychology: string; industryOptimizations: string[]; conversionFunnel: string;
  }
  _heroImage?: string
  _industry?: string
  _variantSeed?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function isLight(hex: string): boolean {
  const c = (hex ?? "#000").replace("#", "")
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) > 145
}

function hexA(hex: string, alpha: number): string {
  const c = (hex ?? "#7c3aed").replace("#", "")
  if (c.length < 6) return `rgba(100,100,100,${alpha})`
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function gf(name: string): string {
  return (name || "Inter").replace(/ /g, "+") + ":ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700"
}

// ─── SVG Icon library ──────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m0 16v1M4.22 4.22l.7.7m14.14 14.14.7.7M3 12H2m20 0h-1M4.22 19.78l.7-.7M19.07 4.93l.7-.7"/><circle cx="12" cy="12" r="3"/></svg>`,
  barchart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7v0A2.5 2.5 0 012 9.5v5A2.5 2.5 0 004.5 17v0A2.5 2.5 0 007 19.5v0A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7v0A2.5 2.5 0 0017 4.5v0A2.5 2.5 0 0014.5 2z"/></svg>`,
  trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
}

function ico(name: string, size = 20): string {
  const key = name.toLowerCase().replace(/[^a-z]/g, "")
  const svg = ICONS[key] ?? ICONS["sparkles"]
  return svg.replace("<svg ", `<svg width="${size}" height="${size}" `)
}

// ─── Unsplash image helpers ────────────────────────────────────────────────────

const HERO_IMAGES: Record<string, string[]> = {
  Cybersecurity: ["photo-1550751827-4bd374c3f58b", "photo-1558618666-fcd25c85cd64", "photo-1526374965328-7f61d4dc18c5"],
  Fintech: ["photo-1611974789855-9c2a0a7236a3", "photo-1551288049-bebda4e38f71", "photo-1460925895917-afdab827c52f"],
  SaaS: ["photo-1498050108023-c5249f4df085", "photo-1573164713988-8665fc963095", "photo-1551434678-e076c223a692"],
  Healthcare: ["photo-1576091160550-2173dba999ef", "photo-1579684385127-1ef15d508118", "photo-1559839734-2b71ea197ec2"],
  Education: ["photo-1522202176988-66273c2fd55f", "photo-1434030216411-0b793f4b6f69", "photo-1501504905252-473c47e087f8"],
  Marketplace: ["photo-1556742049-0cfed4f6a45d", "photo-1607082348824-0a96f2a4b9da", "photo-1472851156868-0b8a07c9c6b7"],
  Agency: ["photo-1561070791-2526d30994b5", "photo-1600880292089-90a7e086ee0c", "photo-1552664730-d307ca884978"],
  Luxury: ["photo-1547555999-14e818e09e33", "photo-1600185365926-3a2ce3cdb9eb", "photo-1506905925346-21bda4d32df4"],
  "E-commerce": ["photo-1607082348824-0a96f2a4b9da", "photo-1585386959984-a4155224a1ad", "photo-1472851156868-0b8a07c9c6b7"],
  "Creator Economy": ["photo-1611162617213-7d7a39e9b1d7", "photo-1598550476439-6847785fcea6", "photo-1516321165247-4aa89a48be4d"],
}

const FALLBACK_IMAGES = ["photo-1573164713988-8665fc963095", "photo-1498050108023-c5249f4df085", "photo-1542744173-05336fcc7ad4"]

const AVATARS = [
  "photo-1494790108755-2616b612b786", "photo-1472099645785-5658abf4ff4e",
  "photo-1438761681033-6461ffad8d80", "photo-1507003211169-0a1dd7228f2d",
  "photo-1573496359142-b8d87734a5a2", "photo-1500648767791-00dcc994a43e",
]

function heroImg(industry: string, seed: string): string {
  const list = HERO_IMAGES[industry] ?? FALLBACK_IMAGES
  const h = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0))
  return `https://images.unsplash.com/${list[h % list.length]}?w=1400&q=85&fit=crop&auto=format`
}

function avatarImg(i: number): string {
  return `https://images.unsplash.com/${AVATARS[i % AVATARS.length]}?w=120&h=120&fit=crop&q=80`
}

// ─── CSS Generator ─────────────────────────────────────────────────────────────

function buildCss(w: WebsiteOutput): string {
  const c = w.colorPalette
  const t = w.typography
  const dv = w.designVariant ?? "Clean Pro"
  const light = isLight(c.background)
  const p = c.primary
  const isGlass = dv === "Glassmorphism"
  const isLux = dv === "Luxury Editorial" || dv === "Cinematic Dark"
  const isBrutalist = dv === "Bold Brutalist"
  const hw = t.headingWeight ?? "800"

  const bodyBg = isGlass
    ? "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)"
    : c.background

  const radius = isBrutalist ? "0px" : isLux ? "4px" : "14px"
  const radiusSm = isBrutalist ? "0px" : isLux ? "2px" : "8px"
  const radiusLg = isBrutalist ? "0px" : isLux ? "6px" : "24px"

  return `
@import url('https://fonts.googleapis.com/css2?family=${gf(t.headingFont)}&family=${gf(t.bodyFont)}&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;font-size:16px;-webkit-text-size-adjust:100%}
body{
  font-family:'${t.bodyFont}',system-ui,-apple-system,sans-serif;
  background:${bodyBg};${isGlass ? "background-attachment:fixed;min-height:100vh;" : ""}
  color:${c.text};
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  overflow-x:hidden;line-height:1.65;
}
h1,h2,h3,h4,h5,h6{
  font-family:'${t.headingFont}',system-ui,sans-serif;
  font-weight:${hw};
  letter-spacing:${isLux ? "0.06em" : isBrutalist ? "-0.01em" : "-0.03em"};
  line-height:1.08;color:${c.text};
  ${isLux ? "font-style:italic;" : ""}
}
a{text-decoration:none;color:inherit;transition:opacity .2s}
a:hover{opacity:.8}
ul,ol{list-style:none}
img{max-width:100%;display:block}
button{font-family:inherit;cursor:pointer;border:none;outline:none}
input{font-family:inherit}

:root{
  --p:${p};
  --s:${c.secondary};
  --a:${c.accent};
  --bg:${c.background};
  --sf:${c.surface};
  --tx:${c.text};
  --tm:${c.textMuted};
  --br:${c.border};
  --radius:${radius};
  --radius-sm:${radiusSm};
  --radius-lg:${radiusLg};
  --shadow-sm:0 1px 3px rgba(0,0,0,${light ? ".07" : ".2"}),0 2px 8px rgba(0,0,0,${light ? ".04" : ".14"});
  --shadow:0 4px 16px rgba(0,0,0,${light ? ".08" : ".28"}),0 8px 32px rgba(0,0,0,${light ? ".05" : ".2"});
  --shadow-lg:0 8px 40px rgba(0,0,0,${light ? ".1" : ".38"}),0 20px 64px rgba(0,0,0,${light ? ".07" : ".28"});
  --ease:cubic-bezier(.4,0,.2,1);
}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.container{max-width:1200px;margin:0 auto;padding:0 clamp(20px,4vw,52px)}
.section{padding:clamp(72px,10vw,128px) 0;position:relative;overflow:hidden}
.section-alt{background:${light ? "rgba(0,0,0,.025)" : "rgba(255,255,255,.025)"}}

/* ── Section Header ─────────────────────────────────────────────────────── */
.sh{margin-bottom:clamp(48px,7vw,80px)}
.sh.center{text-align:center}
.sh.center .sh-title,.sh.center .sh-sub{margin-inline:auto}
.sh-eyebrow{
  display:inline-flex;align-items:center;gap:8px;
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:${p};margin-bottom:14px;
}
.sh-eyebrow::before{content:'';display:block;width:20px;height:2px;background:${p};border-radius:2px}
.sh.center .sh-eyebrow::before{display:none}
.sh.center .sh-eyebrow{justify-content:center}
.sh-title{font-size:clamp(28px,4.2vw,54px);margin-bottom:16px;max-width:640px}
.sh-sub{font-size:clamp(15px,1.6vw,18px);color:${c.textMuted};max-width:540px;line-height:1.78}

/* ── Gradient text ──────────────────────────────────────────────────────── */
.grad{background:linear-gradient(135deg,${p} 0%,${c.accent} 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.btn{
  display:inline-flex;align-items:center;gap:8px;
  padding:13px 26px;border-radius:var(--radius-sm);
  font-size:15px;font-weight:700;letter-spacing:-.01em;
  transition:all .22s var(--ease);cursor:pointer;white-space:nowrap;
}
.btn-primary{
  background:${p};color:${light ? "#fff" : c.background};
  box-shadow:0 4px 20px ${hexA(p, .35)};
}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px ${hexA(p, .5)}}
.btn-ghost{
  background:transparent;color:${c.text};
  border:1.5px solid ${light ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.14)"};
}
.btn-ghost:hover{border-color:${p};color:${p}}

/* ── Badge ──────────────────────────────────────────────────────────────── */
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 14px;border-radius:100px;
  font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  background:${hexA(p, .13)};border:1px solid ${hexA(p, .3)};color:${p};
}
.badge-dot{width:6px;height:6px;border-radius:50%;background:${p};animation:pulse-dot 2s infinite}

/* ── Cards ──────────────────────────────────────────────────────────────── */
.card{
  background:${light ? "#fff" : c.surface};
  border:1px solid ${light ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.07)"};
  border-radius:var(--radius);box-shadow:var(--shadow-sm);
  transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease);
  overflow:hidden;
}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow);border-color:${hexA(p, .25)}}
${isGlass ? `.card{background:rgba(255,255,255,.07);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.12)}.card:hover{background:rgba(255,255,255,.11)}` : ""}
${isBrutalist ? `.card{border:2.5px solid ${c.text};box-shadow:5px 5px 0 ${p}}.card:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 ${p}}` : ""}

/* ── Navigation ─────────────────────────────────────────────────────────── */
.nav{
  position:sticky;top:0;z-index:100;
  padding:0 clamp(20px,4vw,52px);
  background:${isGlass ? "rgba(15,12,41,.78)" : light ? "rgba(255,255,255,.9)" : `${c.background}e8`};
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid ${light ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.07)"};
  transition:box-shadow .3s;
}
.nav.scrolled{box-shadow:0 4px 24px rgba(0,0,0,.12)}
.nav-inner{max-width:1200px;margin:0 auto;height:64px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.nav-logo{font-family:'${t.headingFont}',sans-serif;font-size:19px;font-weight:900;letter-spacing:-.04em;color:${c.text};flex-shrink:0;${isLux ? "font-size:13px;letter-spacing:.14em;text-transform:uppercase;" : ""}}
.nav-links{display:flex;align-items:center;gap:26px;flex:1;justify-content:center}
.nav-links a{font-size:14px;font-weight:500;color:${c.textMuted};transition:color .2s;white-space:nowrap}
.nav-links a:hover{color:${c.text};opacity:1}
.nav-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
.nav-login{font-size:14px;font-weight:500;color:${c.textMuted}}
.nav-hamburger{display:none;width:38px;height:38px;align-items:center;justify-content:center;border-radius:var(--radius-sm);color:${c.text};background:transparent}
.mob-menu{
  display:none;position:fixed;top:64px;inset-x:0;z-index:99;
  background:${light ? "#fff" : c.surface};
  border-bottom:1px solid ${c.border};
  padding:20px clamp(20px,4vw,52px);
  flex-direction:column;gap:0;
}
.mob-menu.open{display:flex}
.mob-menu a{font-size:15px;font-weight:600;color:${c.text};padding:12px 0;border-bottom:1px solid ${light ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.06)"};}
.mob-cta{margin-top:16px}

/* ── Hero ───────────────────────────────────────────────────────────────── */
.hero{padding:clamp(96px,12vw,168px) 0 clamp(80px,10vw,128px);position:relative;overflow:hidden}
.hero-inner{max-width:1200px;margin:0 auto;padding:0 clamp(20px,4vw,52px);position:relative;z-index:2}
.hero-badge{margin-bottom:28px}
.hero-headline{font-size:clamp(42px,7vw,88px);line-height:1.02;margin-bottom:22px;${isBrutalist ? "font-size:clamp(52px,9vw,108px);" : ""}}
.hero-sub{font-size:clamp(16px,1.8vw,20px);color:${c.textMuted};line-height:1.78;margin-bottom:40px;max-width:520px}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:56px}
.hero-stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
  gap:24px;padding-top:40px;
  border-top:1px solid ${light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.08)"};
  max-width:580px;
}
.stat-val{font-family:'${t.headingFont}',sans-serif;font-size:clamp(28px,3.5vw,44px);font-weight:900;color:${p};line-height:1;margin-bottom:5px}
.stat-lbl{font-size:13px;color:${c.textMuted};font-weight:500}
.hero-trusted{margin-top:36px}
.trust-label{font-size:11px;font-weight:700;color:${c.textMuted};text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
.trust-logos{display:flex;flex-wrap:wrap;gap:20px;align-items:center}
.trust-name{font-family:'${t.headingFont}',sans-serif;font-size:15px;font-weight:800;color:${light ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.18)"};letter-spacing:-.02em;transition:color .2s}
.trust-name:hover{color:${light ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.45)"}}

/* Hero split layout */
.hero-split{display:grid;grid-template-columns:55% 45%;gap:clamp(40px,6vw,80px);align-items:center}
.hero-img{position:relative;border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);border:1px solid ${light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.08)"}}
.hero-img img{width:100%;aspect-ratio:4/3;object-fit:cover}
.hero-img-badge{
  position:absolute;bottom:20px;left:20px;
  background:${light ? "rgba(255,255,255,.95)" : `${c.surface}f0`};
  backdrop-filter:blur(12px);border:1px solid ${light ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.1)"};
  border-radius:var(--radius-sm);padding:12px 16px;box-shadow:var(--shadow);
}
.hib-val{font-size:20px;font-weight:900;color:${p};line-height:1}
.hib-lbl{font-size:11px;color:${c.textMuted};margin-top:3px}

/* Background orbs */
.orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;opacity:${light ? ".2" : ".3"}}
.orb-1{width:clamp(260px,38vw,560px);height:clamp(260px,38vw,560px);background:${p};top:-18%;right:-8%;animation:orb 13s ease-in-out infinite}
.orb-2{width:clamp(180px,28vw,380px);height:clamp(180px,28vw,380px);background:${c.accent};bottom:-12%;left:4%;animation:orb 18s ease-in-out infinite reverse}
.orb-3{width:clamp(140px,18vw,260px);height:clamp(140px,18vw,260px);background:${c.secondary};top:38%;left:36%;animation:orb 22s ease-in-out infinite;opacity:${light ? ".12" : ".18"}}

/* ── Trust Bar ──────────────────────────────────────────────────────────── */
.trust-bar{
  padding:clamp(28px,4vw,52px) 0;
  background:${light ? "rgba(0,0,0,.02)" : "rgba(255,255,255,.02)"};
  border-block:1px solid ${light ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.06)"};
}
.trust-bar-inner{max-width:1200px;margin:0 auto;padding:0 clamp(20px,4vw,52px)}
.trust-bar-label{text-align:center;font-size:11px;font-weight:700;color:${c.textMuted};text-transform:uppercase;letter-spacing:.1em;margin-bottom:22px}
.trust-bar-logos{display:flex;flex-wrap:wrap;gap:28px;justify-content:center;align-items:center}

/* ── Features Bento ─────────────────────────────────────────────────────── */
.bento{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.bento-card{padding:clamp(22px,3vw,36px)}
.bento-card:nth-child(1){grid-column:span 7}
.bento-card:nth-child(2){grid-column:span 5}
.bento-card:nth-child(3){grid-column:span 4}
.bento-card:nth-child(4){grid-column:span 4}
.bento-card:nth-child(5){grid-column:span 4}
.bento-card:nth-child(6){grid-column:span 6}
.bento-card:nth-child(7){grid-column:span 6}
.bento-card:nth-child(n+8){grid-column:span 4}
.feat-icon{
  width:44px;height:44px;border-radius:var(--radius-sm);
  background:${hexA(p, .12)};border:1px solid ${hexA(p, .2)};
  display:flex;align-items:center;justify-content:center;
  color:${p};margin-bottom:18px;flex-shrink:0;
}
.feat-title{font-size:clamp(16px,1.4vw,20px);margin-bottom:10px}
.feat-desc{font-size:14px;color:${c.textMuted};line-height:1.72}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}

/* ── How It Works ───────────────────────────────────────────────────────── */
.how-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:clamp(24px,4vw,48px)}
.how-step{position:relative}
.how-step:not(:last-child)::after{
  content:'';position:absolute;top:22px;left:52px;right:-24px;
  height:1px;background:linear-gradient(90deg,${hexA(p, .35)},transparent);
}
.how-num{
  width:44px;height:44px;border-radius:50%;
  background:${p};color:${light ? "#fff" : c.background};
  display:flex;align-items:center;justify-content:center;
  font-family:'${t.headingFont}',sans-serif;font-size:15px;font-weight:900;
  flex-shrink:0;margin-bottom:18px;box-shadow:0 4px 16px ${hexA(p, .35)};
}
.how-title{font-size:17px;margin-bottom:8px}
.how-desc{font-size:14px;color:${c.textMuted};line-height:1.7}

/* ── Testimonials ───────────────────────────────────────────────────────── */
.testi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.testi-card{padding:clamp(22px,3vw,34px);display:flex;flex-direction:column;gap:18px}
.testi-stars{display:flex;gap:2px;color:#f59e0b}
.testi-metric{font-size:clamp(26px,3vw,38px);font-weight:900;font-family:'${t.headingFont}',sans-serif;color:${p};line-height:1}
.testi-quote{font-size:15px;color:${c.text};line-height:1.78;font-style:italic;flex:1}
.testi-author{display:flex;align-items:center;gap:12px;margin-top:auto}
.testi-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover}
.testi-name{font-size:14px;font-weight:700;color:${c.text}}
.testi-role{font-size:12px;color:${c.textMuted};margin-top:2px}

/* ── Pricing ────────────────────────────────────────────────────────────── */
.price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;align-items:start}
.price-card{padding:clamp(26px,3vw,40px)}
.price-card.hi{
  background:${p};color:${light ? "#fff" : c.background};
  border-color:transparent;box-shadow:0 8px 40px ${hexA(p, .45)};
  transform:scale(1.03);
}
.price-card.hi .pc-name,.price-card.hi .pc-price{color:${light ? "#fff" : c.background}}
.price-card.hi .pc-desc,.price-card.hi .pc-feat-lbl{color:${light ? "rgba(255,255,255,.8)" : "rgba(0,0,0,.7)"}}
.price-card.hi .pc-feat-ico{color:${light ? "#fff" : c.background}}
.pc-badge{display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px;background:${hexA(p, .15)};color:${p};letter-spacing:.05em;text-transform:uppercase;margin-bottom:14px}
.price-card.hi .pc-badge{background:rgba(255,255,255,.2);color:inherit}
.pc-name{font-size:13px;font-weight:700;color:${c.textMuted};text-transform:uppercase;letter-spacing:.09em;margin-bottom:8px}
.pc-price{font-family:'${t.headingFont}',sans-serif;font-size:clamp(36px,4vw,54px);font-weight:900;color:${c.text};line-height:1;margin-bottom:5px}
.pc-period{font-size:14px;color:${c.textMuted};margin-bottom:14px}
.pc-desc{font-size:14px;color:${c.textMuted};line-height:1.65;margin-bottom:26px}
.pc-div{height:1px;background:${light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.08)"};margin-bottom:22px}
.pc-feats{display:flex;flex-direction:column;gap:11px;margin-bottom:26px}
.pc-feat{display:flex;align-items:flex-start;gap:10px}
.pc-feat-ico{width:17px;height:17px;flex-shrink:0;color:${p};margin-top:1px}
.pc-feat-lbl{font-size:14px;color:${c.text};line-height:1.5}
.pc-cta{width:100%;justify-content:center}
.price-card.hi .btn-primary{background:${light ? "rgba(255,255,255,.95)" : "rgba(0,0,0,.88)"};color:${p}}
.price-card.hi .btn-ghost{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.28);color:inherit}

/* ── FAQ ────────────────────────────────────────────────────────────────── */
.faq-wrap{max-width:760px;margin:0 auto}
.faq-item{border-bottom:1px solid ${light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.08)"}}
.faq-q{
  width:100%;display:flex;align-items:center;justify-content:space-between;
  padding:20px 0;gap:16px;background:transparent;cursor:pointer;
  font-size:16px;font-weight:600;color:${c.text};text-align:left;
  transition:color .2s;
}
.faq-q:hover{color:${p}}
.faq-ico{flex-shrink:0;width:22px;height:22px;color:${p};transition:transform .35s var(--ease)}
.faq-item.open .faq-ico{transform:rotate(45deg)}
.faq-a{max-height:0;overflow:hidden;font-size:15px;color:${c.textMuted};line-height:1.78;transition:max-height .4s var(--ease),padding-bottom .3s}
.faq-item.open .faq-a{max-height:400px;padding-bottom:20px}

/* ── CTA ────────────────────────────────────────────────────────────────── */
.cta-sec{
  padding:clamp(80px,10vw,128px) 0;
  background:${light ? `linear-gradient(135deg,${hexA(p, .06)},${hexA(c.accent, .05)})` : `linear-gradient(135deg,${hexA(p, .14)},${hexA(c.accent, .09)})`};
  border-top:1px solid ${hexA(p, .14)};
}
.cta-inner{max-width:700px;margin:0 auto;padding:0 clamp(20px,4vw,52px);text-align:center}
.cta-hl{font-size:clamp(32px,5.5vw,64px);margin-bottom:18px}
.cta-sub{font-size:clamp(15px,1.6vw,18px);color:${c.textMuted};margin-bottom:40px;line-height:1.75}
.cta-acts{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.cta-sub2{margin-top:18px;font-size:13px;color:${c.textMuted}}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.footer{
  background:${light ? "rgba(0,0,0,.025)" : "rgba(0,0,0,.45)"};
  border-top:1px solid ${light ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.07)"};
  padding:clamp(56px,8vw,100px) 0 clamp(32px,4vw,52px);
}
.footer-inner{max-width:1200px;margin:0 auto;padding:0 clamp(20px,4vw,52px)}
.footer-grid{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:40px;margin-bottom:52px}
.footer-brand{font-family:'${t.headingFont}',sans-serif;font-size:19px;font-weight:900;letter-spacing:-.03em;color:${c.text};margin-bottom:12px}
.footer-desc{font-size:14px;color:${c.textMuted};line-height:1.7;max-width:210px}
.footer-col-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${c.text};margin-bottom:14px}
.footer-links{display:flex;flex-direction:column;gap:9px}
.footer-links a{font-size:14px;color:${c.textMuted};transition:color .2s}
.footer-links a:hover{color:${c.text};opacity:1}
.footer-bottom{padding-top:28px;border-top:1px solid ${light ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.07)"};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.footer-legal{font-size:13px;color:${c.textMuted}}

/* ── Animations ─────────────────────────────────────────────────────────── */
@keyframes orb{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,-18px) scale(1.05)}66%{transform:translate(-18px,28px) scale(.97)}}
@keyframes pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.7}}
@keyframes fade-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}

/* ── Scroll Reveal ──────────────────────────────────────────────────────── */
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .62s var(--ease),transform .62s var(--ease)}
[data-reveal].vis{opacity:1;transform:translateY(0)}
[data-reveal][data-d="1"]{transition-delay:.1s}
[data-reveal][data-d="2"]{transition-delay:.2s}
[data-reveal][data-d="3"]{transition-delay:.3s}
[data-reveal][data-d="4"]{transition-delay:.4s}
[data-reveal][data-d="5"]{transition-delay:.5s}

${!light && !isGlass ? `
body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")}
` : ""}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media(max-width:900px){
  .hero-split{grid-template-columns:1fr}
  .hero-img{display:none}
  .bento{grid-template-columns:1fr 1fr}
  .bento-card:nth-child(n){grid-column:span 1}
  .bento-card:nth-child(1){grid-column:span 2}
  .footer-grid{grid-template-columns:1fr 1fr}
  .how-step:not(:last-child)::after{display:none}
}
@media(max-width:640px){
  .nav-links{display:none}
  .nav-actions .btn,.nav-login{display:none}
  .nav-hamburger{display:flex}
  .bento{grid-template-columns:1fr}
  .bento-card:nth-child(n){grid-column:span 1}
  .price-card.hi{transform:none}
  .footer-grid{grid-template-columns:1fr}
  .testi-grid{grid-template-columns:1fr}
  .hero-stats{grid-template-columns:1fr 1fr}
  .cta-acts{flex-direction:column;align-items:center}
  .footer-bottom{flex-direction:column;text-align:center}
}
`
}

// ─── Section Builders ──────────────────────────────────────────────────────────

function nav(w: WebsiteOutput): string {
  const { sections: s, brand, colorPalette: c, designVariant: dv = "Clean Pro" } = w
  const isLux = dv === "Luxury Editorial" || dv === "Cinematic Dark"
  const links = (s.nav?.links ?? []).slice(0, 5).map(l => `<a href="#">${esc(l)}</a>`).join("")

  const rightCta = isLux
    ? `<a href="#" style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${c.primary}">Enquire</a>`
    : `<a href="#" class="nav-login">Log in</a>
       <button class="btn btn-primary" style="padding:9px 20px;font-size:13px" onclick="document.querySelector('.hero')?.scrollIntoView({behavior:'smooth'})">Get Started</button>`

  return `<nav class="nav" id="nav">
  <div class="nav-inner">
    <div class="nav-logo">${esc(s.nav?.logo || brand.name)}</div>
    <div class="nav-links">${links}</div>
    <div class="nav-actions">${rightCta}</div>
    <button class="nav-hamburger" onclick="toggleMob()" id="ham" aria-label="Menu">${ico("menu", 22)}</button>
  </div>
</nav>
<div class="mob-menu" id="mob">
  ${links}
  <div class="mob-cta"><button class="btn btn-primary" style="width:100%;justify-content:center">Get Started</button></div>
</div>`
}

function hero(w: WebsiteOutput): string {
  const { sections: s, brand, colorPalette: c, designVariant: dv = "Clean Pro", _heroImage, _industry = "SaaS" } = w
  const h = s.hero
  const imgUrl = _heroImage || heroImg(_industry, brand.name)
  const useSplit = ["Premium SaaS", "Enterprise Minimal", "Clean Pro"].includes(dv) && (h.stats?.length ?? 0) > 0

  const badge = h.badge
    ? `<div class="hero-badge" data-reveal><span class="badge"><span class="badge-dot"></span>${esc(h.badge)}</span></div>`
    : ""

  const hl = `<h1 class="hero-headline" data-reveal data-d="1">${esc(h.headline)}</h1>`
  const sub = `<p class="hero-sub" data-reveal data-d="2">${esc(h.subheadline)}</p>`

  const btnColor = isLight(c.background) ? "#fff" : c.background
  const acts = `<div class="hero-actions" data-reveal data-d="3">
    <button class="btn btn-primary">${esc(h.ctaPrimary || "Get Started")} ${ico("arrow", 15)}</button>
    ${h.ctaSecondary ? `<button class="btn btn-ghost">${ico("play", 13)} ${esc(h.ctaSecondary)}</button>` : ""}
  </div>`

  const stats = (h.stats?.length ?? 0) > 0 ? `<div class="hero-stats" data-reveal data-d="4">
    ${(h.stats ?? []).map(st => `<div><div class="stat-val" data-counter="${esc(st.value)}">${esc(st.value)}</div><div class="stat-lbl">${esc(st.label)}</div></div>`).join("")}
  </div>` : ""

  const trusted = (h.trustedBy?.length ?? 0) > 0 ? `<div class="hero-trusted" data-reveal data-d="5">
    <div class="trust-label">Trusted by teams at</div>
    <div class="trust-logos">${(h.trustedBy ?? []).map(n => `<span class="trust-name">${esc(n)}</span>`).join("")}</div>
  </div>` : ""

  const orbs = `<div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>`
  const content = `${badge}${hl}${sub}${acts}${stats}${trusted}`

  if (useSplit) {
    const first = h.stats![0]
    return `<section class="hero">
  ${orbs}
  <div class="hero-inner">
    <div class="hero-split">
      <div>${content}</div>
      <div class="hero-img" data-reveal data-d="2">
        <img src="${imgUrl}" alt="${esc(brand.name)}" loading="eager" onerror="this.style.display='none'"/>
        ${first ? `<div class="hero-img-badge"><div class="hib-val">${esc(first.value)}</div><div class="hib-lbl">${esc(first.label)}</div></div>` : ""}
      </div>
    </div>
  </div>
</section>`
  }

  return `<section class="hero">
  ${orbs}
  <div class="hero-inner">${content}</div>
</section>`
}

function trustBar(w: WebsiteOutput): string {
  const logos = w.sections.hero?.trustedBy ?? []
  if (logos.length === 0) return ""
  return `<div class="trust-bar">
  <div class="trust-bar-inner">
    <div class="trust-bar-label">Trusted by industry leaders</div>
    <div class="trust-bar-logos">${logos.map(n => `<span class="trust-name">${esc(n)}</span>`).join("")}</div>
  </div>
</div>`
}

function features(w: WebsiteOutput): string {
  const f = w.sections.features
  if (!f?.items?.length) return ""
  const items = f.items.slice(0, 7)
  const useBento = items.length >= 4

  return `<section class="section">
  <div class="container">
    <div class="sh" data-reveal>
      <div class="sh-eyebrow">Features</div>
      <h2 class="sh-title">${esc(f.title)}</h2>
      <p class="sh-sub">${esc(f.subtitle)}</p>
    </div>
    <div class="${useBento ? "bento" : "feat-grid"}">
      ${items.map((it, i) => `<div class="card ${useBento ? "bento-card" : ""}" data-reveal data-d="${Math.min(i + 1, 5)}">
        <div class="feat-icon">${ico(it.icon, 20)}</div>
        <h3 class="feat-title">${esc(it.title)}</h3>
        <p class="feat-desc">${esc(it.description)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`
}

function howItWorks(w: WebsiteOutput): string {
  const hiw = w.sections.howItWorks
  if (!hiw?.steps?.length) return ""
  return `<section class="section section-alt">
  <div class="container">
    <div class="sh center" data-reveal>
      <div class="sh-eyebrow">How It Works</div>
      <h2 class="sh-title">${esc(hiw.title)}</h2>
      <p class="sh-sub">${esc(hiw.subtitle)}</p>
    </div>
    <div class="how-grid">
      ${hiw.steps.map((st, i) => `<div class="how-step" data-reveal data-d="${i + 1}">
        <div class="how-num">${i + 1}</div>
        <h3 class="how-title">${esc(st.title)}</h3>
        <p class="how-desc">${esc(st.description)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`
}

function testimonials(w: WebsiteOutput): string {
  const t = w.sections.testimonials
  if (!t?.items?.length) return ""
  const stars = Array(5).fill(0).map(() => ico("star", 13)).join("")
  return `<section class="section">
  <div class="container">
    <div class="sh center" data-reveal>
      <div class="sh-eyebrow">Testimonials</div>
      <h2 class="sh-title">${esc(t.title || "What Our Customers Say")}</h2>
    </div>
    <div class="testi-grid">
      ${t.items.slice(0, 4).map((it, i) => `<div class="card testi-card" data-reveal data-d="${i + 1}">
        <div class="testi-stars">${stars}</div>
        ${it.metric ? `<div class="testi-metric">${esc(it.metric)}</div>` : ""}
        <p class="testi-quote">"${esc(it.quote)}"</p>
        <div class="testi-author">
          <img src="${avatarImg(i)}" alt="${esc(it.author)}" class="testi-avatar" loading="lazy" onerror="this.style.display='none'"/>
          <div>
            <div class="testi-name">${esc(it.author)}</div>
            <div class="testi-role">${esc(it.role)}${it.company ? ` · ${esc(it.company)}` : ""}</div>
          </div>
        </div>
      </div>`).join("")}
    </div>
  </div>
</section>`
}

function pricing(w: WebsiteOutput): string {
  const p = w.sections.pricing
  if (!p?.tiers?.length) return ""
  return `<section class="section section-alt">
  <div class="container">
    <div class="sh center" data-reveal>
      <div class="sh-eyebrow">Pricing</div>
      <h2 class="sh-title">${esc(p.title || "Simple, Transparent Pricing")}</h2>
      <p class="sh-sub">${esc(p.subtitle)}</p>
    </div>
    <div class="price-grid">
      ${p.tiers.map((tier, i) => {
    const hi = tier.highlighted
    const btn = hi ? "btn btn-primary pc-cta" : "btn btn-ghost pc-cta"
    return `<div class="card price-card${hi ? " hi" : ""}" data-reveal data-d="${i + 1}">
          ${tier.badge ? `<div class="pc-badge">${esc(tier.badge)}</div>` : ""}
          <div class="pc-name">${esc(tier.name)}</div>
          <div class="pc-price">${esc(tier.price)}</div>
          <div class="pc-period">${esc(tier.period)}</div>
          <p class="pc-desc">${esc(tier.description)}</p>
          <div class="pc-div"></div>
          <div class="pc-feats">
            ${(tier.features ?? []).map(f => `<div class="pc-feat">
              <span class="pc-feat-ico">${ico("check", 16)}</span>
              <span class="pc-feat-lbl">${esc(f)}</span>
            </div>`).join("")}
          </div>
          <button class="${btn}">${esc(tier.cta || "Get Started")}</button>
        </div>`
  }).join("")}
    </div>
  </div>
</section>`
}

function faq(w: WebsiteOutput): string {
  const f = w.sections.faq
  if (!f?.items?.length) return ""
  return `<section class="section">
  <div class="container">
    <div class="sh center" data-reveal>
      <div class="sh-eyebrow">FAQ</div>
      <h2 class="sh-title">${esc(f.title || "Frequently Asked Questions")}</h2>
    </div>
    <div class="faq-wrap" data-reveal data-d="1">
      ${f.items.map((it, i) => `<div class="faq-item" id="fi${i}">
        <button class="faq-q" onclick="faqToggle(${i})" aria-expanded="false">
          <span>${esc(it.question)}</span>
          <span class="faq-ico" aria-hidden="true">${ico("plus", 20)}</span>
        </button>
        <div class="faq-a" role="region">${esc(it.answer)}</div>
      </div>`).join("")}
    </div>
  </div>
</section>`
}

function ctaSection(w: WebsiteOutput): string {
  const cta = w.sections.cta
  if (!cta) return ""
  return `<section class="cta-sec">
  <div class="cta-inner">
    <h2 class="cta-hl grad" data-reveal>${esc(cta.headline)}</h2>
    <p class="cta-sub" data-reveal data-d="1">${esc(cta.subheadline)}</p>
    <div class="cta-acts" data-reveal data-d="2">
      <button class="btn btn-primary">${esc(cta.buttonText || "Get Started")} ${ico("arrow", 15)}</button>
    </div>
    ${cta.subtext ? `<p class="cta-sub2" data-reveal data-d="3">${esc(cta.subtext)}</p>` : ""}
  </div>
</section>`
}

function footer(w: WebsiteOutput): string {
  const { sections: s, brand, colorPalette: c } = w
  const f = s.footer
  const cols = (f?.columns ?? []).slice(0, 3).map(col => `<div>
    <div class="footer-col-title">${esc(col.title)}</div>
    <div class="footer-links">${(col.links ?? []).map(l => `<a href="#">${esc(l)}</a>`).join("")}</div>
  </div>`).join("")

  return `<footer class="footer">
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-brand">${esc(brand.name)}</div>
        <p class="footer-desc">${esc(f?.tagline || brand.tagline || "")}</p>
      </div>
      ${cols}
    </div>
    <div class="footer-bottom">
      <p class="footer-legal">${esc(f?.legal || `© ${new Date().getFullYear()} ${brand.name}. All rights reserved.`)}</p>
    </div>
  </div>
</footer>`
}

// ─── JavaScript ────────────────────────────────────────────────────────────────

function buildJs(): string {
  return `<script>
// Mobile menu
function toggleMob(){
  var m=document.getElementById('mob'),h=document.getElementById('ham'),o=m.classList.toggle('open');
  h.innerHTML=o?'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
}
// FAQ accordion
function faqToggle(i){
  var el=document.getElementById('fi'+i),isOpen=el.classList.toggle('open');
  el.querySelector('.faq-q').setAttribute('aria-expanded',isOpen?'true':'false');
  el.querySelector('.faq-ico').innerHTML=isOpen?'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>':'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  document.querySelectorAll('.faq-item').forEach(function(el2){if(el2.id!=='fi'+i&&el2.classList.contains('open')){el2.classList.remove('open');el2.querySelector('.faq-q').setAttribute('aria-expanded','false');el2.querySelector('.faq-ico').innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';}});
}
// Scroll reveal
var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vis');ro.unobserve(e.target);}});},{threshold:.08,rootMargin:'0px 0px -36px 0px'});
document.querySelectorAll('[data-reveal]').forEach(function(el){ro.observe(el);});
// Animated counters
function animCount(el,raw){
  // Split raw into prefix (non-digit prefix like $ or €), the number, and suffix
  var preMatch=raw.match(/^([^\d]*)(\d[\d.,]*)(.*)$/);
  if(!preMatch)return;
  var pre=preMatch[1],numStr=preMatch[2].replace(/,/g,''),suf=preMatch[3];
  var num=parseFloat(numStr);
  if(isNaN(num)||num===0)return;
  var dur=1400,started=null;
  // Clear the static HTML value immediately so it can't flash alongside animated value
  el.textContent=pre+'0'+suf;
  function tick(ts){
    if(started===null)started=ts;
    var p=Math.min((ts-started)/dur,1),ease=1-Math.pow(1-p,3),v=num*ease;
    el.textContent=pre+(Number.isInteger(num)?Math.floor(v):v.toFixed(1))+suf;
    if(p<1)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
var co=new IntersectionObserver(function(es){
  es.forEach(function(e){
    if(e.isIntersecting){
      co.unobserve(e.target);
      animCount(e.target,e.target.dataset.counter||'');
    }
  });
},{threshold:.4,rootMargin:'0px 0px -20px 0px'});
document.querySelectorAll('[data-counter]').forEach(function(el){co.observe(el);});
// Sticky nav shadow
var nv=document.getElementById('nav');
if(nv)window.addEventListener('scroll',function(){nv.classList.toggle('scrolled',window.scrollY>16);},{passive:true});
</script>`
}

// ─── Main Exports ──────────────────────────────────────────────────────────────

export function buildPreviewHtml(w: WebsiteOutput): string {
  const css = buildCss(w)
  const seo = w.seoMeta
  const hf = w.typography.headingFont
  const bf = w.typography.bodyFont

  const body = [
    nav(w),
    hero(w),
    w.sections.hero?.trustedBy?.length ? "" : trustBar(w),
    features(w),
    howItWorks(w),
    testimonials(w),
    pricing(w),
    faq(w),
    ctaSection(w),
    footer(w),
  ].join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(seo?.title || w.brand.name)}</title>
<meta name="description" content="${esc(seo?.description || w.brand.tagline || "")}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<style>${css}</style>
</head>
<body>
${body}
${buildJs()}
</body>
</html>`
}

// Alias for backwards compatibility
export const generateWebsiteHtml = buildPreviewHtml

export function buildNextjsProject(data: WebsiteOutput): Record<string, string> {
  const html = buildPreviewHtml(data)
  const c = data.colorPalette
  const t = data.typography

  return {
    "public/index.html": html,
    "package.json": JSON.stringify({
      name: data.brand.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "14.2.0", react: "^18", "react-dom": "^18" },
      devDependencies: { typescript: "^5", "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18" },
    }, null, 2),
    "next.config.js": `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig`,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "es5", lib: ["dom", "dom.iterable", "esnext"], allowJs: true,
        skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
        module: "esnext", moduleResolution: "bundler", resolveJsonModule: true,
        isolatedModules: true, jsx: "preserve", incremental: true,
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    }, null, 2),
    "src/app/globals.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:${c.primary};--bg:${c.background};--tx:${c.text};--tm:${c.textMuted}}
body{font-family:'${t.bodyFont}',sans-serif;background:var(--bg);color:var(--tx)}`,
    "src/app/page.tsx": `export default function Home() {
  return (
    <main>
      <p>See public/index.html for the full generated website.</p>
    </main>
  )
}`,
  }
}
