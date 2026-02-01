import { readFile } from "fs/promises"
import { join } from "path"
import { exec } from "child_process"

export interface Canvas {
  id: string
  path: string
  createdAt: Date
  url: string
}

const canvases = new Map<string, Canvas>()

export function getCanvas(id: string): Canvas | undefined {
  return canvases.get(id)
}

export function getCanvasList(): Canvas[] {
  return Array.from(canvases.values())
}

export function hasCanvas(id: string): boolean {
  return canvases.has(id)
}

export interface OpenCanvasOptions {
  openBrowser?: boolean
}

// Check if browser opening is disabled via BROWSER=none env var
function shouldOpenBrowser(): boolean {
  return process.env.BROWSER !== "none"
}

export async function openCanvas(
  id: string,
  path: string,
  port: number,
  options: OpenCanvasOptions = {}
): Promise<Canvas> {
  const { openBrowser = true } = options
  const url = `http://127.0.0.1:${port}/canvas/${id}`

  const canvas: Canvas = {
    id,
    path,
    createdAt: new Date(),
    url,
  }

  canvases.set(id, canvas)

  // Open browser tab (unless disabled via option or BROWSER=none env var)
  if (openBrowser && shouldOpenBrowser()) {
    exec(`open "${url}"`, (error) => {
      if (error) {
        console.error(`Failed to open browser for canvas ${id}:`, error.message)
      }
    })
  }

  return canvas
}

export function closeCanvas(id: string): boolean {
  return canvases.delete(id)
}

export async function readCanvasCode(id: string): Promise<string | null> {
  const canvas = canvases.get(id)
  if (!canvas) {
    return null
  }

  const appPath = join(canvas.path, "App.jsx")
  try {
    const code = await readFile(appPath, "utf-8")
    return code
  } catch {
    return null
  }
}

export function getActiveCanvasIds(): string[] {
  return Array.from(canvases.keys())
}
