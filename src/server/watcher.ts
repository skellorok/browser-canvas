import chokidar, { type FSWatcher } from "chokidar"
import { readFile, stat } from "fs/promises"
import { basename, dirname, join } from "path"
import {
  openCanvas,
  hasCanvas,
  closeCanvas,
  readCanvasCode,
} from "./canvas-manager"
import { sendReload, sendStateUpdate, sendVanillaReload } from "./websocket"
import { prependComponents, getScopeIdentifiers } from "./component-loader"
import { runServerValidators } from "./validators"
import { clearLog, appendLogs, summarizeNotices, type NoticeLogEntry } from "./log"
import { recordValidation, markValidationPending } from "./validation-status"

// Canvas mode detection
type CanvasMode = "react" | "vanilla"

function detectCanvasModeSync(canvasPath: string): CanvasMode | null {
  const jsxPath = join(canvasPath, "App.jsx")
  const htmlPath = join(canvasPath, "index.html")

  try {
    require("fs").accessSync(jsxPath)
    return "react"
  } catch {
    // App.jsx doesn't exist
  }

  try {
    require("fs").accessSync(htmlPath)
    return "vanilla"
  } catch {
    // Neither exists
  }

  return null
}

const DEBOUNCE_MS = 100
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Track initial scan state
let isInitialScan = true
const initialCanvasPaths: Array<{ canvasId: string; canvasPath: string; filePath: string }> = []

function debounce(key: string, fn: () => void): void {
  const existing = debounceTimers.get(key)
  if (existing) {
    clearTimeout(existing)
  }
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key)
      fn()
    }, DEBOUNCE_MS)
  )
}

async function handleAppJsxChange(canvasId: string, watchPath: string): Promise<void> {
  const code = await readCanvasCode(canvasId)
  if (!code) return

  // Clear log before re-validating (fresh start on each code change)
  await clearLog(watchPath, canvasId)

  // Run server-side validators
  const scopeIdentifiers = getScopeIdentifiers()
  const notices = runServerValidators(code, scopeIdentifiers)

  // Record validation result for status API
  recordValidation(canvasId, notices)

  if (notices.length > 0) {
    await appendLogs(watchPath, canvasId, notices)
    console.log(`Canvas ${canvasId} pre-render: ${summarizeNotices(notices as Omit<NoticeLogEntry, "ts">[])}`)
  }

  // Send code to browser regardless of notices (let browser show errors too)
  const fullCode = prependComponents(code)
  sendReload(canvasId, fullCode)
}

async function handleStateChange(canvasId: string, statePath: string): Promise<void> {
  try {
    const content = await readFile(statePath, "utf-8")
    const state = JSON.parse(content) as Record<string, unknown>
    sendStateUpdate(canvasId, state)
  } catch (error) {
    console.error(`Error reading state file for ${canvasId}:`, error)
  }
}

async function handleIndexHtmlChange(canvasId: string, watchPath: string): Promise<void> {
  // For vanilla mode, just send a reload signal - browser will fetch fresh HTML
  sendVanillaReload(canvasId)
  console.log(`Canvas ${canvasId} (vanilla): reloading`)
}

async function handleNewCanvas(
  canvasId: string,
  canvasPath: string,
  port: number,
  onCanvasesChanged?: () => void
): Promise<void> {
  if (hasCanvas(canvasId)) {
    return
  }

  // After initial scan, new canvases open browser immediately
  await openCanvas(canvasId, canvasPath, port)
  console.log(`Canvas opened: ${canvasId}`)
  onCanvasesChanged?.()
}

async function processInitialCanvases(
  port: number,
  onCanvasesChanged?: () => void
): Promise<void> {
  if (initialCanvasPaths.length === 0) {
    return
  }

  // Get modification times for all collected canvases
  const canvasesWithMtime: Array<{ canvasId: string; canvasPath: string; mtime: number }> = []
  for (const canvas of initialCanvasPaths) {
    try {
      const stats = await stat(canvas.filePath)
      canvasesWithMtime.push({
        canvasId: canvas.canvasId,
        canvasPath: canvas.canvasPath,
        mtime: stats.mtimeMs,
      })
    } catch {
      // File may have been deleted, skip
    }
  }

  if (canvasesWithMtime.length === 0) {
    return
  }

  // Sort by modification time (most recent first)
  canvasesWithMtime.sort((a, b) => b.mtime - a.mtime)

  // Open browser only for the most recently modified canvas
  const mostRecent = canvasesWithMtime[0]
  await openCanvas(mostRecent.canvasId, mostRecent.canvasPath, port, { openBrowser: true })
  console.log(`Canvas opened: ${mostRecent.canvasId} (most recent)`)

  // Register remaining canvases without opening browser
  for (let i = 1; i < canvasesWithMtime.length; i++) {
    const canvas = canvasesWithMtime[i]
    await openCanvas(canvas.canvasId, canvas.canvasPath, port, { openBrowser: false })
    console.log(`Canvas registered: ${canvas.canvasId}`)
  }

  onCanvasesChanged?.()
}

export interface WatcherOptions {
  watchPath: string
  port: number
  onCanvasesChanged?: () => void
}

export function startWatcher(options: WatcherOptions): FSWatcher {
  const { watchPath, port, onCanvasesChanged } = options
  const watcher = chokidar.watch(watchPath, {
    persistent: true,
    ignoreInitial: false,
    depth: 2,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  })

  watcher.on("add", (filePath) => {
    const fileName = basename(filePath)
    const canvasPath = dirname(filePath)
    const canvasId = basename(canvasPath)

    // Skip files directly in the watch root (like server.json)
    if (canvasPath === watchPath) {
      return
    }

    if (fileName === "App.jsx" || fileName === "index.html") {
      if (isInitialScan) {
        // During initial scan, collect synchronously (no debounce)
        initialCanvasPaths.push({ canvasId, canvasPath, filePath })
      } else {
        // After initial scan, process with debounce
        debounce(`new-${canvasId}`, () => {
          handleNewCanvas(canvasId, canvasPath, port, onCanvasesChanged)
        })
      }
    } else if (fileName === "_state.json") {
      // State file added - send to browser
      debounce(`state-${canvasId}`, () => {
        handleStateChange(canvasId, filePath)
      })
    }
  })

  watcher.on("change", (filePath) => {
    const fileName = basename(filePath)
    const canvasPath = dirname(filePath)
    const canvasId = basename(canvasPath)

    // Skip files directly in the watch root
    if (canvasPath === watchPath) {
      return
    }

    if (fileName === "App.jsx") {
      // Mark as pending immediately (before debounce) so API can wait
      markValidationPending(canvasId)
      debounce(`change-${canvasId}`, () => {
        handleAppJsxChange(canvasId, watchPath)
      })
    } else if (fileName === "index.html") {
      // Vanilla mode - just trigger reload
      debounce(`change-${canvasId}`, () => {
        handleIndexHtmlChange(canvasId, watchPath)
      })
    } else if (fileName === "_state.json") {
      // State file changed - send to browser
      debounce(`state-${canvasId}`, () => {
        handleStateChange(canvasId, filePath)
      })
    }
  })

  watcher.on("unlink", (filePath) => {
    const fileName = basename(filePath)
    const canvasPath = dirname(filePath)
    const canvasId = basename(canvasPath)

    // Skip files directly in the watch root
    if (canvasPath === watchPath) {
      return
    }

    if (fileName === "App.jsx" || fileName === "index.html") {
      // Canvas file was deleted, close the canvas
      if (hasCanvas(canvasId)) {
        closeCanvas(canvasId)
        console.log(`Canvas closed (file deleted): ${canvasId}`)
        onCanvasesChanged?.()
      }
    }
  })

  watcher.on("error", (error) => {
    console.error("Watcher error:", error)
  })

  // When initial scan completes, process collected canvases
  watcher.on("ready", async () => {
    isInitialScan = false
    await processInitialCanvases(port, onCanvasesChanged)
  })

  console.log(`File watcher started on ${watchPath}`)
  return watcher
}
