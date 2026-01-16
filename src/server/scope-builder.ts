/**
 * Dynamic scope builder for browser-canvas
 *
 * Allows projects to extend the base scope with additional libraries.
 *
 * Project extension file: .claude/canvas/scope.ts
 *
 * Example:
 * ```typescript
 * import ReactMarkdown from 'react-markdown'
 * import remarkGfm from 'remark-gfm'
 *
 * export const extend = {
 *   ReactMarkdown,
 *   remarkGfm
 * }
 * ```
 */

import { join } from "path"
import { readFile, stat, mkdir } from "fs/promises"
import type { BunPlugin } from "bun"

interface BuildScopeOptions {
  serverRoot: string      // Where browser-canvas package is installed
  projectRoot: string     // User's project directory (cwd)
  outdir: string          // Output directory for built files
}

interface BuildResult {
  success: boolean
  jsPath?: string
  error?: string
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Read file contents, return null if doesn't exist
 */
async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}

/**
 * Generate merged scope code with absolute imports
 *
 * Reads base scope and project extension, generates code that merges them.
 * Converts relative imports to absolute paths.
 */
async function generateMergedScope(
  serverRoot: string,
  projectRoot: string
): Promise<{ code: string; hasExtension: boolean }> {
  const baseScopePath = join(serverRoot, "src/browser/scope.ts")
  const projectScopePath = join(projectRoot, ".claude/canvas/scope.ts")
  const browserDir = join(serverRoot, "src/browser")

  // Read base scope
  let baseScope = await readFile(baseScopePath, "utf-8")

  // Convert relative imports to absolute paths
  baseScope = baseScope.replace(
    /from ["']\.\/([^"']+)["']/g,
    (_, path) => `from "${join(browserDir, path).replace(/\\/g, "/")}"`
  )
  baseScope = baseScope.replace(
    /from ["']\.\.\/([^"']+)["']/g,
    (_, path) => `from "${join(serverRoot, "src", path).replace(/\\/g, "/")}"`
  )

  // Check for project extension
  const projectScope = await readFileOrNull(projectScopePath)

  if (!projectScope) {
    // No extension, use base scope as-is (with absolute paths)
    return { code: baseScope, hasExtension: false }
  }

  // Generate merged scope
  // We append the project scope and modify the export to merge
  const mergedCode = `
// ============================================
// Base scope from browser-canvas
// ============================================
${baseScope.replace(/export const scope = \{/, 'const baseScope = {')}

// ============================================
// Project extension from .claude/canvas/scope.ts
// ============================================
${projectScope.replace(/export const extend = \{/, 'const projectExtend = {')}

// ============================================
// Merged scope
// ============================================
export const scope = {
  ...baseScope,
  ...projectExtend
}
`

  return { code: mergedCode, hasExtension: true }
}

/**
 * Create a Bun plugin that intercepts scope imports
 */
function createScopeMergerPlugin(mergedScopeCode: string): BunPlugin {
  return {
    name: "scope-merger",
    setup(build) {
      // Intercept imports of './scope' from app.tsx
      build.onResolve({ filter: /^\.\/scope$/ }, (args) => {
        // Only intercept if coming from the browser directory
        if (args.importer.includes("browser")) {
          return {
            path: "virtual:merged-scope",
            namespace: "merged-scope"
          }
        }
        return undefined
      })

      // Return the merged scope code
      build.onLoad({ filter: /.*/, namespace: "merged-scope" }, () => {
        return {
          contents: mergedScopeCode,
          loader: "tsx"
        }
      })
    }
  }
}

/**
 * Build the browser bundle with merged scope
 */
export async function buildBrowserBundle(options: BuildScopeOptions): Promise<BuildResult> {
  const { serverRoot, projectRoot, outdir } = options

  try {
    // Ensure output directory exists
    await mkdir(outdir, { recursive: true })

    // Generate merged scope
    const { code: mergedScopeCode, hasExtension } = await generateMergedScope(serverRoot, projectRoot)

    if (hasExtension) {
      console.log("Building with project scope extension from .claude/canvas/scope.ts")
    }

    // Build with the scope merger plugin
    const entrypoint = join(serverRoot, "src/browser/app.tsx")

    let result
    try {
      result = await Bun.build({
        entrypoints: [entrypoint],
        outdir,
        naming: "canvas.js",
        target: "browser",
        minify: process.env.NODE_ENV === "production",
        sourcemap: "external",
        define: {
          "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
        },
        plugins: [createScopeMergerPlugin(mergedScopeCode)],
      })
    } catch (buildError) {
      return {
        success: false,
        error: `Bun.build exception: ${buildError instanceof Error ? buildError.message : String(buildError)}`
      }
    }

    if (!result.success) {
      const errors = result.logs.map(log => {
        if (typeof log === 'object' && log !== null) {
          return JSON.stringify(log)
        }
        return String(log)
      }).join("\n")
      return { success: false, error: `Bundle build failed:\n${errors}` }
    }

    return {
      success: true,
      jsPath: join(outdir, "canvas.js")
    }
  } catch (error) {
    const errorMsg = error instanceof Error
      ? `${error.message}\n${error.stack || ''}`
      : String(error)
    return {
      success: false,
      error: `Build error: ${errorMsg}`
    }
  }
}

/**
 * Check if rebuild is needed
 *
 * Returns true if:
 * - Output doesn't exist
 * - Project scope extension is newer than output
 * - Base scope is newer than output (dev mode)
 */
export async function needsRebuild(options: BuildScopeOptions): Promise<boolean> {
  const { serverRoot, projectRoot, outdir } = options

  const outputPath = join(outdir, "canvas.js")
  const baseScopePath = join(serverRoot, "src/browser/scope.ts")
  const projectScopePath = join(projectRoot, ".claude/canvas/scope.ts")

  // Check if output exists
  if (!await fileExists(outputPath)) {
    return true
  }

  const outputStat = await stat(outputPath)
  const outputMtime = outputStat.mtimeMs

  // Check if base scope is newer (dev mode)
  if (await fileExists(baseScopePath)) {
    const baseStat = await stat(baseScopePath)
    if (baseStat.mtimeMs > outputMtime) {
      return true
    }
  }

  // Check if project scope is newer
  if (await fileExists(projectScopePath)) {
    const projectStat = await stat(projectScopePath)
    if (projectStat.mtimeMs > outputMtime) {
      return true
    }
  }

  return false
}

/**
 * Get info about scope extensions
 */
export async function getScopeInfo(projectRoot: string): Promise<{
  hasProjectExtension: boolean
  projectScopePath: string
}> {
  const projectScopePath = join(projectRoot, ".claude/canvas/scope.ts")
  return {
    hasProjectExtension: await fileExists(projectScopePath),
    projectScopePath
  }
}
