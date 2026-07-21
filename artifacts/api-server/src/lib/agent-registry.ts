// ─── Agent Registry — Specialist Agent Definitions ──────────────────────────
// Phase 13.6
//
// Defines the SpecialistAgent interface and registers all built-in agents.
// The registry is designed for extensibility — new agents can be added without
// modifying the orchestrator. The orchestrator discovers agents from the
// registry and routes tasks to the best match.

import type { ExecutionTask } from "./task-planner";

// ─── Agent Interface ─────────────────────────────────────────────────────────

export interface SpecialistAgent {
  /** Unique identifier (e.g. "styling", "routing"). */
  id: string;
  /** Human-readable name (e.g. "Styling Agent"). */
  name: string;
  /** One-line description of what this agent does. */
  description: string;
  /** Keyword capabilities this agent handles (used for routing). */
  capabilities: string[];
  /** Priority for routing — higher wins ties. */
  priority: number;
  /** Returns true if this agent can handle the given task. */
  canHandle(task: ExecutionTask): boolean;
}

// ─── Agent Prompt Profiles ───────────────────────────────────────────────────
// Each agent owns a dedicated system prompt. Prompts are short and focused.
// They do NOT duplicate WorkspaceContext — that is injected separately.

export interface AgentPromptProfile {
  agentId: string;
  systemPrompt: string;
}

// ─── Context Filtering Rules ─────────────────────────────────────────────────
// Each agent receives only the WorkspaceContext fields relevant to it.

export interface ContextFilterRule {
  agentId: string;
  /** WorkspaceContext field names this agent should receive. */
  includeFields: string[];
}

// ─── Built-in Agents ─────────────────────────────────────────────────────────

function createAgent(
  id: string,
  name: string,
  description: string,
  capabilities: string[],
  priority: number,
): SpecialistAgent {
  return {
    id,
    name,
    description,
    capabilities: capabilities.map((c) => c.toLowerCase()),
    priority,
    canHandle(task: ExecutionTask): boolean {
      const lowerTitle = task.title.toLowerCase();
      const lowerObjective = task.objective.toLowerCase();
      const allFiles = [...task.filesToModify, ...task.filesToRead];

      // Check if any capability keyword matches the task
      return this.capabilities.some((cap) => {
        // Check title
        if (lowerTitle.includes(cap)) return true;
        // Check objective
        if (lowerObjective.includes(cap)) return true;
        // Check file paths
        return allFiles.some((f) => f.toLowerCase().includes(cap));
      });
    },
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const AGENT_REGISTRY: SpecialistAgent[] = [
  createAgent(
    "styling",
    "Styling Agent",
    "Handles CSS, Tailwind, theme, animations, spacing, and visual design changes",
    ["css", "tailwind", "theme", "animation", "spacing", "style", "styling", "color", "font", "responsive", "layout shift", "visual"],
    80,
  ),
  createAgent(
    "routing",
    "Routing Agent",
    "Handles page routing, navigation, layouts, route groups, and URL structure",
    ["layout", "page", "navigation", "route", "router", "redirect", "link", "href", "segment", "path", "url", "sitemap"],
    70,
  ),
  createAgent(
    "component",
    "Component Agent",
    "Handles React components, TSX/JSX files, component composition, and reusability",
    ["component", "tsx", "jsx", "react", "props", "children", "hoc", "render", "composable", "ui component"],
    60,
  ),
  createAgent(
    "state",
    "State Agent",
    "Handles state management, stores, contexts, providers, and data flow",
    ["zustand", "redux", "context", "provider", "store", "state", "dispatch", "reducer", "action", "selector", "atom", "signal", "recoil", "jotai"],
    50,
  ),
  createAgent(
    "data",
    "Data Agent",
    "Handles data fetching, API calls, server actions, GraphQL, and data mutations",
    ["fetch", "api", "server action", "graphql", "query", "mutation", "axios", "swr", "tanstack query", "react query", "endpoint", "rest", "rpc", "trpc"],
    40,
  ),
  createAgent(
    "performance",
    "Performance Agent",
    "Handles performance optimization, bundle size, memoization, lazy loading, and rendering efficiency",
    ["performance", "bundle", "render", "memo", "lazy", "suspense", "optimize", "optimization", "throttle", "debounce", "code split", "chunk", "cache"],
    30,
  ),
  createAgent(
    "accessibility",
    "Accessibility Agent",
    "Handles ARIA attributes, keyboard navigation, color contrast, screen reader support, and a11y compliance",
    ["aria", "keyboard", "contrast", "screen reader", "a11y", "accessibility", "tabindex", "focus", "role", "label", "alt text", "semantic html"],
    20,
  ),
  createAgent(
    "validation",
    "Validation Agent",
    "Handles input validation, form validation, error handling, and type safety fixes",
    ["validation", "validate", "error handling", "type error", "type safety", "form validation", "input validation", "schema", "zod", "yup", "assert"],
    10,
  ),
  // GeneralAgent is the fallback — lowest priority, catches everything
  createAgent(
    "general",
    "General Agent",
    "Fallback agent for tasks that don't match any specialist. Handles general edits, configuration, and miscellaneous changes",
    [], // Empty capabilities — matches nothing via keywords, only via fallback
    0,
  ),
];

// ─── Agent Prompt Profiles ───────────────────────────────────────────────────

export const AGENT_PROMPT_PROFILES: Record<string, AgentPromptProfile> = {
  styling: {
    agentId: "styling",
    systemPrompt: `You are a Styling Specialist.

Responsibilities:
• Modify only styling — never change business logic, component interfaces, or data flow
• Preserve layout structure and responsive behavior
• Preserve accessibility attributes and semantic HTML
• Use the project's existing styling approach (Tailwind classes, CSS modules, etc.)
• Keep existing class names and CSS custom properties where possible
• Ensure visual consistency with the design system`,
  },
  routing: {
    agentId: "routing",
    systemPrompt: `You are a Routing Specialist.

Responsibilities:
• Preserve existing navigation structure and route hierarchy
• Preserve layout nesting and inheritance
• Maintain route group organization and parallel route patterns
• Update links and redirects when routes change
• Ensure all routes remain accessible and properly nested
• Do not modify component internals — only routing and layout files`,
  },
  component: {
    agentId: "component",
    systemPrompt: `You are a Component Specialist.

Responsibilities:
• Preserve component interfaces (props, exports, types)
• Reuse existing components — avoid creating duplicates
• Maintain component composition patterns
• Keep existing import paths and naming conventions
• Ensure TypeScript type safety across component boundaries
• Do not modify routing, state management, or data fetching logic`,
  },
  state: {
    agentId: "state",
    systemPrompt: `You are a State Management Specialist.

Responsibilities:
• Preserve existing state management patterns (Zustand stores, React context, Redux, etc.)
• Maintain provider hierarchy and context scope
• Keep selector patterns and memoization
• Ensure state updates are predictable and side-effect-free
• Do not modify component rendering or styling
• Do not introduce new state management libraries`,
  },
  data: {
    agentId: "data",
    systemPrompt: `You are a Data Specialist.

Responsibilities:
• Preserve existing data fetching patterns (server actions, React Query, SWR, etc.)
• Maintain API endpoint contracts and response types
• Keep error handling and loading states consistent
• Preserve caching and revalidation strategies
• Do not modify UI components or styling
• Do not change business logic in data handlers`,
  },
  performance: {
    agentId: "performance",
    systemPrompt: `You are a Performance Specialist.

Responsibilities:
• Reduce unnecessary re-renders with memo, useMemo, useCallback
• Optimize bundle size — prefer dynamic imports and code splitting
• Preserve all existing functionality — no regressions
• Add Suspense boundaries where beneficial
• Keep existing component interfaces intact
• Do not change styling, routing, or data fetching patterns`,
  },
  accessibility: {
    agentId: "accessibility",
    systemPrompt: `You are an Accessibility Specialist.

Responsibilities:
• Add and fix ARIA attributes, roles, and labels
• Ensure keyboard navigation works correctly
• Maintain sufficient color contrast ratios
• Support screen readers with proper semantic HTML
• Preserve all existing functionality and styling
• Do not remove existing accessibility features`,
  },
  validation: {
    agentId: "validation",
    systemPrompt: `You are a Validation Specialist.

Responsibilities:
• Fix TypeScript type errors and type safety issues
• Add input validation and form validation where needed
• Use the project's existing validation patterns (Zod, Yup, etc.)
• Preserve all existing business logic and functionality
• Do not change component rendering or styling
• Ensure error messages are user-friendly and consistent`,
  },
  general: {
    agentId: "general",
    systemPrompt: `You are a General Editing Specialist.

You handle tasks that don't match any specialist. Apply the user's instruction precisely, maintaining code quality and consistency with the existing codebase.`,
  },
};

// ─── Context Filtering Rules ─────────────────────────────────────────────────

export const AGENT_CONTEXT_FILTERS: Record<string, ContextFilterRule> = {
  styling: {
    agentId: "styling",
    includeFields: [
      "designTokens",
      "stylingApproach",
      "componentUsage",
      "pathAliases",
      "framework",
    ],
  },
  routing: {
    agentId: "routing",
    includeFields: [
      "routeTree",
      "layoutHierarchy",
      "entryPoints",
      "pathAliases",
      "framework",
    ],
  },
  component: {
    agentId: "component",
    includeFields: [
      "componentIndex",
      "importGraph",
      "relatedFiles",
      "relationReasons",
      "pathAliases",
      "framework",
    ],
  },
  state: {
    agentId: "state",
    includeFields: [
      "dependencies",
      "stateManagement",
      "relatedFiles",
      "importGraph",
      "pathAliases",
    ],
  },
  data: {
    agentId: "data",
    includeFields: [
      "dataFetching",
      "dependencies",
      "importGraph",
      "relatedFiles",
      "pathAliases",
    ],
  },
  performance: {
    agentId: "performance",
    includeFields: [
      "dependencies",
      "importGraph",
      "componentIndex",
      "relatedFiles",
      "pathAliases",
    ],
  },
  accessibility: {
    agentId: "accessibility",
    includeFields: [
      "componentIndex",
      "relatedFiles",
      "pathAliases",
      "framework",
    ],
  },
  validation: {
    agentId: "validation",
    includeFields: [
      "dependencies",
      "importGraph",
      "relatedFiles",
      "pathAliases",
    ],
  },
  general: {
    agentId: "general",
    includeFields: [
      "framework",
      "pathAliases",
      "entryPoints",
      "dependencies",
    ],
  },
};

// ─── Registry Helpers ────────────────────────────────────────────────────────

/** Get all registered agents. */
export function getRegisteredAgents(): SpecialistAgent[] {
  return [...AGENT_REGISTRY];
}

/** Get an agent by ID. */
export function getAgentById(id: string): SpecialistAgent | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}

/** Get the system prompt for an agent. */
export function getAgentPrompt(agentId: string): string {
  return AGENT_PROMPT_PROFILES[agentId]?.systemPrompt ?? AGENT_PROMPT_PROFILES.general.systemPrompt;
}

/** Get the context filter rule for an agent. */
export function getAgentContextFilter(agentId: string): ContextFilterRule {
  return AGENT_CONTEXT_FILTERS[agentId] ?? AGENT_CONTEXT_FILTERS.general;
}

/** Filter a WorkspaceContext to only include fields relevant to the given agent. */
export function filterContextForAgent(
  agentId: string,
  ctx: import("./workspace-context").WorkspaceContext | undefined,
): import("./workspace-context").WorkspaceContext | undefined {
  if (!ctx) return undefined;

  const filter = getAgentContextFilter(agentId);
  const filtered: Record<string, unknown> = {};

  for (const field of filter.includeFields) {
    const value = (ctx as Record<string, unknown>)[field];
    if (value !== undefined) {
      filtered[field] = value;
    }
  }

  return filtered as import("./workspace-context").WorkspaceContext;
}
