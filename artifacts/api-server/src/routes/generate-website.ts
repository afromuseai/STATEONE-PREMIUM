import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "../lib/models";
import { onWebsiteGenerationComplete } from "../lib/business-graph";
import { logEventFireForget } from "../lib/log-event";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const router = Router();

// ─── Multi-Model Architecture ─────────────────────────────────────────────────
// Both phases now use Llama 4 Maverick — full website generation pipeline.
// WEBSITE_PLANNING       → Llama 4 Maverick 17B-128E (strategic reasoning, structured JSON, streaming)
// COMPONENT_GENERATION   → Llama 4 Maverick 17B-128E (React/Tailwind component code generation)
// Visual Assets          → FLUX.1-schnell (AI hero image — graceful null if not on account)
const ORCHESTRATION_MODEL  = MODELS.WEBSITE_PLANNING;       // meta/llama-4-maverick-17b-128e-instruct
const IMPLEMENTATION_MODEL = MODELS.COMPONENT_GENERATION;   // meta/llama-4-maverick-17b-128e-instruct
const IMAGE_MODEL          = "black-forest-labs/flux-schnell";

// ─── Industry-Aware Design Systems ───────────────────────────────────────────
const INDUSTRY_DESIGN_SYSTEMS: Record<string, {
  style: string; tone: string; principles: string; sectionOrder: string;
  trustSignals: string; primaryConversion: string; colorStrategy: string;
}> = {
  Cybersecurity: {
    style: "Corporate",
    tone: "Corporate",
    principles: `- Trust-first visual hierarchy: compliance badges, certifications visible above the fold
- Enterprise credibility signals: Fortune 500 logos, SOC2/ISO/GDPR badges
- Technical depth: security architecture diagrams, threat intelligence dashboards
- Dark, authoritative color scheme — deep navy or charcoal, no playful elements
- Formal enterprise language: ROI, uptime SLA, MTTR, incident response`,
    sectionOrder: "Hero (threat context + trust badge) → Client logos → Security Architecture/How it works → Features (detection/response focused) → Compliance Certifications → Enterprise Testimonials → Pricing (enterprise/annual) → FAQ (compliance/integration questions) → CTA",
    trustSignals: "SOC2 Type II, ISO 27001, GDPR compliant, CISA aligned, 99.99% uptime SLA, named enterprise logos",
    primaryConversion: "Book a security demo / Start free security assessment",
    colorStrategy: "Deep navy (#0a1628) background, electric blue (#1e6fd9) or electric cyan accent, white text. No warm colors.",
  },
  Fintech: {
    style: "Corporate",
    tone: "Corporate",
    principles: `- Regulatory credibility first: banking licenses, regulated entity status prominently displayed
- Show the product (financial dashboard UI) immediately in the hero
- Onboarding funnel: show how fast users can get started (3 steps, 5 minutes)
- Security indicators throughout: encryption, 2FA, bank-level security
- Transaction volume / AUM as social proof (e.g. "$2B processed")`,
    sectionOrder: "Hero (social proof metric + product preview) → How it works (onboarding funnel) → Features (financial tools) → Security & Compliance section → Integrations (banks/APIs) → Testimonials (ROI/savings) → Pricing → FAQ (regulatory/compliance) → CTA",
    trustSignals: "Regulated by [authority], bank-level 256-bit encryption, FDIC/FSCS insured, SOC2 certified, transaction volume",
    primaryConversion: "Open account free / Start 30-day trial / Book a demo",
    colorStrategy: "Deep navy or dark green background with gold or teal accent. Conveys financial stability.",
  },
  SaaS: {
    style: "SaaS",
    tone: "Professional",
    principles: `- Product-led: show the actual UI/dashboard in the hero section
- Metric-heavy social proof: exact numbers ('10,247 teams', '$4.2M saved', '3.2x faster')
- Integration ecosystem: show logos of tools your ICP already uses (Slack, Salesforce, Notion)
- Friction-free CTA: free trial, no credit card required
- Feature depth without complexity: benefits over specs`,
    sectionOrder: "Hero (product screenshot + key metric) → Social proof logos → Features (3-column grid) → Product tour/workflow section → Integrations → Testimonials → Pricing → FAQ → CTA",
    trustSignals: "Customer count, named logos, G2 rating, uptime SLA, free trial / no credit card",
    primaryConversion: "Start free trial — no credit card required",
    colorStrategy: "Very dark background (#0a0a0a or #0d0d14), single accent (violet #7c3aed or indigo #4f46e5). Developer-grade precision.",
  },
  Healthcare: {
    style: "Corporate",
    tone: "Friendly",
    principles: `- HIPAA compliance and patient privacy must appear in the hero
- Clinical credibility: MD/physician advisors, peer-reviewed research citations
- Empathy-first copy focused on patient outcomes, not product features
- Accessibility: high contrast, large readable text, clear navigation
- Trust through humanity: real patient stories, before/after transformations`,
    sectionOrder: "Hero (patient outcome + HIPAA badge) → How it works → Clinical Features → HIPAA/Compliance section → Provider testimonials → Patient testimonials → Pricing → FAQ (privacy/compliance) → CTA",
    trustSignals: "HIPAA compliant, board-certified physicians, IRB-approved research, FDA cleared (if applicable)",
    primaryConversion: "Book a free consultation / Start your assessment",
    colorStrategy: "Clean white or very light background with calm teal/blue accent. Conveys clinical trust.",
  },
  Education: {
    style: "Startup",
    tone: "Friendly",
    principles: `- Outcome-led: lead with career transformation (salary increase, job placement rate)
- Free sample content in the hero to reduce purchase barrier
- Student success stories with specific before/after narratives
- Curriculum transparency: show the learning path before asking to enroll
- Urgency through cohort enrollment or limited seats`,
    sectionOrder: "Hero (transformation/outcome metric) → Social proof (outcomes + alumni logos) → Curriculum preview → Instructor credibility → Student testimonials → Pricing (with payment plans) → FAQ (commitment/outcomes) → CTA",
    trustSignals: "Job placement rate, average salary increase, alumni at named companies, satisfaction/money-back guarantee",
    primaryConversion: "Enroll now / Watch free lesson / Start learning free",
    colorStrategy: "Bold, high-energy. Dark background with bright accent (orange #f97316 or green #22c55e). YC energy.",
  },
  Marketplace: {
    style: "Startup",
    tone: "Friendly",
    principles: `- Dual-sided trust: address both buyer AND seller trust simultaneously
- Volume signals: active listings, transaction volume, active user count
- Safety and escrow/buyer protection prominently displayed
- Show the actual product/search UI to demonstrate inventory depth
- Make joining the marketplace feel low-friction for both sides`,
    sectionOrder: "Hero (value for both sides + volume stat) → How it works (both flows in 2 columns) → Featured listings/sellers → Trust & Safety section → Testimonials (buyers + sellers) → Pricing/fee structure → FAQ → CTA",
    trustSignals: "Buyer protection guarantee, seller verification process, escrow services, dispute resolution, transaction volume",
    primaryConversion: "Browse listings / Post your first listing free",
    colorStrategy: "Clean, approachable. White or very dark with warm amber/orange accent. Platform feel.",
  },
  Agency: {
    style: "Corporate",
    tone: "Professional",
    principles: `- Portfolio-first: lead with a specific transformation case study above the fold
- Named client logos and ROI metrics before any feature explanations
- Team expertise and thought leadership positioning
- Clear process/methodology to reduce uncertainty about working together
- Positioning as a strategic partner, not a vendor`,
    sectionOrder: "Hero (key result metric + client logo) → Client logos → Case study results → Services → Team section → Process/Methodology → More testimonials → Engagement pricing → FAQ → CTA",
    trustSignals: "Named client logos, case study ROI metrics, years of experience, team certifications, industry awards",
    primaryConversion: "Book a strategy call / Get a free audit / View our work",
    colorStrategy: "Authoritative dark with gold or white accent. Premium professional appearance.",
  },
  Luxury: {
    style: "Luxury",
    tone: "Premium",
    principles: `- Editorial composition: every element intentionally placed, generous whitespace
- Restraint over maximalism: say less, mean more — minimalist layout
- Cinematic visual storytelling: each section tells part of a brand narrative
- Exclusivity signals: limited availability, bespoke, by appointment, curated
- Never mention pricing directly on the main page — lead to enquiry`,
    sectionOrder: "Nav (minimal, logo only) → Hero (cinematic, single powerful statement) → Brand philosophy → Product/service showcase → Craftsmanship/provenance story → Curated testimonials (1-2) → Experience section → Contact (not 'pricing') → Footer",
    trustSignals: "Heritage narrative, craftsmanship story, limited edition, featured in [premium publication], awards",
    primaryConversion: "Request private consultation / Book by appointment / Enquire",
    colorStrategy: "Pure black (#000) background, gold (#d4af37) as the ONLY accent. Every pixel must feel crafted.",
  },
  "E-commerce": {
    style: "Startup",
    tone: "Friendly",
    principles: `- Urgency and scarcity signals: limited stock, countdown timers, flash sales where appropriate
- Social proof everywhere: review count, star ratings, user-generated photos
- Return policy and money-back guarantee prominently displayed to reduce purchase anxiety
- Product photography and lifestyle imagery implied in the design structure
- Free shipping threshold as a conversion driver`,
    sectionOrder: "Hero (offer + review count) → Best sellers / featured products → Benefits/why us → Customer reviews (UGC) → How it works / sourcing story → Guarantee & returns → More products → FAQ → CTA",
    trustSignals: "Star rating + review count, money-back guarantee, free shipping, secure checkout, return policy",
    primaryConversion: "Shop now / Get X% off your first order",
    colorStrategy: "High contrast — either dark with vibrant accent or clean white with bold product colors.",
  },
  "Creator Economy": {
    style: "Startup",
    tone: "Friendly",
    principles: `- Creator-first narrative: lead with the creator's story and audience
- Monetization proof: show income potential, conversion rates, community size
- Fan/audience engagement features prominently displayed
- Simple onboarding for both creators and fans
- Community and exclusivity as the primary value proposition`,
    sectionOrder: "Hero (creator income metric) → Featured creators → How creators earn → Features → Community proof → Creator testimonials → Pricing/plans → FAQ → CTA",
    trustSignals: "Creator earnings stats, community size, platform uptime, payout speed, creator testimonials",
    primaryConversion: "Start your page free / Join as a creator",
    colorStrategy: "Bold, energetic. Dark background with bright accent (pink #ec4899 or purple #9333ea).",
  },
};

// ─── Style Guides ─────────────────────────────────────────────────────────────
const STYLE_GUIDES: Record<string, string> = {
  SaaS: "Clean, precision-engineered SaaS aesthetic. Think Linear, Vercel. Very dark background (#0a0a0a), tight typography, single accent color (violet or indigo), grid patterns. Professional developer tool feel.",
  Corporate: "Trust-first enterprise aesthetic. Deep navy or charcoal backgrounds, white text, authoritative accent. Conservative but modern — wide sections, clear hierarchy, proof points, compliance-safe.",
  Startup: "Bold, high-energy startup aesthetic. High contrast, punchy CTAs, metric-heavy social proof, orange or green accent on dark. YC Demo Day energy.",
  Luxury: "Ultra-premium luxury aesthetic. Pure black (#000) background, gold (#d4af37) as ONLY accent, generous whitespace, wide letter-spacing. Every element feels crafted. Apple × Rolex.",
  Minimal: "Ultra-minimal whitespace-first design. Off-white (#fafafa) or near-black, single accent, maximum breathing room. Let typography do all the work.",
};

const TONE_GUIDES: Record<string, string> = {
  Professional: "Clear, authoritative, benefit-forward. Every claim backed by specificity. No hype words. 'Reduce onboarding time by 40%' not 'super fast onboarding'.",
  Corporate: "Formal enterprise language. ROI-focused, compliance-aware, scalability-oriented. Speaks to executives and procurement teams.",
  Friendly: "Warm, human, approachable. Conversational but never casual. Encourages action through warmth. Outcome-focused.",
  Premium: "Exclusive, aspirational, high-value. Words like 'crafted', 'exceptional', 'curated'. Never discount, never beg.",
};

// ─── Design Variant System ─────────────────────────────────────────────────────
const DESIGN_VARIANTS: Record<string, {
  description: string;
  heroLayout: string;
  colorConstraints: string;
  typographyConstraints: string;
  componentStyle: string;
  promptInstructions: string;
}> = {
  "Futuristic": {
    description: "Dark tech aesthetic — neon glows, geometric grid patterns, sharp angles, cyberpunk energy",
    heroLayout: "fullscreen-centered",
    colorConstraints: "Background must be #020408 or #030912. Primary must be cyan #00d4ff, electric blue #0ea5e9, or neon purple #7c3aed. NO warm colors.",
    typographyConstraints: "Tight letter-spacing (-0.05em). Use Inter or Space Grotesk. Bold weights (800-900). Uppercase section labels.",
    componentStyle: "Sharp corners (border-radius: 4px max). Glowing borders (box-shadow: 0 0 20px primary). Grid overlay patterns. Scan-line accents.",
    promptInstructions: "Design variant: FUTURISTIC. Make the brand feel like cutting-edge deep tech. Hero headline should feel like a system alert or mission statement. Stats must feel like live data readouts. CTA buttons must have a terminal/command energy.",
  },
  "Premium SaaS": {
    description: "Developer-grade precision — near-black, single violet/indigo accent, metric-heavy, product-led",
    heroLayout: "split-product",
    colorConstraints: "Background must be #0a0a0a or #0d0d14. Primary must be violet #7c3aed, indigo #4f46e5, or blue #3b82f6. Very dark surface colors.",
    typographyConstraints: "Ultra-tight tracking (-0.05em). Use Inter. Font weights 800-900 for headings. Monospace for code snippets.",
    componentStyle: "Rounded corners (12-16px). Subtle grid pattern on hero. Purple/violet glow on CTA. Clean card borders.",
    promptInstructions: "Design variant: PREMIUM SAAS. Think Linear, Vercel, Raycast aesthetic. Hero headline should name the exact workflow pain. Stats should feel like dashboard readouts. Pricing tiers should map directly to team size.",
  },
  "Luxury Editorial": {
    description: "Ultra-premium editorial — pure black, gold accent, serif typography, cinematic whitespace, restraint over maximalism",
    heroLayout: "centered-editorial",
    colorConstraints: "Background must be #000000. Primary/accent must be gold #d4af37 or champagne #e8d5a3. Surface #0a0a0a. NO other accent colors.",
    typographyConstraints: "Use Cormorant Garamond or Playfair Display for headings. Wide letter-spacing (0.05-0.15em) for headlines. Thin body text (300 weight). Generous line-height (1.9).",
    componentStyle: "Zero or minimal border-radius (0-4px). Hairline borders (1px gold/20%). No card backgrounds — section separation by spacing only. No floating badges.",
    promptInstructions: "Design variant: LUXURY EDITORIAL. Think Rolex, Bottega Veneta, The Row. Hero should have ONE powerful statement — no badge, no stats. Testimonials should be 1-2 curated quotes, not metrics. CTA should say 'Request consultation' or 'Enquire'. Never mention discounts.",
  },
  "Enterprise Minimal": {
    description: "Clean enterprise — off-white background, navy/dark blue, structured, compliance-first, restrained",
    heroLayout: "split-product",
    colorConstraints: "Background must be #ffffff or #fafafa or #f5f7fa. Primary must be navy #1e3a5f, dark blue #1d4ed8, or slate #475569. Professional palette only.",
    typographyConstraints: "Use Inter or DM Sans. Normal letter-spacing. Font weight 700 for headings. Clean hierarchy.",
    componentStyle: "Consistent 8px border-radius. Light gray card backgrounds. No glows. Structured grid layouts. Compliance badges prominent.",
    promptInstructions: "Design variant: ENTERPRISE MINIMAL. Think Salesforce, Stripe, HubSpot landing pages. Hero badge should show compliance certification or enterprise stat. All copy must be ROI-focused and executive-readable. Trust signals must include enterprise-grade certifications.",
  },
  "Startup Modern": {
    description: "Bold and energetic — high contrast, large metrics in hero, punchy orange/green, YC Demo Day energy",
    heroLayout: "centered-metrics",
    colorConstraints: "Background must be #0f0f0f or #111827 (very dark). Primary must be orange #f97316, bright green #22c55e, or hot pink #ec4899. High contrast.",
    typographyConstraints: "Use Plus Jakarta Sans or Sora. Extra-bold (900) headlines. Tight tracking. Large font sizes.",
    componentStyle: "Rounded corners (16-20px). Bright glowing CTAs. Large metrics displayed prominently. Bold color fills on cards.",
    promptInstructions: "Design variant: STARTUP MODERN. Think Superhuman, Loom, Notion pre-IPO. Hero stats must be bold and oversized. Features should feel like superpowers. CTA should create FOMO. Pricing should have a bold 'Most Popular' highlight with social proof count.",
  },
  "Bold Brutalist": {
    description: "Raw and unapologetic — pure black/white, zero border-radius, oversized typography, thick borders, no decoration",
    heroLayout: "fullscreen-text",
    colorConstraints: "Background must be #000000 or #ffffff (pick one — high contrast). Primary is the ONLY accent color — bold and single. No gradients, no subtle tones.",
    typographyConstraints: "Use Anton, Barlow Condensed, or Black Han Sans (bold). Massive font sizes (6-8vw for h1). ALL CAPS headlines acceptable. Extreme boldness.",
    componentStyle: "ZERO border-radius everywhere. Thick borders (2-3px solid). No box shadows. No background gradients. Raw grid structure. Bold hover states (color inversion).",
    promptInstructions: "Design variant: BOLD BRUTALIST. Anti-design intentional aesthetic. Hero headline should be a manifesto statement. Features as numbered list, not cards. FAQ as plain text, not styled. Everything stripped back to maximum impact with minimum decoration.",
  },
  "Glassmorphism": {
    description: "Frosted glass — gradient mesh background, translucent cards with blur, layered depth, modern aesthetic",
    heroLayout: "split-glass",
    colorConstraints: "Background must be a rich gradient (e.g., linear-gradient from #0f0c29 via #302b63 to #24243e). Primary must be vibrant — violet, teal, or rose. Cards use rgba(255,255,255,0.06) with blur.",
    typographyConstraints: "Use Inter or Outfit. Clean modern weights. Good contrast against glass cards.",
    componentStyle: "Large border-radius (20-28px). backdrop-filter blur(20px) on all cards. Subtle white border (rgba 0.12). Multiple layered gradients. Depth through transparency.",
    promptInstructions: "Design variant: GLASSMORPHISM. Think modern Apple Vision Pro or iOS design language. Cards float over gradient background. Hero has a glass panel over mesh gradient. Features float as glass cards. The depth and layering creates premium feel.",
  },
  "Cinematic Dark": {
    description: "Film-grade visual storytelling — near-black, wide-format, dramatic typography, slow cinematic pacing, brand narrative",
    heroLayout: "fullscreen-cinematic",
    colorConstraints: "Background must be #08080a or #0c0c0e. Primary must be warm — amber #f59e0b, warm white #faf8f5, or muted gold #c9a84c. Film-like warmth on cold dark.",
    typographyConstraints: "Use Bebas Neue, Oswald, or Cinzel for display. Wide letter-spacing (0.1-0.2em). Mixed sizing — very large hero, small body. Cinematic hierarchy.",
    componentStyle: "Minimal decoration. Wide padding (section height 100vh for hero). Image overlays with gradient. No floating badges. Horizontal rules as dividers.",
    promptInstructions: "Design variant: CINEMATIC DARK. Think film studio, documentary brand, high-end creative agency. Hero is a full-screen declaration. No stats in hero — let the copy breathe. Testimonials feel like reviews in a film magazine. CTA is an invitation, not a demand.",
  },
  "Clean Pro": {
    description: "Modern clean SaaS — white background, bold accent color, card-based layout, Stripe/Linear/Vercel aesthetic, conversion-optimized",
    heroLayout: "split-product",
    colorConstraints: "Background MUST be #ffffff (pure white). Primary must be a bold vivid accent: violet #6366f1, indigo #4f46e5, blue #2563eb, teal #0d9488, or emerald #059669. Surface must be #f8fafc or #f1f5f9. Text must be near-black #0f172a or #111827. TextMuted must be #64748b or #6b7280. Border: rgba(0,0,0,0.08). NO dark backgrounds.",
    typographyConstraints: "Use Inter or DM Sans. Tight tracking (-0.02em). Font weight 700-800 for headings. 18px body text. Subtitle in textMuted. Clean modern hierarchy.",
    componentStyle: "Rounded corners 12-16px. Card box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06). Icon containers use primary at 10% opacity background. CTA buttons use solid primary color. Section backgrounds alternate: white → #f8fafc → white.",
    promptInstructions: "Design variant: CLEAN PRO. Think Stripe, Linear, Vercel, Loom, Notion. WHITE background is mandatory — this is a light-mode professional SaaS website. Bold single accent color (indigo/violet/blue). Hero has product dashboard screenshot from Unsplash. Stats row below hero copy. Feature cards have icon + title + description. 3-tier pricing with highlighted 'Most Popular'. CTA section is a rounded card with primary gradient. Professional, polished, instantly trustworthy.",
  },
};

// ─── Design Space System (V4.5) ───────────────────────────────────────────────
// 8 canonical design spaces for explore/premium mode diversity enforcement.
// Each maps deterministically to an existing DESIGN_VARIANT key.
const DESIGN_SPACES = [
  "Premium SaaS",
  "Enterprise Minimal",
  "Futuristic AI",
  "Luxury Editorial",
  "Startup Modern",
  "Glassmorphism",
  "Cinematic Dark",
  "Bold Brutalist",
] as const;
export type DesignSpace = typeof DESIGN_SPACES[number];

const DESIGN_SPACE_TO_VARIANT: Record<string, string> = {
  "Premium SaaS":       "Premium SaaS",
  "Enterprise Minimal": "Enterprise Minimal",
  "Futuristic AI":      "Futuristic",
  "Luxury Editorial":   "Luxury Editorial",
  "Startup Modern":     "Startup Modern",
  "Glassmorphism":      "Glassmorphism",
  "Cinematic Dark":     "Cinematic Dark",
  "Bold Brutalist":     "Bold Brutalist",
};

// Reverse map: variant key → design space name
const VARIANT_TO_DESIGN_SPACE: Record<string, string> = Object.fromEntries(
  Object.entries(DESIGN_SPACE_TO_VARIANT).map(([space, variant]) => [variant, space])
);

// ─── Design DNA Fingerprints (for diversity validation) ──────────────────────
function getTypographyDNA(variantKey: string): string {
  const v = DESIGN_VARIANTS[variantKey];
  if (!v) return "sans";
  const tc = v.typographyConstraints.toLowerCase();
  if (tc.includes("cormorant") || tc.includes("playfair") || tc.includes("cinzel") || tc.includes("serif")) return "serif";
  if (tc.includes("bebas") || tc.includes("oswald") || tc.includes("anton") || tc.includes("barlow")) return "condensed";
  if (tc.includes("mono")) return "mono";
  return "sans";
}

function getLayoutDNA(variantKey: string): string {
  return DESIGN_VARIANTS[variantKey]?.heroLayout ?? "centered";
}

function getSpacingDNA(variantKey: string): string {
  const v = DESIGN_VARIANTS[variantKey];
  if (!v) return "modern";
  const cs = v.componentStyle.toLowerCase();
  if (cs.includes("zero border-radius") || cs.includes("zero border")) return "brutalist";
  if (cs.includes("backdrop-filter") || cs.includes("blur")) return "glass";
  if (cs.includes("hairline") || cs.includes("no card background") || cs.includes("no floating")) return "editorial";
  return "modern";
}

function getVisualDNA(variantKey: string): string {
  const v = DESIGN_VARIANTS[variantKey];
  if (!v) return "dark";
  const cc = v.colorConstraints;
  if (cc.includes("#000000") && !cc.includes("#ffffff")) return "pure-black";
  if (cc.includes("#ffffff") || cc.includes("#fafafa") || cc.includes("#f5f7fa")) return "white";
  if (cc.includes("gradient")) return "gradient";
  if (cc.includes("#08080a") || cc.includes("#0c0c0e")) return "cinematic-dark";
  if (cc.includes("#020408") || cc.includes("cyan #00d4ff") || cc.includes("neon")) return "neon-dark";
  return "dark";
}

// Computes 0–100 diversity score across a list of variant keys.
// A pair is "diverse" if they differ on ≥2 of 4 DNA dimensions.
function computeDiversityScore(variantKeys: string[]): number {
  if (variantKeys.length < 2) return 100;
  let totalPairs = 0;
  let diversePairs = 0;
  for (let i = 0; i < variantKeys.length; i++) {
    for (let j = i + 1; j < variantKeys.length; j++) {
      totalPairs++;
      const diffs = [
        getTypographyDNA(variantKeys[i]) !== getTypographyDNA(variantKeys[j]),
        getLayoutDNA(variantKeys[i]) !== getLayoutDNA(variantKeys[j]),
        getSpacingDNA(variantKeys[i]) !== getSpacingDNA(variantKeys[j]),
        getVisualDNA(variantKeys[i]) !== getVisualDNA(variantKeys[j]),
      ].filter(Boolean).length;
      if (diffs >= 2) diversePairs++;
    }
  }
  return Math.round((diversePairs / totalPairs) * 100);
}

// Returns pairs of candidates that share ≥3 of 4 DNA dimensions (too similar).
function getDiversityFlags(
  candidates: Array<{ label: string; variantKey: string }>
): Array<{ labels: [string, string]; dimensions: string[] }> {
  const flags: Array<{ labels: [string, string]; dimensions: string[] }> = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const shared: string[] = [];
      if (getTypographyDNA(a.variantKey) === getTypographyDNA(b.variantKey)) shared.push("typography");
      if (getLayoutDNA(a.variantKey) === getLayoutDNA(b.variantKey)) shared.push("layout");
      if (getSpacingDNA(a.variantKey) === getSpacingDNA(b.variantKey)) shared.push("spacing");
      if (getVisualDNA(a.variantKey) === getVisualDNA(b.variantKey)) shared.push("visual");
      if (shared.length >= 3) flags.push({ labels: [a.label, b.label], dimensions: shared });
    }
  }
  return flags;
}

const VARIANT_INDUSTRY_POOLS: Record<string, string[]> = {
  "Cybersecurity":    ["Futuristic", "Enterprise Minimal", "Premium SaaS", "Clean Pro", "Cinematic Dark"],
  "Fintech":          ["Clean Pro", "Enterprise Minimal", "Premium SaaS", "Glassmorphism", "Futuristic"],
  "SaaS":             ["Clean Pro", "Enterprise Minimal", "Premium SaaS", "Startup Modern", "Glassmorphism", "Futuristic"],
  "Healthcare":       ["Enterprise Minimal", "Clean Pro", "Glassmorphism", "Premium SaaS"],
  "Education":        ["Clean Pro", "Startup Modern", "Glassmorphism", "Enterprise Minimal", "Futuristic"],
  "Marketplace":      ["Startup Modern", "Glassmorphism", "Clean Pro", "Bold Brutalist", "Futuristic"],
  "Agency":           ["Luxury Editorial", "Bold Brutalist", "Cinematic Dark", "Glassmorphism", "Clean Pro"],
  "Luxury":           ["Luxury Editorial", "Cinematic Dark", "Glassmorphism", "Enterprise Minimal"],
  "E-commerce":       ["Bold Brutalist", "Startup Modern", "Glassmorphism", "Clean Pro", "Futuristic"],
  "Creator Economy":  ["Bold Brutalist", "Glassmorphism", "Cinematic Dark", "Startup Modern", "Futuristic"],
};

function selectDesignVariant(industry: string, idea: string, seedOffset = 0): string {
  const pool = VARIANT_INDUSTRY_POOLS[industry] ?? Object.keys(DESIGN_VARIANTS);
  // idea hash — consistent base for a given business
  let hash = 5381;
  for (let i = 0; i < idea.length; i++) {
    hash = ((hash << 5) + hash + idea.charCodeAt(i)) & 0x7fffffff;
  }
  // Add real time-based entropy so repeated generations cycle through all variants,
  // even when the client sends seedOffset=0 (e.g. after page refresh / component remount).
  // Dividing by 8000ms means the slot changes every 8 seconds — different enough that
  // rapid back-to-back regenerations still get a fresh variant.
  const timeSlot = Math.floor(Date.now() / 8000);
  const idx = (hash + seedOffset + timeSlot) % pool.length;
  return pool[idx];
}

// ─── Orchestration Layer System Prompt (Qwen — strategy + creative direction) ─
// componentCode is intentionally excluded — the Implementation Layer (Mistral) handles that
const BASE_SYSTEM_PROMPT = `You are STAGEONE's Creative Orchestration Intelligence — the strategic brain of a layered AI creative pipeline.

You are responsible for: business reasoning, audience positioning, brand voice, conversion strategy, copywriting, and visual design direction. You do NOT generate frontend code — a specialized implementation model handles that.

Your output must be strategically engineered, industry-optimized, and conversion-focused — built for the specific business and audience provided.

You understand:
- Industry-specific buyer psychology and trust signals
- Conversion-optimized section ordering and CTA placement
- Visual design systems appropriate for each vertical
- How to write copy that speaks directly to the specific ICP with surgical precision

Return ONLY valid JSON starting with { and ending with }. No markdown, no explanation, no code fences, no <think> tags.

Full schema:
{
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "textMuted": "#hex", "border": "#hex" },
  "typography": { "headingFont": "Google Font name", "bodyFont": "Google Font name", "headingStyle": "ultra-tight|tight|normal", "headingWeight": "800|900|700" },
  "brand": { "name": "Company Name", "tagline": "Short memorable tagline", "voice": "professional|bold|friendly|premium" },
  "design": { "style": "style name", "uiDirection": "2-sentence precise description matching the industry design system", "animations": ["fade-in","slide-up","stagger","scale-in"], "borderRadius": "none|sm|md|lg|xl", "glassmorphism": true },
  "websiteStrategy": {
    "conversionApproach": "2 sentences: primary conversion strategy tailored to this industry and ICP",
    "sectionOrderRationale": "Why sections are ordered this specific way — psychological flow from awareness to conversion",
    "trustSignals": ["Specific trust signal 1 and why it matters for this audience", "Specific trust signal 2", "Specific trust signal 3"],
    "ctaStrategy": "Primary CTA placement strategy and the psychological principle behind it",
    "audiencePsychology": "Key psychological triggers used: what this specific ICP fears, desires, and needs to see before converting",
    "industryOptimizations": ["Industry-specific design decision 1 and its rationale", "Industry-specific design decision 2", "Industry-specific design decision 3"],
    "conversionFunnel": "Top → Middle → Bottom of funnel section mapping for this specific website"
  },
  "sections": {
    "nav": { "logo": "Brand name", "links": ["Features","Pricing","Testimonials","Blog","Contact"] },
    "hero": { "badge": "Short eyebrow label (<40 chars) — specific trust signal or category definition", "headline": "6-9 bold words speaking directly to the ICP's primary pain or desire", "subheadline": "2 sentences: specific benefit + quantified outcome", "ctaPrimary": "Action verb + specific outcome", "ctaSecondary": "Lower commitment action", "socialProof": "Specific quantified trust signal e.g. '500+ enterprise security teams trust us'", "stats": [{ "value": "Metric like 500+ or $2M or 99.9%", "label": "Short descriptor e.g. Enterprise Clients" }, { "value": "...", "label": "..." }, { "value": "...", "label": "..." }, { "value": "...", "label": "..." }], "trustedBy": ["Company Name 1", "Company Name 2", "Company Name 3", "Company Name 4", "Company Name 5"] },
    "howItWorks": { "title": "How it works headline (5-8 words, outcome-led)", "subtitle": "1 sentence: the transformation this process delivers for the specific ICP", "steps": [{ "step": "01", "title": "Step title (verb-led, specific)", "icon": "Zap|Rocket|Globe|Brain", "description": "1-sentence step description showing ease, speed and specific outcome" }, { "step": "02", "title": "...", "icon": "...", "description": "..." }, { "step": "03", "title": "...", "icon": "...", "description": "..." }, { "step": "04", "title": "...", "icon": "...", "description": "..." }] },
    "features": { "title": "Section headline that frames features as solutions", "subtitle": "1-sentence that names the core problem being solved", "items": [
      { "icon": "Zap|Target|Shield|Rocket|Globe|Sparkles|BarChart|Lock|Users|Layers|Brain|TrendingUp", "title": "Benefit-led feature name", "description": "Specific outcome in <20 words" },
      { "icon": "...", "title": "...", "description": "..." },
      { "icon": "...", "title": "...", "description": "..." },
      { "icon": "...", "title": "...", "description": "..." },
      { "icon": "...", "title": "...", "description": "..." },
      { "icon": "...", "title": "...", "description": "..." }
    ]},
    "testimonials": { "title": "Section headline that builds urgency through peer proof", "items": [
      { "quote": "Specific result testimonial with named metric — 1-2 sentences", "author": "Real-sounding Full Name", "role": "Specific job title matching ICP", "company": "Realistic company name for the industry", "metric": "e.g. '40% reduction in response time'" },
      { "quote": "...", "author": "...", "role": "...", "company": "...", "metric": null },
      { "quote": "...", "author": "...", "role": "...", "company": "...", "metric": "..." }
    ]},
    "pricing": { "title": "Pricing section headline", "subtitle": "Value-framing subtitle that reduces price sensitivity", "annual": true, "tiers": [
      { "name": "Starter", "price": "$X", "period": "/mo", "description": "Who it's for (specific job title/company size)", "features": ["specific feature 1","specific feature 2","specific feature 3"], "cta": "Get started free", "highlighted": false, "badge": null },
      { "name": "Pro", "price": "$X", "period": "/mo", "description": "Who it's for", "features": ["all starter features","specific pro feature 1","specific pro feature 2","specific pro feature 3","specific pro feature 4"], "cta": "Start free trial", "highlighted": true, "badge": "Most Popular" },
      { "name": "Enterprise", "price": "Custom", "period": "", "description": "Who it's for", "features": ["all pro features","specific enterprise feature 1","specific enterprise feature 2","SLA guarantee","Dedicated support"], "cta": "Contact sales", "highlighted": false, "badge": null }
    ]},
    "cta": { "headline": "Strong close (<8 words) with urgency or exclusivity", "subheadline": "1 sentence reinforcing the primary value and reducing friction", "buttonText": "Final action CTA", "subtext": "Trust signal: no credit card / free tier / cancel anytime" },
    "faq": { "title": "FAQ headline", "items": [
      { "question": "Specific objection the ICP has about buying?", "answer": "Direct answer that overcomes the objection. 1-2 sentences." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." },
      { "question": "...", "answer": "..." }
    ]},
    "footer": { "tagline": "Brand tagline", "columns": [
      { "title": "Product", "links": ["Features","Pricing","Changelog","Roadmap"] },
      { "title": "Company", "links": ["About","Blog","Careers","Press"] },
      { "title": "Legal", "links": ["Privacy","Terms","Security","Cookies"] }
    ], "legal": "© 2025 Company. All rights reserved." }
  },
  "seoMeta": { "title": "Page title 50-60 chars — keyword + value prop", "description": "150-160 char meta description with primary keyword and ICP-specific benefit", "keywords": ["primary kw","secondary kw","long-tail kw","industry kw","brand kw"] }
}

HARD RULES:
- Every piece of copy must be specific to the actual business idea — ZERO generic placeholder text
- Colors must match the industry design system provided
- websiteStrategy must explain real strategic reasoning, not boilerplate
- FAQ items must address real objections the specific ICP would have
- Pricing must reflect realistic pricing for this industry and business model
- Testimonials must sound like they come from the actual target customer (use correct job titles)
- Output raw JSON only — no <think> blocks, no markdown, no commentary`;

function buildPrompt(idea: string, businessIntelligence: unknown, designVariant: string, seedOffset = 0): string {
  const bi = businessIntelligence as {
    industry?: string;
    targetMarket?: string;
    businessSnapshot?: string;
    metrics?: Record<string, number>;
    strategicInsights?: Record<string, string>;
    competitiveAdvantage?: Record<string, string>;
    growthPlan?: string[];
    recommendedStack?: Record<string, unknown>;
    websitePages?: string[];
    chatbotRole?: string;
  } | null;

  const industry = bi?.industry ?? "SaaS";
  const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];
  const styleGuide = STYLE_GUIDES[designSystem.style] ?? STYLE_GUIDES["SaaS"];
  const toneGuide = TONE_GUIDES[designSystem.tone] ?? TONE_GUIDES["Professional"];
  const variant = DESIGN_VARIANTS[designVariant] ?? DESIGN_VARIANTS["Premium SaaS"];

  const biBlock = bi ? `
BUSINESS INTELLIGENCE (use ALL of this to inform copy, strategy, and design decisions):
- Industry: ${bi.industry}
- Business Snapshot: ${bi.businessSnapshot ?? ""}
- Target Market / ICP: ${bi.targetMarket ?? ""}
- Metrics: Automation Potential ${bi.metrics?.automationPotential}%, AI Opportunity ${bi.metrics?.aiAdoptionOpportunity}%, Revenue Scalability ${bi.metrics?.revenueScalability}/10, Market Difficulty ${bi.metrics?.marketDifficulty}/10, Operational Complexity ${bi.metrics?.operationalComplexity}/10
- Strategic Growth Bottleneck: ${bi.strategicInsights?.growthBottleneck ?? ""}
- Fastest Acquisition Channel: ${bi.strategicInsights?.fastestChannel ?? ""}
- Highest Leverage Automation: ${bi.strategicInsights?.highestLeverageAutomation ?? ""}
- Operational Risk: ${bi.strategicInsights?.operationalRisk ?? ""}
- Competitive Differentiation: ${bi.competitiveAdvantage?.differentiation ?? ""}
- Defensibility Strategy: ${bi.competitiveAdvantage?.defensibility ?? ""}
- Scalability Edge: ${bi.competitiveAdvantage?.scalabilityEdge ?? ""}
- Growth Plan Phase 1: ${bi.growthPlan?.[0] ?? ""}
- Growth Plan Phase 2: ${bi.growthPlan?.[1] ?? ""}
- Suggested Website Pages: ${(bi.websitePages ?? []).join(", ")}
- AI/Chatbot Role: ${bi.chatbotRole ?? ""}` : "";

  return `Generate a complete, strategically intelligent website for this business:

BUSINESS IDEA: "${idea}"
${biBlock}

INDUSTRY: ${industry}
INDUSTRY DESIGN SYSTEM — apply these principles EXACTLY:
${designSystem.principles}

RECOMMENDED SECTION ORDER FOR THIS INDUSTRY:
${designSystem.sectionOrder}

REQUIRED TRUST SIGNALS FOR THIS INDUSTRY:
${designSystem.trustSignals}

PRIMARY CONVERSION GOAL:
${designSystem.primaryConversion}

COLOR STRATEGY — HARD CONSTRAINTS FROM DESIGN VARIANT (override industry defaults if they conflict):
${variant.colorConstraints}

TYPOGRAPHY CONSTRAINTS:
${variant.typographyConstraints}

VISUAL STYLE: ${designSystem.style}
${styleGuide}

COPY TONE: ${designSystem.tone}
${toneGuide}

═══════════════════════════════════════════════
ACTIVE DESIGN VARIANT: ${designVariant.toUpperCase()}
${variant.description}
${variant.promptInstructions}

COMPONENT STYLE RULES (enforce in componentCode):
${variant.componentStyle}
HERO LAYOUT: ${variant.heroLayout}
═══════════════════════════════════════════════

CRITICAL RULES:
1. Every piece of copy must be specific to the actual business idea — ZERO generic placeholder text
2. Colors MUST follow the variant constraints above — not the industry default
3. websiteStrategy must explain real strategic reasoning, not boilerplate
4. FAQ items must address real objections the specific ICP would have
5. Pricing must reflect realistic pricing for this industry and business model
6. Testimonials must sound like they come from the actual target customer (use correct job titles)
7. componentCode must visually match the ${designVariant} variant style exactly
${seedOffset > 0 ? `
═══════════════════════════════════════════════
REGENERATION ATTEMPT #${seedOffset} — MANDATORY CREATIVE PIVOT:
The previous generation was too predictable. You MUST take a genuinely different creative direction on EVERY field:
- Headline: use a completely different angle, metaphor, or emotional hook than before
- Badge: different framing (pain-point vs. outcome vs. social proof vs. category definition)
- Subheadline: different benefit emphasis, different sentence structure
- Testimonials: different company sizes, different specific metrics, different job titles
- FAQ: address different objections than the obvious ones
- CTA: different urgency mechanism, different risk-reversal language
- Pricing: consider different tier names, different anchor points, different feature emphasis
- Stats: different metrics, consider unconventional but credible numbers
Imagine you are a DIFFERENT creative director who has never seen the previous output.
═══════════════════════════════════════════════` : ""}`;
}

async function streamNvidiaRequest(
  model: string,
  systemPrompt: string,
  userMessage: string,
  res: import("express").Response,
  req: import("express").Request,
  maxTokens = 7000,
  temperature = 0.88
): Promise<string> {
  const makeBody = (modelId: string) => {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };
    // Thinking models output to delta.reasoning_content by default — disable thinking
    // so structured JSON goes to delta.content where the parser expects it.
    // Note: DeepSeek uses {"thinking": false}, others use {"enable_thinking": false}
    if (modelId.includes("deepseek")) body.chat_template_kwargs = { thinking: false };
    else if (modelId.includes("qwen") || modelId.includes("step") || modelId.includes("nemotron-3-ultra")) body.chat_template_kwargs = { enable_thinking: false };
    return JSON.stringify(body);
  };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` };

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers, body: makeBody(model) });
  if (!response.ok) {
    const errorText = await response.text();
    req.log.error({ model, status: response.status, errorText }, "NVIDIA API error");
    throw new Error(`Model ${model} request failed (${response.status})`);
  }

  const decoder = new TextDecoder();
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  let contentBuffer = "";
  let lineCarryover = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = lineCarryover + decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    lineCarryover = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          contentBuffer += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      } catch { /* SSE fragment */ }
    }
  }

  return contentBuffer;
}

function extractJson(raw: string): unknown {
  let clean = raw.trim();
  // Strip Qwen3 <think>...</think> blocks
  clean = clean.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
  // First try strict parse; on failure use jsonrepair to recover from
  // model-generated issues like unescaped quotes inside string values
  try {
    return JSON.parse(clean);
  } catch {
    return JSON.parse(jsonrepair(clean));
  }
}

// ─── Non-Streaming Model Call (for background Mistral + intelligence tasks) ───
async function callModelJson(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000,
  temperature = 0.72
): Promise<string> {
  const makeBody = (modelId: string) => {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };
    if (modelId.includes("deepseek")) body.chat_template_kwargs = { thinking: false };
    else if (modelId.includes("qwen") || modelId.includes("step") || modelId.includes("nemotron-3-ultra")) body.chat_template_kwargs = { enable_thinking: false };
    return JSON.stringify(body);
  };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` };
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers, body: makeBody(model) });
  if (!response.ok) throw new Error(`Model ${model} call failed: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── FLUX Visual Asset Generation ─────────────────────────────────────────────
// Industry × design variant → AI-generated hero imagery (base64 data URL)
// Falls back to Unsplash if FLUX is unavailable or fails
const INDUSTRY_IMAGE_PROMPTS: Record<string, string> = {
  Cybersecurity: "A dark futuristic enterprise cybersecurity operations center, multiple monitors displaying threat intelligence graphs, glowing network topology visualization, deep blue and cyan lighting, cinematic wide-angle composition, ultra-realistic",
  Fintech:       "A sleek fintech trading dashboard on large monitors in a glass-walled professional office, real-time financial charts, warm ambient lighting with blue accents, modern financial technology environment, ultra-realistic",
  SaaS:          "A modern SaaS product team collaborating around large screens showing analytics dashboards, bright open-plan startup office, natural daylight, energetic and focused atmosphere, ultra-realistic",
  Healthcare:    "A physician using a tablet for a telemedicine consultation, modern clinical setting with soft natural lighting, clean professional medical environment, warm and trustworthy atmosphere, ultra-realistic",
  Education:     "Students engaged in collaborative online learning in a bright modern classroom, laptops open, diverse group, natural daylight, inspiring and productive educational atmosphere, ultra-realistic",
  Marketplace:   "A vibrant product marketplace interface on large screens in a clean modern studio, curated products beautifully arranged, warm commercial photography lighting, ultra-realistic",
  Agency:        "A creative agency strategy session around a large table with design mockups displayed on screens, modern studio loft space, editorial quality professional photography, ultra-realistic",
  Luxury:        "A beautifully crafted luxury product displayed with dramatic cinematic lighting against a pure black background, high-fashion editorial photography, Vogue-quality composition, ultra-premium",
  "E-commerce":  "Premium product photography of curated lifestyle products arranged elegantly, soft directional studio lighting, aspirational commercial photography, ultra-realistic",
  "Creator Economy": "A content creator in a beautifully lit home studio with professional camera setup, warm ring lighting, bookshelves in background, intimate and inspiring creative atmosphere, ultra-realistic",
};

const VARIANT_IMAGE_STYLE: Record<string, string> = {
  "Futuristic":          "cyberpunk neon aesthetic, dramatic blue-cyan-purple glowing light sources, sci-fi atmosphere, digital art quality",
  "Cinematic Dark":      "film noir cinematic quality, dramatic chiaroscuro lighting, deep shadows, anamorphic lens, wide cinematic format",
  "Luxury Editorial":    "Vogue editorial photography style, minimalist composition, high-fashion dramatic lighting, ultra-premium",
  "Bold Brutalist":      "raw industrial aesthetic, high contrast harsh lighting, bold graphic composition, documentary photography",
  "Glassmorphism":       "clean modern aesthetic, soft gradient pastel background, translucent surfaces, premium tech feel",
  "Premium SaaS":        "clean professional product photography, tech startup aesthetic, precise studio lighting",
  "Enterprise Minimal":  "corporate professional photography, clean and trustworthy, neutral tones, polished",
  "Startup Modern":      "energetic startup aesthetic, vibrant bold colors, youthful professional energy, dynamic composition",
};

async function generateHeroImage(prompt: string): Promise<string | null> {
  if (!NVIDIA_API_KEY) return null;
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        size: "1344x768",
        response_format: "b64_json",
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;
    return `data:image/jpeg;base64,${b64}`;
  } catch { return null; }
}

function buildImagePrompt(idea: string, industry: string, designVariant: string): string {
  const base = INDUSTRY_IMAGE_PROMPTS[industry] ??
    "A modern professional business environment, clean and aspirational, studio quality photography, ultra-realistic";
  const style = VARIANT_IMAGE_STYLE[designVariant] ?? "premium commercial photography quality";
  return `${base}, ${style}. 4K ultra-detailed, award-winning photography, cinematic composition, agency-quality production value. No text, no logos, no watermarks.`;
}

// ─── Phase 2: AI HTML Generation System ───────────────────────────────────────
// The model generates a complete, self-contained HTML/CSS website from scratch.
// Full creative autonomy — no template constraints. The model chooses all layouts.
const HTML_GENERATION_SYSTEM = `You are the lead creative engineer at a world-class digital agency. Your work is indistinguishable from the best sites on awwwards.com, Stripe's marketing pages, Linear's landing page, and Vercel's homepage. You build marketing websites as single, complete, self-contained HTML files that clients pay $80,000+ for.

You receive a detailed creative brief — business context, brand strategy, conversion goals, design variant, color palette, typography, and full copy. You make EVERY layout and design decision yourself. No templates. No formulaic structures. Each site you create is genuinely unique.

═══ ABSOLUTE OUTPUT RULES ═══
- Output ONLY raw HTML. Start with <!DOCTYPE html>. End with </html>.
- Zero markdown, zero explanation, zero code fences, zero commentary before or after.
- ONE <style> block inside <head> with ALL CSS. Use @import for Google Fonts at the very top of that block.
- NO external CSS frameworks (no Bootstrap, no Tailwind, no UIkit).
- JavaScript: vanilla only. Use IntersectionObserver for scroll animations. Use <details>/<summary> for FAQ accordions.
- Every <img> must have loading="lazy" and onerror="this.style.display='none'".
- The HTML must be complete — every section present, every link working (href="#"), fully responsive.

═══ TECHNICAL EXCELLENCE STANDARDS ═══
CSS architecture:
- Define ALL design tokens as CSS custom properties in :root — colors, font stacks, spacing scale, radius, shadows
- Use clamp() everywhere for fluid typography and spacing — no fixed px for font-size or section padding
- CSS Grid for complex layouts, Flexbox for alignment. Use subgrid where it adds precision.
- Smooth transitions on all interactive elements (hover, focus). Timing: 200-300ms ease.
- backdrop-filter: blur() on the sticky nav with a semi-transparent background
- will-change: transform on animated elements for GPU acceleration

Scroll animations (IntersectionObserver):
- Stagger children using CSS animation-delay (0.1s increments)
- Fade + translate: opacity 0→1, translateY 32px→0 over 0.6s with cubic-bezier(0.16,1,0.3,1)
- Trigger at rootMargin: "0px 0px -80px 0px"

Responsive breakpoints:
- Mobile-first. Break at 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Grid collapses gracefully. Typography scales fluidly with clamp().
- Touch targets minimum 44px. Adequate padding on mobile.

═══ DESIGN AUTONOMY — YOU DECIDE EVERYTHING ═══
You receive a design variant (Futuristic / Premium SaaS / Luxury Editorial / Enterprise Minimal / Startup Modern / Bold Brutalist / Glassmorphism / Cinematic Dark / Clean Pro). This tells you the AESTHETIC WORLD. Within that world, you have complete autonomy over:

NAVIGATION: You choose — minimal wordmark only, full links centered, mega-menu, transparent-to-solid on scroll, pill-shaped, underline-only, split left/right. Whatever best serves the design variant.

HERO SECTION: You choose the layout. Options include (but are not limited to):
  • Asymmetric split: oversized headline left (60%), visual right (40%)
  • Full-bleed centered: massive typography dominating the viewport, minimal decoration
  • Bento grid hero: headline + stats in a grid of cards
  • Diagonal split: color break at an angle across the viewport
  • Stacked editorial: large small-large typography rhythm
  • Floating glass card over gradient mesh background
  • Offset composition: headline top-left, visual bottom-right, stats scattered
  Pick the layout that makes this specific business look most impressive. Use the stats, badge, social proof, and CTAs from the brief — arrange them in whatever composition feels most premium.

FEATURES: You choose the layout. Options include (but are not limited to):
  • Asymmetric 2-column: large visual or description left, stacked features right
  • Bento grid: varying card sizes (1×1, 2×1, 1×2) for visual hierarchy
  • Horizontal scroll carousel (CSS only, no JS libraries)
  • Full-width alternating rows: icon+title+description alternating left/right
  • Numbered list with large ordinals as decorative elements
  • Tabbed interface with details/summary
  Never default to a plain 3×2 card grid unless the design variant specifically calls for structured grids.

TESTIMONIALS: You choose the layout. Options:
  • Large featured quote (full width) + 2 smaller cards below
  • Stacked left with large quotation mark as decoration
  • Masonry-style varying card heights
  • Horizontal scrollable strip
  • One quote per "slide" revealed by details/summary
  Include ★★★★★ stars, author name, role, company. Add metric badges if provided.

PRICING: 3 tiers. You choose the visual treatment — column cards, horizontal rows, highlighted center with scale transform, frosted glass cards, brutalist bordered boxes, etc. The "Most Popular" tier must stand out clearly.

CTA SECTION: Full creative freedom. Could be a full-screen takeover, an elegant editorial close, a split with visual, a floating card, a bold typographic statement, a gradient panel. Match the design variant's energy.

FAQ: Use <details>/<summary> for native accordion. Style it to match the overall aesthetic — minimal hairline borders, brutalist thick borders, glass cards, whatever fits.

FOOTER: Your call — minimal single-row, editorial multi-column, full brand statement, dark contrast band.

═══ MODERN DESIGN TECHNIQUES — USE THEM ═══
- CSS Grid template areas for complex named layouts
- clip-path for diagonal section dividers or angular hero shapes
- background: conic-gradient() or radial-gradient() for texture
- mix-blend-mode for layered text effects on images
- CSS @keyframes for continuous ambient animations (slow float, pulse glow, gradient shift)
- SVG inline for icons and decorative shapes — never use emoji as icons
- Frosted glass: background: rgba(255,255,255,0.07); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
- Noise texture overlay using SVG filter or CSS: background-image: url("data:image/svg+xml,...")
- Large decorative numerals (font-size: 10vw, opacity: 0.04) as background elements
- Horizontal rule with gradient: border: none; height: 1px; background: linear-gradient(90deg, transparent, var(--primary), transparent);

═══ TYPOGRAPHY SYSTEM ═══
- Import the exact fonts specified. Use font-feature-settings: "ss01", "cv01" for OpenType features where available.
- Heading scale: use a major third or perfect fourth ratio. clamp() for every size.
- Letter-spacing: tight on large headings (-0.02em to -0.05em), normal on body, wide on labels/eyebrows (0.08em to 0.15em)
- Line-height: 1.05–1.1 for display text, 1.6–1.75 for body copy
- Text-wrap: balance on headings (where supported)
- Use font-weight variations throughout — don't just use bold everywhere

═══ IMAGES ═══
Use Unsplash photos that genuinely match the business context. Pick IDs that make sense — don't use random photos.
Format: https://images.unsplash.com/photo-[REAL-PHOTO-ID]?w=1200&q=85&fit=crop&auto=format
For testimonial avatars, use diverse, professional portrait photos from Unsplash.
Always set loading="lazy". Always set onerror="this.style.display='none'".

═══ WHAT MAKES THIS DIFFERENT FROM TEMPLATES ═══
A template fills data into fixed slots. Your sites INTERPRET the business and make creative decisions:
- The hero composition reflects the brand's personality
- The feature layout serves the content's nature (some content is best in a grid, some in a flow, some in a single-focus layout)
- The color system has depth (not just primary everywhere — use the full palette with intentional restraint)
- Typography has hierarchy and rhythm — different weights, sizes, spacing creating a reading experience
- Whitespace is used deliberately — breathing room is a design choice, not an afterthought
- Every hover state, every transition, every animation serves a purpose`;



// Extract valid HTML from model output (strips markdown fences, think tags, etc.)
function extractHtml(raw: string): string | null {
  if (!raw || raw.length < 500) return null;
  let html = raw.trim();

  // Strip <think>...</think> reasoning blocks (some models output these)
  html = html.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences
  if (html.startsWith("```html")) html = html.slice(7);
  else if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  html = html.trim();

  // Find the start of the HTML document
  const lower = html.toLowerCase();
  const docIdx = lower.indexOf("<!doctype");
  const htmlIdx = lower.indexOf("<html");
  const start = docIdx !== -1 ? docIdx : (htmlIdx !== -1 ? htmlIdx : -1);
  if (start === -1) return null;
  html = html.slice(start);

  // If the model ran out of tokens and didn't close </html>, try to close it gracefully
  if (!html.toLowerCase().includes("</html>")) {
    // Must have at least a <body> and meaningful content
    if (!html.toLowerCase().includes("<body") || html.length < 2000) return null;
    // Close any open tags as best we can
    html = html + "\n</body>\n</html>";
  }

  return html;
}

function buildHtmlPrompt(spec: Record<string, unknown>, designVariant: string, idea: string): string {
  const c = spec.colorPalette as Record<string, string> | undefined;
  const t = spec.typography as Record<string, string> | undefined;
  const brand = spec.brand as Record<string, string> | undefined;
  const s = spec.sections as Record<string, unknown> | undefined;
  const seo = spec.seoMeta as Record<string, string> | undefined;
  const strategy = spec.websiteStrategy as Record<string, unknown> | undefined;
  const design = spec.design as Record<string, unknown> | undefined;
  const variant = DESIGN_VARIANTS[designVariant] ?? DESIGN_VARIANTS["Premium SaaS"];
  const industry = (spec._industry as string) ?? "SaaS";
  const industryDesign = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];

  return `You are building a marketing website for this business. Read everything carefully — use the strategy and context to make intelligent design decisions.

═══════════════════════════════════════════════
BUSINESS BRIEF
═══════════════════════════════════════════════
Business: ${idea}
Industry: ${industry}
Brand name: ${brand?.name ?? ""}
Tagline: ${brand?.tagline ?? ""}
Brand voice: ${brand?.voice ?? "professional"}
Page title (use in <title>): ${seo?.title ?? brand?.name ?? ""}
Meta description: ${seo?.description ?? ""}

═══════════════════════════════════════════════
DESIGN VARIANT: ${designVariant.toUpperCase()}
═══════════════════════════════════════════════
Aesthetic world: ${variant.description}
Creative direction: ${variant.promptInstructions}
Typography rules: ${variant.typographyConstraints}
Component style: ${variant.componentStyle}
Color constraints (hard rules): ${variant.colorConstraints}
Hero layout suggestion: ${variant.heroLayout}

═══════════════════════════════════════════════
CONVERSION STRATEGY (from Phase 1 AI analysis — use to inform design decisions)
═══════════════════════════════════════════════
Conversion approach: ${strategy?.conversionApproach ?? ""}
Section order rationale: ${strategy?.sectionOrderRationale ?? ""}
CTA strategy: ${strategy?.ctaStrategy ?? ""}
Audience psychology: ${strategy?.audiencePsychology ?? ""}
Trust signals required: ${JSON.stringify(strategy?.trustSignals ?? [])}
Industry optimizations: ${JSON.stringify(strategy?.industryOptimizations ?? [])}
Conversion funnel: ${strategy?.conversionFunnel ?? ""}
Industry primary conversion goal: ${industryDesign.primaryConversion}
UI direction from planner: ${design?.uiDirection ?? ""}
Animations planned: ${JSON.stringify(design?.animations ?? [])}

═══════════════════════════════════════════════
COLOR SYSTEM — use these EXACT hex values, no substitutions
═══════════════════════════════════════════════
:root {
  --primary: ${c?.primary ?? "#6366f1"};
  --secondary: ${c?.secondary ?? "#4f46e5"};
  --accent: ${c?.accent ?? c?.primary ?? "#6366f1"};
  --bg: ${c?.background ?? "#ffffff"};
  --surface: ${c?.surface ?? "#f8fafc"};
  --tx: ${c?.text ?? "#0f172a"};
  --tm: ${c?.textMuted ?? "#64748b"};
  --br: ${c?.border ?? "rgba(0,0,0,0.08)"};
}

═══════════════════════════════════════════════
TYPOGRAPHY — @import these exact fonts from Google Fonts
═══════════════════════════════════════════════
Heading font: "${t?.headingFont ?? "Inter"}"
Heading weight: ${t?.headingWeight ?? "800"}
Heading style: ${t?.headingStyle ?? "tight"} (tight = letter-spacing -0.03em, ultra-tight = -0.05em)
Body font: "${t?.bodyFont ?? "Inter"}"

═══════════════════════════════════════════════
SECTION COPY — use this content VERBATIM. Do not invent, rephrase, or substitute any copy.
You choose how to ARRANGE and PRESENT it — that's the design decision.
═══════════════════════════════════════════════

NAV: ${JSON.stringify(s?.nav)}

HERO: ${JSON.stringify(s?.hero)}

HOW IT WORKS: ${JSON.stringify(s?.howItWorks)}

FEATURES: ${JSON.stringify(s?.features)}

TESTIMONIALS: ${JSON.stringify(s?.testimonials)}

PRICING: ${JSON.stringify(s?.pricing)}

CTA: ${JSON.stringify(s?.cta)}

FAQ: ${JSON.stringify(s?.faq)}

FOOTER: ${JSON.stringify(s?.footer)}

═══════════════════════════════════════════════
IMAGES
═══════════════════════════════════════════════
For the hero (if your chosen layout uses a visual): pick a real Unsplash photo that genuinely matches "${idea}" in the ${industry} industry. Use a high-quality photo ID. Format: https://images.unsplash.com/photo-[REAL-ID]?w=1400&q=85&fit=crop&auto=format
For testimonial avatars, use professional portrait photos from Unsplash (diverse, realistic).
Always: loading="lazy" onerror="this.style.display='none'"

═══════════════════════════════════════════════
YOUR DESIGN MISSION
═══════════════════════════════════════════════
The person reviewing this site should immediately think: "This looks like it costs $80,000 to build." That means:

1. The hero must be arresting — the layout, typography scale, and visual composition must stop the user from scrolling past
2. Every section must have a clear purpose and a distinct visual character — not just "the next section"
3. The color system must be used with intention — primary color for emphasis, not everywhere
4. Typography must have real hierarchy — headline sizes, subheading sizes, body sizes, label sizes, all different
5. Animations must feel native, not bolted on — they reveal content naturally as the user scrolls
6. The site must render beautifully on both desktop and mobile — no broken layouts

Now build the complete HTML file. Make every creative decision with confidence. Output nothing but the HTML.`;
}

// ─── Multi-Model Pipeline Reasoning Stages ───────────────────────────────────
// These stages play during the architect pre-flight, before orchestration begins
const ARCHITECT_STAGES: Record<string, string[]> = {
  Cybersecurity:     ["Initializing website architecture engine", "Analyzing enterprise threat landscape + buyer psychology", "Engineering SOC2/ISO compliance trust hierarchy", "Preparing component implementation layer"],
  Fintech:           ["Initializing website architecture engine", "Parsing regulatory credibility + onboarding funnel psychology", "Designing financial trust signal hierarchy", "Preparing component implementation layer"],
  SaaS:              ["Initializing website architecture engine", "Analyzing PLG conversion patterns for this ICP", "Engineering metric-heavy social proof + free-trial CTA", "Preparing component implementation layer"],
  Healthcare:        ["Initializing website architecture engine", "Analyzing HIPAA compliance display + patient trust psychology", "Engineering clinical credibility + accessibility hierarchy", "Preparing component implementation layer"],
  Education:         ["Initializing website architecture engine", "Analyzing outcome-led conversion + student transformation arc", "Engineering cohort urgency + curriculum transparency flow", "Preparing component implementation layer"],
  Marketplace:       ["Initializing website architecture engine", "Analyzing dual-sided trust architecture for buyers + sellers", "Engineering inventory depth + safety & escrow messaging", "Preparing component implementation layer"],
  Agency:            ["Initializing website architecture engine", "Analyzing portfolio-first credibility + case study ROI framing", "Engineering strategic partner positioning + methodology trust", "Preparing component implementation layer"],
  Luxury:            ["Initializing website architecture engine", "Analyzing editorial composition + exclusivity signal hierarchy", "Engineering cinematic brand narrative + restraint-over-maximalism", "Preparing component implementation layer"],
  "E-commerce":      ["Initializing website architecture engine", "Analyzing purchase psychology + urgency signal density", "Engineering return policy trust + product discovery flow", "Preparing component implementation layer"],
  "Creator Economy": ["Initializing website architecture engine", "Analyzing creator monetization trust + fan community psychology", "Engineering income proof architecture + creator-first narrative", "Preparing component implementation layer"],
};

const DEFAULT_STAGES = [
  "Initializing website architecture engine",
  "Analyzing business model + ICP psychology",
  "Engineering conversion funnel architecture",
  "Preparing component implementation layer",
];

// POST /api/generate/website — full site generation (industry-aware)
router.post("/generate/website", requireAuth, async (req, res): Promise<void> => {
  try {
    const { idea, businessIntelligence, variantSeed, language, forceDesignVariant, projectId } = req.body;
    const userId = (req as import("express").Request & { user?: { userId: string } }).user?.userId ?? "";

    // Always open SSE stream first so the client receives a typed error event
    // (not a plain 400 JSON which the SSE reader treats as a generic connection error)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!idea || typeof idea !== "string" || !idea.trim()) {
      console.warn("[generate-website] NO_IDEA: request received with empty idea — rejecting via SSE error");
      res.write(`data: ${JSON.stringify({ error: "NO_IDEA: No business idea was provided. The website generator requires a description to generate from.", code: "NO_IDEA" })}\n\n`);
      res.end();
      return;
    }
    if (!NVIDIA_API_KEY) {
      res.write(`data: ${JSON.stringify({ error: "API key not configured" })}\n\n`);
      res.end();
      return;
    }

    // ─── Pre-flight reasoning SSE events ─────────────────────────────────────
    const bi = businessIntelligence as { industry?: string } | null;
    const industry = bi?.industry ?? "SaaS";
    const stages = ARCHITECT_STAGES[industry] ?? DEFAULT_STAGES;
    // variantSeed increments on every client regeneration — forces a different hero type each time
    const seedOffset = typeof variantSeed === "number" ? variantSeed : 0;
    // V4.5: forceDesignVariant (from Design Space System) overrides hash-based selection
    // when explore/premium mode pre-selects unique spaces for diversity enforcement
    const designVariant = (typeof forceDesignVariant === "string" && DESIGN_VARIANTS[forceDesignVariant])
      ? forceDesignVariant
      : selectDesignVariant(industry, idea.trim(), seedOffset);

    res.write(`data: ${JSON.stringify({ phase: "architect", industry, stages, designVariant })}\n\n`);
    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 380));
      res.write(`data: ${JSON.stringify({ phase: "reasoning", stage: i, label: stages[i] })}\n\n`);
    }
    await new Promise(r => setTimeout(r, 250));
    // Signal which model is handling orchestration
    res.write(`data: ${JSON.stringify({ phase: "generating", designVariant, model: ORCHESTRATION_MODEL })}\n\n`);

    // ─── Phase 1: Orchestration (Qwen streams to client) ─────────────────────
    // Qwen generates all strategic content: copy, sections, colors, typography, brand, SEO
    const { getLanguageInstruction } = await import("../lib/language");
    const langInstruction = getLanguageInstruction(language);
    let buffer = "";
    try {
      buffer = await streamNvidiaRequest(
        ORCHESTRATION_MODEL,
        BASE_SYSTEM_PROMPT + langInstruction,
        buildPrompt(idea, businessIntelligence, designVariant, seedOffset),
        res, req, 6500, 0.88
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`); res.end(); return;
    }

    let qwenData: Record<string, unknown>;
    try {
      qwenData = extractJson(buffer) as Record<string, unknown>;
    } catch (parseErr) {
      req.log.error({ parseErr, bufLen: buffer.length }, "Qwen JSON parse failed");
      res.write(`data: ${JSON.stringify({ error: "Failed to parse website blueprint — please try again" })}\n\n`);
      res.end(); return;
    }

    // Inject pipeline metadata
    qwenData.designVariant = designVariant;
    qwenData._industry = industry;
    qwenData._variantSeed = seedOffset;
    // V4.5: Inject design space label for diversity tracking
    qwenData._designSpace = VARIANT_TO_DESIGN_SPACE[designVariant] ?? designVariant;

    // ─── Phase 2: FLUX hero image ──────────────────────────────────────────────
    // The design template engine (client-side) handles layout — no AI HTML needed.
    // FLUX generates an industry-matched hero image when available on the account.
    res.write(`data: ${JSON.stringify({ phase: "implementing", label: "Applying design system..." })}\n\n`);
    res.write(`data: ${JSON.stringify({ phase: "imaging", label: "Generating hero imagery..." })}\n\n`);

    const imagePrompt = buildImagePrompt(idea, industry, designVariant);
    const heroImage = await generateHeroImage(imagePrompt);
    if (heroImage) qwenData._heroImage = heroImage;

    req.log.info({ designVariant, heroImageGenerated: !!heroImage }, "Website generation complete");

    res.write(`data: ${JSON.stringify({ done: true, data: qwenData, pipeline: { orchestration: ORCHESTRATION_MODEL, imaging: IMAGE_MODEL, heroImageGenerated: !!heroImage } })}\n\n`);

    logEventFireForget({ userId, projectId: projectId as string | undefined, type: "website_generated", data: {}, req });

    // V5: Update Business Graph Memory (fire-and-forget — never blocks the stream)
    onWebsiteGenerationComplete(
      projectId as string | undefined,
      userId,
      idea,
      qwenData,
    ).catch(() => {});

    res.end();
  } catch (error) {
    req.log.error({ error }, "Generate website error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/section — regenerate one section
router.post("/generate/website/section", requireAuth, async (req, res): Promise<void> => {
  try {
    const { idea, businessIntelligence, sectionName, language } = req.body;
    if (!idea || !sectionName) {
      res.status(400).json({ error: "idea and sectionName are required" }); return;
    }
    const { getLanguageInstruction: getLangInstr1 } = await import("../lib/language");
    const langInstr1 = getLangInstr1(language);
    if (!NVIDIA_API_KEY) {
      res.status(500).json({ error: "API key not configured" }); return;
    }

    const bi = businessIntelligence as { industry?: string } | null;
    const industry = bi?.industry ?? "SaaS";
    const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];

    const sectionPrompts: Record<string, string> = {
      hero: `Return ONLY a JSON object for the hero section for: "${idea}". Industry: ${industry}. Trust signals: ${designSystem.trustSignals}. Shape: { "badge": "...", "headline": "...", "subheadline": "...", "ctaPrimary": "...", "ctaSecondary": "...", "socialProof": "..." }`,
      features: `Return ONLY a JSON object for the features section for: "${idea}". Industry: ${industry}. Shape: { "title": "...", "subtitle": "...", "items": [{ "icon": "Zap|Target|Shield|Rocket|Globe|Sparkles", "title": "...", "description": "..." }] } with 6 items.`,
      testimonials: `Return ONLY a JSON object for testimonials for: "${idea}". Industry: ${industry}. Testimonials should come from realistic ${industry} ICP job titles. Shape: { "title": "...", "items": [{ "quote": "...", "author": "...", "role": "...", "company": "...", "metric": null }] } with 3 items.`,
      pricing: `Return ONLY a JSON object for the pricing section for: "${idea}". Industry: ${industry}. Use realistic ${industry} pricing. Shape: { "title": "...", "subtitle": "...", "tiers": [{ "name": "Starter", "price": "$X", "period": "/mo", "description": "...", "features": ["..."], "cta": "...", "highlighted": false, "badge": null }, { "name": "Pro", "highlighted": true, "badge": "Most Popular" }, { "name": "Enterprise", "price": "Custom" }] }`,
      cta: `Return ONLY a JSON object for the CTA section for: "${idea}". Industry: ${industry}. Primary conversion: ${designSystem.primaryConversion}. Shape: { "headline": "...", "subheadline": "...", "buttonText": "...", "subtext": "..." }`,
      faq: `Return ONLY a JSON object for the FAQ section for: "${idea}". Industry: ${industry}. FAQs must address real ${industry} buyer objections. Shape: { "title": "...", "items": [{ "question": "...?", "answer": "..." }] } with 5 items.`,
      footer: `Return ONLY a JSON object for the footer for: "${idea}". Shape: { "tagline": "...", "columns": [{ "title": "Product", "links": ["..."] }, { "title": "Company", "links": ["..."] }, { "title": "Legal", "links": ["..."] }], "legal": "© 2025 ..." }`,
    };

    const sectionPrompt = sectionPrompts[sectionName];
    if (!sectionPrompt) {
      res.status(400).json({ error: `Unknown section: ${sectionName}` }); return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let buffer = "";
    try {
      buffer = await streamNvidiaRequest(
        ORCHESTRATION_MODEL,
        `You are an elite conversion copywriter specializing in ${industry}. Return ONLY valid JSON, no explanation, no <think> blocks.` + langInstr1,
        sectionPrompt,
        res, req, 1500, 0.88
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`); res.end(); return;
    }

    try {
      const sectionData = extractJson(buffer);
      res.write(`data: ${JSON.stringify({ done: true, section: sectionName, data: sectionData })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Failed to parse section — try again" })}\n\n`);
    }
    res.end();
  } catch (error) {
    req.log.error({ error }, "Section regen error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/optimize — AI conversion optimization analysis
router.post("/generate/website/optimize", requireAuth, async (req, res): Promise<void> => {
  try {
    const { websiteData, businessIntelligence, language: optLanguage } = req.body;
    if (!websiteData) { res.status(400).json({ error: "websiteData required" }); return; }
    const { getLanguageInstruction: getLangInstr2 } = await import("../lib/language");
    const langInstr2 = getLangInstr2(optLanguage);
    if (!NVIDIA_API_KEY) { res.status(500).json({ error: "API key not configured" }); return; }

    const bi = businessIntelligence as { industry?: string; targetMarket?: string; metrics?: Record<string, number> } | null;
    const wd = websiteData as {
      brand?: { name?: string };
      sections?: { hero?: { badge?: string; headline?: string; ctaPrimary?: string; socialProof?: string }; pricing?: { tiers?: Array<{name: string; price: string}> } };
      websiteStrategy?: { conversionApproach?: string; trustSignals?: string[] };
    };

    const industry = bi?.industry ?? "SaaS";
    const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];

    const systemPrompt = `You are STAGEONE's AI Conversion Optimizer — a senior CRO strategist with expertise in ${industry} websites. You analyze websites with surgical precision and identify SPECIFIC, ACTIONABLE conversion weaknesses.` + langInstr2 + `

Return ONLY valid JSON. No markdown.

Schema:
{
  "score": <integer 0-100 overall conversion score>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2 sentences: overall assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "issues": [
    {
      "category": "<trust_gap|cta_weakness|conversion_friction|social_proof_gap|copy_mismatch|section_ordering|ux_friction>",
      "severity": "<critical|high|medium>",
      "section": "<hero|features|testimonials|pricing|cta|faq|footer|nav>",
      "issue": "<specific problem — 1 sentence>",
      "why": "<why this hurts conversion for ${industry} buyers — 1 sentence>",
      "fix": "<exact actionable fix — 1 sentence>",
      "impact": "<estimated conversion impact e.g. +8-12% CVR>"
    }
  ]
}

HARD RULES:
- issues array must have 4-6 items total
- At least 1 critical issue if score < 80
- strengths array must have exactly 2 items
- Every issue must reference the ACTUAL content from the website, not generic advice
- Fixes must be specific enough to implement immediately`;

    const userMsg = `Analyze this ${industry} website for conversion optimization:

BRAND: ${wd.brand?.name ?? "Unknown"}
TARGET MARKET: ${bi?.targetMarket ?? "Unknown"}
INDUSTRY REQUIRED TRUST SIGNALS: ${designSystem.trustSignals}
PRIMARY CONVERSION GOAL: ${designSystem.primaryConversion}

CURRENT WEBSITE DATA:
- Hero badge: "${wd.sections?.hero?.badge ?? "none"}"
- Hero headline: "${wd.sections?.hero?.headline ?? "none"}"
- Primary CTA: "${wd.sections?.hero?.ctaPrimary ?? "none"}"
- Social proof: "${wd.sections?.hero?.socialProof ?? "none"}"
- Strategy trust signals: ${JSON.stringify(wd.websiteStrategy?.trustSignals ?? [])}
- Pricing tiers: ${JSON.stringify(wd.sections?.pricing?.tiers?.map(t => ({ name: t.name, price: t.price })) ?? [])}
- Conversion approach: "${wd.websiteStrategy?.conversionApproach ?? "none"}"

AI OPPORTUNITY: ${bi?.metrics?.aiAdoptionOpportunity ?? "?"}% | AUTOMATION: ${bi?.metrics?.automationPotential ?? "?"}% | DIFFICULTY: ${bi?.metrics?.marketDifficulty ?? "?"}/10

Identify the most impactful conversion gaps for a ${industry} website targeting this ICP. Be specific — reference the actual content above, not generic advice.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let buffer = "";
    try {
      buffer = await streamNvidiaRequest(ORCHESTRATION_MODEL, systemPrompt, userMsg, res, req, 1800, 0.8);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`); res.end(); return;
    }

    try {
      const result = extractJson(buffer);
      res.write(`data: ${JSON.stringify({ done: true, optimization: result })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Parse failed — try again" })}\n\n`);
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "Optimize error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/analyze — full 7-category AI intelligence analysis
router.post("/generate/website/analyze", requireAuth, async (req, res): Promise<void> => {
  try {
    const { websiteData, businessIdea, businessIntelligence, language: anlLanguage } = req.body;
    if (!websiteData) { res.status(400).json({ error: "websiteData required" }); return; }
    if (!NVIDIA_API_KEY) { res.status(500).json({ error: "API key not configured" }); return; }
    const { getLanguageInstruction: getLangInstrAnl } = await import("../lib/language");
    const langInstrAnl = getLangInstrAnl(anlLanguage);

    const bi = businessIntelligence as { industry?: string; targetMarket?: string; metrics?: Record<string, number> } | null;
    const wd = websiteData as {
      brand?: { name?: string; tagline?: string };
      sections?: {
        hero?: { badge?: string; headline?: string; subheadline?: string; ctaPrimary?: string; socialProof?: string; stats?: unknown[] };
        features?: { items?: Array<{ title: string; description?: string }> };
        testimonials?: { items?: Array<{ quote: string; author: string; metric?: string }> };
        pricing?: { tiers?: Array<{ name: string; price: string; highlighted?: boolean }> };
        faq?: { items?: Array<{ question: string }> };
      };
      colorPalette?: { primary?: string; background?: string };
      typography?: { headingFont?: string; bodyFont?: string };
      websiteStrategy?: { conversionApproach?: string; trustSignals?: string[]; audiencePsychology?: string };
      seoMeta?: { title?: string; description?: string; keywords?: string[] };
    };

    const industry = bi?.industry ?? "SaaS";
    const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];

    const systemPrompt = `You are STAGEONE Website Intelligence — a senior conversion strategist, SEO specialist, and UX researcher combined. You analyze websites across 7 dimensions and provide specific, actionable recommendations grounded in the actual content.${langInstrAnl}

Return ONLY valid JSON matching this EXACT schema. No markdown, no extra text:
{
  "overallScore": <integer 0-100>,
  "overallGrade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "overallSummary": "<2-3 sentences: honest, specific assessment referencing the actual brand and content>",
  "topPriorities": ["<top actionable priority 1>", "<top actionable priority 2>", "<top actionable priority 3>"],
  "categories": {
    "conversion": {
      "score": <integer 0-100>,
      "grade": "<letter grade>",
      "summary": "<1 sentence specific to this website>",
      "recommendations": [
        { "priority": "<critical|high|medium|low>", "title": "<concise title>", "description": "<what is the specific issue on this site>", "action": "<exact actionable step to fix it>" }
      ]
    },
    "seo": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] },
    "ux": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] },
    "brand": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] },
    "mobile": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] },
    "performance": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] },
    "content": { "score": <int>, "grade": "<>", "summary": "<>", "recommendations": [...] }
  }
}

HARD RULES:
- Each category must have 2-4 recommendations
- Scores must be grounded in observable evidence from the website data
- Reference actual content (quote the headline, mention the pricing tier names, etc.)
- DO NOT give generic advice — every recommendation must be specific to this website
- The overallScore is the weighted average: conversion(30%) + seo(15%) + ux(20%) + brand(10%) + mobile(10%) + performance(10%) + content(5%)`;

    const userMsg = `Analyze this ${industry} website:

BUSINESS: ${businessIdea ?? wd.brand?.name}
TARGET MARKET: ${bi?.targetMarket ?? "Not specified"}
INDUSTRY TRUST SIGNALS NEEDED: ${designSystem.trustSignals}
PRIMARY CONVERSION GOAL: ${designSystem.primaryConversion}

WEBSITE CONTENT:
- Brand: ${wd.brand?.name ?? "?"} — "${wd.brand?.tagline ?? ""}"
- Hero badge: "${wd.sections?.hero?.badge ?? "none"}"
- Hero headline: "${wd.sections?.hero?.headline ?? "none"}"
- Hero subheadline: "${wd.sections?.hero?.subheadline ?? "none"}"
- Primary CTA: "${wd.sections?.hero?.ctaPrimary ?? "none"}"
- Social proof: "${wd.sections?.hero?.socialProof ?? "none"}"
- Stats count: ${(wd.sections?.hero?.stats ?? []).length}
- Features count: ${(wd.sections?.features?.items ?? []).length} — titles: ${(wd.sections?.features?.items ?? []).slice(0,4).map(f => f.title).join(", ")}
- Testimonials: ${(wd.sections?.testimonials?.items ?? []).length} (with metrics: ${(wd.sections?.testimonials?.items ?? []).filter(t => t.metric).length})
- Pricing tiers: ${(wd.sections?.pricing?.tiers ?? []).map(t => `${t.name}@${t.price}`).join(", ")}
- FAQ items: ${(wd.sections?.faq?.items ?? []).length}
- SEO title: "${wd.seoMeta?.title ?? "none"}" (${(wd.seoMeta?.title ?? "").length} chars)
- SEO description: "${wd.seoMeta?.description ?? "none"}" (${(wd.seoMeta?.description ?? "").length} chars)
- Keywords: ${(wd.seoMeta?.keywords ?? []).join(", ")}
- Colors: primary=${wd.colorPalette?.primary ?? "?"}, bg=${wd.colorPalette?.background ?? "?"}
- Fonts: ${wd.typography?.headingFont ?? "?"} / ${wd.typography?.bodyFont ?? "?"}
- Conversion approach: "${wd.websiteStrategy?.conversionApproach ?? "none"}"
- Trust signals present: ${JSON.stringify(wd.websiteStrategy?.trustSignals ?? [])}

AI METRICS: opportunity=${bi?.metrics?.aiAdoptionOpportunity ?? "?"}% | automation=${bi?.metrics?.automationPotential ?? "?"}% | difficulty=${bi?.metrics?.marketDifficulty ?? "?"}/10

Give an honest, detailed analysis with specific, actionable recommendations for each of the 7 categories.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let buffer = "";
    try {
      buffer = await streamNvidiaRequest(ORCHESTRATION_MODEL, systemPrompt, userMsg, res, req, 3200, 0.75);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`); res.end(); return;
    }

    try {
      const report = extractJson(buffer);
      res.write(`data: ${JSON.stringify({ done: true, report })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: "Parse failed — try again" })}\n\n`);
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "Analyze error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/strategy — switch conversion strategy
router.post("/generate/website/strategy", requireAuth, async (req, res): Promise<void> => {
  try {
    const { idea, businessIntelligence, strategyMode, sections, language: stratLanguage } = req.body;
    if (!idea || !strategyMode) { res.status(400).json({ error: "idea and strategyMode required" }); return; }
    if (!NVIDIA_API_KEY) { res.status(500).json({ error: "API key not configured" }); return; }
    const { getLanguageInstruction: getLangInstr3 } = await import("../lib/language");
    const langInstr3 = getLangInstr3(stratLanguage);

    const bi = businessIntelligence as { industry?: string; targetMarket?: string } | null;
    const industry = bi?.industry ?? "SaaS";
    const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];

    const STRATEGY_GUIDES: Record<string, string> = {
      plg: `Product-led Growth (PLG): Free tier is the hero CTA. Show the product immediately. Metric-heavy ("${(sections as {hero?: {socialProof?: string}})?.hero?.socialProof ?? "10,000+ teams"}" style). No credit card required. Frictionless self-serve onboarding. Viral/referral mechanics in pricing. Convert on outcome, not features.`,
      enterprise: `Enterprise Sales: No free tier — only "Book a demo" / "Contact sales". Lead with ROI and compliance. Named enterprise logos as primary trust signal. Annual contracts, dedicated CSM, SLA guarantees. Address procurement and security teams. Custom pricing dominates.`,
      "high-touch": `High-Touch Sales: Consultative selling. Headline is a transformation promise, not a product claim. Primary CTA is "Book a strategy call" or "Get a custom assessment". Emphasis on expertise, methodology, case studies. ROI-heavy testimonials from named companies.`,
      community: `Community-Led Growth: Lead with community size and engagement. Free membership as the primary CTA. Content library, peer learning, creator ecosystem. Network effects as the value proposition. Social proof is community-generated (UGC, shared results, member spotlights).`,
    };

    const strategyGuide = STRATEGY_GUIDES[strategyMode] ?? STRATEGY_GUIDES["plg"];

    const sectionPrompts: Record<string, string> = {
      hero: `Rewrite the hero section for "${idea}" (${industry}) using this EXACT strategy: ${strategyGuide}. ICP: ${bi?.targetMarket ?? "Unknown"}. Trust signals needed: ${designSystem.trustSignals}. Return ONLY JSON: { "badge": "...", "headline": "...", "subheadline": "...", "ctaPrimary": "...", "ctaSecondary": "...", "socialProof": "..." }`,
      pricing: `Rewrite pricing for "${idea}" (${industry}) using this EXACT strategy: ${strategyGuide}. Return ONLY JSON: { "title": "...", "subtitle": "...", "tiers": [{ "name": "...", "price": "$X", "period": "/mo", "description": "...", "features": ["..."], "cta": "...", "highlighted": boolean, "badge": null }] } with 3 tiers.`,
      cta: `Rewrite the final CTA section for "${idea}" (${industry}) using this EXACT strategy: ${strategyGuide}. Conversion goal: ${designSystem.primaryConversion}. Return ONLY JSON: { "headline": "...", "subheadline": "...", "buttonText": "...", "subtext": "..." }`,
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const results: Record<string, unknown> = {};
    const sysPrompt = `You are an elite conversion strategist specializing in ${industry}. Return ONLY valid JSON. No markdown, no explanation, no <think> blocks.` + langInstr3;

    for (const sectionName of ["hero", "pricing", "cta"]) {
      res.write(`data: ${JSON.stringify({ phase: "section", section: sectionName })}\n\n`);
      let buf = "";
      try {
        buf = await streamNvidiaRequest(ORCHESTRATION_MODEL, sysPrompt, sectionPrompts[sectionName], res, req, 1200, 0.88);
        results[sectionName] = extractJson(buf);
      } catch { /* skip section on error */ }
    }

    res.write(`data: ${JSON.stringify({ done: true, sections: results, strategyMode })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Strategy switch error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/evaluate — AI self-evaluation of generated website
router.post("/generate/website/evaluate", requireAuth, async (req, res): Promise<void> => {
  try {
    const { websiteData, businessIdea, businessIntelligence } = req.body;
    if (!websiteData) { res.status(400).json({ error: "websiteData required" }); return; }
    if (!NVIDIA_API_KEY) { res.status(500).json({ error: "API key not configured" }); return; }

    const { callNvidia, extractJson } = await import("../lib/nvidia");

    const bi = businessIntelligence as {
      industry?: string; targetMarket?: string;
      metrics?: Record<string, number>;
    } | null;
    const wd = websiteData as {
      brand?: { name?: string; tagline?: string };
      designVariant?: string;
      _industry?: string;
      colorPalette?: { primary?: string; background?: string; accent?: string };
      typography?: { headingFont?: string; bodyFont?: string };
      sections?: {
        hero?: { badge?: string; headline?: string; subheadline?: string; ctaPrimary?: string; ctaSecondary?: string; socialProof?: string };
        features?: { title?: string; items?: Array<{ title: string; description?: string }> };
        testimonials?: { title?: string; items?: Array<{ quote: string; author: string; metric?: string }> };
        pricing?: { tiers?: Array<{ name: string; price: string; highlighted?: boolean; badge?: string }> };
        cta?: { headline?: string; subheadline?: string; buttonText?: string };
        faq?: { items?: Array<{ question: string; answer?: string }> };
        footer?: { tagline?: string };
      };
      websiteStrategy?: {
        conversionApproach?: string;
        audiencePsychology?: string;
        trustSignals?: string[];
        sectionOrder?: string;
      };
      seoMeta?: { title?: string; description?: string; keywords?: string[] };
    };

    const industry = bi?.industry ?? wd._industry ?? "SaaS";
    const designSystem = INDUSTRY_DESIGN_SYSTEMS[industry] ?? INDUSTRY_DESIGN_SYSTEMS["SaaS"];
    const variant = wd.designVariant ?? "Unknown";

    const systemPrompt = `You are STAGEONE's AI Quality Reviewer — an expert in conversion design, UX, brand strategy, and web performance. You review AI-generated websites and score them across multiple quality dimensions.

Your job: analyze the website plan and generated content, then return a structured evaluation report with precise scores and actionable insights.

Scoring dimensions (each 0–100):
- design_score: Visual hierarchy, color consistency, typography quality, spacing, aesthetic coherence with the chosen design variant
- conversion_score: CTA clarity, trust signal placement, pricing clarity, social proof quality, conversion funnel logic
- ux_score: Navigation clarity, section flow, information architecture, readability, cognitive load
- content_score: Headline quality, copy clarity, benefit vs feature balance, specificity of claims, tone consistency
- responsiveness_score: Mobile-readiness signals, viewport adaptability, touch-friendly CTA sizing, content prioritization for small screens
- overall_score: Weighted composite (design 20%, conversion 30%, ux 20%, content 20%, responsiveness 10%)

Scoring calibration:
- 90–100: Exceptional — publication-ready, industry-leading quality
- 75–89: Strong — above average with minor gaps
- 60–74: Adequate — functional but with clear improvement areas
- 40–59: Weak — significant gaps affecting effectiveness
- Below 40: Poor — fundamental issues requiring rework

Return ONLY valid JSON matching this EXACT schema. No markdown, no explanation:
{
  "overall_score": <integer 0-100>,
  "design_score": <integer 0-100>,
  "conversion_score": <integer 0-100>,
  "ux_score": <integer 0-100>,
  "content_score": <integer 0-100>,
  "responsiveness_score": <integer 0-100>,
  "strengths": ["<specific strength referencing actual content>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<specific weakness referencing actual content>", "<weakness 2>", "<weakness 3>"],
  "improvement_recommendations": [
    "<specific, actionable recommendation — reference exact content>",
    "<recommendation 2>",
    "<recommendation 3>",
    "<recommendation 4>",
    "<recommendation 5>"
  ]
}`;

    const userMsg = `Evaluate this AI-generated ${industry} website:

BUSINESS: ${businessIdea ?? wd.brand?.name ?? "Unknown"}
TARGET MARKET: ${bi?.targetMarket ?? "Not specified"}
DESIGN VARIANT: ${variant}
INDUSTRY: ${industry}
INDUSTRY REQUIRED TRUST SIGNALS: ${designSystem.trustSignals}
PRIMARY CONVERSION GOAL: ${designSystem.primaryConversion}

DESIGN DNA:
- Colors: primary=${wd.colorPalette?.primary ?? "?"}, bg=${wd.colorPalette?.background ?? "?"}, accent=${wd.colorPalette?.accent ?? "?"}
- Typography: ${wd.typography?.headingFont ?? "?"} (headings) / ${wd.typography?.bodyFont ?? "?"} (body)
- Variant style: ${DESIGN_VARIANTS[variant]?.description ?? "Unknown"}

WEBSITE PLAN:
- Conversion approach: "${wd.websiteStrategy?.conversionApproach ?? "none"}"
- Audience psychology: "${wd.websiteStrategy?.audiencePsychology ?? "none"}"
- Trust signals in plan: ${JSON.stringify(wd.websiteStrategy?.trustSignals ?? [])}
- Section order: "${wd.websiteStrategy?.sectionOrder ?? "none"}"

GENERATED CONTENT:
- Brand: "${wd.brand?.name ?? "?"}" — "${wd.brand?.tagline ?? ""}"
- Hero badge: "${wd.sections?.hero?.badge ?? "none"}"
- Hero headline: "${wd.sections?.hero?.headline ?? "none"}"
- Hero subheadline: "${wd.sections?.hero?.subheadline ?? "none"}"
- Primary CTA: "${wd.sections?.hero?.ctaPrimary ?? "none"}"
- Secondary CTA: "${wd.sections?.hero?.ctaSecondary ?? "none"}"
- Social proof: "${wd.sections?.hero?.socialProof ?? "none"}"
- Features section: "${wd.sections?.features?.title ?? "?"}" — ${(wd.sections?.features?.items ?? []).length} features: ${(wd.sections?.features?.items ?? []).slice(0, 4).map(f => f.title).join(", ")}
- Testimonials: ${(wd.sections?.testimonials?.items ?? []).length} (${(wd.sections?.testimonials?.items ?? []).filter(t => t.metric).length} with metrics)
- Pricing tiers: ${(wd.sections?.pricing?.tiers ?? []).map(t => `${t.name}@${t.price}${t.badge ? " ["+t.badge+"]" : ""}`).join(", ")}
- CTA section: "${wd.sections?.cta?.headline ?? "none"}" → "${wd.sections?.cta?.buttonText ?? "none"}"
- FAQ: ${(wd.sections?.faq?.items ?? []).length} questions
- Footer tagline: "${wd.sections?.footer?.tagline ?? "none"}"
- SEO title (${(wd.seoMeta?.title ?? "").length} chars): "${wd.seoMeta?.title ?? "none"}"
- SEO description (${(wd.seoMeta?.description ?? "").length} chars): "${wd.seoMeta?.description ?? "none"}"

EVALUATION DIMENSIONS TO JUDGE:
1. Visual hierarchy — Does the design variant (${variant}) constraints create a clear visual hierarchy?
2. CTA placement — Are primary CTAs placed at optimal conversion points?
3. Layout balance — Does the section flow feel balanced and purposeful?
4. Section flow — Does the section order guide the visitor through a logical journey?
5. Conversion readiness — Does the page have what a ${industry} buyer needs to convert?
6. Brand consistency — Is the copy tone consistent with the ${wd.brand?.name ?? "brand"} voice?
7. Mobile usability — Based on design choices, how mobile-ready does this appear?
8. Content quality — Are claims specific, benefits clear, and copy compelling?

Be specific — reference actual content (quote headlines, mention feature names, cite pricing tier names). Do NOT give generic advice.`;

    const raw = await callNvidia({
      model: MODELS.ORCHESTRATION,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.6,
      maxTokens: 1200,
    });

    try {
      const report = extractJson(raw);
      res.json({ success: true, report });
    } catch {
      res.status(500).json({ error: "Failed to parse evaluation — try again" });
    }
  } catch (err) {
    req.log.error({ err }, "Evaluate error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/generate/website/compare — multi-candidate comparison engine
router.post("/generate/website/compare", requireAuth, async (req, res): Promise<void> => {
  try {
    const { candidates, businessIdea, businessIntelligence } = req.body;
    if (!candidates || !Array.isArray(candidates) || candidates.length < 2) {
      res.status(400).json({ error: "At least 2 candidates required" }); return;
    }
    if (!NVIDIA_API_KEY) { res.status(500).json({ error: "API key not configured" }); return; }

    const { callNvidia, extractJson } = await import("../lib/nvidia");
    const bi = businessIntelligence as { industry?: string; targetMarket?: string } | null;
    const industry = bi?.industry ?? "SaaS";

    type CandInput = {
      label: string; designVariant?: string;
      evaluationReport?: {
        overall_score?: number; design_score?: number; conversion_score?: number;
        ux_score?: number; content_score?: number; responsiveness_score?: number;
        strengths?: string[]; weaknesses?: string[];
      };
      websiteData?: {
        brand?: { name?: string; tagline?: string };
        sections?: { hero?: { headline?: string; ctaPrimary?: string; socialProof?: string } };
        colorPalette?: { primary?: string; background?: string };
        typography?: { headingFont?: string };
      };
    };

    const candidateSummaries = (candidates as CandInput[]).map(c => `Candidate ${c.label}:
- Design Variant: ${c.designVariant ?? "Unknown"}
- Brand: ${c.websiteData?.brand?.name ?? "?"} — "${c.websiteData?.brand?.tagline ?? ""}"
- Hero Headline: "${c.websiteData?.sections?.hero?.headline ?? "?"}"
- Primary CTA: "${c.websiteData?.sections?.hero?.ctaPrimary ?? "?"}"
- Social Proof: "${c.websiteData?.sections?.hero?.socialProof ?? "?"}"
- Colors: primary=${c.websiteData?.colorPalette?.primary ?? "?"}, bg=${c.websiteData?.colorPalette?.background ?? "?"}
- Font: ${c.websiteData?.typography?.headingFont ?? "?"}
- Scores: overall=${c.evaluationReport?.overall_score ?? "?"} design=${c.evaluationReport?.design_score ?? "?"} conversion=${c.evaluationReport?.conversion_score ?? "?"} ux=${c.evaluationReport?.ux_score ?? "?"} content=${c.evaluationReport?.content_score ?? "?"} mobile=${c.evaluationReport?.responsiveness_score ?? "?"}
- Strengths: ${(c.evaluationReport?.strengths ?? []).join("; ")}
- Weaknesses: ${(c.evaluationReport?.weaknesses ?? []).join("; ")}`).join("\n\n---\n\n");

    const labels = (candidates as CandInput[]).map(c => c.label);
    const labelList = labels.join(", ");

    const systemPrompt = `You are STAGEONE's Multi-Candidate Comparison Engine — an expert in website design, conversion optimization, and brand strategy. You analyze multiple AI-generated website candidates and determine the strongest overall option based on their evaluation scores and content quality.

Return ONLY valid JSON matching this EXACT schema. No markdown, no explanation:
{
  "winner": "<label of winning candidate — one of: ${labelList}>",
  "strongest_candidate": "<same as winner>",
  "reasoning": "<2-3 sentences explaining why this candidate wins — reference specific scores and content>",
  "ranking": [<label of 1st>, <label of 2nd>, ...],
  "strengths_by_candidate": {${labels.map(l => `"${l}": ["<strength 1>", "<strength 2>"]`).join(", ")}},
  "weaknesses_by_candidate": {${labels.map(l => `"${l}": ["<weakness 1>", "<weakness 2>"]`).join(", ")}}
}`;

    const userMsg = `Compare these ${(candidates as CandInput[]).length} website candidates for: "${businessIdea ?? "Unknown business"}"
Industry: ${industry} | Target Market: ${bi?.targetMarket ?? "Not specified"}

${candidateSummaries}

Identify the winner and rank all candidates from strongest to weakest.`;

    const raw = await callNvidia({
      model: MODELS.ORCHESTRATION,
      systemPrompt, userMessage: userMsg,
      temperature: 0.3, maxTokens: 900,
    });

    let report: unknown;
    try { report = extractJson(raw); }
    catch { res.status(500).json({ error: "Failed to parse comparison report" }); return; }

    res.json({ success: true, report });
  } catch (err) {
    req.log.error({ err }, "Compare error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
