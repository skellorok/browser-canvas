declare global {
  interface Window {
    canvasEmit: (event: string, data: unknown) => void
    __canvasWebSocket: WebSocket | null
  }
}

export function initEventBridge(ws: WebSocket): void {
  window.__canvasWebSocket = ws

  window.canvasEmit = (event: string, data: unknown): void => {
    if (window.__canvasWebSocket?.readyState === WebSocket.OPEN) {
      window.__canvasWebSocket.send(JSON.stringify({
        type: "event",
        event,
        data
      }))
    } else {
      console.warn("Canvas WebSocket not connected, event not sent:", event, data)
    }
  }
}

export function cleanupEventBridge(): void {
  window.__canvasWebSocket = null
  window.canvasEmit = () => {
    console.warn("Canvas not connected")
  }
}

// Initialize with a no-op until WebSocket connects
window.canvasEmit = () => {
  console.warn("Canvas not connected yet")
}
window.__canvasWebSocket = null

export {}
