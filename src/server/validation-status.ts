/**
 * Validation Status Store
 *
 * Maintains current validation state for all canvases.
 * Used by the status API and PostToolUse hook.
 */

import type { NoticeLogEntry } from "./log"

export interface ValidationStatus {
  notices: Array<Omit<NoticeLogEntry, "ts">>
  errorCount: number
  warningCount: number
  infoCount: number
}

// Current validation status per canvas
const canvasStatus = new Map<string, ValidationStatus>()

// Canvases with pending validation (file changed, validation not yet complete)
const pendingValidation = new Set<string>()

// Waiters for pending validations
const validationWaiters = new Map<string, Array<() => void>>()

/**
 * Mark a canvas as having a pending validation (call when file change detected)
 */
export function markValidationPending(canvasId: string): void {
  pendingValidation.add(canvasId)
}

/**
 * Record validation result for a canvas (call when validation completes)
 */
export function recordValidation(
  canvasId: string,
  notices: Array<Omit<NoticeLogEntry, "ts">>
): void {
  const status: ValidationStatus = {
    notices,
    errorCount: notices.filter(n => n.severity === "error").length,
    warningCount: notices.filter(n => n.severity === "warning").length,
    infoCount: notices.filter(n => n.severity === "info").length,
  }

  canvasStatus.set(canvasId, status)
  pendingValidation.delete(canvasId)

  // Notify waiters
  const waiters = validationWaiters.get(canvasId)
  if (waiters) {
    for (const resolve of waiters) {
      resolve()
    }
    validationWaiters.delete(canvasId)
  }
}

/**
 * Get validation status for a canvas
 */
export function getValidationStatus(canvasId: string): ValidationStatus | null {
  return canvasStatus.get(canvasId) ?? null
}

/**
 * Check if a canvas has pending validation
 */
export function isValidationPending(canvasId: string): boolean {
  return pendingValidation.has(canvasId)
}

/**
 * Wait for pending validation to complete (with timeout)
 */
export async function waitForValidation(
  canvasId: string,
  timeoutMs: number = 2000
): Promise<void> {
  if (!pendingValidation.has(canvasId)) {
    return
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const waiters = validationWaiters.get(canvasId)
      if (waiters) {
        const idx = waiters.indexOf(resolve)
        if (idx >= 0) waiters.splice(idx, 1)
        if (waiters.length === 0) validationWaiters.delete(canvasId)
      }
      resolve()
    }, timeoutMs)

    const wrappedResolve = () => {
      clearTimeout(timeout)
      resolve()
    }

    const waiters = validationWaiters.get(canvasId) ?? []
    waiters.push(wrappedResolve)
    validationWaiters.set(canvasId, waiters)
  })
}

/**
 * Clear validation status for a canvas
 */
export function clearValidationStatus(canvasId: string): void {
  canvasStatus.delete(canvasId)
  pendingValidation.delete(canvasId)
}

/**
 * Get all canvas IDs with validation status
 */
export function getAllCanvasIds(): string[] {
  return Array.from(canvasStatus.keys())
}
