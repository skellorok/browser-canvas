/**
 * Vanilla Canvas Support
 *
 * Serves plain HTML files with minimal bridge injection.
 * No React, no bundling, no Tailwind - just standards-based web.
 */

import { readFile } from "fs/promises"
import { join } from "path"

/**
 * Inject bridge scripts into vanilla HTML
 *
 * Adds:
 * 1. Sync script in <head> defining window.canvasState and window.canvasEmit
 * 2. Module script before </body> for WebSocket connection
 */
export function injectVanillaBridge(html: string, canvasId: string, wsUrl: string): string {
  // First script defines the API synchronously (no module, runs immediately)
  const bridgeSetup = `
<script>
  // Canvas Bridge API - defined synchronously so it's available to app scripts
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

  // Second script sets up WebSocket connection (as module, can be async)
  const bridgeConnect = `
<script type="module">
  // WebSocket connection to server
  const ws = new WebSocket("${wsUrl}");
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
    .then(data => { window._canvasState = data.state || {}; });

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

  // Hot reload and state sync
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "reload") {
      location.reload();
    }
    if (msg.type === "state-update") {
      window._canvasState = msg.state;
      window.dispatchEvent(new CustomEvent("canvas-state-change", { detail: msg.state }));
    }
    if (msg.type === "screenshot-request") {
      import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm")
        .then(({ default: html2canvas }) => html2canvas(document.body))
        .then(canvas => {
          ws.send(JSON.stringify({ type: "screenshot", dataUrl: canvas.toDataURL() }));
        });
    }
    if (msg.type === "close") {
      window.close();
    }
  };
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

/**
 * Read vanilla canvas HTML from filesystem
 */
export async function readVanillaCanvas(canvasDir: string, canvasId: string): Promise<string | null> {
  const htmlPath = join(canvasDir, canvasId, "index.html")
  try {
    return await readFile(htmlPath, "utf-8")
  } catch {
    return null
  }
}

/**
 * Detect canvas mode based on which file exists
 */
export async function detectCanvasMode(canvasDir: string, canvasId: string): Promise<"react" | "vanilla" | null> {
  const jsxPath = join(canvasDir, canvasId, "App.jsx")
  const htmlPath = join(canvasDir, canvasId, "index.html")

  try {
    await Bun.file(jsxPath).text()
    return "react"
  } catch {
    // App.jsx doesn't exist, try index.html
  }

  try {
    await Bun.file(htmlPath).text()
    return "vanilla"
  } catch {
    // Neither file exists
  }

  return null
}
