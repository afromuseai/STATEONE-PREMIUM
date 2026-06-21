// ─── Copilot Circuit Breaker ───────────────────────────────────────────────────
// Protects the COPILOT model endpoint from cascading failures during NVIDIA
// infrastructure outages. Three states:
//
//   CLOSED    — normal operation, all requests pass through
//   OPEN      — model is unavailable, requests fail fast for COOLDOWN_MS
//   HALF_OPEN — cooldown expired, one test probe is allowed through;
//               success → CLOSED, failure → OPEN (timer reset)
//
// Transitions to OPEN after FAILURE_THRESHOLD consecutive timeouts or degraded
// responses. Network errors are tracked but do not count toward the threshold
// (they may be transient connection issues unrelated to the model deployment).

import { logger } from "./logger";
import { MODELS } from "./models";

// ─── Configuration ─────────────────────────────────────────────────────────────
const FAILURE_THRESHOLD = 3;       // consecutive failures before opening
const COOLDOWN_MS       = 5 * 60 * 1000; // 5 minutes

// ─── State ─────────────────────────────────────────────────────────────────────
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

let state: CircuitState        = "CLOSED";
let openedAt: number | null    = null;
let testInFlight: boolean      = false;

// ─── Rolling health counters (module-level, persist across requests) ────────────
const health = {
  successes:           0,
  timeouts:            0,
  degraded:            0,
  network:             0,
  consecutiveFailures: 0,
  recoveryAttempts:    0,
};

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true when the circuit is open and the caller should fail fast.
 * Handles the OPEN → HALF_OPEN cooldown transition and the HALF_OPEN
 * single-probe gate automatically.
 */
export function shouldBlock(): boolean {
  const now = Date.now();
  const cooldownUntil = openedAt !== null ? openedAt + COOLDOWN_MS : null;
  const elapsed       = openedAt !== null ? now - openedAt : null;
  const remainingMs   = cooldownUntil !== null ? cooldownUntil - now : null;

  // ── CIRCUIT_STATE_CHECK — logged on every shouldBlock() call ─────────────────
  logger.info(
    {
      event:               "CIRCUIT_STATE_CHECK",
      model:               MODELS.COPILOT,
      state,
      openedAt:            openedAt ? new Date(openedAt).toISOString() : null,
      cooldownUntil:       cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
      elapsedMs:           elapsed,
      remainingMs,
      testInFlight,
      ...health,
    },
    "[CIRCUIT] CIRCUIT_STATE_CHECK"
  );

  if (state === "CLOSED") return false;

  if (state === "OPEN") {
    // ── CIRCUIT_RECOVERY_CHECK — logged every time we evaluate the cooldown ────
    const cooldownExpired = openedAt !== null && now - openedAt >= COOLDOWN_MS;
    logger.info(
      {
        event:           "CIRCUIT_RECOVERY_CHECK",
        model:           MODELS.COPILOT,
        currentTimestamp: new Date(now).toISOString(),
        cooldownUntil:   cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
        elapsedMs:       elapsed,
        remainingMs,
        cooldownExpired,
        willTransitionToHalfOpen: cooldownExpired,
        ...health,
      },
      "[CIRCUIT] CIRCUIT_RECOVERY_CHECK"
    );

    if (cooldownExpired) {
      // Cooldown expired — allow one test probe
      state        = "HALF_OPEN";
      testInFlight = false;
      health.recoveryAttempts++;
      logger.info(
        {
          event:            "COPILOT_CIRCUIT_HALF_OPEN",
          model:            MODELS.COPILOT,
          recoveryAttempts: health.recoveryAttempts,
          ...health,
        },
        "[CIRCUIT] COPILOT_CIRCUIT_HALF_OPEN — test probe allowed"
      );
    } else {
      // Still within cooldown window — fail fast
      logger.warn(
        {
          event:         "CIRCUIT_BLOCK_TRIGGERED",
          model:         MODELS.COPILOT,
          state,
          reason:        `cooldown not yet expired — ${remainingMs}ms remaining`,
          remainingMs,
          cooldownUntil: cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
          ...health,
        },
        "[CIRCUIT] CIRCUIT_BLOCK_TRIGGERED — failing fast (OPEN, in cooldown)"
      );
      return true;
    }
  }

  // HALF_OPEN: gate the single test probe
  if (state === "HALF_OPEN") {
    if (testInFlight) {
      // Probe already in flight — block concurrent requests
      logger.warn(
        {
          event:  "CIRCUIT_BLOCK_TRIGGERED",
          model:  MODELS.COPILOT,
          state,
          reason: "HALF_OPEN probe already in flight — blocking concurrent request",
          ...health,
        },
        "[CIRCUIT] CIRCUIT_BLOCK_TRIGGERED — probe in flight (HALF_OPEN)"
      );
      return true;
    }
    // Claim the probe slot
    testInFlight = true;
    logger.info(
      {
        event:            "CIRCUIT_PROBE_START",
        model:            MODELS.COPILOT,
        recoveryAttempts: health.recoveryAttempts,
        ...health,
      },
      "[CIRCUIT] CIRCUIT_PROBE_START — allowing single test probe through"
    );
    return false;
  }

  return false;
}

/** Call when streamNvidia opens successfully (stream body received). */
export function recordSuccess(): void {
  const wasHalfOpen = state === "HALF_OPEN";
  health.successes++;
  health.consecutiveFailures = 0;

  if (wasHalfOpen) {
    state        = "CLOSED";
    openedAt     = null;
    testInFlight = false;
    logger.info(
      {
        event:    "CIRCUIT_PROBE_SUCCESS",
        model:    MODELS.COPILOT,
        ...health,
      },
      "[CIRCUIT] CIRCUIT_PROBE_SUCCESS — probe succeeded, circuit CLOSED"
    );
    logger.info(
      {
        event:    "COPILOT_CIRCUIT_CLOSED",
        model:    MODELS.COPILOT,
        ...health,
      },
      "[CIRCUIT] COPILOT_CIRCUIT_CLOSED — model recovered"
    );
  }
}

/** Call when the request times out (TimeoutError / AbortError). */
export function recordTimeout(errorMsg: string): void {
  const wasHalfOpen = state === "HALF_OPEN";
  health.timeouts++;
  health.consecutiveFailures++;

  logger.error(
    {
      event:     "COPILOT_MODEL_DEGRADED",
      model:     MODELS.COPILOT,
      errorType: "timeout",
      errorMsg,
      timestamp: new Date().toISOString(),
      ...health,
    },
    "[CIRCUIT] COPILOT stream timeout"
  );

  if (wasHalfOpen) {
    logger.error(
      {
        event:  "CIRCUIT_PROBE_FAILED",
        model:  MODELS.COPILOT,
        reason: "timeout during HALF_OPEN probe",
        ...health,
      },
      "[CIRCUIT] CIRCUIT_PROBE_FAILED — probe timed out, reopening circuit"
    );
  }

  _maybeOpen("timeout");
}

/** Call when NVIDIA returns a DEGRADED deployment error. */
export function recordDegraded(errorMsg: string): void {
  const wasHalfOpen = state === "HALF_OPEN";
  health.degraded++;
  health.consecutiveFailures++;

  logger.error(
    {
      event:     "COPILOT_MODEL_DEGRADED",
      model:     MODELS.COPILOT,
      errorType: "degraded",
      errorMsg,
      timestamp: new Date().toISOString(),
      ...health,
    },
    "[CIRCUIT] COPILOT_MODEL_DEGRADED — NVIDIA infrastructure degradation"
  );

  if (wasHalfOpen) {
    logger.error(
      {
        event:  "CIRCUIT_PROBE_FAILED",
        model:  MODELS.COPILOT,
        reason: "DEGRADED error during HALF_OPEN probe",
        ...health,
      },
      "[CIRCUIT] CIRCUIT_PROBE_FAILED — probe returned DEGRADED, reopening circuit"
    );
  }

  _maybeOpen("degraded");
}

/** Call for generic network/fetch errors (tracked but do not trip the breaker). */
export function recordNetworkError(errorMsg: string): void {
  health.network++;

  logger.error(
    {
      event:     "COPILOT_HEALTH_STATUS",
      model:     MODELS.COPILOT,
      errorType: "network",
      errorMsg,
      ...health,
    },
    "[CIRCUIT] COPILOT stream network error"
  );
}

/** Return current health snapshot (for admin/observability). */
export function getCircuitHealth(): typeof health & { state: CircuitState } {
  return { ...health, state };
}

// ─── Internal helpers ───────────────────────────────────────────────────────────
function _maybeOpen(triggerType: string): void {
  const shouldOpen =
    state === "HALF_OPEN" ||
    (state === "CLOSED" && health.consecutiveFailures >= FAILURE_THRESHOLD);

  if (shouldOpen) {
    const previousState = state;
    state        = "OPEN";
    openedAt     = Date.now();
    testInFlight = false;

    logger.error(
      {
        event:               "COPILOT_CIRCUIT_OPEN",
        model:               MODELS.COPILOT,
        triggerType,
        previousState,
        consecutiveFailures: health.consecutiveFailures,
        timeouts:            health.timeouts,
        degraded:            health.degraded,
        cooldownUntil:       new Date(openedAt + COOLDOWN_MS).toISOString(),
        ...health,
      },
      "[CIRCUIT] COPILOT_CIRCUIT_OPEN — failing fast for 5 minutes"
    );
  } else {
    logger.info(
      {
        event:               "COPILOT_HEALTH_STATUS",
        model:               MODELS.COPILOT,
        consecutiveFailures: health.consecutiveFailures,
        threshold:           FAILURE_THRESHOLD,
        ...health,
      },
      "[CIRCUIT] COPILOT_HEALTH_STATUS"
    );
  }
}
