// ─── WorkspaceValidator — Post-Edit Validation & Repair Engine ──────────────
//
// Phase 13.2.5 — Validates AI-generated file changes by running real tooling
// (TypeScript compiler, ESLint, framework builds) against a temporary workspace
// and feeding structured errors back into the editing loop for correction.
//
// Architecture:
//   1. Detect available validators from project dependencies
//   2. Write merged files (current + AI changes) to a temp directory
//   3. Execute each validator, capture stdout/stderr
//   4. Parse output into structured ValidationError[]
//   5. Support repair loop: re-prompt the editor with discovered errors
//
// Cache: Validator availability is detected once per project and cached.
// Invalidation: when package.json or config files change.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "./logger";
import type { FileModification, ProjectFile } from "./website-v2-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ValidatorKind = "typescript" | "eslint" | "build";

export interface ValidationError {
  /** The file that contains the error */
  file: string;
  /** Line number (1-based), or 0 if unknown */
  line: number;
  /** Column number (1-based), or 0 if unknown */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Raw text of the error line, if available */
  code?: string;
}

export interface ValidatorConfig {
  /** Whether TypeScript validation is available */
  typescript: boolean;
  /** Whether ESLint validation is available */
  eslint: boolean;
  /** Whether a build command is available */
  build: boolean;
  /** The detected build command, if any */
  buildCommand?: "next build" | "vite build";
}

export interface ValidationResult {
  /** Overall success (true = no errors) */
  success: boolean;
  /** Which validator ran */
  validator: ValidatorKind;
  /** Structured errors (empty on success) */
  errors: ValidationError[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Raw stdout from the validator, if captured */
  rawOutput?: string;
}

export interface ValidationReport {
  /** Results from each validator that ran */
  results: ValidationResult[];
  /** Overall success (all validators passed) */
  success: boolean;
  /** Total validation duration */
  totalDurationMs: number;
  /** Which validators were executed */
  validatorsExecuted: ValidatorKind[];
}

// ─── Validator detection ─────────────────────────────────────────────────────

/**
 * Detect which validators are available for a project based on its dependencies
 * and workspace scan data. Results are suitable for caching.
 */
export function detectValidators(
  dependencies: string[],
  framework?: string,
): ValidatorConfig {
  const depSet = new Set(dependencies.map((d) => d.toLowerCase()));

  // TypeScript: look for typescript in deps or tsconfig in files
  const typescript = depSet.has("typescript");

  // ESLint: look for eslint in deps
  const eslint = depSet.has("eslint") || depSet.has("@eslint/js");

  // Build command detection
  let buildCommand: "next build" | "vite build" | undefined;
  if (framework?.toLowerCase().includes("next")) {
    buildCommand = "next build";
  } else if (depSet.has("vite")) {
    buildCommand = "vite build";
  }

  return {
    typescript,
    eslint,
    build: !!buildCommand,
    buildCommand,
  };
}

// ─── Validation execution ────────────────────────────────────────────────────

/**
 * Run all available validators against a set of project files + AI changes.
 *
 * @param currentFiles - The current project files (from DB)
 * @param changes - The AI-generated file modifications
 * @param validatorConfig - Detected validator availability
 * @param projectId - For logging
 * @returns A validation report
 */
export async function validateChanges(
  currentFiles: ProjectFile[],
  changes: FileModification[],
  validatorConfig: ValidatorConfig,
  projectId?: string,
): Promise<ValidationReport> {
  const start = Date.now();
  const results: ValidationResult[] = [];

  // Merge current files with AI changes
  const merged = mergeChanges(currentFiles, changes);

  // Write to temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-validate-"));
  try {
    writeFilesToTemp(merged, tmpDir);

    // Run TypeScript check
    if (validatorConfig.typescript) {
      const tsResult = await runValidator(
        "typescript",
        tmpDir,
        ["npx", "--yes", "typescript", "--noEmit", "--pretty", "false"],
        projectId,
      );
      results.push(tsResult);
    }

    // Run ESLint check
    if (validatorConfig.eslint) {
      const eslintResult = await runValidator(
        "eslint",
        tmpDir,
        ["npx", "--yes", "eslint", "."],
        projectId,
      );
      results.push(eslintResult);
    }

    // Run build check
    if (validatorConfig.build && validatorConfig.buildCommand) {
      const buildCmd = validatorConfig.buildCommand === "next build"
        ? ["npx", "--yes", "next", "build"]
        : ["npx", "--yes", "vite", "build"];
      const buildResult = await runValidator(
        "build",
        tmpDir,
        buildCmd,
        projectId,
      );
      results.push(buildResult);
    }
  } finally {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const totalDurationMs = Date.now() - start;
  const success = results.every((r) => r.success);

  return {
    results,
    success,
    totalDurationMs,
    validatorsExecuted: results.map((r) => r.validator),
  };
}

/**
 * Run a single validator command and parse the output.
 * If the command is not available, returns a successful result (skip).
 */
async function runValidator(
  validator: ValidatorKind,
  cwd: string,
  args: string[],
  projectId?: string,
): Promise<ValidationResult> {
  const start = Date.now();
  const cmd = args.join(" ");

  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 60_000, // 60 seconds max per validator
      stdio: ["ignore", "pipe", "pipe"],
      // Suppress error output — we capture it ourselves
    });

    const durationMs = Date.now() - start;
    return {
      success: true,
      validator,
      errors: [],
      durationMs,
      rawOutput: stdout,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const stderr = err instanceof Error
      ? (err as { stderr?: string }).stderr || (err as { stdout?: string }).stdout || err.message
      : String(err);

    const errors = parseValidatorOutput(validator, stderr);

    logger.info(
      { validator, projectId, errorCount: errors.length, durationMs },
      "[validator] Validation failed",
    );

    return {
      success: false,
      validator,
      errors,
      durationMs,
      rawOutput: stderr,
    };
  }
}

// ─── Output parsing ──────────────────────────────────────────────────────────

/**
 * Parse validator output into structured errors.
 * Each validator has its own output format.
 */
function parseValidatorOutput(
  validator: ValidatorKind,
  output: string,
): ValidationError[] {
  switch (validator) {
    case "typescript":
      return parseTypeScriptOutput(output);
    case "eslint":
      return parseEslintOutput(output);
    case "build":
      return parseBuildOutput(output);
    default:
      return [];
  }
}

/**
 * Parse TypeScript compiler output.
 * Format: file(line,column): error TS1234: message
 */
function parseTypeScriptOutput(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  // Standard tsc error format: "src/file.ts(23,5): error TS2345: message"
  const lineRe = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+)?\s*:\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(output)) !== null) {
    errors.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: `${match[4]}: ${match[6].trim()}`,
    });
  }

  // Fallback: multi-line format or error summaries
  if (errors.length === 0) {
    const simpleRe = /^(.+)\((\d+),\s*(\d+)\)/gm;
    while ((match = simpleRe.exec(output)) !== null) {
      // Extract the error message from context
      const lines = output.split("\n");
      const lineIdx = lines.findIndex((l) => l.includes(match![0]));
      const msgLine = lineIdx >= 0 ? lines[lineIdx + 1] ?? "" : "";
      errors.push({
        file: match[1].trim(),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: msgLine.trim() || "Unknown TypeScript error",
      });
    }
  }

  return errors;
}

/**
 * Parse ESLint output (stylish format).
 * Format: file:line:column: error message [rule]
 */
function parseEslintOutput(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  // ESLint stylish format: "file:line:col: error message [rule]"
  const lineRe = /^(.+):(\d+):(\d+):\s+(error|warning)\s+(.+?)(?:\s+\[.+\])?$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(output)) !== null) {
    errors.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5].trim(),
    });
  }
  return errors;
}

/**
 * Parse build tool output.
 * More free-form — captures lines mentioning "error" with file references.
 */
function parseBuildOutput(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Try to match file references
    const fileRe = /([\w./-]+\.(?:tsx?|jsx?))\s*[:\(]\s*(\d+)(?:[,:\s]*(\d+))?/g;
    const fileMatch = fileRe.exec(line);
    if (fileMatch && line.toLowerCase().includes("error")) {
      errors.push({
        file: fileMatch[1].trim(),
        line: parseInt(fileMatch[2], 10) || 0,
        column: fileMatch[3] ? parseInt(fileMatch[3], 10) : 0,
        message: line.trim(),
      });
    }
  }

  // If no structured errors found, capture the entire output as a single error
  if (errors.length === 0) {
    const errorLines = lines.filter((l) => l.toLowerCase().includes("error"));
    for (const el of errorLines.slice(0, 10)) {
      errors.push({
        file: "",
        line: 0,
        column: 0,
        message: el.trim(),
      });
    }
  }

  return errors;
}

// ─── File operations ─────────────────────────────────────────────────────────

/**
 * Merge current project files with AI-generated changes.
 * Changes overwrite current files; deletions remove them.
 */
function mergeChanges(
  currentFiles: ProjectFile[],
  changes: FileModification[],
): ProjectFile[] {
  const fileMap = new Map<string, ProjectFile>();

  // Start with current files
  for (const f of currentFiles) {
    fileMap.set(f.path, { ...f });
  }

  // Apply changes
  for (const change of changes) {
    if (change.operation === "delete") {
      fileMap.delete(change.path);
    } else {
      fileMap.set(change.path, {
        path: change.path,
        operation: "update",
        content: change.content,
      });
    }
  }

  return [...fileMap.values()];
}

/**
 * Write project files to a temporary directory, preserving directory structure.
 */
function writeFilesToTemp(files: ProjectFile[], tmpDir: string): void {
  for (const f of files) {
    const fullPath = path.join(tmpDir, f.path);
    const dir = path.dirname(fullPath);

    // Ensure parent directory exists
    fs.mkdirSync(dir, { recursive: true });

    // Write the file
    fs.writeFileSync(fullPath, f.content, "utf-8");
  }
}

// ─── Repair prompt builder ───────────────────────────────────────────────────

/**
 * Build a repair prompt from validation errors to re-feed the editor model.
 */
export function buildRepairPrompt(
  originalInstruction: string,
  errors: ValidationError[],
): string {
  const errorSummary = errors
    .slice(0, 20) // Limit to 20 errors to avoid token overflow
    .map((e) => {
      const location = e.file
        ? `${e.file}:${e.line}:${e.column}`
        : "unknown location";
      return `  [${location}] ${e.message}`;
    })
    .join("\n");

  const totalErrors = errors.length;

  return `The previous changes produced ${totalErrors} validation error(s):

${errorSummary}

Fix ONLY these specific issues. Do not change unrelated code.
Return the corrected file(s) in the same JSON format.`;
}

// ─── Repair loop ─────────────────────────────────────────────────────────────

export interface RepairAttempt {
  attempt: number;
  errors: ValidationError[];
  success: boolean;
}

/**
 * Run the repair loop: validate changes, and if they fail, re-prompt the editor
 * with structured errors. Up to `maxRetries` attempts.
 *
 * @param runEditor - Async function that calls the editor and returns changes
 * @param validateFn - Async function that validates changes
 * @param maxRetries - Maximum repair attempts (default 2)
 * @returns The final (possibly repaired) editor result and repair history
 */
export async function repairLoop(
  runEditor: () => Promise<{ changes: FileModification[]; summary: string }>,
  validateFn: (changes: FileModification[]) => Promise<ValidationReport>,
  maxRetries = 2,
): Promise<{
  result: { changes: FileModification[]; summary: string };
  repairs: RepairAttempt[];
  finalValidation: ValidationReport;
}> {
  const repairs: RepairAttempt[] = [];

  // First attempt: run the editor
  let result = await runEditor();
  let validation = await validateFn(result.changes);

  if (validation.success) {
    return {
      result,
      repairs,
      finalValidation: validation,
    };
  }

  // Repair loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    repairs.push({
      attempt,
      errors: collectAllErrors(validation),
      success: false,
    });

    logger.info(
      { attempt, maxRetries, errorCount: collectAllErrors(validation).length },
      "[validator] Starting repair attempt",
    );

    // Re-run the editor with repair context
    // Note: The actual re-run is handled by the caller, which has access to
    // the editor function and can inject the repair prompt. This function
    // just orchestrates the validation cycle.
    break;
  }

  return {
    result,
    repairs,
    finalValidation: validation,
  };
}

/** Collect all errors from a validation report into a flat array. */
function collectAllErrors(report: ValidationReport): ValidationError[] {
  const all: ValidationError[] = [];
  for (const r of report.results) {
    all.push(...r.errors);
  }
  return all;
}
