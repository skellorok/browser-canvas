/**
 * Vanilla Browser Canvas Server
 *
 * ~200 lines of vanilla JS. No TypeScript. No bundling.
 * Serves HTML files directly, watches for changes, hot reloads.
 */

import { watch } from "fs"
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ARTIFACTS_DIR = join(process.cwd(), ".claude", "artifacts")
const PORT = process.env.PORT || 3210

// Track WebSocket connections per canvas
const connections = new Map() // canvasId -> Set<WebSocket>
const watchers = new Map()    // canvasId -> FSWatcher

// Ensure artifacts directory exists
await mkdir(ARTIFACTS_DIR, { recursive: true })

// HTTP server with Bun
const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const canvasId = url.searchParams.get("canvas")
      if (server.upgrade(req, { data: { canvasId } })) {
        return
      }
      return new Response("WebSocket upgrade failed", { status: 400 })
    }

    // Shell page
    if (url.pathname === "/") {
      return new Response(await readFile(join(__dirname, "shell.html")), {
        headers: { "Content-Type": "text/html" }
      })
    }

    // Base CSS
    if (url.pathname === "/base.css") {
      return new Response(await readFile(join(__dirname, "base.css")), {
        headers: { "Content-Type": "text/css" }
      })
    }

    // Canvas content
    if (url.pathname.startsWith("/canvas/")) {
      const canvasId = url.pathname.replace("/canvas/", "").replace(/\/$/, "")
      const indexPath = join(ARTIFACTS_DIR, canvasId, "index.html")

      try {
        const html = await readFile(indexPath, "utf-8")
        // Inject bridge script
        const injected = injectBridge(html, canvasId)
        return new Response(injected, {
          headers: { "Content-Type": "text/html" }
        })
      } catch (e) {
        return new Response(`Canvas not found: ${canvasId}`, { status: 404 })
      }
    }

    // API: List canvases
    if (url.pathname === "/api/canvases" && req.method === "GET") {
      try {
        const entries = await readdir(ARTIFACTS_DIR, { withFileTypes: true })
        const canvases = entries
          .filter(e => e.isDirectory() && !e.name.startsWith("_"))
          .map(e => e.name)
        return Response.json({ canvases })
      } catch {
        return Response.json({ canvases: [] })
      }
    }

    // API: Get state
    if (url.pathname.match(/^\/api\/canvas\/[^/]+\/state$/) && req.method === "GET") {
      const canvasId = url.pathname.split("/")[3]
      const statePath = join(ARTIFACTS_DIR, canvasId, "_state.json")
      try {
        const state = JSON.parse(await readFile(statePath, "utf-8"))
        return Response.json(state)
      } catch {
        return Response.json({})
      }
    }

    // API: Set state
    if (url.pathname.match(/^\/api\/canvas\/[^/]+\/state$/) && req.method === "PUT") {
      const canvasId = url.pathname.split("/")[3]
      const statePath = join(ARTIFACTS_DIR, canvasId, "_state.json")
      const state = await req.json()
      await writeFile(statePath, JSON.stringify(state, null, 2))
      // Notify browser
      broadcast(canvasId, { type: "state-update", state })
      return Response.json({ ok: true })
    }

    // API: Screenshot (placeholder - would need puppeteer or similar)
    if (url.pathname.match(/^\/api\/canvas\/[^/]+\/screenshot$/) && req.method === "POST") {
      const canvasId = url.pathname.split("/")[3]
      broadcast(canvasId, { type: "screenshot-request" })
      return Response.json({ ok: true, message: "Screenshot requested" })
    }

    // API: Close canvas
    if (url.pathname.match(/^\/api\/canvas\/[^/]+\/close$/) && req.method === "POST") {
      const canvasId = url.pathname.split("/")[3]
      broadcast(canvasId, { type: "close" })
      return Response.json({ ok: true })
    }

    return new Response("Not found", { status: 404 })
  },

  websocket: {
    open(ws) {
      const { canvasId } = ws.data
      // Skip watching for special IDs like _shell
      if (!canvasId.startsWith("_")) {
        if (!connections.has(canvasId)) {
          connections.set(canvasId, new Set())
          startWatching(canvasId)
        }
        connections.get(canvasId).add(ws)
      }
      log(`[${canvasId}] Client connected`)
    },

    close(ws) {
      const { canvasId } = ws.data
      if (!canvasId.startsWith("_")) {
        const conns = connections.get(canvasId)
        if (conns) {
          conns.delete(ws)
          if (conns.size === 0) {
            connections.delete(canvasId)
            stopWatching(canvasId)
          }
        }
      }
      log(`[${canvasId}] Client disconnected`)
    },

    async message(ws, message) {
      const { canvasId } = ws.data
      const data = JSON.parse(message)
      log(`[${canvasId}] Message: ${data.type}`)

      if (data.type === "event") {
        await appendLog(canvasId, {
          type: "event",
          event: data.event,
          data: data.data,
          timestamp: new Date().toISOString()
        })
      }

      if (data.type === "error") {
        await appendLog(canvasId, {
          type: "error",
          message: data.message,
          timestamp: new Date().toISOString()
        })
      }

      if (data.type === "set-state") {
        const statePath = join(ARTIFACTS_DIR, canvasId, "_state.json")
        await writeFile(statePath, JSON.stringify(data.state, null, 2))
      }

      if (data.type === "screenshot") {
        const screenshotPath = join(ARTIFACTS_DIR, canvasId, "_screenshot.png")
        const base64 = data.dataUrl.replace(/^data:image\/png;base64,/, "")
        await writeFile(screenshotPath, Buffer.from(base64, "base64"))
        log(`[${canvasId}] Screenshot saved`)
      }
    }
  }
})

// File watching
function startWatching(canvasId) {
  const canvasDir = join(ARTIFACTS_DIR, canvasId)
  const indexPath = join(canvasDir, "index.html")

  const watcher = watch(canvasDir, async (eventType, filename) => {
    if (filename === "index.html") {
      log(`[${canvasId}] File changed, reloading`)
      broadcast(canvasId, { type: "reload" })
    }
    if (filename === "_state.json") {
      try {
        const state = JSON.parse(await readFile(join(canvasDir, "_state.json"), "utf-8"))
        broadcast(canvasId, { type: "state-update", state })
      } catch {}
    }
  })

  watchers.set(canvasId, watcher)
  log(`[${canvasId}] Watching for changes`)
}

function stopWatching(canvasId) {
  const watcher = watchers.get(canvasId)
  if (watcher) {
    watcher.close()
    watchers.delete(canvasId)
  }
}

// Broadcast to all connections for a canvas
function broadcast(canvasId, message) {
  const conns = connections.get(canvasId)
  if (conns) {
    const json = JSON.stringify(message)
    for (const ws of conns) {
      ws.send(json)
    }
  }
}

// Append to log file
async function appendLog(canvasId, entry) {
  const logPath = join(ARTIFACTS_DIR, canvasId, "_log.jsonl")
  await writeFile(logPath, JSON.stringify(entry) + "\n", { flag: "a" })
}

// Inject bridge script into HTML
function injectBridge(html, canvasId) {
  // First script defines the API synchronously (no module, runs immediately)
  const bridgeSetup = `
<script>
  // Define API synchronously so it's available to app scripts
  // Use window.* so second script can access them
  window._canvasState = {};
  window._canvasWs = null;
  window._canvasWsReady = false;
  window._canvasWsQueue = [];

  window.canvasState = async function(newState) {
    if (newState !== undefined) {
      window._canvasState = newState;
      if (window._canvasWsReady && window._canvasWs) {
        window._canvasWs.send(JSON.stringify({ type: "set-state", state: newState }));
      } else {
        window._canvasWsQueue.push({ type: "set-state", state: newState });
      }
    }
    return window._canvasState;
  };

  window.canvasEmit = function(event, data) {
    const msg = { type: "event", event, data };
    if (window._canvasWsReady && window._canvasWs) {
      window._canvasWs.send(JSON.stringify(msg));
    } else {
      window._canvasWsQueue.push(msg);
    }
  };
</script>
`

  // Second script sets up WebSocket (as module, can be async)
  const bridgeConnect = `
<script type="module">
  // WebSocket connection to server
  const ws = new WebSocket(\`ws://\${location.host}/ws?canvas=${canvasId}\`);
  window._canvasWs = ws;

  ws.onopen = () => {
    window._canvasWsReady = true;
    // Send queued messages
    window._canvasWsQueue.forEach(msg => ws.send(JSON.stringify(msg)));
    window._canvasWsQueue = [];
  };

  // Fetch initial state
  fetch("/api/canvas/${canvasId}/state")
    .then(r => r.json())
    .then(s => { window._canvasState = s; });

  // Error reporting
  window.onerror = (msg, src, line, col, err) => {
    if (window._canvasWsReady) {
      ws.send(JSON.stringify({ type: "error", message: \`\${msg} at \${src}:\${line}:\${col}\` }));
    }
  };
  window.onunhandledrejection = (e) => {
    if (window._canvasWsReady) {
      ws.send(JSON.stringify({ type: "error", message: e.reason?.message || String(e.reason) }));
    }
  };

  // Hot reload
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === "reload") {
      location.reload()
    }
    if (msg.type === "state-update") {
      window._canvasState = msg.state;
      window.dispatchEvent(new CustomEvent("canvas-state-change", { detail: msg.state }));
    }
    if (msg.type === "screenshot-request") {
      import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm")
        .then(({ default: html2canvas }) => html2canvas(document.body))
        .then(canvas => {
          ws.send(JSON.stringify({ type: "screenshot", dataUrl: canvas.toDataURL() }))
        })
    }
    if (msg.type === "close") {
      window.close()
    }
  }
</script>
`

  // Insert setup script in <head>, connect script before </body>
  let result = html
  if (html.includes("</head>")) {
    result = result.replace("</head>", bridgeSetup + "</head>")
  } else if (html.includes("<body")) {
    result = result.replace("<body", bridgeSetup + "<body")
  } else {
    result = bridgeSetup + result
  }

  if (result.includes("</body>")) {
    result = result.replace("</body>", bridgeConnect + "</body>")
  } else {
    result = result + bridgeConnect
  }
  return result
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

// Write server info
const serverJson = join(ARTIFACTS_DIR, "server.json")
await writeFile(serverJson, JSON.stringify({ port: PORT, pid: process.pid }, null, 2))

log(`Vanilla Canvas Server running on http://localhost:${PORT}`)
log(`Artifacts directory: ${ARTIFACTS_DIR}`)
