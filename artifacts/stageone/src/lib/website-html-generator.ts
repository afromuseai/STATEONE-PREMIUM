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
  componentCode?: Record<string, string>
  htmlCode?: string
  websiteStrategy?: {
    conversionApproach: string
    sectionOrderRationale: string
    trustSignals: string[]
    ctaStrategy: string
    audiencePsychology: string
    industryOptimizations: string[]
    conversionFunnel: string
  }
  _heroImage?: string
  _industry?: string
  _variantSeed?: number
}

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function isLight(hex: string): boolean {
  const c = (hex ?? "#000").replace("#", "")
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160
}

function gf(name: string): string {
  return name.replace(/ /g, "+") + ":wght@300;400;500;600;700;800;900"
}

// ─── Curated Unsplash hero images per industry ────────────────────────────────
const HERO_IMAGES: Record<string, string[]> = {
  Cybersecurity: [
    "photo-1550751827-4bd374c3f58b", "photo-1526374965328-7f61d4dc18c5",
    "photo-1558618666-fcd25c85cd64", "photo-1510511459019-5dda7724fd87",
  ],
  Fintech: [
    "photo-1611974789855-9c2a0a7236a3", "photo-1460925895917-afdab827c52f",
    "photo-1559526324-4b87b5e36e44", "photo-1551288049-bebda4e38f71",
  ],
  SaaS: [
    "photo-1498050108023-c5249f4df085", "photo-1573164713988-8665fc963095",
    "photo-1551434678-e076c223a692", "photo-1542744173-05336fcc7ad4",
  ],
  Healthcare: [
    "photo-1576091160550-2173dba999ef", "photo-1579684385127-1ef15d508118",
    "photo-1631217868264-e5b90bb7e133", "photo-1559839734-2b71ea197ec2",
  ],
  Education: [
    "photo-1522202176988-66273c2fd55f", "photo-1501504905252-473c47e087f8",
    "photo-1434030216411-0b793f4b6f69", "photo-1523240795612-9a054b0db644",
  ],
  Marketplace: [
    "photo-1556742049-0cfed4f6a45d", "photo-1607082348824-0a96f2a4b9da",
    "photo-1472851156868-0b8a07c9c6b7", "photo-1483985988355-763728e1935b",
  ],
  Agency: [
    "photo-1561070791-2526d30994b5", "photo-1600880292089-90a7e086ee0c",
    "photo-1552664730-d307ca884978", "photo-1497215842964-222b430dc094",
  ],
  Luxury: [
    "photo-1547555999-14e818e09e33", "photo-1506905925346-21bda4d32df4",
    "photo-1600185365926-3a2ce3cdb9eb", "photo-1523275335684-37898b6baf30",
  ],
  "E-commerce": [
    "photo-1607082348824-0a96f2a4b9da", "photo-1585386959984-a4155224a1ad",
    "photo-1472851156868-0b8a07c9c6b7", "photo-1483985988355-763728e1935b",
  ],
  "Creator Economy": [
    "photo-1611162617213-7d7a39e9b1d7", "photo-1598550476439-6847785fcea6",
    "photo-1552664730-d307ca884978", "photo-1516321165247-4aa89a48be4d",
  ],
}

const FALLBACK_IMAGES = [
  "photo-1573164713988-8665fc963095", "photo-1498050108023-c5249f4df085",
  "photo-1542744173-05336fcc7ad4", "photo-1460925895917-afdab827c52f",
]

const AVATAR_IMAGES = [
  "photo-1494790108755-2616b612b786", "photo-1472099645785-5658abf4ff4e",
  "photo-1438761681033-6461ffad8d80", "photo-1507003211169-0a1dd7228f2d",
  "photo-1573496359142-b8d87734a5a2", "photo-1500648767791-00dcc994a43e",
]

function heroImg(industry: string, seed: string, offset = 0): string {
  const list = HERO_IMAGES[industry] ?? FALLBACK_IMAGES
  const h = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0))
  const id = list[(h + offset * 3) % list.length]
  return `https://images.unsplash.com/${id}?w=1400&q=90&fit=crop&auto=format`
}

function avatarImg(i: number): string {
  return `https://images.unsplash.com/${AVATAR_IMAGES[i % AVATAR_IMAGES.length]}?w=120&h=120&fit=crop&q=80&auto=format`
}

// ─── SVG Icon library ──────────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  Zap: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  Target: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  Shield: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  Rocket: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l-4 4 1 4 4-1 4-4M15 9l-2.5-2.5M3 21l3-3M13 4l7 7-9 9-7-7z"/></svg>`,
  Globe: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>`,
  Sparkles: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m0 16v1M4.22 4.22l.7.7m14.14 14.14.7.7M3 12H2m20 0h-1M4.22 19.78l.7-.7M19.07 4.93l.7-.7"/><circle cx="12" cy="12" r="3"/></svg>`,
  BarChart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="6" width="4" height="15" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`,
  Lock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  Users: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M1 21v-2a4 4 0 013-3.87"/></svg>`,
  Layers: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  Brain: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7v0A2.5 2.5 0 012 9.5v5A2.5 2.5 0 004.5 17v0A2.5 2.5 0 007 19.5v0A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7v0A2.5 2.5 0 0017 4.5v0A2.5 2.5 0 0014.5 2z"/></svg>`,
  TrendingUp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  Check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
  ArrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  Star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  Play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  Quote: `<svg width="36" height="28" viewBox="0 0 36 28" fill="currentColor" opacity="0.12"><path d="M0 28V16C0 7.267 4.8 2 14.4 0l2.048 3.28C12.256 4.56 9.76 6.8 9.216 9.84H14V28H0zm22 0V16C22 7.267 26.8 2 36.4 0l2.048 3.28C34.256 4.56 31.76 6.8 31.216 9.84H36V28H22z"/></svg>`,
}

function ico(name: string): string {
  return ICONS[name] ?? ICONS.Sparkles
}

// ─── Variant detection ──────────────────────────────────────────────────────────
type HeroLayout = "split" | "centered" | "fullscreen" | "editorial" | "cinematic" | "glass"

function getHeroLayout(variant: string): HeroLayout {
  const map: Record<string, HeroLayout> = {
    "Premium SaaS": "split",
    "Enterprise Minimal": "split",
    "Clean Pro": "split",
    "Startup Modern": "centered",
    "Futuristic": "fullscreen",
    "Bold Brutalist": "fullscreen",
    "Glassmorphism": "glass",
    "Luxury Editorial": "editorial",
    "Cinematic Dark": "cinematic",
  }
  return map[variant] ?? "split"
}

// ─── Scroll animation JS (runs once, observes all .reveal elements) ────────────
const SCROLL_JS = `
<script>
(function(){
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
})();
</script>`

// ─── Base CSS reset + design tokens + animations ───────────────────────────────
function baseCss(c: WebsiteOutput["colorPalette"], t: WebsiteOutput["typography"], variant: string): string {
  const hw = t.headingWeight ?? "800"
  const hs = t.headingStyle === "ultra-tight" ? "-0.05em" : t.headingStyle === "tight" ? "-0.03em" : "-0.02em"
  const lightBg = isLight(c.background)
  const isGlass = variant === "Glassmorphism"
  const isLuxury = variant === "Luxury Editorial"

  return `
@import url('https://fonts.googleapis.com/css2?family=${gf(t.headingFont)}&family=${gf(t.bodyFont)}&display=swap');

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --p: ${c.primary};
  --s: ${c.secondary};
  --a: ${c.accent};
  --bg: ${c.background};
  --sf: ${c.surface};
  --tx: ${c.text};
  --tm: ${c.textMuted};
  --br: ${c.border};
  --hf: '${t.headingFont}', system-ui, sans-serif;
  --bf: '${t.bodyFont}', system-ui, sans-serif;
  --radius: 16px;
  --radius-sm: 10px;
  --radius-lg: 24px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.1), 0 12px 40px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.15), 0 24px 64px rgba(0,0,0,0.15);
}

html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: var(--bf);
  background: ${isGlass ? "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" : "var(--bg)"};
  ${isGlass ? "background-attachment: fixed;" : ""}
  color: var(--tx);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
  line-height: 1.6;
}
h1,h2,h3,h4,h5,h6 {
  font-family: var(--hf);
  font-weight: ${hw};
  letter-spacing: ${hs};
  line-height: 1.08;
  ${isLuxury ? "font-style: italic;" : ""}
}
a { text-decoration: none; color: inherit; transition: opacity 0.2s; }
a:hover { opacity: 0.8; }
button { font-family: var(--bf); cursor: pointer; border: none; outline: none; transition: all 0.25s ease; }
img { max-width: 100%; display: block; }
ul { list-style: none; }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.65s ease, transform 0.65s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal.delay-1 { transition-delay: 0.1s; }
.reveal.delay-2 { transition-delay: 0.2s; }
.reveal.delay-3 { transition-delay: 0.3s; }
.reveal.delay-4 { transition-delay: 0.4s; }
.reveal.delay-5 { transition-delay: 0.5s; }
.reveal.delay-6 { transition-delay: 0.6s; }

/* Keyframes */
@keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px ${c.primary}40; } 50% { box-shadow: 0 0 48px ${c.primary}70; } }
@keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes mesh { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* Gradient text utility */
.grad-text {
  background: linear-gradient(135deg, var(--p), var(--a));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Divider line */
.hr-grad {
  height: 1px;
  border: none;
  background: linear-gradient(90deg, transparent, var(--p), transparent);
  opacity: 0.4;
  margin: 0;
}

/* Stars */
.stars { display: flex; gap: 2px; color: #f59e0b; }

/* Responsive */
@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr !important; }
  .hero-img-col { display: none !important; }
  .features-grid { grid-template-columns: 1fr 1fr !important; }
  .pricing-grid { grid-template-columns: 1fr !important; }
  .testi-grid { grid-template-columns: 1fr !important; }
  .footer-grid { grid-template-columns: 1fr 1fr !important; }
  .how-steps { grid-template-columns: 1fr !important; }
}
@media (max-width: 600px) {
  .features-grid { grid-template-columns: 1fr !important; }
  .footer-grid { grid-template-columns: 1fr !important; }
  .stats-row { grid-template-columns: 1fr 1fr !important; }
}

/* Light bg surface override */
${lightBg ? `
.card-surface { background: #fff !important; }
.alt-section { background: #f8fafc !important; }
` : `
.card-surface { background: var(--sf) !important; }
.alt-section { background: rgba(255,255,255,0.03) !important; }
`}
`
}

// ─── Navigation ────────────────────────────────────────────────────────────────
function renderNav(
  nav: WebsiteOutput["sections"]["nav"],
  brand: WebsiteOutput["brand"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const lightBg = isLight(c.background)
  const isLuxury = variant === "Luxury Editorial" || variant === "Cinematic Dark"
  const isGlass = variant === "Glassmorphism"

  const links = (nav?.links ?? []).slice(0, 5).map(l =>
    `<a href="#" style="color:var(--tm);font-size:14px;font-weight:500;white-space:nowrap;letter-spacing:-0.01em;">${esc(l)}</a>`
  ).join("")

  const navBg = isGlass
    ? "background:rgba(255,255,255,0.06);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,0.1);"
    : `background:${c.background}ee;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)"};`

  if (isLuxury) {
    return `<nav style="position:sticky;top:0;z-index:100;${navBg}padding:0 clamp(32px,6vw,80px);">
  <div style="max-width:1280px;margin:0 auto;height:72px;display:flex;align-items:center;justify-content:space-between;">
    <div style="font-family:var(--hf);font-size:15px;font-weight:700;color:var(--tx);letter-spacing:0.12em;text-transform:uppercase;">${esc(nav?.logo ?? brand.name)}</div>
    <div style="display:flex;align-items:center;gap:40px;">${links}</div>
    <a href="#" style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--p);">Enquire</a>
  </div>
</nav>`
  }

  return `<nav style="position:sticky;top:0;z-index:100;${navBg}padding:0 clamp(20px,4vw,48px);">
  <div style="max-width:1280px;margin:0 auto;height:64px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
    <div style="font-family:var(--hf);font-size:20px;font-weight:900;color:var(--tx);letter-spacing:-0.04em;flex-shrink:0;">${esc(nav?.logo ?? brand.name)}</div>
    <div style="display:flex;align-items:center;gap:28px;flex:1;justify-content:center;">${links}</div>
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <a href="#" style="font-size:14px;font-weight:500;color:var(--tm);">Log in</a>
      <button style="background:var(--p);color:${lightBg ? "#fff" : c.background};padding:10px 22px;border-radius:var(--radius-sm);font-size:14px;font-weight:700;letter-spacing:-0.01em;box-shadow:0 4px 16px ${c.primary}40;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 8px 24px ${c.primary}55'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px ${c.primary}40'">Get Started</button>
    </div>
  </div>
</nav>`
}

// ─── Hero Section ──────────────────────────────────────────────────────────────
function renderHero(
  hero: WebsiteOutput["sections"]["hero"],
  c: WebsiteOutput["colorPalette"],
  t: WebsiteOutput["typography"],
  brand: WebsiteOutput["brand"],
  variant: string,
  industry: string,
  aiHeroImage: string | null,
  variantSeed: number
): string {
  const layout = getHeroLayout(variant)
  const lightBg = isLight(c.background)
  const imgUrl = aiHeroImage || heroImg(industry, brand.name, variantSeed)
  const stats = hero?.stats ?? []
  const trusted = hero?.trustedBy ?? []

  const badge = hero?.badge ? `
    <div class="reveal" style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:100px;background:${c.primary}18;border:1px solid ${c.primary}40;color:${c.primary};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:28px;">
      <span style="width:6px;height:6px;border-radius:50%;background:${c.primary};flex-shrink:0;box-shadow:0 0 8px ${c.primary};animation:pulse-glow 2s infinite;"></span>
      ${esc(hero.badge)}
    </div>` : ""

  const headline = `<h1 class="reveal delay-1" style="font-size:clamp(36px,5.5vw,72px);color:var(--tx);line-height:1.06;margin-bottom:20px;letter-spacing:-0.04em;">${esc(hero?.headline ?? "")}</h1>`

  const sub = `<p class="reveal delay-2" style="font-size:clamp(16px,1.8vw,19px);color:var(--tm);line-height:1.7;margin-bottom:36px;max-width:520px;">${esc(hero?.subheadline ?? "")}</p>`

  const ctaLight = lightBg ? "#fff" : c.background
  const ctas = `
    <div class="reveal delay-3" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:48px;">
      <button onclick="window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})" style="display:inline-flex;align-items:center;gap:8px;padding:15px 32px;border-radius:var(--radius-sm);background:var(--p);color:${ctaLight};font-weight:700;font-size:16px;box-shadow:0 4px 20px ${c.primary}45;letter-spacing:-0.01em;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px ${c.primary}60'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px ${c.primary}45'">
        ${esc(hero?.ctaPrimary ?? "Get Started")} <span style="display:inline-flex;">${ICONS.ArrowRight}</span>
      </button>
      ${hero?.ctaSecondary ? `<button style="display:inline-flex;align-items:center;gap:8px;padding:15px 24px;border-radius:var(--radius-sm);background:transparent;color:var(--tx);font-weight:600;font-size:15px;border:1.5px solid ${lightBg ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)"};" onmouseover="this.style.borderColor='var(--p)';this.style.color='var(--p)'" onmouseout="this.style.borderColor='${lightBg ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)"}';this.style.color='var(--tx)'">
        <span style="display:inline-flex;opacity:0.6;">${ICONS.Play}</span> ${esc(hero.ctaSecondary)}
      </button>` : ""}
    </div>`

  const statsRow = stats.length > 0 ? `
    <div class="reveal delay-4 stats-row" style="display:grid;grid-template-columns:repeat(${Math.min(stats.length, 4)},1fr);gap:24px;padding-top:36px;border-top:1px solid ${lightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};">
      ${stats.map(s => `
        <div>
          <div style="font-family:var(--hf);font-size:clamp(24px,3vw,36px);font-weight:900;color:var(--p);line-height:1;margin-bottom:5px;">${esc(s.value)}</div>
          <div style="font-size:13px;color:var(--tm);font-weight:500;letter-spacing:0.01em;">${esc(s.label)}</div>
        </div>`).join("")}
    </div>` : ""

  const trustedRow = trusted.length > 0 ? `
    <div class="reveal delay-5" style="margin-top:${stats.length > 0 ? "36px" : "0"};">
      <p style="font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px;">Trusted by teams at</p>
      <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;">
        ${trusted.map(n => `<span style="font-family:var(--hf);font-size:16px;font-weight:800;color:${lightBg ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.22)"};letter-spacing:-0.02em;">${esc(n)}</span>`).join("")}
      </div>
    </div>` : ""

  const socialProofLine = hero?.socialProof ? `<p class="reveal delay-5" style="font-size:13px;color:var(--tm);font-weight:500;margin-top:16px;">✦ ${esc(hero.socialProof)}</p>` : ""

  // ── SPLIT LAYOUT ─────────────────────────────────────────────────────────────
  // Premium SaaS: gradient bg + image right + floating status card
  // Enterprise Minimal: white/dark bg + image right + no card, corporate clean
  // Clean Pro: reverse split — image LEFT, text right, angle divider
  if (layout === "split") {
    // ─ Enterprise Minimal ─────────────────────────────────────────────────────
    if (variant === "Enterprise Minimal") {
      return `
<section style="background:var(--bg);padding:clamp(80px,9vw,110px) clamp(20px,4vw,48px) clamp(60px,7vw,80px);border-bottom:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)"};">
  <div style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:55% 45%;gap:clamp(40px,5vw,72px);align-items:center;" class="hero-grid">
    <div>
      ${badge}
      ${headline}
      ${sub}
      ${ctas}
      ${statsRow}
      ${trustedRow}
    </div>
    <div class="reveal delay-2 hero-img-col" style="position:relative;">
      <div style="border-radius:4px;overflow:hidden;border:1px solid ${lightBg ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)"};">
        <img src="${imgUrl}" alt="${esc(brand.name)}" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:auto;display:block;aspect-ratio:4/3;object-fit:cover;filter:${lightBg ? "none" : "brightness(0.85)"};">
      </div>
      ${stats.length > 0 ? `
      <div style="position:absolute;bottom:-1px;left:0;right:0;display:flex;justify-content:space-around;background:${lightBg ? "#fff" : c.background};border-top:1px solid ${lightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};padding:18px 20px;">
        ${stats.slice(0, 3).map((s, i) => `
          <div style="text-align:center;${i > 0 ? `border-left:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"};padding-left:20px;` : ""}flex:1;">
            <div style="font-family:var(--hf);font-size:clamp(18px,2.2vw,26px);font-weight:900;color:var(--p);line-height:1;">${esc(s.value)}</div>
            <div style="font-size:11px;color:var(--tm);margin-top:3px;">${esc(s.label)}</div>
          </div>`).join("")}
      </div>` : ""}
    </div>
  </div>
</section>`
    }

    // ─ Clean Pro: image LEFT, text RIGHT, diagonal accent ────────────────────
    if (variant === "Clean Pro") {
      const heroBg = lightBg ? "#fff" : "var(--bg)"
      return `
<section style="background:${heroBg};padding:clamp(72px,8vw,100px) clamp(20px,4vw,48px) clamp(60px,7vw,80px);overflow:hidden;position:relative;">
  <div style="position:absolute;top:0;right:0;width:45%;height:100%;background:${c.primary}07;clip-path:polygon(8% 0,100% 0,100% 100%,0% 100%);pointer-events:none;"></div>
  <div style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,5vw,80px);align-items:center;" class="hero-grid">
    <div class="reveal hero-img-col" style="position:relative;order:-1;">
      <div style="position:relative;border-radius:var(--radius-lg);overflow:hidden;box-shadow:${lightBg ? "var(--shadow-lg)" : "0 24px 80px rgba(0,0,0,0.5)"};transform:perspective(1000px) rotateY(3deg);">
        <img src="${imgUrl}" alt="${esc(brand.name)}" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:auto;display:block;aspect-ratio:4/3;object-fit:cover;">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,${c.primary}20,transparent 50%);"></div>
      </div>
    </div>
    <div>
      ${badge}
      ${headline}
      ${sub}
      ${ctas}
      ${statsRow}
      ${trustedRow}
      ${socialProofLine}
    </div>
  </div>
</section>`
    }

    // ─ Premium SaaS (default split): gradient bg + floating card ─────────────
    const heroBg = lightBg
      ? `linear-gradient(160deg, ${c.primary}08 0%, ${c.secondary}05 50%, #f8fafc 100%)`
      : `radial-gradient(ellipse 80% 60% at 30% 30%, ${c.primary}15, transparent 70%)`

    return `
<section style="background:${heroBg};padding:clamp(72px,8vw,100px) clamp(20px,4vw,48px) 0;">
  <div style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,5vw,80px);align-items:center;" class="hero-grid">
    <div>
      ${badge}
      ${headline}
      ${sub}
      ${ctas}
      ${statsRow}
      ${trustedRow}
      ${socialProofLine}
    </div>
    <div class="reveal delay-2 hero-img-col" style="position:relative;">
      <div style="position:absolute;inset:-20px;background:radial-gradient(ellipse 70% 70% at 50% 50%,${c.primary}20,transparent);border-radius:50%;filter:blur(40px);pointer-events:none;"></div>
      <div style="position:relative;border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,${lightBg ? "0.14" : "0.5"}),0 0 0 1px ${lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)"};animation:float 6s ease-in-out infinite;">
        <img src="${imgUrl}" alt="${esc(brand.name)} product" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:auto;display:block;aspect-ratio:4/3;object-fit:cover;">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,${c.background}40);pointer-events:none;"></div>
        <div style="position:absolute;bottom:20px;left:20px;right:20px;">
          <div style="background:${lightBg ? "rgba(255,255,255,0.92)" : "rgba(15,15,20,0.88)"};backdrop-filter:blur(16px);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;border:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)"};">
            <div style="width:10px;height:10px;border-radius:50%;background:#22c55e;flex-shrink:0;box-shadow:0 0 8px #22c55e;"></div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--tx);line-height:1.3;">${esc(brand.name)} is live</div>
              <div style="font-size:11px;color:var(--tm);">Platform operational · 99.9% uptime</div>
            </div>
            ${stats.length > 0 ? `<div style="margin-left:auto;font-family:var(--hf);font-size:20px;font-weight:900;color:var(--p);">${esc(stats[0].value)}</div>` : ""}
          </div>
        </div>
      </div>
      <div style="position:absolute;top:-16px;right:-16px;width:80px;height:80px;border-radius:50%;background:${c.primary}25;pointer-events:none;"></div>
    </div>
  </div>
</section>`
  }

  // ── CENTERED LAYOUT (Startup Modern) ────────────────────────────────────────
  if (layout === "centered") {
    return `
<section style="position:relative;padding:clamp(80px,10vw,130px) clamp(20px,4vw,48px) 0;overflow:hidden;text-align:center;background:var(--bg);">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 0%,${c.primary}25,transparent);pointer-events:none;"></div>
  <div style="position:absolute;top:20%;left:10%;width:300px;height:300px;border-radius:50%;background:${c.accent}10;filter:blur(80px);pointer-events:none;animation:float 8s ease-in-out infinite;"></div>
  <div style="position:absolute;top:30%;right:8%;width:200px;height:200px;border-radius:50%;background:${c.secondary}15;filter:blur(60px);pointer-events:none;animation:float 10s ease-in-out infinite reverse;"></div>
  <div style="position:relative;max-width:860px;margin:0 auto;">
    ${badge}
    ${headline}
    ${sub}
    ${ctas}
    ${socialProofLine}
  </div>
  <div class="reveal delay-5" style="position:relative;max-width:1100px;margin:60px auto 0;border-radius:24px 24px 0 0;overflow:hidden;box-shadow:0 -8px 60px rgba(0,0,0,0.35);border:1px solid ${isLight(c.background) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};border-bottom:none;">
    <img src="${imgUrl}" alt="${esc(brand.name)}" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:auto;display:block;aspect-ratio:16/8;object-fit:cover;object-position:top;">
    <div style="position:absolute;bottom:0;left:0;right:0;height:40%;background:linear-gradient(to top,${c.background},transparent);"></div>
    ${stats.length > 0 ? `
    <div style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:0;background:${isLight(c.background) ? "rgba(255,255,255,0.92)" : "rgba(10,10,14,0.88)"};backdrop-filter:blur(20px);border-top:1px solid ${isLight(c.background) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};">
      ${stats.slice(0, 4).map((s, i) => `
        <div style="padding:20px 36px;text-align:center;${i > 0 ? `border-left:1px solid ${isLight(c.background) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"};` : ""}flex:1;">
          <div style="font-family:var(--hf);font-size:clamp(20px,2.5vw,30px);font-weight:900;color:var(--p);line-height:1;margin-bottom:3px;">${esc(s.value)}</div>
          <div style="font-size:12px;color:var(--tm);font-weight:500;">${esc(s.label)}</div>
        </div>`).join("")}
    </div>` : ""}
  </div>
</section>`
  }

  // ── FULLSCREEN LAYOUT (Futuristic, Bold Brutalist) ───────────────────────────
  if (layout === "fullscreen") {
    const isBrutalist = variant === "Bold Brutalist"
    const isFuturistic = variant === "Futuristic"

    if (isBrutalist) {
      return `
<section style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(80px,10vw,120px) clamp(20px,5vw,80px);background:var(--bg);position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,transparent,transparent 79px,${c.primary}08 80px),repeating-linear-gradient(90deg,transparent,transparent 79px,${c.primary}08 80px);pointer-events:none;"></div>
  <div style="position:relative;max-width:1100px;width:100%;">
    <div class="reveal" style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--p);margin-bottom:32px;font-family:monospace;">${esc(hero?.badge ?? "")}</div>
    <h1 class="reveal delay-1" style="font-size:clamp(56px,10vw,140px);color:var(--tx);line-height:0.94;letter-spacing:-0.03em;text-transform:uppercase;font-weight:900;margin-bottom:40px;">${esc(hero?.headline ?? "")}</h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;">
      <p class="reveal delay-2" style="font-size:clamp(15px,1.6vw,18px);color:var(--tm);line-height:1.7;">${esc(hero?.subheadline ?? "")}</p>
      <div class="reveal delay-3">
        <button style="display:block;width:100%;padding:20px 32px;background:var(--tx);color:var(--bg);font-weight:900;font-size:18px;letter-spacing:0.02em;text-transform:uppercase;border:3px solid var(--tx);margin-bottom:16px;" onmouseover="this.style.background='var(--p)';this.style.borderColor='var(--p)'" onmouseout="this.style.background='var(--tx)';this.style.borderColor='var(--tx)'">${esc(hero?.ctaPrimary ?? "Get Started")}</button>
        ${hero?.ctaSecondary ? `<button style="display:block;width:100%;padding:20px 32px;background:transparent;color:var(--tx);font-weight:700;font-size:15px;border:3px solid var(--tx);" onmouseover="this.style.background='var(--tx)';this.style.color='var(--bg)'" onmouseout="this.style.background='transparent';this.style.color='var(--tx)'">${esc(hero.ctaSecondary)}</button>` : ""}
      </div>
    </div>
    ${stats.length > 0 ? `
    <div class="reveal delay-4" style="display:flex;gap:0;margin-top:80px;border-top:3px solid var(--tx);">
      ${stats.slice(0, 4).map((s, i) => `
        <div style="padding:32px 40px;${i > 0 ? "border-left:3px solid var(--tx);" : ""}flex:1;">
          <div style="font-family:var(--hf);font-size:clamp(28px,4vw,48px);font-weight:900;color:var(--p);line-height:1;">${esc(s.value)}</div>
          <div style="font-size:13px;color:var(--tm);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-top:6px;">${esc(s.label)}</div>
        </div>`).join("")}
    </div>` : ""}
  </div>
</section>`
    }

    if (isFuturistic) {
      return `
<section style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(80px,10vw,120px) clamp(20px,5vw,60px);background:var(--bg);position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;"></div>
  <div style="position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,${c.primary}18,transparent 70%);pointer-events:none;"></div>
  <div style="position:relative;max-width:900px;width:100%;text-align:center;">
    <div class="reveal" style="display:inline-flex;align-items:center;gap:8px;padding:6px 18px;border:1px solid ${c.primary};border-radius:4px;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${c.primary};margin-bottom:40px;">${esc(hero?.badge ?? "")}</div>
    <h1 class="reveal delay-1" style="font-size:clamp(40px,7vw,96px);color:var(--tx);line-height:1.02;letter-spacing:-0.04em;margin-bottom:24px;">${esc(hero?.headline ?? "")}</h1>
    <p class="reveal delay-2" style="font-size:clamp(15px,1.6vw,18px);color:var(--tm);line-height:1.7;max-width:580px;margin:0 auto 44px;">${esc(hero?.subheadline ?? "")}</p>
    <div class="reveal delay-3" style="display:flex;gap:16px;justify-content:center;margin-bottom:64px;">
      <button style="display:inline-flex;align-items:center;gap:8px;padding:14px 36px;border:1px solid ${c.primary};border-radius:4px;background:${c.primary}15;color:${c.primary};font-weight:700;font-size:15px;letter-spacing:0.04em;position:relative;overflow:hidden;" onmouseover="this.style.background='${c.primary}';this.style.color='${c.background}'" onmouseout="this.style.background='${c.primary}15';this.style.color='${c.primary}'">${esc(hero?.ctaPrimary ?? "Initialize System")}</button>
      ${hero?.ctaSecondary ? `<button style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border:1px solid rgba(255,255,255,0.15);border-radius:4px;background:transparent;color:var(--tm);font-size:15px;">${esc(hero.ctaSecondary)}</button>` : ""}
    </div>
    ${stats.length > 0 ? `
    <div class="reveal delay-4" style="display:grid;grid-template-columns:repeat(${Math.min(stats.length, 4)},1fr);gap:1px;background:${c.primary}20;border:1px solid ${c.primary}20;border-radius:4px;overflow:hidden;">
      ${stats.slice(0, 4).map(s => `
        <div style="padding:28px 24px;background:var(--bg);text-align:center;">
          <div style="font-family:monospace;font-size:clamp(24px,3vw,36px);font-weight:900;color:${c.primary};line-height:1;margin-bottom:6px;">${esc(s.value)}</div>
          <div style="font-size:11px;color:var(--tm);letter-spacing:0.12em;text-transform:uppercase;">${esc(s.label)}</div>
        </div>`).join("")}
    </div>` : ""}
  </div>
</section>`
    }
  }

  // ── GLASS LAYOUT (Glassmorphism) ─────────────────────────────────────────────
  if (layout === "glass") {
    return `
<section style="min-height:90vh;display:flex;align-items:center;justify-content:center;padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);position:relative;overflow:hidden;">
  <div class="reveal" style="max-width:720px;width:100%;text-align:center;background:rgba(255,255,255,0.07);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border:1px solid rgba(255,255,255,0.14);border-radius:32px;padding:clamp(48px,6vw,80px) clamp(32px,5vw,72px);">
    ${badge}
    <h1 class="reveal delay-1" style="font-size:clamp(36px,5.5vw,68px);color:#fff;line-height:1.06;margin-bottom:20px;letter-spacing:-0.04em;">${esc(hero?.headline ?? "")}</h1>
    <p class="reveal delay-2" style="font-size:clamp(15px,1.6vw,18px);color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:40px;">${esc(hero?.subheadline ?? "")}</p>
    <div class="reveal delay-3" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:40px;">
      <button style="display:inline-flex;align-items:center;gap:8px;padding:15px 36px;border-radius:16px;background:linear-gradient(135deg,${c.primary},${c.accent});color:#fff;font-weight:700;font-size:16px;box-shadow:0 8px 32px ${c.primary}50;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 40px ${c.primary}65'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 32px ${c.primary}50'">${esc(hero?.ctaPrimary ?? "Get Started")} ${ICONS.ArrowRight}</button>
      ${hero?.ctaSecondary ? `<button style="display:inline-flex;align-items:center;gap:8px;padding:15px 28px;border-radius:16px;background:rgba(255,255,255,0.1);color:#fff;font-size:15px;border:1px solid rgba(255,255,255,0.2);">${esc(hero.ctaSecondary)}</button>` : ""}
    </div>
    ${stats.length > 0 ? `
    <div style="display:grid;grid-template-columns:repeat(${Math.min(stats.length, 4)},1fr);gap:1px;background:rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
      ${stats.slice(0, 4).map(s => `
        <div style="padding:20px 16px;text-align:center;background:rgba(255,255,255,0.04);">
          <div style="font-family:var(--hf);font-size:clamp(20px,2.5vw,28px);font-weight:900;color:${c.primary};margin-bottom:4px;">${esc(s.value)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);">${esc(s.label)}</div>
        </div>`).join("")}
    </div>` : ""}
  </div>
</section>`
  }

  // ── EDITORIAL LAYOUT (Luxury) ────────────────────────────────────────────────
  if (layout === "editorial") {
    return `
<section style="min-height:90vh;display:flex;align-items:center;padding:clamp(80px,10vw,130px) clamp(40px,8vw,120px);background:var(--bg);">
  <div style="max-width:900px;">
    <div class="reveal" style="width:40px;height:1px;background:var(--p);margin-bottom:48px;"></div>
    <h1 class="reveal delay-1" style="font-size:clamp(48px,7vw,100px);color:var(--tx);line-height:1.03;letter-spacing:0.02em;margin-bottom:40px;font-weight:${t.headingWeight ?? "800"};">${esc(hero?.headline ?? "")}</h1>
    <p class="reveal delay-2" style="font-size:clamp(15px,1.5vw,18px);color:var(--tm);line-height:1.85;max-width:480px;margin-bottom:56px;font-weight:300;letter-spacing:0.01em;">${esc(hero?.subheadline ?? "")}</p>
    <div class="reveal delay-3" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
      <a href="#" style="display:inline-flex;align-items:center;gap:12px;padding:16px 40px;border:1px solid var(--p);color:var(--p);font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;" onmouseover="this.style.background='var(--p)';this.style.color='var(--bg)'" onmouseout="this.style.background='transparent';this.style.color='var(--p)'">${esc(hero?.ctaPrimary ?? "Enquire")} ${ICONS.ArrowRight}</a>
      ${hero?.ctaSecondary ? `<a href="#" style="font-size:12px;font-weight:500;color:var(--tm);letter-spacing:0.08em;text-decoration:underline;text-underline-offset:4px;">${esc(hero.ctaSecondary)}</a>` : ""}
    </div>
    ${socialProofLine}
  </div>
</section>`
  }

  // ── CINEMATIC LAYOUT (Cinematic Dark) ────────────────────────────────────────
  return `
<section style="position:relative;min-height:95vh;display:flex;align-items:flex-end;padding:clamp(64px,8vw,100px) clamp(32px,6vw,80px);overflow:hidden;">
  <div style="position:absolute;inset:0;z-index:0;">
    <img src="${imgUrl}" alt="" loading="lazy" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;display:block;">
    <div style="position:absolute;inset:0;background:linear-gradient(to top,${c.background} 20%,${c.background}80 50%,transparent);"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(to right,${c.background}90,transparent 60%);"></div>
  </div>
  <div style="position:relative;z-index:1;max-width:760px;">
    <p class="reveal" style="font-size:11px;color:var(--p);letter-spacing:0.25em;text-transform:uppercase;font-weight:600;margin-bottom:28px;">${esc(hero?.badge ?? "")}</p>
    <h1 class="reveal delay-1" style="font-size:clamp(44px,7vw,100px);color:#fff;line-height:1.0;letter-spacing:0.04em;text-transform:uppercase;font-weight:900;margin-bottom:28px;">${esc(hero?.headline ?? "")}</h1>
    <p class="reveal delay-2" style="font-size:clamp(13px,1.4vw,16px);color:rgba(255,255,255,0.55);line-height:1.75;max-width:440px;margin-bottom:48px;letter-spacing:0.04em;text-transform:uppercase;font-weight:300;">${esc(hero?.subheadline ?? "")}</p>
    <div class="reveal delay-3" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
      <button style="display:inline-flex;align-items:center;gap:10px;padding:15px 36px;border:1px solid var(--p);color:var(--p);font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;background:transparent;border-radius:4px;" onmouseover="this.style.background='var(--p)20'" onmouseout="this.style.background='transparent'">${esc(hero?.ctaPrimary ?? "Enquire")} ${ICONS.ArrowRight}</button>
    </div>
  </div>
</section>`
}

// ─── How it Works ──────────────────────────────────────────────────────────────
function renderHowItWorks(
  section: WebsiteOutput["sections"]["howItWorks"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  if (!section?.steps?.length) return ""
  const lightBg = isLight(c.background)
  const isBrutalist = variant === "Bold Brutalist"

  return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:var(--bg);">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:clamp(48px,6vw,80px);">
      <h2 style="font-size:clamp(28px,4vw,52px);color:var(--tx);margin-bottom:16px;">${esc(section.title ?? "How it Works")}</h2>
      ${section.subtitle ? `<p style="font-size:18px;color:var(--tm);line-height:1.65;max-width:520px;margin:0 auto;">${esc(section.subtitle)}</p>` : ""}
    </div>
    <div class="how-steps" style="display:grid;grid-template-columns:repeat(${Math.min(section.steps.length, 3)},1fr);gap:${isBrutalist ? "0" : "32px"};">
      ${section.steps.map((step, i) => isBrutalist ? `
        <div class="reveal delay-${i + 1}" style="padding:40px 32px;border:3px solid ${i === 0 ? "var(--p)" : "var(--tx)"};${i > 0 ? "border-left:none;" : ""}">
          <div style="font-size:clamp(60px,8vw,100px);font-weight:900;color:${i === 0 ? "var(--p)" : "var(--tx)"}15;line-height:1;margin-bottom:20px;font-family:var(--hf);">${esc(step.step)}</div>
          <h3 style="font-size:20px;font-weight:800;color:var(--tx);margin-bottom:12px;text-transform:uppercase;">${esc(step.title)}</h3>
          <p style="font-size:15px;color:var(--tm);line-height:1.7;">${esc(step.description)}</p>
        </div>` : `
        <div class="reveal delay-${i + 1}" style="position:relative;padding:40px 32px;border-radius:var(--radius);background:${lightBg ? "#fff" : "rgba(255,255,255,0.04)"};border:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"};box-shadow:${lightBg ? "var(--shadow-sm)" : "none"};">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:${c.primary}15;border:1px solid ${c.primary}30;margin-bottom:24px;font-family:var(--hf);font-size:18px;font-weight:900;color:${c.primary};">${esc(step.step)}</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-0.02em;">${esc(step.title)}</h3>
          <p style="font-size:15px;color:var(--tm);line-height:1.7;">${esc(step.description)}</p>
          ${i < section.steps.length - 1 ? `<div style="position:absolute;top:50%;right:-17px;width:34px;height:34px;border-radius:50%;background:${c.primary}15;border:1px solid ${c.primary}30;display:flex;align-items:center;justify-content:center;color:${c.primary};z-index:1;">${ICONS.ArrowRight}</div>` : ""}
        </div>`).join("")}
    </div>
  </div>
</section>
<hr class="hr-grad">`
}

// ─── Features ──────────────────────────────────────────────────────────────────
function renderFeatures(
  features: WebsiteOutput["sections"]["features"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const items = features?.items ?? []
  const lightBg = isLight(c.background)
  const isBrutalist = variant === "Bold Brutalist"
  const isGlass = variant === "Glassmorphism"
  const isFuturistic = variant === "Futuristic"

  const altBg = lightBg ? "#f8fafc" : "rgba(255,255,255,0.02)"

  if (isBrutalist) {
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,5vw,80px);background:var(--bg);">
  <div style="max-width:1100px;margin:0 auto;">
    <h2 class="reveal" style="font-size:clamp(36px,5vw,72px);color:var(--tx);margin-bottom:60px;text-transform:uppercase;letter-spacing:-0.02em;">${esc(features?.title ?? "")}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;" class="features-grid">
      ${items.map((f, i) => `
        <div class="reveal delay-${(i % 3) + 1}" style="padding:40px 36px;border:3px solid var(--tx);${i % 2 !== 0 ? "border-left:none;" : ""}${i >= 2 ? "border-top:none;" : ""}display:flex;gap:20px;align-items:flex-start;">
          <div style="color:var(--p);flex-shrink:0;margin-top:2px;">${ico(f.icon)}</div>
          <div>
            <h3 style="font-size:18px;font-weight:800;color:var(--tx);margin-bottom:8px;text-transform:uppercase;">${esc(f.title)}</h3>
            <p style="font-size:15px;color:var(--tm);line-height:1.7;">${esc(f.description)}</p>
          </div>
        </div>`).join("")}
    </div>
  </div>
</section>`
  }

  if (isFuturistic) {
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:var(--bg);">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:60px;">
      <h2 style="font-size:clamp(28px,4vw,52px);color:var(--tx);margin-bottom:16px;">${esc(features?.title ?? "")}</h2>
      <p style="font-size:17px;color:var(--tm);max-width:480px;margin:0 auto;">${esc(features?.subtitle ?? "")}</p>
    </div>
    <div class="features-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:${c.primary}15;border:1px solid ${c.primary}20;border-radius:4px;overflow:hidden;">
      ${items.slice(0, 6).map((f, i) => `
        <div class="reveal delay-${(i % 3) + 1}" style="padding:36px 28px;background:var(--bg);transition:background 0.2s;" onmouseover="this.style.background='${c.primary}08'" onmouseout="this.style.background='var(--bg)'">
          <div style="color:${c.primary};margin-bottom:20px;">${ico(f.icon)}</div>
          <h3 style="font-size:17px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-0.02em;">${esc(f.title)}</h3>
          <p style="font-size:14px;color:var(--tm);line-height:1.7;">${esc(f.description)}</p>
        </div>`).join("")}
    </div>
  </div>
</section>`
  }

  if (isGlass) {
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:64px;">
      <h2 style="font-size:clamp(28px,4vw,52px);color:#fff;margin-bottom:16px;">${esc(features?.title ?? "")}</h2>
      <p style="font-size:17px;color:rgba(255,255,255,0.55);max-width:480px;margin:0 auto;">${esc(features?.subtitle ?? "")}</p>
    </div>
    <div class="features-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      ${items.slice(0, 6).map((f, i) => `
        <div class="reveal delay-${(i % 3) + 1}" style="padding:32px;border-radius:24px;background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);transition:all 0.25s;" onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.transform='translateY(-4px)'" onmouseout="this.style.background='rgba(255,255,255,0.07)';this.style.transform='translateY(0)'">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:${c.primary}25;margin-bottom:20px;color:${c.primary};">${ico(f.icon)}</div>
          <h3 style="font-size:17px;font-weight:700;color:#fff;margin-bottom:10px;">${esc(f.title)}</h3>
          <p style="font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;">${esc(f.description)}</p>
        </div>`).join("")}
    </div>
  </div>
</section>`
  }

  return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:${altBg};">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:clamp(48px,6vw,80px);max-width:600px;margin-left:auto;margin-right:auto;">
      <h2 style="font-size:clamp(28px,4vw,52px);color:var(--tx);margin-bottom:16px;">${esc(features?.title ?? "")}</h2>
      <p style="font-size:18px;color:var(--tm);line-height:1.65;">${esc(features?.subtitle ?? "")}</p>
    </div>
    <div class="features-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
      ${items.slice(0, 6).map((f, i) => `
        <div class="reveal delay-${(i % 3) + 1} card-surface" style="padding:36px 28px;border-radius:var(--radius);border:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"};transition:all 0.25s;cursor:default;box-shadow:${lightBg ? "var(--shadow-sm)" : "none"};" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='${lightBg ? "var(--shadow-md)" : `0 16px 48px rgba(0,0,0,0.25),0 0 0 1px ${c.primary}20`}';this.style.borderColor='${c.primary}35'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='${lightBg ? "var(--shadow-sm)" : "none"}';this.style.borderColor='${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"}'">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:${c.primary}12;border:1px solid ${c.primary}25;margin-bottom:24px;color:${c.primary};">${ico(f.icon)}</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--tx);margin-bottom:10px;letter-spacing:-0.02em;">${esc(f.title)}</h3>
          <p style="font-size:14px;color:var(--tm);line-height:1.75;">${esc(f.description)}</p>
        </div>`).join("")}
    </div>
  </div>
</section>`
}

// ─── Testimonials ──────────────────────────────────────────────────────────────
function renderTestimonials(
  testimonials: WebsiteOutput["sections"]["testimonials"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const items = testimonials?.items ?? []
  const lightBg = isLight(c.background)
  const isLuxury = variant === "Luxury Editorial" || variant === "Cinematic Dark"
  const isGlass = variant === "Glassmorphism"
  const isBrutalist = variant === "Bold Brutalist"

  if (isLuxury && items.length > 0) {
    const t = items[0]
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(40px,8vw,120px);background:var(--bg);">
  <div style="max-width:800px;">
    <div class="reveal" style="width:40px;height:1px;background:var(--p);margin-bottom:48px;opacity:0.5;"></div>
    <blockquote class="reveal delay-1" style="font-size:clamp(20px,2.5vw,28px);line-height:1.75;color:var(--tx);font-weight:300;letter-spacing:0.01em;margin-bottom:40px;font-style:italic;">"${esc(t.quote)}"</blockquote>
    <div class="reveal delay-2" style="display:flex;align-items:center;gap:16px;">
      <img src="${avatarImg(0)}" alt="${esc(t.author)}" loading="lazy" onerror="this.style.display='none'" style="width:48px;height:48px;border-radius:50%;object-fit:cover;opacity:0.8;">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--tx);letter-spacing:0.05em;">${esc(t.author)}</div>
        <div style="font-size:12px;color:var(--tm);margin-top:2px;letter-spacing:0.04em;">${esc(t.role)}, ${esc(t.company)}</div>
      </div>
    </div>
  </div>
</section>`
  }

  const stars = Array(5).fill(`<span style="color:#f59e0b;">${ICONS.Star}</span>`).join("")
  const cardBg = isGlass
    ? "background:rgba(255,255,255,0.07);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.13);"
    : isBrutalist
      ? "background:transparent;border:3px solid var(--tx);"
      : lightBg
        ? "background:#fff;border:1px solid rgba(0,0,0,0.07);box-shadow:var(--shadow-sm);"
        : "background:var(--sf);border:1px solid rgba(255,255,255,0.07);"

  const altBg = lightBg ? "#f1f5f9" : (isGlass ? "transparent" : "#040404")

  return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:${altBg};">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:64px;">
      <h2 style="font-size:clamp(28px,4vw,52px);color:${isGlass ? "#fff" : "var(--tx)"};margin-bottom:16px;">${esc(testimonials?.title ?? "")}</h2>
    </div>
    <div class="testi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${isBrutalist ? "0" : "20px"};">
      ${items.slice(0, 3).map((t, i) => `
        <div class="reveal delay-${i + 1}" style="${cardBg}padding:36px;border-radius:${isBrutalist ? "0" : "var(--radius-lg)"};display:flex;flex-direction:column;gap:20px;${isBrutalist && i > 0 ? "border-left:none;" : ""}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="color:${c.primary};">${ICONS.Quote}</div>
            <div style="display:flex;gap:2px;">${stars}</div>
          </div>
          <p style="font-size:15px;line-height:1.8;color:${isGlass ? "rgba(255,255,255,0.8)" : "var(--tx)"};flex:1;font-weight:400;">"${esc(t.quote)}"</p>
          ${t.metric ? `<div style="display:inline-block;padding:5px 14px;border-radius:${isBrutalist ? "0" : "100px"};background:${c.primary}15;border:1px solid ${c.primary}30;color:${c.primary};font-size:12px;font-weight:700;letter-spacing:0.04em;width:fit-content;">${esc(t.metric)}</div>` : ""}
          <div style="display:flex;align-items:center;gap:14px;border-top:1px solid ${isGlass ? "rgba(255,255,255,0.1)" : isBrutalist ? "var(--tx)" : lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"};padding-top:20px;">
            <img src="${avatarImg(i)}" alt="${esc(t.author)}" loading="lazy" onerror="this.style.background='${c.primary}25';this.style.border='1px solid ${c.primary}40'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${c.primary}30;flex-shrink:0;">
            <div>
              <div style="font-weight:700;font-size:14px;color:${isGlass ? "#fff" : "var(--tx)"};">${esc(t.author)}</div>
              <div style="font-size:12px;color:${isGlass ? "rgba(255,255,255,0.5)" : "var(--tm)"};margin-top:2px;">${esc(t.role)}, <span style="color:var(--p);">${esc(t.company)}</span></div>
            </div>
          </div>
        </div>`).join("")}
    </div>
  </div>
</section>`
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
function renderPricing(
  pricing: WebsiteOutput["sections"]["pricing"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const tiers = pricing?.tiers ?? []
  const lightBg = isLight(c.background)
  const isGlass = variant === "Glassmorphism"
  const isBrutalist = variant === "Bold Brutalist"

  return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:var(--bg);">
  <div style="max-width:1100px;margin:0 auto;">
    <div class="reveal" style="text-align:center;margin-bottom:64px;">
      <h2 style="font-size:clamp(28px,4vw,52px);color:${isGlass ? "#fff" : "var(--tx)"};margin-bottom:16px;">${esc(pricing?.title ?? "Pricing")}</h2>
      <p style="font-size:18px;color:${isGlass ? "rgba(255,255,255,0.55)" : "var(--tm)"};max-width:460px;margin:0 auto;line-height:1.65;">${esc(pricing?.subtitle ?? "")}</p>
    </div>
    <div class="pricing-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${isBrutalist ? "0" : "20px"};align-items:start;">
      ${tiers.map((tier, i) => {
        const highlighted = tier.highlighted
        const cardStyle = isGlass
          ? `background:rgba(255,255,255,${highlighted ? "0.13" : "0.06"});backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1.5px solid ${highlighted ? `${c.primary}60` : "rgba(255,255,255,0.12)"};`
          : isBrutalist
            ? `background:${highlighted ? `${c.primary}08` : "transparent"};border:3px solid ${highlighted ? "var(--p)" : "var(--tx)"};${i > 0 ? "border-left:none;" : ""}`
            : lightBg
              ? `background:#fff;border:${highlighted ? `2px solid ${c.primary}` : "1px solid rgba(0,0,0,0.07)"};box-shadow:${highlighted ? `0 8px 40px ${c.primary}20,var(--shadow-md)` : "var(--shadow-sm)"};`
              : `background:${highlighted ? `linear-gradient(160deg,${c.primary}14,${c.surface})` : "var(--sf)"};border:${highlighted ? `1.5px solid ${c.primary}50` : "1px solid rgba(255,255,255,0.07)"};box-shadow:${highlighted ? `0 0 60px ${c.primary}20` : "none"};`

        return `
        <div class="reveal delay-${i + 1}" style="position:relative;padding:40px 32px;border-radius:${isBrutalist ? "0" : "var(--radius-lg)"};${cardStyle}display:flex;flex-direction:column;">
          ${tier.badge ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:var(--p);color:${lightBg ? "#fff" : c.background};padding:4px 20px;border-radius:${isBrutalist ? "0" : "100px"};font-size:12px;font-weight:700;white-space:nowrap;letter-spacing:0.05em;box-shadow:0 4px 16px ${c.primary}40;">${esc(tier.badge)}</div>` : ""}
          <div style="font-size:12px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">${esc(tier.name)}</div>
          <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:8px;">
            <span style="font-family:var(--hf);font-size:clamp(36px,4.5vw,52px);font-weight:900;color:${highlighted ? "var(--p)" : isGlass ? "#fff" : "var(--tx)"};line-height:1;">${esc(tier.price)}</span>
            ${tier.period ? `<span style="font-size:15px;color:var(--tm);font-weight:500;">${esc(tier.period)}</span>` : ""}
          </div>
          ${tier.description ? `<p style="font-size:13px;color:var(--tm);line-height:1.6;margin-bottom:24px;">${esc(tier.description)}</p>` : ""}
          <ul style="flex:1;padding:20px 0;border-top:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)"};border-bottom:1px solid ${lightBg ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)"};margin:8px 0;display:flex;flex-direction:column;gap:12px;">
            ${(tier.features ?? []).map(f => `
              <li style="display:flex;align-items:flex-start;gap:10px;">
                <span style="color:${c.primary};flex-shrink:0;margin-top:1px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:${c.primary}15;">${ICONS.Check}</span>
                <span style="font-size:14px;color:var(--tm);line-height:1.45;">${esc(f)}</span>
              </li>`).join("")}
          </ul>
          <button style="margin-top:24px;width:100%;padding:15px 24px;border-radius:${isBrutalist ? "0" : "var(--radius-sm)"};font-weight:700;font-size:15px;background:${highlighted ? "var(--p)" : "transparent"};color:${highlighted ? (lightBg ? "#fff" : c.background) : (isGlass ? "#fff" : "var(--tx)")};border:${highlighted ? "none" : `1.5px solid ${lightBg ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)"}`};${highlighted ? `box-shadow:0 4px 20px ${c.primary}40;` : ""}transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';${highlighted ? `this.style.boxShadow='0 8px 32px ${c.primary}55'` : "this.style.borderColor='var(--p)';this.style.color='var(--p)'"}" onmouseout="this.style.transform='translateY(0)';${highlighted ? `this.style.boxShadow='0 4px 20px ${c.primary}40'` : `this.style.borderColor='${lightBg ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)"}';this.style.color='${isGlass ? "#fff" : "var(--tx)"}'`}">${esc(tier.cta)}</button>
        </div>`
      }).join("")}
    </div>
  </div>
</section>`
}

// ─── CTA Section ───────────────────────────────────────────────────────────────
function renderCta(
  cta: WebsiteOutput["sections"]["cta"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const lightBg = isLight(c.background)
  const isLuxury = variant === "Luxury Editorial" || variant === "Cinematic Dark"
  const isBrutalist = variant === "Bold Brutalist"
  const isGlass = variant === "Glassmorphism"

  if (isBrutalist) {
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,5vw,80px);background:var(--tx);">
  <div style="max-width:1000px;margin:0 auto;">
    <h2 class="reveal" style="font-size:clamp(40px,7vw,96px);color:var(--bg);line-height:0.95;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:40px;font-weight:900;">${esc(cta?.headline ?? "")}</h2>
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
      <button class="reveal delay-1" style="padding:20px 52px;background:var(--p);color:${c.background};font-weight:900;font-size:18px;text-transform:uppercase;letter-spacing:0.02em;border-radius:0;" onmouseover="this.style.transform='translate(-3px,-3px)';this.style.boxShadow='6px 6px 0 ${c.background}'" onmouseout="this.style.transform='translate(0,0)';this.style.boxShadow='none'">${esc(cta?.buttonText ?? "Get Started")}</button>
      ${cta?.subtext ? `<span class="reveal delay-2" style="font-size:14px;color:var(--bg);opacity:0.6;">${esc(cta.subtext)}</span>` : ""}
    </div>
  </div>
</section>`
  }

  if (isLuxury) {
    return `
<section style="padding:clamp(80px,10vw,120px) clamp(40px,8vw,120px);background:var(--bg);">
  <div style="max-width:800px;">
    <div class="reveal" style="width:40px;height:1px;background:var(--p);margin-bottom:48px;opacity:0.5;"></div>
    <h2 class="reveal delay-1" style="font-size:clamp(36px,5vw,72px);color:var(--tx);margin-bottom:24px;letter-spacing:0.03em;line-height:1.1;">${esc(cta?.headline ?? "")}</h2>
    <p class="reveal delay-2" style="font-size:clamp(14px,1.5vw,17px);color:var(--tm);line-height:1.85;max-width:460px;margin-bottom:52px;font-weight:300;">${esc(cta?.subheadline ?? "")}</p>
    <a class="reveal delay-3" href="#" style="display:inline-flex;align-items:center;gap:12px;padding:16px 40px;border:1px solid var(--p);color:var(--p);font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;" onmouseover="this.style.background='var(--p)';this.style.color='var(--bg)'" onmouseout="this.style.background='transparent';this.style.color='var(--p)'">${esc(cta?.buttonText ?? "Enquire")} ${ICONS.ArrowRight}</a>
  </div>
</section>`
  }

  if (isGlass) {
    return `
<section style="padding:clamp(64px,8vw,100px) clamp(20px,4vw,48px);">
  <div style="max-width:960px;margin:0 auto;">
    <div class="reveal" style="text-align:center;padding:clamp(64px,8vw,100px) clamp(32px,5vw,80px);border-radius:32px;background:rgba(255,255,255,0.07);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.14);">
      <h2 style="font-size:clamp(30px,5vw,60px);color:#fff;margin-bottom:20px;font-weight:900;">${esc(cta?.headline ?? "")}</h2>
      <p style="font-size:18px;color:rgba(255,255,255,0.6);margin-bottom:44px;line-height:1.65;max-width:480px;margin-left:auto;margin-right:auto;">${esc(cta?.subheadline ?? "")}</p>
      <button style="display:inline-flex;align-items:center;gap:8px;padding:17px 52px;border-radius:16px;background:linear-gradient(135deg,var(--p),var(--a));color:#fff;font-weight:700;font-size:17px;box-shadow:0 8px 40px ${c.primary}50;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">${esc(cta?.buttonText ?? "Get Started")} ${ICONS.ArrowRight}</button>
      ${cta?.subtext ? `<p style="margin-top:18px;font-size:13px;color:rgba(255,255,255,0.4);">${esc(cta.subtext)}</p>` : ""}
    </div>
  </div>
</section>`
  }

  return `
<section style="padding:clamp(64px,8vw,100px) clamp(20px,4vw,48px);background:var(--bg);">
  <div style="max-width:960px;margin:0 auto;">
    <div class="reveal" style="position:relative;text-align:center;padding:clamp(64px,8vw,100px) clamp(32px,5vw,80px);border-radius:32px;background:${lightBg ? `linear-gradient(135deg,${c.primary}08,${c.secondary}06)` : `linear-gradient(135deg,${c.primary}16,${c.surface})`};border:1px solid ${c.primary}28;overflow:hidden;">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:300px;height:2px;background:linear-gradient(90deg,transparent,${c.primary}60,transparent);"></div>
      <div style="position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:320px;height:320px;background:${c.primary}12;border-radius:50%;filter:blur(80px);pointer-events:none;"></div>
      <h2 style="position:relative;font-size:clamp(30px,5vw,60px);color:var(--tx);margin-bottom:20px;font-weight:900;">${esc(cta?.headline ?? "")}</h2>
      <p style="position:relative;font-size:18px;color:var(--tm);margin-bottom:44px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.65;">${esc(cta?.subheadline ?? "")}</p>
      <div style="position:relative;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
        <button style="display:inline-flex;align-items:center;gap:8px;padding:17px 48px;border-radius:var(--radius-sm);background:var(--p);color:${lightBg ? "#fff" : c.background};font-weight:700;font-size:17px;box-shadow:0 4px 24px ${c.primary}45;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 36px ${c.primary}60'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 24px ${c.primary}45'">${esc(cta?.buttonText ?? "Get Started")} ${ICONS.ArrowRight}</button>
      </div>
      ${cta?.subtext ? `<p style="position:relative;margin-top:18px;font-size:13px;color:var(--tm);">${esc(cta.subtext)}</p>` : ""}
    </div>
  </div>
</section>`
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────
function renderFaq(
  faq: WebsiteOutput["sections"]["faq"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const items = faq?.items ?? []
  const lightBg = isLight(c.background)
  const isGlass = variant === "Glassmorphism"
  const isBrutalist = variant === "Bold Brutalist"
  const altBg = lightBg ? "#f1f5f9" : (isGlass ? "transparent" : "#030303")

  return `
<section style="padding:clamp(80px,10vw,120px) clamp(20px,4vw,48px);background:${altBg};">
  <div style="max-width:760px;margin:0 auto;">
    <h2 class="reveal" style="text-align:center;font-size:clamp(28px,4vw,52px);color:${isGlass ? "#fff" : "var(--tx)"};margin-bottom:60px;">${esc(faq?.title ?? "Frequently Asked Questions")}</h2>
    <div style="display:flex;flex-direction:column;gap:${isBrutalist ? "0" : "12px"};">
      ${items.map((item, i) => `
        <details class="reveal delay-${Math.min(i + 1, 5)}" style="border-radius:${isBrutalist ? "0" : "var(--radius-sm)"};border:${isBrutalist ? `3px solid var(--tx);${i > 0 ? "border-top:none;" : ""}` : isGlass ? "1px solid rgba(255,255,255,0.12);" : lightBg ? "1px solid rgba(0,0,0,0.08);" : "1px solid rgba(255,255,255,0.08);"};overflow:hidden;background:${isGlass ? "rgba(255,255,255,0.06);backdrop-filter:blur(16px);" : isBrutalist ? "transparent;" : lightBg ? "#fff;" : "var(--sf);"}transition:border-color 0.2s;" onmouseover="this.style.borderColor='${isBrutalist ? "var(--p)" : c.primary}40'" onmouseout="this.style.borderColor='${isBrutalist ? "var(--tx)" : lightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"}'">
          <summary style="padding:22px 26px;font-weight:600;font-size:15px;color:${isGlass ? "#fff" : "var(--tx)"};list-style:none;display:flex;justify-content:space-between;align-items:center;cursor:pointer;gap:16px;line-height:1.45;">
            ${esc(item.question)}
            <span style="color:var(--p);font-size:24px;flex-shrink:0;font-weight:300;line-height:1;">+</span>
          </summary>
          <div style="padding:0 26px 22px;font-size:15px;color:${isGlass ? "rgba(255,255,255,0.6)" : "var(--tm)"};line-height:1.75;border-top:1px solid ${isGlass ? "rgba(255,255,255,0.1)" : lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"};padding-top:18px;">${esc(item.answer)}</div>
        </details>`).join("")}
    </div>
  </div>
</section>`
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function renderFooter(
  footer: WebsiteOutput["sections"]["footer"],
  brand: WebsiteOutput["brand"],
  c: WebsiteOutput["colorPalette"],
  variant: string
): string {
  const lightBg = isLight(c.background)
  const isGlass = variant === "Glassmorphism"
  const isBrutalist = variant === "Bold Brutalist"

  const cols = (footer?.columns ?? []).map(col => `
    <div>
      <div style="font-size:11px;font-weight:700;color:${isGlass ? "rgba(255,255,255,0.6)" : "var(--tx)"};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px;">${esc(col.title)}</div>
      ${(col.links ?? []).map(l => `<a href="#" style="display:block;font-size:14px;color:var(--tm);margin-bottom:11px;transition:color 0.2s;" onmouseover="this.style.color='${isGlass ? "#fff" : "var(--tx)"}'" onmouseout="this.style.color='var(--tm)'">${esc(l)}</a>`).join("")}
    </div>`).join("")

  return `
<footer style="background:var(--bg);border-top:${isBrutalist ? "3px solid var(--tx)" : `1px solid ${lightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`};padding:clamp(56px,7vw,88px) clamp(20px,4vw,48px) 36px;">
  <div style="max-width:1280px;margin:0 auto;">
    <div class="footer-grid" style="display:grid;grid-template-columns:2fr repeat(${Math.min((footer?.columns ?? []).length, 3)},1fr);gap:40px;margin-bottom:56px;">
      <div>
        <div style="font-family:var(--hf);font-size:22px;font-weight:900;color:${isGlass ? "#fff" : "var(--tx)"};margin-bottom:16px;letter-spacing:-0.04em;">${esc(brand.name)}</div>
        <p style="font-size:14px;color:var(--tm);line-height:1.7;max-width:260px;">${esc(footer?.tagline ?? brand.tagline)}</p>
      </div>
      ${cols}
    </div>
    <hr class="hr-grad" style="margin-bottom:32px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
      <p style="font-size:13px;color:var(--tm);">${esc(footer?.legal ?? `© 2025 ${brand.name}. All rights reserved.`)}</p>
      <div style="display:flex;gap:24px;">
        <a href="#" style="font-size:13px;color:var(--tm);">Privacy</a>
        <a href="#" style="font-size:13px;color:var(--tm);">Terms</a>
        <a href="#" style="font-size:13px;color:var(--tm);">Security</a>
      </div>
    </div>
  </div>
</footer>`
}

// ─── Main entry point ──────────────────────────────────────────────────────────
export function generateWebsiteHtml(data: WebsiteOutput): string {
  const c = data.colorPalette
  const t = data.typography
  const brand = data.brand
  const sections = data.sections
  const variant = data.designVariant ?? "Premium SaaS"
  const industry = data._industry ?? "SaaS"
  const variantSeed = data._variantSeed ?? 0
  const aiHeroImage = data._heroImage ?? null

  const lightBg = isLight(c.background)

  const hf1 = t.headingFont.replace(/ /g, "+")
  const hf2 = t.bodyFont.replace(/ /g, "+")

  const htmlParts = [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<title>${esc(data.seoMeta?.title ?? brand.name)}</title>`,
    `<meta name="description" content="${esc(data.seoMeta?.description ?? "")}">`,
    `<meta name="keywords" content="${esc((data.seoMeta?.keywords ?? []).join(", "))}">`,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link href="https://fonts.googleapis.com/css2?family=${hf1}:wght@300;400;500;600;700;800;900&family=${hf2}:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">`,
    `<style>`,
    baseCss(c, t, variant),
    `</style>`,
    `</head>`,
    `<body>`,
    renderNav(sections.nav, brand, c, variant),
    renderHero(sections.hero, c, t, brand, variant, industry, aiHeroImage, variantSeed),
    renderHowItWorks(sections.howItWorks, c, variant),
    `<hr class="hr-grad">`,
    renderFeatures(sections.features, c, variant),
    `<hr class="hr-grad">`,
    renderTestimonials(sections.testimonials, c, variant),
    `<hr class="hr-grad">`,
    renderPricing(sections.pricing, c, variant),
    `<hr class="hr-grad">`,
    renderCta(sections.cta, c, variant),
    `<hr class="hr-grad">`,
    renderFaq(sections.faq, c, variant),
    renderFooter(sections.footer, brand, c, variant),
    SCROLL_JS,
    `</body>`,
    `</html>`,
  ]

  return htmlParts.join("\n")
}

// ─── Backwards-compatible aliases ─────────────────────────────────────────────
export const buildPreviewHtml = generateWebsiteHtml

export function buildNextjsProject(data: WebsiteOutput): Record<string, string> {
  const html = generateWebsiteHtml(data)
  const brand = data.brand
  const c = data.colorPalette
  const t = data.typography
  const safeFont = (f: string) => `'${f}', sans-serif`

  const packageJson = JSON.stringify({
    name: brand.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "14.2.0", react: "^18", "react-dom": "^18" },
    devDependencies: { typescript: "^5", "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18" }
  }, null, 2)

  const indexPage = `import Head from 'next/head'
export default function Home() {
  return (
    <>
      <Head>
        <title>${data.seoMeta?.title ?? brand.name}</title>
        <meta name="description" content="${data.seoMeta?.description ?? ""}" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=${t.headingFont.replace(/ /g, "+")}:wght@400;700;900&family=${t.bodyFont.replace(/ /g, "+")}:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>
      <main dangerouslySetInnerHTML={{ __html: \`<style>body{font-family:${safeFont(t.bodyFont)};background:${c.background};color:${c.text}}</style>\` }} />
    </>
  )
}`

  const globalsCss = `* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary: ${c.primary};
  --secondary: ${c.secondary};
  --accent: ${c.accent};
  --bg: ${c.background};
  --tx: ${c.text};
  --tm: ${c.textMuted};
}
body { font-family: ${safeFont(t.bodyFont)}; background: var(--bg); color: var(--tx); }`

  const tsconfigJson = JSON.stringify({
    compilerOptions: {
      target: "es5", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
      resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, paths: { "@/*": ["./src/*"] }
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"]
  }, null, 2)

  const nextConfigJs = `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`

  return {
    "package.json": packageJson,
    "next.config.js": nextConfigJs,
    "tsconfig.json": tsconfigJson,
    "src/app/globals.css": globalsCss,
    "src/app/page.tsx": indexPage,
    "public/index.html": html,
  }
}
