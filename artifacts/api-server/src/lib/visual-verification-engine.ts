// ─── Visual Verification Engine — Autonomous Visual QA for Edits ────────────
// Phase 14.4
//
// After code validation and preview intelligence, the visual verification engine
// performs static analysis to detect visual regressions:
//   - Broken layouts (negative margins, missing flex/grid parents, broken gap)
//   - Overlapping elements (position absolute/fixed without relative parent or z-index)
//   - Missing sections (before/after component structure diffing)
//   - Incorrect spacing (inconsistent padding/margin, broken gap values)
//   - Mobile responsiveness issues (missing media queries, fixed viewport units)
//   - Typography inconsistencies (mixing font sizes, families, heading hierarchy violations)
//   - Color/design token violations (colors outside design system palette)
//
// Flow:
//   Validation → Preview Intelligence → Visual Verification → Auto Repair Loop → Confidence
//
// Since we don't have a live browser runtime server-side, we perform heuristic
// static analysis on changed files and compare with the pre-edit state.

import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisualIssueSeverity = "low" | "medium" | "high" | "critical";

export type VisualIssueCategory =
  | "layout-break"
  | "overlap"
  | "missing-section"
  | "spacing"
  | "responsive"
  | "typography"
  | "design-token"
  | "before-after-regression";

export interface VisualIssue {
  category: VisualIssueCategory;
  severity: VisualIssueSeverity;
  description: string;
  suggestion?: string;
  affectedFiles: string[];
  /** For before/after regressions: the original value vs the new value */
  beforeValue?: string;
  afterValue?: string;
}

export interface VisualComparison {
  /** Files that existed before and still exist — their visual fingerprints changed. */
  modifiedVisuals: Array<{ path: string; reason: string }>;
  /** Files that were removed entirely. */
  removedFiles: string[];
  /** Files that were added. */
  addedFiles: string[];
  /** Number of sections detected as removed or changed. */
  sectionDelta: number;
}

export interface VisualScoreBreakdown {
  layoutScore: number;       // 0-100
  overlapScore: number;      // 0-100
  spacingScore: number;      // 0-100
  responsiveScore: number;   // 0-100
  typographyScore: number;   // 0-100
  designTokenScore: number;  // 0-100
  regressionScore: number;   // 0-100 (before/after comparison)
}

export type VisualStatus = "healthy" | "warning" | "failed" | "critical";

export interface VisualReport {
  /** Overall visual health status. */
  status: VisualStatus;
  /** Composite visual score 0–100. */
  score: number;
  /** Full breakdown by category. */
  breakdown: VisualScoreBreakdown;
  /** All detected visual issues. */
  issues: VisualIssue[];
  /** Before/after comparison data. */
  comparison: VisualComparison;
  /** Human-readable summary. */
  summary: string;
  /** Whether there are issues severe enough to warrant a repair pass. */
  needsRepair: boolean;
  /** Structured repair instruction for the editing agent. */
  repairInstruction?: string;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface VisualTelemetry {
  visualChecksPerformed: number;
  visualIssuesDetected: number;
  layoutRegressionCount: number;
  responsiveIssues: number;
  designTokenViolations: number;
  visualRepairAttempts: number;
  visualScore: number;
}

let telemetry: VisualTelemetry = {
  visualChecksPerformed: 0,
  visualIssuesDetected: 0,
  layoutRegressionCount: 0,
  responsiveIssues: 0,
  designTokenViolations: 0,
  visualRepairAttempts: 0,
  visualScore: 100,
};

export function getVisualTelemetry(): VisualTelemetry {
  return { ...telemetry };
}

export function resetVisualTelemetry(): void {
  telemetry = {
    visualChecksPerformed: 0,
    visualIssuesDetected: 0,
    layoutRegressionCount: 0,
    responsiveIssues: 0,
    designTokenViolations: 0,
    visualRepairAttempts: 0,
    visualScore: 100,
  };
}

// ─── Before/After Snapshot Types ─────────────────────────────────────────────

/**
 * A lightweight fingerprint of a file for before/after comparison.
 * Captures structural elements relevant to visual layout: component names,
 * key CSS/Tailwind classes, element count, and section boundaries.
 */
interface FileVisualFingerprint {
  path: string;
  /** Component/element count (divs, sections, etc.) */
  elementCount: number;
  /** Detected section starts (e.g., <section, className="...hero...", id="...") */
  sections: string[];
  /** All Tailwind/utility classes used (deduplicated) */
  classList: string[];
  /** All inline style declarations */
  inlineStyles: string[];
  /** Content hash for quick change detection */
  structuralHash: string;
}

/**
 * Build a visual fingerprint for a file by scanning its content.
 */
function fingerprintFile(path: string, content: string): FileVisualFingerprint {
  const elementMatches = content.match(/<div|<section|<article|<main|<header|<footer|<aside|<nav|<form/g) || [];
  const sectionMatches = content.match(/<section[^>]*>|<div[^>]*className=["'][^"']*(?:section|hero|features|cta|footer|header|nav|banner|content|wrapper|container)[^"']*["']/gi) || [];
  const classMatches = content.match(/className=["']([^"']*)["']/g) || [];
  const styleBlockMatches = content.match(/style\s*=\s*\{[^}]+\}/g) || [];

  const classList = classMatches
    .flatMap((m) => m.replace(/className=["']/, "").replace(/["']$/, "").split(/\s+/))
    .filter(Boolean);

  const inlineStyles = styleBlockMatches.map((m) => {
    // Normalize whitespace for comparison
    return m.replace(/\s+/g, " ").trim();
  });

  // Build a structural hash from the element order and key attributes
  const structuralContent = content
    .replace(/(?:data-[\w-]+|aria-[\w-]+)="[^"]*"/g, "") // strip dynamic attributes
    .replace(/\s+/g, " ")
    .slice(0, 2000); // first 2000 chars of normalized content

  return {
    path,
    elementCount: elementMatches.length,
    sections: [...new Set(sectionMatches)],
    classList: [...new Set(classList)],
    inlineStyles: [...new Set(inlineStyles)],
    structuralHash: simpleHash(structuralContent),
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// ─── Design Token Checker ───────────────────────────────────────────────────

// Common Tailwind color palette for reference when no design tokens are provided.
const TAILWIND_COLOR_CLASSES = new Set([
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

// Common Tailwind spacing/font utilities
const TAILWIND_TYPOGRAPHY_UTILITIES = new Set([
  "text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl",
  "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl", "text-8xl", "text-9xl",
  "font-thin", "font-extralight", "font-light", "font-normal", "font-medium",
  "font-semibold", "font-bold", "font-extrabold", "font-black",
  "leading-none", "leading-tight", "leading-snug", "leading-normal",
  "leading-relaxed", "leading-loose",
]);

// ─── Analysis Functions ──────────────────────────────────────────────────────

/**
 * Analyze changed files for visual regressions.
 *
 * Performs heuristic static analysis on the changed files (and optionally the
 * original files for before/after comparison) to detect common visual problems
 * that would be visible in a browser preview.
 */
export function analyzeVisualState(
  changedFiles: Array<{ path: string; content: string; operation: string }>,
  allFiles: Array<{ path: string; content?: string }>,
  originalFiles?: Array<{ path: string; content?: string }>,
  designTokens?: {
    colors?: string[];
    fonts?: string[];
    spacingScale?: string[];
    breakpoints?: string[];
    borderRadius?: string;
    motion?: "none" | "subtle" | "expressive";
  },
): VisualReport {
  telemetry.visualChecksPerformed++;
  const start = Date.now();

  const issues: VisualIssue[] = [];
  const modifiedVisuals: VisualComparison["modifiedVisuals"] = [];
  const removedFiles: string[] = [];
  const addedFiles: string[] = [];
  let sectionDelta = 0;

  // Build a map of original files for before/after comparison
  const originalMap = new Map<string, string>();
  if (originalFiles) {
    for (const f of originalFiles) {
      if (f.content) originalMap.set(f.path, f.content);
    }
  }

  // Build a fingerprint map of all current files
  const allContentMap = new Map<string, string>();
  for (const f of allFiles) {
    if (f.content) allContentMap.set(f.path, f.content);
  }

  // Build fingerprint for original files (before edit) for all changed files
  const beforeFingerprints = new Map<string, FileVisualFingerprint>();
  const afterFingerprints = new Map<string, FileVisualFingerprint>();

  for (const file of changedFiles) {
    if (file.operation === "delete") {
      removedFiles.push(file.path);
      continue;
    }

    // Create after fingerprint
    const after = fingerprintFile(file.path, file.content);
    afterFingerprints.set(file.path, after);

    // Create before fingerprint if original file exists
    const origContent = originalMap.get(file.path);
    if (origContent) {
      const before = fingerprintFile(file.path, origContent);
      beforeFingerprints.set(file.path, before);

      // Detect structural changes
      if (before.structuralHash !== after.structuralHash) {
        const reasonParts: string[] = [];
        const elemDiff = after.elementCount - before.elementCount;
        if (elemDiff !== 0) {
          reasonParts.push(`${elemDiff > 0 ? "+" : ""}${elemDiff} elements`);
        }
        if (after.sections.length !== before.sections.length) {
          reasonParts.push(`sections: ${before.sections.length} → ${after.sections.length}`);
          sectionDelta += after.sections.length - before.sections.length;
        }
        modifiedVisuals.push({
          path: file.path,
          reason: reasonParts.length > 0 ? reasonParts.join(", ") : "Structural change detected",
        });
      }
    } else {
      addedFiles.push(file.path);
      sectionDelta++;
    }
  }

  // ── 1. Detect layout breaks ──────────────────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;
    const path = file.path;

    // Negative margins
    const negMarginPattern = /(margin|m[trblxye]?)\s*:\s*-\d+px/g;
    const negMargins = content.match(negMarginPattern);
    if (negMargins && negMargins.length > 0) {
      issues.push({
        category: "layout-break",
        severity: "high",
        description: `Negative margin detected in ${path}: ${negMargins.slice(0, 3).join(", ")} — may cause layout overflow or element overlap`,
        suggestion: "Use positive margins or reposition with flex/grid layout instead",
        affectedFiles: [path],
        afterValue: negMargins.slice(0, 3).join(", "),
      });
    }

    // position: absolute/fixed without position: relative on parent
    // Heuristic: check if file has position: absolute or fixed but no relative parent in the same file
    const hasAbsolute = /\bposition\s*:\s*absolute\b/.test(content);
    const hasFixed = /\bposition\s*:\s*fixed\b/.test(content);
    const hasRelative = /\bposition\s*:\s*relative\b/.test(content);
    if ((hasAbsolute || hasFixed) && !hasRelative) {
      issues.push({
        category: "layout-break",
        severity: "medium",
        description: `\`position: ${hasAbsolute ? "absolute" : "fixed"}\` used in ${path} without a \`position: relative\` parent — element may escape its intended container`,
        suggestion: "Wrap the positioned element in a container with `position: relative`",
        affectedFiles: [path],
      });
    }

    // Flex items without flex container
    const flexItemPatterns = /\bflex-\d+\b|\bgrow\b|\bshrink\b|\bbasis-/g;
    if (flexItemPatterns.test(content) && !/\bdisplay\s*:\s*flex\b/.test(content) && !/className=["'][^"']*flex[^"']*["']/.test(content)) {
      issues.push({
        category: "layout-break",
        severity: "high",
        description: `Flex item properties (flex-grow/shrink/basis) used in ${path} without a flex container — layout will not behave as expected`,
        suggestion: "Apply `display: flex` or Tailwind `flex` class to the parent container",
        affectedFiles: [path],
      });
    }

    // Grid items without grid container
    if (/\bgrid-cols-\d+\b/.test(content) && !/className=["'][^"']*grid[^"']*["']/.test(content)) {
      issues.push({
        category: "layout-break",
        severity: "high",
        description: `Grid column classes used in ${path} without a grid container — layout will not render as a grid`,
        suggestion: "Add the `grid` class to the parent container",
        affectedFiles: [path],
      });
    }

    // z-index without position
    const zIndexPattern = /z-?(?:index)?\s*:\s*\d+/g;
    if (zIndexPattern.test(content) && !hasAbsolute && !hasFixed && !hasRelative) {
      issues.push({
        category: "overlap",
        severity: "medium",
        description: `\`z-index\` used in ${path} without a positioned parent — z-index has no effect on statically positioned elements`,
        suggestion: "Ensure the parent element has `position: relative`",
        affectedFiles: [path],
      });
    }
  }

  // ── 2. Detect spacing issues ─────────────────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;
    const path = file.path;

    // Mixed gap values in the same flex/grid context (inconsistent spacing)
    const gapMatches = content.match(/gap[-\w]*\s*:\s*\d+px/g);
    if (gapMatches && gapMatches.length > 1) {
      const uniqueGaps = [...new Set(gapMatches)];
      if (uniqueGaps.length > 1) {
        issues.push({
          category: "spacing",
          severity: "low",
          description: `Multiple different gap values in ${path}: ${uniqueGaps.join(", ")} — may cause inconsistent spacing`,
          affectedFiles: [path],
        });
      }
    }

    // Very large padding/margin values that could cause overflow
    const largeSpacingPattern = /(padding|margin|p[trblxye]?|m[trblxye]?)\s*:\s*(\d{3,})px/g;
    let largeMatch;
    while ((largeMatch = largeSpacingPattern.exec(content)) !== null) {
      const value = parseInt(largeMatch[2], 10);
      if (value > 80) {
        issues.push({
          category: "spacing",
          severity: "low",
          description: `Large ${largeMatch[1]}: ${value}px in ${path} — may cause overflow on small screens`,
          suggestion: "Consider using responsive spacing (e.g., `p-4 sm:p-6 lg:p-8`)",
          affectedFiles: [path],
          afterValue: `${value}px`,
        });
        break; // One warning per file is enough
      }
    }
  }

  // ── 3. Detect responsive issues ──────────────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;
    const path = file.path;

    // Fixed-width class without responsive alternative
    const wPattern = /\bw-\d+\b/g;
    const wMatches = content.match(wPattern);
    const hasResponsiveWidth = content.includes("sm:") || content.includes("md:") || content.includes("lg:") || content.includes("xl:");
    if (wMatches && wMatches.length > 0 && !hasResponsiveWidth) {
      const fixedWidths = [...new Set(wMatches)].slice(0, 3);
      issues.push({
        category: "responsive",
        severity: "medium",
        description: `Fixed-width classes (${fixedWidths.join(", ")}) in ${path} without responsive breakpoints — may overflow on smaller screens`,
        suggestion: "Add responsive prefixes: `w-64 sm:w-48 md:w-56`",
        affectedFiles: [path],
      });
    }

    // Viewport units without min/max fallback
    const vwPattern = /width\s*:\s*\d+vw/g;
    const vhPattern = /height\s*:\s*\d+vh/g;
    if (vwPattern.test(content) && !/\bmin-width\b|\bmax-width\b/.test(content)) {
      issues.push({
        category: "responsive",
        severity: "high",
        description: `Viewport-width units (vw) in ${path} without min/max-width fallback — may cause horizontal scroll on very large or small screens`,
        suggestion: "Add `min-width` and `max-width` constraints alongside vw units",
        affectedFiles: [path],
      });
    }
    if (vhPattern.test(content) && !/\bmin-height\b|\bmax-height\b/.test(content)) {
      issues.push({
        category: "responsive",
        severity: "medium",
        description: `Viewport-height units (vh) in ${path} without min/max-height fallback — may cause layout shift on mobile browsers (URL bar)`,
        suggestion: "Consider using `dvh` (dynamic viewport height) or adding a `min-height` fallback",
        affectedFiles: [path],
      });
    }

    // Container without responsive padding
    const isContainer = /className=["'][^"']*(?:container|wrapper|max-w)[^"']*["']/i.test(content);
    if (isContainer && !/px-\d+/.test(content) && !/p[trblxye]?-\d+/.test(content)) {
      issues.push({
        category: "responsive",
        severity: "low",
        description: `Container element in ${path} without horizontal padding — content may touch edges on mobile`,
        suggestion: "Add `px-4` or `px-6` for safe mobile padding",
        affectedFiles: [path],
      });
    }

    // Missing meta viewport (in HTML files)
    if (path.endsWith(".html") && !/<meta\s+name=["']viewport["']/i.test(content)) {
      issues.push({
        category: "responsive",
        severity: "critical",
        description: `Missing viewport meta tag in ${path} — page will not be responsive on mobile devices`,
        suggestion: 'Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">`',
        affectedFiles: [path],
      });
    }
  }

  // ── 4. Detect typography inconsistencies ─────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;
    const path = file.path;

    // Detect heading hierarchy violations (e.g., h4 without h3, h3 without h2)
    const headingLevels = new Set<number>();
    for (let i = 1; i <= 6; i++) {
      const hPattern = new RegExp(`<h${i}[^>]*>`, "g");
      if (hPattern.test(content)) {
        headingLevels.add(i);
      }
    }

    if (headingLevels.size > 1) {
      const sorted = [...headingLevels].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > 1) {
          issues.push({
            category: "typography",
            severity: "low",
            description: `Heading hierarchy violation in ${path}: h${sorted[i - 1]} → h${sorted[i]} — skipping heading levels can confuse screen readers and break visual hierarchy`,
            suggestion: `Use h${sorted[i - 1] + 1} instead of h${sorted[i]} for the next level, or adjust styling to maintain visual hierarchy`,
            affectedFiles: [path],
          });
          break;
        }
      }
    }

    // Multiple font families (potential inconsistency)
    const fontFamilyMatches = content.match(/font-['"]?[^'"};]+['"]?/g);
    if (fontFamilyMatches) {
      const uniqueFonts = [...new Set(fontFamilyMatches)];
      if (uniqueFonts.length > 2) {
        issues.push({
          category: "typography",
          severity: "medium",
          description: `Multiple font families (${uniqueFonts.length}) detected in ${path}: ${uniqueFonts.slice(0, 3).join(", ")}${uniqueFonts.length > 3 ? "..." : ""} — may cause visual inconsistency`,
          suggestion: "Limit to 1-2 font families (one for headings, one for body text)",
          affectedFiles: [path],
        });
      }
    }

    // Multiple font size scales (more than 4 unique sizes)
    const textSizeMatches = content.match(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g);
    if (textSizeMatches) {
      const uniqueSizes = [...new Set(textSizeMatches)];
      if (uniqueSizes.length > 5) {
        issues.push({
          category: "typography",
          severity: "low",
          description: `Many different font sizes (${uniqueSizes.length}) used in ${path} — may lack typographic consistency`,
          suggestion: "Define a typography scale and limit to 3-4 distinct sizes",
          affectedFiles: [path],
        });
      }
    }

    // Long text without break-word
    const hasLongText = content.replace(/<[^>]*>/g, "").split(/\s+/).some((word) => word.length > 40);
    if (hasLongText && !/break-words|overflow-wrap|word-break/.test(content)) {
      issues.push({
        category: "typography",
        severity: "medium",
        description: `Long unbroken strings in ${path} without \`overflow-wrap\` or \`break-words\` — may cause horizontal scroll on small screens`,
        suggestion: "Add `className='break-words'` or CSS `overflow-wrap: break-word`",
        affectedFiles: [path],
      });
    }
  }

  // ── 5. Detect design token violations ────────────────────────────────────
  if (designTokens) {
    const allowedColors = new Set((designTokens.colors ?? []).map((c) => c.toLowerCase()));
    const allowedFonts = new Set((designTokens.fonts ?? []).map((f) => f.toLowerCase()));

    for (const file of changedFiles) {
      if (file.operation === "delete") continue;
      const content = file.content;
      const path = file.path;

      // Check for color values not in the design system
      if (allowedColors.size > 0) {
        // Match hex colors, rgb(a) colors, and named Tailwind color classes
        const hexColorPattern = /#[0-9a-fA-F]{3,8}/g;
        const hexMatches = content.match(hexColorPattern);
        if (hexMatches) {
          const violators = hexMatches.filter((hex) => {
            // Check if this hex is in the allowed palette
            const lower = hex.toLowerCase();
            return ![...allowedColors].some((c) => lower.includes(c) || c.includes(lower));
          });
          if (violators.length > 0) {
            issues.push({
              category: "design-token",
              severity: "medium",
              description: `Color values outside design system in ${path}: ${violators.slice(0, 3).join(", ")}${violators.length > 3 ? ` (${violators.length - 3} more)` : ""}`,
              suggestion: `Use one of the approved colors: ${[...allowedColors].slice(0, 6).join(", ")}`,
              affectedFiles: [path],
              afterValue: violators.slice(0, 3).join(", "),
            });
          }
        }

        // Check Tailwind color classes against design system
        const tailwindColorPattern = /className=["'][^"']*\b(text|bg|border|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b[^"']*["']/g;
        const twMatches = content.match(tailwindColorPattern);
        if (twMatches) {
          const uniqueColorClasses = [...new Set(twMatches)];
          for (const cls of uniqueColorClasses) {
            // Extract the color name from the class
            const colorMatch = cls.match(/(text|bg|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/);
            if (colorMatch) {
              const colorName = colorMatch[2];
              if (!allowedColors.has(colorName) && ![...allowedColors].some((c) => c.includes(colorName) || colorName.includes(c))) {
                issues.push({
                  category: "design-token",
                  severity: "low",
                  description: `Tailwind color "${colorMatch[0]}" in ${path} may not be in the approved design palette`,
                  suggestion: `Verify this color is part of the design system: ${[...allowedColors].slice(0, 6).join(", ")}`,
                  affectedFiles: [path],
                });
              }
            }
          }
        }
      }

      // Check for font families not in the design system
      if (allowedFonts.size > 0) {
        const fontPattern = /font-(?:sans|serif|mono|['"][^'"]+['"])|fontFamily\s*:\s*['"][^'"]+['"]/g;
        const fontMatches = content.match(fontPattern);
        if (fontMatches) {
          const violators = fontMatches.filter((f) => {
            const fontName = f.replace(/font-(?:family\s*:\s*)?['"]?/, "").replace(/['"]/, "").toLowerCase();
            return ![...allowedFonts].some((af) => fontName.includes(af) || af.includes(fontName));
          });
          if (violators.length > 0) {
            issues.push({
              category: "design-token",
              severity: "medium",
              description: `Font family outside design system in ${path}: ${violators.slice(0, 2).join(", ")}`,
              suggestion: `Use one of the approved fonts: ${[...allowedFonts].slice(0, 4).join(", ")}`,
              affectedFiles: [path],
            });
          }
        }
      }
    }
  }

  // ── 6. Detect missing sections (before/after comparison) ────────────────
  if (beforeFingerprints.size > 0) {
    for (const [path, after] of afterFingerprints) {
      const before = beforeFingerprints.get(path);
      if (!before) continue;

      // Check for removed sections
      const beforeSections = new Set(before.sections.map((s) => s.toLowerCase().replace(/\s+/g, " ")));
      const afterSections = new Set(after.sections.map((s) => s.toLowerCase().replace(/\s+/g, " ")));
      const removedSections = [...beforeSections].filter((s) => !afterSections.has(s));
      if (removedSections.length > 0) {
        issues.push({
          category: "missing-section",
          severity: "high",
          description: `${removedSections.length} section(s) removed or restructured in ${path} — potential content loss`,
          suggestion: "Verify that removed content was intentionally replaced, not accidentally deleted",
          affectedFiles: [path],
          beforeValue: before.sections.length.toString(),
          afterValue: after.sections.length.toString(),
        });
      }
    }
  }

  // ── Deduplicate issues ──────────────────────────────────────────────────
  const uniqueIssues = issues.filter(
    (issue, i, arr) => arr.findIndex((x) => x.description === issue.description) === i,
  );

  // ── Compute visual score breakdown ──────────────────────────────────────
  const breakdown = computeVisualScoreBreakdown(uniqueIssues);
  const overallScore = computeOverallVisualScore(breakdown);

  // ── Determine status ────────────────────────────────────────────────────
  let status: VisualStatus = "healthy";
  if (uniqueIssues.some((i) => i.severity === "critical")) {
    status = "critical";
  } else if (uniqueIssues.some((i) => i.severity === "high")) {
    status = "failed";
  } else if (uniqueIssues.some((i) => i.severity === "medium")) {
    status = "warning";
  }

  // ── Build summary ───────────────────────────────────────────────────────
  const parts: string[] = [];
  const layoutIssues = uniqueIssues.filter((i) => i.category === "layout-break").length;
  const overlapIssues = uniqueIssues.filter((i) => i.category === "overlap").length;
  const missingSectionIssues = uniqueIssues.filter((i) => i.category === "missing-section").length;
  const spacingIssues = uniqueIssues.filter((i) => i.category === "spacing").length;
  const responsiveIssuesCount = uniqueIssues.filter((i) => i.category === "responsive").length;
  const typographyIssuesCount = uniqueIssues.filter((i) => i.category === "typography").length;
  const designTokenIssues = uniqueIssues.filter((i) => i.category === "design-token").length;

  if (layoutIssues > 0) parts.push(`${layoutIssues} layout break(s)`);
  if (overlapIssues > 0) parts.push(`${overlapIssues} overlap(s)`);
  if (missingSectionIssues > 0) parts.push(`${missingSectionIssues} section change(s)`);
  if (spacingIssues > 0) parts.push(`${spacingIssues} spacing issue(s)`);
  if (responsiveIssuesCount > 0) parts.push(`${responsiveIssuesCount} responsive issue(s)`);
  if (typographyIssuesCount > 0) parts.push(`${typographyIssuesCount} typography issue(s)`);
  if (designTokenIssues > 0) parts.push(`${designTokenIssues} design token violation(s)`);

  const summary = parts.length > 0
    ? `Visual issues detected: ${parts.join(", ")}`
    : "Visual verification passed — no regressions detected";

  // ── Build repair instruction if needed ───────────────────────────────────
  const needsRepair = status === "failed" || status === "critical" || uniqueIssues.filter((i) => i.severity === "high" || i.severity === "critical").length > 0;
  let repairInstruction: string | undefined;

  if (needsRepair) {
    const steps: string[] = [];
    const criticalHigh = uniqueIssues.filter((i) => i.severity === "critical" || i.severity === "high");
    for (const issue of criticalHigh) {
      let step = `Fix ${issue.category}: ${issue.description}`;
      if (issue.suggestion) step += ` (${issue.suggestion})`;
      steps.push(`• ${step}`);
    }
    if (uniqueIssues.filter((i) => i.severity === "medium").length > 0) {
      steps.push(`• Address medium-severity issues (${uniqueIssues.filter((i) => i.severity === "medium").length} remaining)`);
    }
    repairInstruction = `Fix visual regressions:\n${steps.join("\n")}`;
  }

  // ── Update telemetry ────────────────────────────────────────────────────
  telemetry.visualIssuesDetected += uniqueIssues.length;
  telemetry.layoutRegressionCount += layoutIssues + overlapIssues;
  telemetry.responsiveIssues += responsiveIssuesCount;
  telemetry.designTokenViolations += designTokenIssues;
  telemetry.visualScore = overallScore;

  const durationMs = Date.now() - start;
  logger.info(
    {
      status,
      score: overallScore,
      issues: uniqueIssues.length,
      layoutBreaks: layoutIssues,
      responsiveIssues: responsiveIssuesCount,
      designTokens: designTokenIssues,
      durationMs,
    },
    "[visual-verif] Visual analysis complete",
  );

  return {
    status,
    score: overallScore,
    breakdown,
    issues: uniqueIssues,
    comparison: {
      modifiedVisuals,
      removedFiles,
      addedFiles,
      sectionDelta,
    },
    summary,
    needsRepair,
    repairInstruction,
  };
}

// ─── Score Computation ──────────────────────────────────────────────────────

function computeVisualScoreBreakdown(issues: VisualIssue[]): VisualScoreBreakdown {
  const byCategory: Record<VisualIssueCategory, VisualIssue[]> = {
    "layout-break": [],
    "overlap": [],
    "missing-section": [],
    "spacing": [],
    "responsive": [],
    "typography": [],
    "design-token": [],
    "before-after-regression": [],
  };

  for (const issue of issues) {
    byCategory[issue.category]?.push(issue);
  }

  function categoryScore(catIssues: VisualIssue[]): number {
    if (catIssues.length === 0) return 100;
    const deductions = catIssues.map((i) => {
      switch (i.severity) {
        case "critical": return 40;
        case "high":     return 25;
        case "medium":   return 15;
        case "low":      return 5;
      }
    });
    const totalDeduction = Math.min(100, deductions.reduce((a, b) => a + b, 0));
    return Math.max(0, 100 - totalDeduction);
  }

  return {
    layoutScore: categoryScore([...byCategory["layout-break"], ...byCategory["overlap"]]),
    overlapScore: categoryScore(byCategory["overlap"]),
    spacingScore: categoryScore(byCategory["spacing"]),
    responsiveScore: categoryScore(byCategory["responsive"]),
    typographyScore: categoryScore(byCategory["typography"]),
    designTokenScore: categoryScore(byCategory["design-token"]),
    regressionScore: categoryScore([
      ...byCategory["missing-section"],
      ...byCategory["before-after-regression"],
    ]),
  };
}

function computeOverallVisualScore(breakdown: VisualScoreBreakdown): number {
  // Weighted composite: layout carries double weight since it's most visible
  const weights = {
    layoutScore: 0.25,
    overlapScore: 0.10,
    spacingScore: 0.10,
    responsiveScore: 0.20,
    typographyScore: 0.10,
    designTokenScore: 0.10,
    regressionScore: 0.15,
  };

  return Math.round(
    breakdown.layoutScore * weights.layoutScore +
    breakdown.overlapScore * weights.overlapScore +
    breakdown.spacingScore * weights.spacingScore +
    breakdown.responsiveScore * weights.responsiveScore +
    breakdown.typographyScore * weights.typographyScore +
    breakdown.designTokenScore * weights.designTokenScore +
    breakdown.regressionScore * weights.regressionScore
  );
}

// ─── Repair Prompt Builder ──────────────────────────────────────────────────

/**
 * Build a structured repair prompt for the editing agent based on visual issues.
 */
export function buildVisualRepairPrompt(report: VisualReport): string {
  const criticalHigh = report.issues.filter((i) => i.severity === "critical" || i.severity === "high");
  const medium = report.issues.filter((i) => i.severity === "medium");
  const low = report.issues.filter((i) => i.severity === "low");

  const parts: string[] = [
    `Visual verification score: ${report.score}/100 (${report.status})`,
    "",
  ];

  if (criticalHigh.length > 0) {
    parts.push(`CRITICAL/HIGH SEVERITY (${criticalHigh.length}):`);
    for (const issue of criticalHigh) {
      parts.push(`  • [${issue.category}] ${issue.description}`);
      if (issue.suggestion) parts.push(`    → ${issue.suggestion}`);
    }
    parts.push("");
  }

  if (medium.length > 0) {
    parts.push(`MEDIUM SEVERITY (${medium.length}):`);
    for (const issue of medium) {
      parts.push(`  • [${issue.category}] ${issue.description}`);
    }
    parts.push("");
  }

  if (low.length > 0) {
    parts.push(`LOW SEVERITY (${low.length}):`);
    for (const issue of low) {
      parts.push(`  • [${issue.category}] ${issue.description}`);
    }
    parts.push("");
  }

  // Before/after comparison summary
  const comp = report.comparison;
  if (comp.modifiedVisuals.length > 0 || comp.removedFiles.length > 0) {
    parts.push("STRUCTURAL CHANGES:");
    if (comp.removedFiles.length > 0) {
      parts.push(`  • ${comp.removedFiles.length} file(s) removed`);
    }
    if (comp.modifiedVisuals.length > 0) {
      for (const mv of comp.modifiedVisuals) {
        parts.push(`  • ${mv.path}: ${mv.reason}`);
      }
    }
    parts.push("");
  }

  parts.push("Fix all critical and high-severity issues before proceeding. Medium-severity issues should be fixed if they don't conflict with the user's intent.");

  return parts.join("\n");
}
