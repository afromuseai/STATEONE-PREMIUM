// ─── Website Architect V2 — Shared Types ─────────────────────────────────────
import type { ConversationEvent } from "./agents/marcus-conversation";
// These types define the V2 pipeline data contracts.
// V1 types (WebsiteOutput, etc.) in website-html-generator.ts are untouched.
//
// Pipeline:
//   BusinessContext → [Architect Agent] → WebsiteBlueprint
//   WebsiteBlueprint + BusinessContext → [Code Agent] → GeneratedProject

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

// ─── BlueprintComponent ───────────────────────────────────────────────────────
// Rich per-component specification that removes ambiguity for the Code Agent.
// Every field is architectural intent, never implementation (no code/CSS/copy).
export interface BlueprintComponent {
  name:            string;    // PascalCase component name, e.g. "HeroSection"
  purpose:         string;    // One sentence: what this component achieves for the user
  layout:          string;    // Visual/structural description, e.g. "split hero, text left, visual right"
  contentElements: string[];  // Content slots inside this component (no copy, just slot names)
                              // e.g. ["headline", "supporting paragraph", "primary CTA", "trust badge"]
  behavior:        string[];  // Interaction/animation/responsive rules
                              // e.g. ["fade in on load", "responsive stacking on mobile"]
}

export interface BlueprintPage {
  route:       string;
  purpose:     string;
  components:  BlueprintComponent[];   // Rich component specs, not just names
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

// ─── ProjectFile ──────────────────────────────────────────────────────────────
// Operation-based file representation for the generated project.
// Enables future agents to update individual files without regenerating the
// entire project. "language" is inferred from the file extension if omitted.
export interface ProjectFile {
  path:       string;                           // e.g. "app/page.tsx"
  operation:  "create" | "update" | "delete";  // always "create" on first generation
  content:    string;                           // full file content
  language?:  string;                           // e.g. "typescript", "css", "json"
}

// ─── GeneratedProject ─────────────────────────────────────────────────────────
// The Code Generation Agent's output (Phase 2).
// files: operation-based list of real Next.js project files.
// preview: standalone HTML for the iframe (no build step required).
// dependencies: npm packages the project needs beyond Next.js defaults.
// runInstructions: how to start the project locally after download.
export interface GeneratedProject {
  projectId?:       string;                    // set after DB persistence
  files:            ProjectFile[];             // operation-based file list
  dependencies:     string[];                  // e.g. ["framer-motion", "lucide-react"]
  runInstructions?: { command: string };        // e.g. { command: "npm run dev" }
  preview:          string;                    // self-contained HTML for <iframe srcDoc>
  blueprint:        WebsiteBlueprint;
  context:          BusinessContext;
}

// ─── API response shapes (consumed by Website Studio UI) ─────────────────────

// Lightweight summary returned by GET /api/website-v2/projects (list)
// Heavy fields (files, blueprint, preview) are omitted here.
export interface WebsiteProjectSummary {
  id:          string;
  projectName: string;
  status:      string;
  createdAt:   string;
  updatedAt:   string;
}

// Full project returned by GET /api/website-v2/projects/:id
// Every field needed to power the Website Studio workspace.
export interface WebsiteProjectResponse {
  id:              string;
  projectName:     string;
  status:          string;
  businessContext: BusinessContext;
  blueprint:       WebsiteBlueprint | null;
  files:           ProjectFile[];
  dependencies:    string[];
  preview:         string | null;
  createdAt:       string;
  updatedAt:       string;
}

// ─── AI Editing Agent types ───────────────────────────────────────────────────

// Input: what the user wants to change and which files to focus on.
export interface EditRequest {
  projectId:      string;
  instruction:    string;
  selectedFiles?: string[];   // file paths the user has selected; if empty, agent decides
}

// A single file modification produced by the editing agent.
export interface FileModification {
  path:      string;
  operation: "update" | "create" | "delete";
  content:   string;
  reason:    string;   // one-sentence explanation of what changed and why
}

// The editing agent's full response.
export interface EditResult {
  changes: FileModification[];
  summary: string;   // human-readable description of all changes made
}

// ─── SSE event shapes ─────────────────────────────────────────────────────────
// Typed payloads the V2 route writes to the SSE stream.
export type V2SseEvent =
  | { phase: "start";             model: string; industry: string }
  | { phase: "thinking";          active: boolean }
  | { phase: "architect";         content: string }
  | { phase: "project-created";   projectId: string }
  | { phase: "blueprint";         data: WebsiteBlueprint }
  /**
   * Emitted after blueprint validation and scope enforcement, before code generation begins.
   * Summarises the blueprint's complexity and signals whether it was trimmed.
   */
  | { phase: "blueprint-summary"; components: number; files: number; estimatedTokens: number; simplified: boolean }
  /**
   * Design Review Agent (Step 5): reviews the blueprint against 4 quality gates
   * before the code generation phase begins. content chunks stream the agent's
   * reasoning; blueprint-updated carries the improved blueprint when it changes.
   */
  | { phase: "design-review";     content?: string }
  | { phase: "blueprint-updated"; data: WebsiteBlueprint }
  | { phase: "building";          content?: string }
  | { phase: "project-saved";     projectId: string }
  | { phase: "done";              projectId: string; data: GeneratedProject }
  | { phase: "error";             message: string; code?: string }
  /** Marcus Conversation Engine events — narrate real agent work alongside generation. */
  | { phase: "agent";             event: ConversationEvent };

// SSE events from the editing route.
export type V2EditSseEvent =
  | { phase: "analyzing" }
  | { phase: "editing" }
  | { phase: "changes";       data: EditResult }
  | { phase: "saved";         fileCount: number }
  | { phase: "regenerating" }
  | { phase: "preview-ready" }
  | { phase: "error";         message: string }
  /** Marcus Conversation Engine events — real narration of the edit run (Commit 4). */
  | { phase: "agent";         event: ConversationEvent };

// SSE events from the preview regeneration route.
export type V2PreviewSseEvent =
  | { phase: "analyzing" }
  | { phase: "rendering" }
  | { phase: "preview"; data: { preview: string } }
  | { phase: "saved" }
  | { phase: "error"; message: string };
