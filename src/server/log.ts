/**
 * Unified Canvas Log System
 *
 * All canvas activity is logged to a single _log.jsonl file per canvas.
 * Designed for easy grep filtering by agents.
 *
 * Log types (grep with "type":"<type>"):
 *   - event    : User interactions (clicks, form submissions)
 *   - notice   : Validation issues (errors, warnings, info)
 *   - render   : Render lifecycle (success, error)
 *   - screenshot: Screenshot captures
 *
 * Example grep patterns:
 *   grep '"type":"notice"' _log.jsonl | tail -10
 *   grep '"severity":"error"' _log.jsonl | head -5
 *   grep '"type":"event"' _log.jsonl | tail -20
 */

import { appendFile, writeFile } from "fs/promises"
import { join } from "path"

// Log entry types - designed for easy grep filtering
export type LogType = "event" | "notice" | "render" | "screenshot"
export type NoticeSeverity = "error" | "warning" | "info"
export type NoticeCategory =
  | "runtime"   // Runtime errors (component crashes)
  | "lint"      // axe-core visual issues
  | "eslint"    // ESLint code quality
  | "scope"     // Missing components/hooks
  | "tailwind"  // Invalid Tailwind classes
  | "overflow"  // Layout overflow
  | "image"     // Broken images
  | "bundle"    // Bundle size concerns

// Base log entry - all entries have these fields
interface BaseLogEntry {
  ts: string        // ISO timestamp
  type: LogType     // For grep: "type":"event"
}

// User interaction events
export interface EventLogEntry extends BaseLogEntry {
  type: "event"
  event: string     // Event name (e.g., "form-submit", "button-click")
  data?: unknown    // Event payload
}

// Validation notices
export interface NoticeLogEntry extends BaseLogEntry {
  type: "notice"
  severity: NoticeSeverity  // For grep: "severity":"error"
  category: NoticeCategory  // For grep: "category":"scope"
  message: string
  details?: Record<string, unknown>
}

// Render lifecycle
export interface RenderLogEntry extends BaseLogEntry {
  type: "render"
  status: "success" | "error"
  error?: string
  duration?: number
}

// Screenshot captures
export interface ScreenshotLogEntry extends BaseLogEntry {
  type: "screenshot"
  path: string
}

export type LogEntry = EventLogEntry | NoticeLogEntry | RenderLogEntry | ScreenshotLogEntry

const LOG_FILE = "_log.jsonl"

/**
 * Append a log entry to the canvas log file
 */
export async function appendLog(
  canvasDir: string,
  canvasId: string,
  entry: Omit<LogEntry, "ts">
): Promise<void> {
  const logPath = join(canvasDir, canvasId, LOG_FILE)
  const fullEntry = {
    ts: new Date().toISOString(),
    ...entry,
  }
  await appendFile(logPath, JSON.stringify(fullEntry) + "\n", "utf-8")
}

/**
 * Append multiple log entries at once
 */
export async function appendLogs(
  canvasDir: string,
  canvasId: string,
  entries: Array<Omit<LogEntry, "ts">>
): Promise<void> {
  if (entries.length === 0) return

  const logPath = join(canvasDir, canvasId, LOG_FILE)
  const ts = new Date().toISOString()
  const lines = entries.map(entry => JSON.stringify({ ts, ...entry })).join("\n") + "\n"
  await appendFile(logPath, lines, "utf-8")
}

/**
 * Clear the log file (used when canvas code changes)
 */
export async function clearLog(
  canvasDir: string,
  canvasId: string
): Promise<void> {
  const logPath = join(canvasDir, canvasId, LOG_FILE)
  try {
    await writeFile(logPath, "", "utf-8")
  } catch {
    // File may not exist, that's fine
  }
}

// Helper functions for creating log entries

export function eventEntry(event: string, data?: unknown): Omit<EventLogEntry, "ts"> {
  return { type: "event", event, data }
}

export function noticeEntry(
  severity: NoticeSeverity,
  category: NoticeCategory,
  message: string,
  details?: Record<string, unknown>
): Omit<NoticeLogEntry, "ts"> {
  return { type: "notice", severity, category, message, details }
}

export function renderEntry(
  status: "success" | "error",
  error?: string,
  duration?: number
): Omit<RenderLogEntry, "ts"> {
  return { type: "render", status, error, duration }
}

export function screenshotEntry(path: string): Omit<ScreenshotLogEntry, "ts"> {
  return { type: "screenshot", path }
}

/**
 * Summarize notices for console logging
 */
export function summarizeNotices(entries: Array<Omit<NoticeLogEntry, "ts">>): string {
  if (entries.length === 0) return "no issues"

  const counts = { error: 0, warning: 0, info: 0 }
  for (const e of entries) {
    counts[e.severity]++
  }

  const parts: string[] = []
  if (counts.error > 0) parts.push(`${counts.error} error(s)`)
  if (counts.warning > 0) parts.push(`${counts.warning} warning(s)`)
  if (counts.info > 0) parts.push(`${counts.info} info`)

  return parts.join(", ") || "no issues"
}
