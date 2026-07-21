// ─── Task Planner — Decompose Execution Plans into Executable Tasks ─────────
// Phase 13.5
//
// Takes an ExecutionPlan and splits it into independent ExecutionTasks.
// Small edits become a single task. Large edits are decomposed by logical
// concern (component boundaries, page boundaries, architectural layers).
// Each task receives isolated context and can execute independently.

import type { WorkspaceContext, RouteNode } from "./workspace-context";
import type { ExecutionPlan, Strategy, Complexity } from "./execution-planner";

// ─── Task Schema ──────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionTask {
  id: string;
  title: string;
  objective: string;
  filesToModify: string[];
  filesToRead: string[];
  dependsOn: string[];
  priority: number;
  validationSteps: string[];
  status: TaskStatus;
  /** Which strategy this task inherits from the parent plan. */
  strategy: Strategy;
  /** Which complexity this task inherits. */
  complexity: Complexity;
}

// ─── Task Planner Result ──────────────────────────────────────────────────────

export interface TaskPlanResult {
  tasks: ExecutionTask[];
  /** Number of tasks that can run in parallel (no dependencies). */
  parallelCount: number;
  /** Number of sequential dependency chains. */
  sequentialChains: number;
  planningTimeMs: number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _taskIdCounter = 0;
function generateTaskId(): string {
  _taskIdCounter++;
  return `task_${Date.now()}_${_taskIdCounter}`;
}

// ─── Decomposition ────────────────────────────────────────────────────────────

/**
 * Decompose an execution plan into a set of executable tasks.
 *
 * Decomposition strategy:
 * - Single-file or refactor plans → single task (atomic)
 * - Small multi-file plans (≤3 files) → single task
 * - Large multi-file plans → group by directory prefix / logical concern
 * - Architecture plans → multiple tasks with dependency chains
 */
export function planTasks(
  executionPlan: ExecutionPlan,
  workspaceContext?: WorkspaceContext,
): TaskPlanResult {
  const start = Date.now();

  // Determine if this is a large edit that needs decomposition
  const needsDecomposition = shouldDecompose(executionPlan);

  let tasks: ExecutionTask[];

  if (!needsDecomposition) {
    // Single task — the entire edit as one unit
    tasks = [
      createTask(executionPlan, workspaceContext, {
        title: inferTaskTitle(executionPlan),
        filesToModify: executionPlan.filesToModify,
        filesToRead: executionPlan.filesToRead,
        dependsOn: [],
        priority: 1,
      }),
    ];
  } else {
    // Decompose into multiple tasks
    tasks = decomposePlan(executionPlan, workspaceContext);
  }

  // Compute parallel/sequential metrics
  const tasksWithDeps = tasks.filter((t) => t.dependsOn.length > 0);
  const independentTasks = tasks.filter((t) => t.dependsOn.length === 0);

  // Count sequential chains — find the longest dependency chain
  const sequentialChains = countChains(tasks);

  const result: TaskPlanResult = {
    tasks,
    parallelCount: independentTasks.length,
    sequentialChains,
    planningTimeMs: Date.now() - start,
  };

  return result;
}

// ─── Decomposition decision ───────────────────────────────────────────────────

function shouldDecompose(plan: ExecutionPlan): boolean {
  // Architecture always decomposes
  if (plan.strategy === "architecture") return true;

  // Refactor is atomic — decomposing rename would break
  if (plan.strategy === "refactor") return false;

  // Large file count triggers decomposition
  if (plan.filesToModify.length > 3) return true;

  // High complexity triggers decomposition
  if (plan.complexity === "high") return true;

  // Multi-file with mixed directory concerns
  if (plan.strategy === "multi-file" && plan.filesToModify.length > 1) {
    const dirs = new Set(plan.filesToModify.map((f) => extractDir(f)));
    if (dirs.size > 2) return true;
  }

  return false;
}

// ─── Create a single task ─────────────────────────────────────────────────────

interface TaskConfig {
  title: string;
  filesToModify: string[];
  filesToRead: string[];
  dependsOn: string[];
  priority: number;
}

function createTask(
  plan: ExecutionPlan,
  workspaceContext: WorkspaceContext | undefined,
  config: TaskConfig,
): ExecutionTask {
  // Derive validation steps from the plan's steps, filtered for this task's files
  const relevantValidation = plan.validationSteps.filter((step) => {
    // Include general steps (preview, tsc, eslint, build)
    if (/^(run|verify|check)/i.test(step)) return true;
    // Include file-specific steps that match this task's files
    return config.filesToModify.some((f) => step.toLowerCase().includes(f.toLowerCase()));
  });

  return {
    id: generateTaskId(),
    title: config.title,
    objective: buildTaskObjective(config.title, config.filesToModify, plan.objective),
    filesToModify: config.filesToModify,
    filesToRead: [...new Set([...config.filesToRead, ...config.filesToModify])],
    dependsOn: config.dependsOn,
    priority: config.priority,
    validationSteps: relevantValidation.length > 0 ? relevantValidation : plan.validationSteps,
    status: "pending",
    strategy: plan.strategy,
    complexity: plan.complexity,
  };
}

function buildTaskObjective(title: string, files: string[], parentObjective: string): string {
  if (files.length === 0) return title;
  const fileHint = files.length <= 3
    ? files.join(", ")
    : `${files.length} files`;
  return `${title}: modify ${fileHint}`;
}

// ─── Decompose a large plan into multiple tasks ──────────────────────────────

function decomposePlan(
  plan: ExecutionPlan,
  workspaceContext?: WorkspaceContext,
): ExecutionTask[] {
  const tasks: ExecutionTask[] = [];

  // Group files by their top-level directory
  const dirGroups = groupByDir(plan.filesToModify);

  // Create a "Setup / Context" task if there are many files to read
  if (plan.filesToRead.length > 0 && plan.filesToRead.length > plan.filesToModify.length) {
    tasks.push(createTask(plan, workspaceContext, {
      title: "Read Context",
      filesToModify: [],
      filesToRead: plan.filesToRead,
      dependsOn: [],
      priority: 0,
    }));
  }

  // Create tasks for each directory group
  let taskOrder = 0;
  const taskEntries = Object.entries(dirGroups);

  for (let i = 0; i < taskEntries.length; i++) {
    const [dir, files] = taskEntries[i];
    const title = inferGroupTitle(dir, files);

    // Determine dependencies: each group depends on the previous group
    // if they share common imports or if previous group creates shared infrastructure
    const dependsOn: string[] = [];
    if (i > 0 && tasks.length > 0) {
      // Only add dependency if tasks might share infrastructure (e.g., layout before pages)
      const prevTask = tasks[tasks.length - 1];
      if (prevTask.title !== "Read Context") {
        dependsOn.push(prevTask.id);
      }
    }

    tasks.push(createTask(plan, workspaceContext, {
      title,
      filesToModify: files,
      filesToRead: plan.filesToRead,
      dependsOn,
      priority: taskOrder++,
    }));
  }

  // If no groups were created (all files in root), create a single task
  if (tasks.length === 0) {
    tasks.push(createTask(plan, workspaceContext, {
      title: inferTaskTitle(plan),
      filesToModify: plan.filesToModify,
      filesToRead: plan.filesToRead,
      dependsOn: [],
      priority: 1,
    }));
  }

  return tasks;
}

// ─── Group files by directory ─────────────────────────────────────────────────

function groupByDir(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const file of files) {
    const dir = extractDir(file);
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(file);
  }

  return groups;
}

function extractDir(filePath: string): string {
  const parts = filePath.split("/");
  // Use the first meaningful directory
  for (const p of parts) {
    if (p && p !== "." && p !== ".." && !p.includes(".")) {
      // Map common directories to logical group names
      if (p === "components") return parts.slice(0, parts.indexOf(p) + 2).join("/");
      if (p === "app" || p === "pages") return parts.slice(0, parts.indexOf(p) + 2).join("/");
      if (p === "lib" || p === "utils" || p === "hooks") return p;
      return p;
    }
  }
  return "root";
}

// ─── Title inference ──────────────────────────────────────────────────────────

/** Build a human-readable title for a task from its files. */
function inferGroupTitle(dir: string, files: string[]): string {
  // Extract component/section names from file names
  const names = files.map((f) => {
    const base = f.split("/").pop()?.replace(/\.(tsx|ts|js|jsx)$/, "") ?? "";
    return base
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  if (names.length <= 2) return names.join(" + ");
  return `${dir} (${names.length} files)`;
}

/** Build a task title from the plan objective when no decomposition occurred. */
function inferTaskTitle(plan: ExecutionPlan): string {
  // Extract the core action from the objective
  const short = plan.objective.length > 50
    ? plan.objective.slice(0, 47) + "..."
    : plan.objective;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

// ─── Chain counting ───────────────────────────────────────────────────────────

function countChains(tasks: ExecutionTask[]): number {
  if (tasks.length === 0) return 0;

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let chains = 0;
  const visited = new Set<string>();

  for (const task of tasks) {
    if (visited.has(task.id)) continue;

    // Walk the dependency chain
    let current: ExecutionTask | undefined = task;
    let chainLength = 0;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chainLength++;
      if (current.dependsOn.length > 0) {
        // Find the last dependency
        const lastDep = current.dependsOn[current.dependsOn.length - 1];
        current = taskMap.get(lastDep);
      } else {
        current = undefined;
      }
    }

    if (chainLength > 1) chains++;
  }

  return chains || 1;
}

// ─── Format tasks for activity stream logging ─────────────────────────────────

export function formatTaskList(tasks: ExecutionTask[]): string {
  const lines: string[] = ["Tasks:"];

  const byPriority = [...tasks].sort((a, b) => a.priority - b.priority);

  for (const task of byPriority) {
    const depInfo = task.dependsOn.length > 0 ? ` [after: ${task.dependsOn.length} task(s)]` : "";
    const fileCount = task.filesToModify.length;
    const fileInfo = fileCount > 0 ? ` (${fileCount} file(s))` : "";
    lines.push(`  ${task.id}: ${task.title}${fileInfo}${depInfo}`);
  }

  return lines.join("\n");
}
