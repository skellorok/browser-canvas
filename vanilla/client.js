/**
 * CanvasClient - API for Claude to interact with canvases
 *
 * Usage:
 *   import { CanvasClient } from './client.js'
 *   const client = await CanvasClient.fromServerJson()
 *   await client.screenshot('my-app')
 */

import { readFile } from "fs/promises"
import { join } from "path"

export class CanvasClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
  }

  /**
   * Create client from server.json in artifacts directory
   */
  static async fromServerJson(artifactsDir = ".claude/artifacts") {
    const serverJson = join(process.cwd(), artifactsDir, "server.json")
    const data = JSON.parse(await readFile(serverJson, "utf-8"))
    return new CanvasClient(`http://localhost:${data.port}`)
  }

  /**
   * Check if server is running
   */
  async health() {
    try {
      const res = await fetch(`${this.baseUrl}/api/canvases`)
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * List all canvases
   */
  async list() {
    const res = await fetch(`${this.baseUrl}/api/canvases`)
    const data = await res.json()
    return data.canvases
  }

  /**
   * Take a screenshot of a canvas
   * @param {string} canvasId - Canvas identifier
   * @returns {Promise<{ok: boolean, path?: string}>}
   */
  async screenshot(canvasId) {
    const res = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/screenshot`, {
      method: "POST"
    })
    if (res.ok) {
      // Wait a moment for browser to capture
      await new Promise(r => setTimeout(r, 500))
      return {
        ok: true,
        path: `.claude/artifacts/${canvasId}/_screenshot.png`
      }
    }
    return { ok: false }
  }

  /**
   * Close a canvas
   * @param {string} canvasId - Canvas identifier
   */
  async close(canvasId) {
    await fetch(`${this.baseUrl}/api/canvas/${canvasId}/close`, {
      method: "POST"
    })
  }

  /**
   * Get canvas state
   * @param {string} canvasId - Canvas identifier
   * @returns {Promise<object>}
   */
  async getState(canvasId) {
    const res = await fetch(`${this.baseUrl}/api/canvas/${canvasId}/state`)
    return res.json()
  }

  /**
   * Set canvas state
   * @param {string} canvasId - Canvas identifier
   * @param {object} state - New state
   */
  async setState(canvasId, state) {
    await fetch(`${this.baseUrl}/api/canvas/${canvasId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    })
  }
}
