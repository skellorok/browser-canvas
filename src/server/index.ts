import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { mkdir, writeFile, appendFile, readdir, stat, readFile } from "fs/promises"
import { join, dirname } from "path"
import { startWatcher } from "./watcher"
import {
  getCanvasList,
  getActiveCanvasIds,
  getCanvas,
  closeCanvas,
  readCanvasCode,
} from "./canvas-manager"
import {
  addConnection,
  removeConnection,
  handleEvent,
  handleScreenshot,
  handleError,
  handleNotices,
  handleSetState,
  broadcastCanvasesUpdate,
  broadcastComponentsUpdate,
  requestScreenshot,
  sendStateUpdate,
  type WebSocketData,
  type ClientMessage,
} from "./websocket"
import {
  initComponentDirs,
  loadComponents,
  watchComponents,
  getCompiledComponents,
} from "./component-loader"
import {
  buildBrowserBundle,
  needsRebuild as needsScopeRebuild,
  getScopeInfo,
} from "./scope-builder"
import {
  buildTailwindCSS,
  needsTailwindRebuild,
  getTailwindInfo,
} from "./tailwind-builder"
import {
  getValidationStatus,
  waitForValidation,
  isValidationPending,
} from "./validation-status"
import {
  injectVanillaBridge,
  readVanillaCanvas,
  detectCanvasMode,
} from "./vanilla"

// Port 0 = OS assigns available port; actual port captured after server starts
let serverPort = 0
const HOST = "127.0.0.1"

// Resolve the canvas directory - defaults to .claude/artifacts in cwd
function resolveCanvasDir(): string {
  if (process.env.CANVAS_DIR) {
    return process.env.CANVAS_DIR
  }
  return join(process.cwd(), ".claude", "artifacts")
}

// Resolve the server root (where this package is installed)
function resolveServerRoot(): string {
  // import.meta.dir gives us the directory containing this file (src/server/)
  // Go up two levels to get package root
  return join(dirname(dirname(import.meta.dir)))
}

const CANVAS_DIR = resolveCanvasDir()
const SERVER_ROOT = resolveServerRoot()
const PROJECT_ROOT = process.cwd()

// Server logging - writes to both console and _server.log in artifacts directory
async function serverLog(level: "info" | "error" | "warn", message: string): Promise<void> {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`

  // Console output
  if (level === "error") {
    console.error(message)
  } else {
    console.log(message)
  }

  // File output
  try {
    const logPath = join(CANVAS_DIR, "_server.log")
    await appendFile(logPath, logLine, "utf-8")
  } catch {
    // Ignore file write errors
  }
}

function log(message: string): void {
  serverLog("info", message)
}

function logError(message: string): void {
  serverLog("error", message)
}

// Read canvas code directly from filesystem (for initial load)
async function readCanvasCodeDirect(canvasId: string): Promise<string | null> {
  const appPath = join(CANVAS_DIR, canvasId, "App.jsx")
  try {
    const code = await Bun.file(appPath).text()
    return code
  } catch {
    return null
  }
}

// Read canvas state directly from filesystem (for initial load)
async function readCanvasStateDirect(canvasId: string): Promise<Record<string, unknown> | null> {
  const statePath = join(CANVAS_DIR, canvasId, "_state.json")
  try {
    const content = await Bun.file(statePath).text()
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

// Scan for all artifact folders containing App.jsx or index.html
async function getAllArtifacts(): Promise<Array<{ id: string; name: string; hasCode: boolean; mode: "react" | "vanilla" }>> {
  try {
    const entries = await readdir(CANVAS_DIR, { withFileTypes: true })
    const artifacts: Array<{ id: string; name: string; hasCode: boolean; mode: "react" | "vanilla" }> = []

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith(".")) {
        const mode = await detectCanvasMode(CANVAS_DIR, entry.name)
        if (mode) {
          artifacts.push({
            id: entry.name,
            name: entry.name,
            hasCode: true,
            mode,
          })
        }
      }
    }

    return artifacts.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

const ARTIFACTS_GITIGNORE = `# Server state (regenerated on startup)
server.json
_server.log

# Per-canvas transient files
*/_log.jsonl
*/_screenshot.png
*/_state.json

# Legacy files
*/events.jsonl
*/_notices.jsonl
*/_error.txt
*/_warnings.jsonl
*/_request.json
`

async function ensureCanvasDir(): Promise<void> {
  await mkdir(CANVAS_DIR, { recursive: true })

  // Create .gitignore if it doesn't exist
  const gitignorePath = join(CANVAS_DIR, ".gitignore")
  try {
    await stat(gitignorePath)
  } catch {
    await writeFile(gitignorePath, ARTIFACTS_GITIGNORE, "utf-8")
  }
}

async function writeServerJson(): Promise<void> {
  const serverState = {
    port: serverPort,
    host: HOST,
    canvasDir: CANVAS_DIR,
    activeCanvases: getActiveCanvasIds(),
    startedAt: new Date().toISOString(),
  }
  await writeFile(
    join(CANVAS_DIR, "server.json"),
    JSON.stringify(serverState, null, 2),
    "utf-8"
  )
}

// Update server.json periodically to reflect active canvases
function startServerJsonUpdater(): void {
  setInterval(() => {
    writeServerJson().catch(console.error)
  }, 5000)
}

const app = new Hono()

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    port: serverPort,
    canvasDir: CANVAS_DIR,
    canvases: getActiveCanvasIds(),
  })
})

// API: Get all artifact folders
app.get("/api/canvases", async (c) => {
  const artifacts = await getAllArtifacts()
  return c.json({
    canvasDir: CANVAS_DIR,
    canvases: artifacts,
  })
})

// API: Take screenshot
app.post("/api/canvas/:id/screenshot", async (c) => {
  const canvasId = c.req.param("id")
  const canvas = getCanvas(canvasId)
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404)
  }
  requestScreenshot(canvasId)
  const screenshotPath = join(canvas.path, "_screenshot.png")
  return c.json({ success: true, path: screenshotPath })
})

// API: Close canvas
app.post("/api/canvas/:id/close", (c) => {
  const canvasId = c.req.param("id")
  const canvas = getCanvas(canvasId)
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404)
  }
  closeCanvas(canvasId)
  return c.json({ success: true })
})

// API: Get state
app.get("/api/canvas/:id/state", async (c) => {
  const canvasId = c.req.param("id")
  const state = await readCanvasStateDirect(canvasId)
  return c.json({ state: state ?? {} })
})

// API: Set state
app.put("/api/canvas/:id/state", async (c) => {
  const canvasId = c.req.param("id")
  const canvas = getCanvas(canvasId)

  // Canvas doesn't need to be open to set state - the file will be picked up when it opens
  const statePath = join(CANVAS_DIR, canvasId, "_state.json")

  try {
    const body = await c.req.json()
    const state = body as Record<string, unknown>

    // Write state to file
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8")

    // If canvas is open, send state update via WebSocket
    if (canvas) {
      sendStateUpdate(canvasId, state)
    }

    return c.json({ success: true, state })
  } catch (error) {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
})

// API: Get validation status (for PostToolUse hook)
app.get("/api/canvas/:id/status", async (c) => {
  const canvasId = c.req.param("id")
  const wait = c.req.query("wait") === "true"
  const timeoutMs = parseInt(c.req.query("timeout") ?? "2000", 10)

  // If validation is pending and caller wants to wait, wait for it
  if (wait && isValidationPending(canvasId)) {
    await waitForValidation(canvasId, timeoutMs)
  }

  const status = getValidationStatus(canvasId)

  if (!status) {
    return c.json({
      canvasId,
      hasStatus: false,
      pending: isValidationPending(canvasId),
    })
  }

  return c.json({
    canvasId,
    hasStatus: true,
    pending: isValidationPending(canvasId),
    errorCount: status.errorCount,
    warningCount: status.warningCount,
    infoCount: status.infoCount,
    notices: status.notices,
  })
})

// Root redirect to first active canvas or placeholder
app.get("/", (c) => {
  const canvases = getCanvasList()
  if (canvases.length > 0) {
    return c.redirect(`/canvas/${canvases[0].id}`)
  }
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Browser Canvas</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .message {
            text-align: center;
            color: #666;
          }
          h1 { color: #333; margin-bottom: 8px; }
          p { margin: 0; }
          code {
            background: #e0e0e0;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Browser Canvas</h1>
          <p>No active canvases. Create one by writing to:</p>
          <p><code>${CANVAS_DIR}/&lt;name&gt;/App.jsx</code> (React)</p>
          <p><code>${CANVAS_DIR}/&lt;name&gt;/index.html</code> (Vanilla)</p>
        </div>
      </body>
    </html>
  `)
})

// Canvas page - supports both React (App.jsx) and Vanilla (index.html) modes
app.get("/canvas/:id", async (c) => {
  const canvasId = c.req.param("id")
  const mode = await detectCanvasMode(CANVAS_DIR, canvasId)

  // Vanilla mode: serve index.html with bridge injection
  if (mode === "vanilla") {
    const html = await readVanillaCanvas(CANVAS_DIR, canvasId)
    if (html) {
      const wsUrl = `ws://${HOST}:${serverPort}/ws/${canvasId}`
      const injected = injectVanillaBridge(html, canvasId, wsUrl)
      return c.html(injected)
    }
  }

  // React mode (default): serve React shell
  const code = await readCanvasCode(canvasId)

  // Even if canvas doesn't exist yet, render the shell
  // The WebSocket will provide updates when the canvas is created
  const initialCode = code ?? "function App() { return <div>Loading...</div> }"

  return c.html(`
    <!DOCTYPE html>
    <html class="dark">
      <head>
        <title>Canvas: ${canvasId}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/canvas.css" />
        <script>
          window.CANVAS_ID = "${canvasId}";
          window.INITIAL_CODE = ${JSON.stringify(initialCode)};
          window.WS_URL = "ws://${HOST}:${serverPort}/ws/${canvasId}";
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/canvas.js"></script>
      </body>
    </html>
  `)
})

// Serve base.css for vanilla mode
app.get("/base.css", async (c) => {
  const cssPath = join(SERVER_ROOT, "vanilla", "base.css")
  try {
    const css = await readFile(cssPath, "utf-8")
    return c.text(css, { headers: { "Content-Type": "text/css" } })
  } catch {
    return c.text("/* base.css not found */", 404, { headers: { "Content-Type": "text/css" } })
  }
})

// Serve static files from dist/
app.use("/*", serveStatic({ root: "./dist" }))

// WebSocket upgrade handling
function handleWebSocketUpgrade(
  req: Request,
  server: ReturnType<typeof Bun.serve>
): Response | undefined {
  const url = new URL(req.url)
  const match = url.pathname.match(/^\/ws\/([^/]+)$/)

  if (match && req.headers.get("upgrade") === "websocket") {
    const canvasId = match[1]
    const success = server.upgrade(req, {
      data: { canvasId } as WebSocketData,
    })
    return success ? undefined : new Response("WebSocket upgrade failed", { status: 500 })
  }
  return undefined
}

// Build browser bundle and CSS if needed
async function buildIfNeeded(): Promise<void> {
  const distDir = join(SERVER_ROOT, "dist")

  const buildOptions = {
    serverRoot: SERVER_ROOT,
    projectRoot: PROJECT_ROOT,
    outdir: distDir
  }

  // Check for project extensions and log info
  const scopeInfo = await getScopeInfo(PROJECT_ROOT)
  const tailwindInfo = await getTailwindInfo(PROJECT_ROOT)

  if (scopeInfo.hasProjectExtension) {
    log(`Found project scope extension at: ${scopeInfo.projectScopePath}`)
  }
  if (tailwindInfo.hasProjectConfig) {
    log(`Found project Tailwind config at: ${tailwindInfo.projectConfigPath}`)
  }
  if (tailwindInfo.hasCustomStyles) {
    log(`Found custom styles at: ${tailwindInfo.customStylesPath}`)
  }

  // Build browser bundle if needed
  const needsJsBuild = await needsScopeRebuild(buildOptions)
  if (needsJsBuild || scopeInfo.hasProjectExtension) {
    log("Building browser bundle...")
    const jsResult = await buildBrowserBundle(buildOptions)
    if (!jsResult.success) {
      logError(`Browser bundle build failed: ${jsResult.error}`)
      throw new Error(jsResult.error)
    }
    log("Browser bundle built successfully")
  }

  // Build Tailwind CSS if needed
  const needsCssBuild = await needsTailwindRebuild(buildOptions)
  if (needsCssBuild || tailwindInfo.hasProjectConfig) {
    log("Building Tailwind CSS...")
    const cssResult = await buildTailwindCSS(buildOptions)
    if (!cssResult.success) {
      logError(`Tailwind CSS build failed: ${cssResult.error}`)
      throw new Error(cssResult.error)
    }
    log("Tailwind CSS built successfully")
  }
}

// Start the server
async function main(): Promise<void> {
  await ensureCanvasDir()
  await writeServerJson()

  // Build browser bundle and CSS if needed
  await buildIfNeeded()

  // Initialize and load components
  initComponentDirs(SERVER_ROOT, PROJECT_ROOT)
  await loadComponents()
  watchComponents(() => {
    // When components change, broadcast the new compiled components to all clients
    const components = getCompiledComponents()
    broadcastComponentsUpdate(components)
    log(`Broadcasted updated components to all clients`)
  })

  const server = Bun.serve<WebSocketData>({
    port: serverPort,
    hostname: HOST,
    fetch(req, server) {
      // Try WebSocket upgrade first
      const wsResponse = handleWebSocketUpgrade(req, server)
      if (wsResponse === undefined && req.headers.get("upgrade") === "websocket") {
        // Upgrade succeeded, return nothing
        return new Response(null, { status: 101 })
      }
      if (wsResponse) {
        return wsResponse
      }

      // Handle regular HTTP requests with Hono
      return app.fetch(req)
    },
    websocket: {
      async open(ws) {
        const { canvasId } = ws.data
        addConnection(canvasId, ws)
        log(`WebSocket connected: ${canvasId}`)

        // Send compiled components first (so they're available before code runs)
        const components = getCompiledComponents()
        if (Object.keys(components).length > 0) {
          ws.send(JSON.stringify({ type: "components-update", components }))
        }

        // Send current code to newly connected client
        // Try canvas manager first, then direct file read
        let code = await readCanvasCode(canvasId)
        if (!code) {
          code = await readCanvasCodeDirect(canvasId)
        }
        if (code) {
          ws.send(JSON.stringify({ type: "reload", code }))
        }

        // Send current state if it exists
        const state = await readCanvasStateDirect(canvasId)
        if (state) {
          ws.send(JSON.stringify({ type: "state-update", state }))
        }

        // Also send current canvases list
        const artifacts = await getAllArtifacts()
        ws.send(JSON.stringify({ type: "canvases-updated", canvases: artifacts }))
      },
      message(ws, message) {
        const { canvasId } = ws.data
        try {
          const msg = JSON.parse(message.toString()) as ClientMessage

          if (msg.type === "event" && msg.event) {
            handleEvent(canvasId, msg.event, msg.data, CANVAS_DIR)
          } else if (msg.type === "screenshot" && msg.dataUrl) {
            handleScreenshot(canvasId, msg.dataUrl, CANVAS_DIR)
          } else if (msg.type === "error" && msg.message) {
            handleError(canvasId, msg.message, CANVAS_DIR)
          } else if (msg.type === "notices" && msg.notices) {
            handleNotices(canvasId, msg.notices, CANVAS_DIR)
          } else if (msg.type === "set-state" && msg.state) {
            handleSetState(canvasId, msg.state, CANVAS_DIR)
          }
        } catch (error) {
          logError(`Invalid WebSocket message from ${canvasId}: ${error}`)
        }
      },
      close(ws) {
        const { canvasId } = ws.data
        removeConnection(canvasId, ws)
        log(`WebSocket disconnected: ${canvasId}`)
      },
    },
  })

  // Capture actual port (OS-assigned if we used port 0)
  serverPort = server.port ?? 9847

  // Write server.json immediately with actual port
  await writeServerJson()

  // Start file watcher with canvases update callback
  startWatcher({
    watchPath: CANVAS_DIR,
    port: serverPort,
    onCanvasesChanged: async () => {
      const artifacts = await getAllArtifacts()
      broadcastCanvasesUpdate(artifacts)
    },
  })

  // Start server.json updater
  startServerJsonUpdater()

  log(`Ready on http://${HOST}:${serverPort}`)
  log(`Watching ${CANVAS_DIR} for canvas changes`)
}

main().catch(console.error)
