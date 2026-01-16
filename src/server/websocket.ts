import { writeFile } from "fs/promises"
import { join } from "path"
import type { ServerWebSocket } from "bun"
import { getCanvas } from "./canvas-manager"
import {
  appendLog,
  appendLogs,
  eventEntry,
  noticeEntry,
  screenshotEntry,
  summarizeNotices,
  type NoticeLogEntry,
  type NoticeSeverity,
  type NoticeCategory,
} from "./log"

export interface WebSocketData {
  canvasId: string
}

export interface CanvasInfo {
  id: string
  name: string
  hasCode: boolean
}

export interface ServerMessage {
  type: "reload" | "screenshot-request" | "canvases-updated" | "state-update" | "components-update"
  code?: string
  canvases?: CanvasInfo[]
  state?: Record<string, unknown>
  components?: Record<string, string>  // { ComponentName: "compiled JS code" }
}

// Notice from browser (sent via WebSocket)
export interface BrowserNotice {
  severity: NoticeSeverity
  category: NoticeCategory
  message: string
  details?: Record<string, unknown>
}

export interface ClientMessage {
  type: "event" | "screenshot" | "error" | "set-state" | "notices"
  event?: string
  data?: unknown
  dataUrl?: string
  message?: string
  state?: Record<string, unknown>
  notices?: BrowserNotice[]
}

// Map of canvasId -> Set of WebSocket connections
const connections = new Map<string, Set<ServerWebSocket<WebSocketData>>>()

export function addConnection(canvasId: string, ws: ServerWebSocket<WebSocketData>): void {
  let set = connections.get(canvasId)
  if (!set) {
    set = new Set()
    connections.set(canvasId, set)
  }
  set.add(ws)
}

export function removeConnection(canvasId: string, ws: ServerWebSocket<WebSocketData>): void {
  const set = connections.get(canvasId)
  if (set) {
    set.delete(ws)
    if (set.size === 0) {
      connections.delete(canvasId)
    }
  }
}

export function getConnectionCount(canvasId: string): number {
  return connections.get(canvasId)?.size ?? 0
}

export function sendReload(canvasId: string, code: string): void {
  const set = connections.get(canvasId)
  if (!set) return

  const message: ServerMessage = {
    type: "reload",
    code,
  }

  const payload = JSON.stringify(message)
  for (const ws of set) {
    ws.send(payload)
  }
}

export function requestScreenshot(canvasId: string): void {
  const set = connections.get(canvasId)
  if (!set) return

  const message: ServerMessage = {
    type: "screenshot-request",
  }

  const payload = JSON.stringify(message)
  for (const ws of set) {
    ws.send(payload)
  }
}

export async function handleEvent(
  canvasId: string,
  event: string,
  data: unknown,
  canvasDir: string
): Promise<void> {
  await appendLog(canvasDir, canvasId, eventEntry(event, data))
}

export async function handleScreenshot(
  canvasId: string,
  dataUrl: string,
  canvasDir: string
): Promise<void> {
  const canvas = getCanvas(canvasId)
  if (!canvas) return

  // dataUrl is like "data:image/png;base64,iVBORw0KGgo..."
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")

  const screenshotPath = join(canvas.path, "_screenshot.png")
  await writeFile(screenshotPath, buffer)

  // Log the screenshot event
  await appendLog(canvasDir, canvasId, screenshotEntry(screenshotPath))
}

export async function handleError(canvasId: string, message: string, canvasDir: string): Promise<void> {
  await appendLog(canvasDir, canvasId, noticeEntry("error", "runtime", message))
  console.error(`Canvas ${canvasId} error: ${message}`)
}

export async function handleNotices(
  canvasId: string,
  notices: BrowserNotice[],
  canvasDir: string
): Promise<void> {
  if (notices.length === 0) return

  const entries = notices.map(n =>
    noticeEntry(n.severity, n.category, n.message, n.details)
  )

  await appendLogs(canvasDir, canvasId, entries)
  console.log(`Canvas ${canvasId}: ${summarizeNotices(entries as Omit<NoticeLogEntry, "ts">[])}`)
}

export function broadcast(canvasId: string, message: ServerMessage): void {
  const set = connections.get(canvasId)
  if (!set) return

  const payload = JSON.stringify(message)
  for (const ws of set) {
    ws.send(payload)
  }
}

export function sendStateUpdate(canvasId: string, state: Record<string, unknown>): void {
  const set = connections.get(canvasId)
  if (!set) return

  const message: ServerMessage = {
    type: "state-update",
    state,
  }

  const payload = JSON.stringify(message)
  for (const ws of set) {
    ws.send(payload)
  }
}

export async function handleSetState(
  canvasId: string,
  state: Record<string, unknown>,
  canvasDir: string
): Promise<void> {
  const statePath = join(canvasDir, canvasId, "_state.json")
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8")
}

// Broadcast to ALL connected clients across all canvases
export function broadcastCanvasesUpdate(canvases: CanvasInfo[]): void {
  const message: ServerMessage = {
    type: "canvases-updated",
    canvases,
  }
  const payload = JSON.stringify(message)

  for (const set of connections.values()) {
    for (const ws of set) {
      ws.send(payload)
    }
  }
}

// Send compiled components to a specific canvas
export function sendComponents(canvasId: string, components: Record<string, string>): void {
  const set = connections.get(canvasId)
  if (!set) return

  const message: ServerMessage = {
    type: "components-update",
    components,
  }

  const payload = JSON.stringify(message)
  for (const ws of set) {
    ws.send(payload)
  }
}

// Broadcast components update to ALL connected clients
export function broadcastComponentsUpdate(components: Record<string, string>): void {
  const message: ServerMessage = {
    type: "components-update",
    components,
  }
  const payload = JSON.stringify(message)

  for (const set of connections.values()) {
    for (const ws of set) {
      ws.send(payload)
    }
  }
}
