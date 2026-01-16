/**
 * Canvas Linter - Visual quality checks
 *
 * Runs after successful render to catch visual issues like:
 * - Poor contrast (axe-core)
 * - Layout overflow
 * - Broken images
 *
 * Focuses on "does it look right" rather than full WCAG compliance.
 */

import axe, { type AxeResults, type Result } from "axe-core"

export type NoticeSeverity = "error" | "warning" | "info"
export type NoticeCategory = "lint" | "overflow" | "image" | "runtime"

// Notice format matching server-side log entries
export interface Notice {
  severity: NoticeSeverity
  category: NoticeCategory
  message: string
  details?: Record<string, unknown>
}

// Legacy alias for compatibility
export interface LintWarning {
  type: string
  severity: "error" | "warning" | "info"
  message: string
  element?: string
  details?: Record<string, unknown>
}

function createNotice(
  severity: NoticeSeverity,
  category: NoticeCategory,
  message: string,
  details?: Record<string, unknown>
): Notice {
  return {
    severity,
    category,
    message,
    details,
  }
}

// Visual-only rules - things that affect how the UI looks
// Skip ARIA, keyboard nav, screen reader stuff
// Note: Only checking WCAG AA (4.5:1 contrast), not AAA (7:1)
const VISUAL_RULES = [
  "color-contrast",           // Text contrast ratio (WCAG AA - 4.5:1)
  "link-in-text-block",       // Links distinguishable from text
  "image-alt",                // Images missing alt (shows broken icon)
  "meta-viewport",            // Viewport prevents zooming
]

/**
 * Map axe-core impact to our severity levels
 */
function mapSeverity(impact: string | undefined | null): "error" | "warning" | "info" {
  switch (impact) {
    case "critical":
    case "serious":
      return "error"
    case "moderate":
      return "warning"
    case "minor":
    default:
      return "info"
  }
}

/**
 * Format an axe-core node target as a readable element description
 */
function formatElement(node: { target: (string | string[])[]; html: string }): string {
  // target can be complex with shadow DOM, flatten it
  const selector = node.target
    .map(t => Array.isArray(t) ? t.join(" > ") : t)
    .join(" ")

  // Extract a short preview of the HTML
  const htmlPreview = node.html
    .replace(/\s+/g, " ")
    .slice(0, 100)

  return `${selector}: ${htmlPreview}${node.html.length > 100 ? "..." : ""}`
}

/**
 * Convert axe-core violations to our LintWarning format
 */
function convertViolations(violations: Result[]): LintWarning[] {
  const warnings: LintWarning[] = []

  for (const violation of violations) {
    for (const node of violation.nodes) {
      warnings.push({
        type: violation.id,
        severity: mapSeverity(violation.impact),
        message: violation.help,
        element: formatElement(node),
        details: {
          ruleId: violation.id,
          impact: violation.impact,
          description: violation.description,
          helpUrl: violation.helpUrl,
          failureSummary: node.failureSummary,
        }
      })
    }
  }

  return warnings
}

/**
 * Run visual lint checks on the given element using axe-core
 */
export async function lintCanvas(rootElement?: Element): Promise<LintWarning[]> {
  const element = rootElement || document.body

  try {
    const results: AxeResults = await axe.run(element, {
      runOnly: {
        type: "rule",
        values: VISUAL_RULES
      },
      // Don't check elements outside our canvas
      elementRef: true,
      // Performance: only check what's visible
      resultTypes: ["violations"],
    })

    return convertViolations(results.violations)
  } catch (error) {
    console.error("Linter error:", error)
    return [{
      type: "linter-error",
      severity: "warning",
      message: `Linter failed: ${error instanceof Error ? error.message : String(error)}`,
    }]
  }
}

/**
 * Check for layout overflow issues
 */
function checkOverflow(element: Element): Notice[] {
  const notices: Notice[] = []

  const checkElement = (el: Element) => {
    if (!(el instanceof HTMLElement)) return

    const hasHorizontalOverflow = el.scrollWidth > el.clientWidth + 1
    const hasVerticalOverflow = el.scrollHeight > el.clientHeight + 1

    // Skip if element allows scrolling
    const style = getComputedStyle(el)
    const allowsScroll = ["auto", "scroll"].includes(style.overflowX) ||
                         ["auto", "scroll"].includes(style.overflowY)

    if ((hasHorizontalOverflow || hasVerticalOverflow) && !allowsScroll) {
      // Check if overflow is actually clipped
      const isClipped = style.overflow === "hidden" ||
                        style.overflowX === "hidden" ||
                        style.overflowY === "hidden"

      if (isClipped) {
        const selector = getElementSelector(el)
        notices.push(
          createNotice(
            "warning",
            "overflow",
            `Content clipped: ${hasHorizontalOverflow ? "horizontal" : "vertical"} overflow`,
            {
              element: selector,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            }
          )
        )
      }
    }
  }

  // Check root and all descendants
  checkElement(element)
  element.querySelectorAll("*").forEach(checkElement)

  return notices
}

/**
 * Check for text alignment issues in form fields
 * Detects when inputs/selects may have clipped or poorly positioned text
 */
function checkFormFieldAlignment(element: Element): Notice[] {
  const notices: Notice[] = []
  const formFields = element.querySelectorAll("input, select, textarea")

  formFields.forEach((field) => {
    if (!(field instanceof HTMLElement)) return

    const style = getComputedStyle(field)
    const height = field.clientHeight
    const paddingTop = parseFloat(style.paddingTop) || 0
    const paddingBottom = parseFloat(style.paddingBottom) || 0
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    const fontSize = parseFloat(style.fontSize) || 16

    // Available height for text
    const availableHeight = height - paddingTop - paddingBottom

    // Check if there's enough room for the text
    if (availableHeight < fontSize) {
      notices.push(
        createNotice(
          "error",
          "overflow",
          `Form field too small: ${Math.round(availableHeight)}px available for ${Math.round(fontSize)}px text`,
          {
            element: getElementSelector(field),
            height,
            paddingTop,
            paddingBottom,
            fontSize,
            availableHeight,
          }
        )
      )
    } else if (availableHeight < lineHeight) {
      notices.push(
        createNotice(
          "warning",
          "overflow",
          `Form field may clip text: ${Math.round(availableHeight)}px available for ${Math.round(lineHeight)}px line-height`,
          {
            element: getElementSelector(field),
            height,
            paddingTop,
            paddingBottom,
            lineHeight,
            availableHeight,
          }
        )
      )
    }

    // Check for excessive padding that might push text off-center
    const paddingRatio = paddingTop / (paddingTop + paddingBottom || 1)
    if (paddingTop > 0 && paddingBottom > 0 && (paddingRatio < 0.3 || paddingRatio > 0.7)) {
      notices.push(
        createNotice(
          "info",
          "overflow",
          `Uneven form field padding: ${Math.round(paddingTop)}px top vs ${Math.round(paddingBottom)}px bottom`,
          {
            element: getElementSelector(field),
            paddingTop,
            paddingBottom,
            paddingRatio: Math.round(paddingRatio * 100) / 100,
          }
        )
      )
    }
  })

  return notices
}

/**
 * Check for broken images
 */
function checkImages(element: Element): Notice[] {
  const notices: Notice[] = []
  const images = element.querySelectorAll("img")

  images.forEach((img) => {
    // Check if image failed to load
    if (!img.complete || img.naturalWidth === 0) {
      notices.push(
        createNotice(
          "error",
          "image",
          `Broken image: ${img.src || "(no src)"}`,
          {
            element: getElementSelector(img),
            src: img.src,
            alt: img.alt,
          }
        )
      )
    }
  })

  return notices
}

/**
 * Get a readable CSS selector for an element
 */
function getElementSelector(el: Element): string {
  if (el.id) return `#${el.id}`

  let selector = el.tagName.toLowerCase()
  if (el.className && typeof el.className === "string") {
    const classes = el.className.split(/\s+/).filter(Boolean).slice(0, 3)
    if (classes.length) {
      selector += "." + classes.join(".")
    }
  }

  return selector
}

/**
 * Run all browser-side checks and return notices
 */
export async function runBrowserChecks(rootElement?: Element): Promise<Notice[]> {
  const element = rootElement || document.body
  const notices: Notice[] = []

  // Axe-core visual checks
  const lintWarnings = await lintCanvas(element)
  for (const w of lintWarnings) {
    notices.push(
      createNotice(
        w.severity,
        "lint",
        w.message,
        w.details
      )
    )
  }

  // Overflow detection
  notices.push(...checkOverflow(element))

  // Form field text alignment
  notices.push(...checkFormFieldAlignment(element))

  // Image validation
  notices.push(...checkImages(element))

  return notices
}

/**
 * Summarize warnings for logging
 */
export function summarizeWarnings(warnings: LintWarning[]): string {
  if (warnings.length === 0) return "No issues"

  const bySeverity = {
    error: warnings.filter(w => w.severity === "error").length,
    warning: warnings.filter(w => w.severity === "warning").length,
    info: warnings.filter(w => w.severity === "info").length
  }

  const parts: string[] = []
  if (bySeverity.error) parts.push(`${bySeverity.error} error(s)`)
  if (bySeverity.warning) parts.push(`${bySeverity.warning} warning(s)`)
  if (bySeverity.info) parts.push(`${bySeverity.info} info`)

  return parts.join(", ")
}

/**
 * Summarize notices for logging
 */
export function summarizeNotices(notices: Notice[]): string {
  if (notices.length === 0) return "No issues"

  const bySeverity = {
    error: notices.filter(n => n.severity === "error").length,
    warning: notices.filter(n => n.severity === "warning").length,
    info: notices.filter(n => n.severity === "info").length
  }

  const parts: string[] = []
  if (bySeverity.error) parts.push(`${bySeverity.error} error(s)`)
  if (bySeverity.warning) parts.push(`${bySeverity.warning} warning(s)`)
  if (bySeverity.info) parts.push(`${bySeverity.info} info`)

  return parts.join(", ")
}

// Re-export for type compatibility
export type { LintWarning as Warning }
