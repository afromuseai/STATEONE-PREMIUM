// ─── Website Architect V2 — Shared Types ─────────────────────────────────────
// These types define the V2 pipeline data contracts.
// V1 types (WebsiteOutput, etc.) in website-html-generator.ts are untouched.
//
// Pipeline:
//   BusinessContext → [Architect Agent] → WebsiteBlueprint
//   WebsiteBlueprint + BusinessContext → [Code Agent] → GeneratedProject   (Phase 2)

// ─── BusinessContext ──────────────────────────────────────────────────────────
// Extracted from the user's idea and any existing Business Intelligence output.
// Passed as input to both the Architect Agent and the Code Generation Agent.
export interface BusinessContext {
  idea:             string;
  companyName:      string;
  industry:         string;
  targetAudience:   string;
  businessGoal:     string;
  brandPositioning: string;
  conversionGoal:   string;
  existingBI?:      Record<string, unknown>;  // raw BI output from /api/generate
}

// ─── WebsiteBlueprint ─────────────────────────────────────────────────────────
// The Architect Agent's output — an engineering architecture document.
// NOT HTML. NOT a template schema. NOT marketing copy.
// Describes what to build and why; the Code Agent decides how.
export interface BlueprintPage {
  route:       string;
  purpose:     string;
  components:  string[];
  priority:    "primary" | "secondary";
}

export interface BlueprintDesignSystem {
  style:        string;   // e.g. "enterprise futuristic", "clean minimal"
  colorPrimary: string;   // descriptive, not hex — e.g. "deep navy"
  colorAccent:  string;   // e.g. "electric blue"
  typography:   string;   // e.g. "modern geometric sans"
  motion:       "none" | "subtle" | "expressive";
  borderRadius: "sharp" | "sm" | "md" | "lg" | "full";
}

export interface WebsiteBlueprint {
  projectType:    "marketing" | "saas" | "portfolio" | "ecommerce" | "blog" | "agency";
  pages:          BlueprintPage[];
  designSystem:   BlueprintDesignSystem;
  // Map of component name → its own sub-components / children
  componentHierarchy:    Record<string, string[]>;
  responsiveStrategy:    string;   // How the layout adapts across breakpoints
  interactionPlan:       string[]; // Key user interactions / animation moments
  contentStrategy:       string;   // Hierarchy of information and persuasion flow
  technicalRequirements: string[]; // Next.js features, libraries, accessibility needs
  architectRationale:    string;   // Why this structure fits the business
}

// ─── GenerationPlan ───────────────────────────────────────────────────────────
// Intermediate planning artifact — the Architect Agent's reasoning trace.
// Stored for observability; not sent to the Code Agent.
export interface GenerationPlan {
  businessSummary:    string;
  keyProblems:        string[];
  strategicDecisions: string[];
  riskFlags:          string[];
}

// ─── GeneratedProject ─────────────────────────────────────────────────────────
// The Code Generation Agent's output (Phase 2 — not yet implemented).
// files: real Next.js project files for download.
// preview: standalone HTML for the iframe (no build step required).
export interface GeneratedProject {
  files:     Record<string, string>;  // file path → content
  preview:   string;                  // self-contained HTML for <iframe srcDoc>
  blueprint: WebsiteBlueprint;
  context:   BusinessContext;
}

// ─── SSE event shapes ─────────────────────────────────────────────────────────
// Typed payloads the V2 route writes to the SSE stream.
export type V2SseEvent =
  | { phase: "start";      model: string; industry: string }
  | { phase: "thinking";   active: boolean }
  | { phase: "architect";  content: string }
  | { phase: "blueprint";  data: WebsiteBlueprint }
  | { phase: "error";      message: string; code?: string };
