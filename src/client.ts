/**
 * Browser Canvas Client
 *
 * Programmatic API for interacting with the browser-canvas server.
 *
 * Usage:
 *   import { CanvasClient } from "browser-canvas"
 *   const client = new CanvasClient()
 *   await client.screenshot("my-app")
 */

import { readFile } from "fs/promises"
import { join } from "path"

export interface CanvasInfo {
  id: string
  name: string
  hasCode: boolean
}

export interface ValidationNotice {
  type: "notice"
  severity: "error" | "warning" | "info"
  category: string
  message: string
  details?: Record<string, unknown>
}

export interface ValidationStatus {
  canvasId: string
  hasStatus: boolean
  pending: boolean
  errorCount?: number
  warningCount?: number
  infoCount?: number
  notices?: ValidationNotice[]
}

export interface CanvasClientOptions {
  host?: string
  port?: number
  canvasDir?: string
}

export class CanvasClient {
  private host: string
  private port: number
  private baseUrl: string

  constructor(options: CanvasClientOptions = {}) {
    this.host = options.host ?? "127.0.0.1"
    this.port = options.port ?? 9847
    this.baseUrl = `http://${this.host}:${this.port}`
  }

  /**
   * Create a client by reading server.json for connection info
   */
  static async fromServerJson(artifactsDir?: string): Promise<CanvasClient> {
    const dir = artifactsDir ?? join(process.cwd(), ".claude", "artifacts")
    const serverJsonPath = join(dir, "server.json")

    try {
      const content = await readFile(serverJsonPath, "utf-8")
      const serverState = JSON.parse(content) as {
        host: string
        port: number
        canvasDir: string
      }
      return new CanvasClient({
        host: serverState.host,
        port: serverState.port,
        canvasDir: serverState.canvasDir,
      })
    } catch {
      // Fall back to defaults if server.json doesn't exist
      return new CanvasClient({ canvasDir: dir })
    }
  }

  /**
   * Take a screenshot of a canvas
   * @returns Path to the screenshot file
   */
  async screenshot(canvasId: string): Promise<{ path: string }> {
    const response = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/screenshot`, {
      method: "POST",
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(error.error ?? `Screenshot failed: ${response.status}`)
    }

    const result = await response.json() as { success: boolean; path: string }
    return { path: result.path }
  }

  /**
   * Close a canvas
   */
  async close(canvasId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/close`, {
      method: "POST",
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(error.error ?? `Close failed: ${response.status}`)
    }
  }

  /**
   * Get the current state of a canvas
   */
  async getState(canvasId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/state`)

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(error.error ?? `Get state failed: ${response.status}`)
    }

    const result = await response.json() as { state: Record<string, unknown> }
    return result.state
  }

  /**
   * Set the state of a canvas
   */
  async setState(canvasId: string, state: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(error.error ?? `Set state failed: ${response.status}`)
    }
  }

  /**
   * List all available canvases
   */
  async list(): Promise<CanvasInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/canvases`)

    if (!response.ok) {
      throw new Error(`List canvases failed: ${response.status}`)
    }

    const result = await response.json() as { canvases: CanvasInfo[] }
    return result.canvases
  }

  /**
   * Check if the server is running
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get validation status for a canvas
   * @param wait If true, waits for pending validation to complete
   * @param timeoutMs Timeout for waiting (default 2000ms)
   */
  async getStatus(
    canvasId: string,
    options: { wait?: boolean; timeoutMs?: number } = {}
  ): Promise<ValidationStatus> {
    const { wait = true, timeoutMs = 2000 } = options
    const params = new URLSearchParams()
    if (wait) params.set("wait", "true")
    if (timeoutMs) params.set("timeout", String(timeoutMs))

    const response = await fetch(
      `${this.baseUrl}/api/canvas/${canvasId}/status?${params}`
    )

    if (!response.ok) {
      throw new Error(`Get status failed: ${response.status}`)
    }

    return await response.json() as ValidationStatus
  }
}
