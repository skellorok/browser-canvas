/**
 * Dynamic Tailwind CSS builder for browser-canvas
 *
 * Allows projects to extend the base Tailwind config with additional plugins.
 *
 * Project config file: .claude/canvas/tailwind.config.js
 *
 * Example:
 * ```javascript
 * // .claude/canvas/tailwind.config.js
 * export default {
 *   plugins: [
 *     require('@tailwindcss/typography'),
 *     require('@tailwindcss/forms'),
 *   ],
 *   theme: {
 *     extend: {
 *       colors: {
 *         brand: '#ff6b6b',
 *       }
 *     }
 *   }
 * }
 * ```
 */

import { join } from "path"
import { stat, mkdir, writeFile, readFile, appendFile } from "fs/promises"
import { $ } from "bun"

interface BuildTailwindOptions {
  serverRoot: string      // Where browser-canvas package is installed
  projectRoot: string     // User's project directory (cwd)
  outdir: string          // Output directory for built files
}

interface BuildResult {
  success: boolean
  cssPath?: string
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
 * Generate merged Tailwind config
 *
 * Creates a wrapper config that imports both base and project configs
 * and merges them at runtime. This properly handles plugins.
 */
async function generateMergedConfig(
  serverRoot: string,
  projectRoot: string,
  tempDir: string
): Promise<{ configPath: string; hasExtension: boolean }> {
  const baseConfigPath = join(serverRoot, "tailwind.config.js")
  const projectConfigPath = join(projectRoot, ".claude/canvas/tailwind.config.js")

  // Check for project extension
  const hasProjectConfig = await fileExists(projectConfigPath)

  if (!hasProjectConfig) {
    // No extension, use base config
    return { configPath: baseConfigPath, hasExtension: false }
  }

  // Content paths to scan for classes
  const contentPaths = [
    join(serverRoot, "src/browser/**/*.{ts,tsx,html}"),
    join(projectRoot, ".claude/canvas/components/**/*.jsx"),
    join(serverRoot, "skills/canvas/components/**/*.jsx"),
    join(projectRoot, ".claude/artifacts/**/*.jsx"),
  ]

  // Generate a wrapper config that does runtime merging
  // This properly handles plugins since they're evaluated at runtime
  const configContent = `
// Auto-generated merged Tailwind config
// Do not edit - regenerated on server start

import baseConfig from "${baseConfigPath.replace(/\\/g, "/")}"
import projectConfig from "${projectConfigPath.replace(/\\/g, "/")}"

// Deep merge helper
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      result[key] = [...target[key], ...source[key]]
    } else if (
      source[key] instanceof Object &&
      target[key] instanceof Object &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

// Merge configs
const merged = deepMerge(baseConfig, projectConfig)

// Override content paths with absolute paths
merged.content = ${JSON.stringify(contentPaths)}

export default merged
`

  // Write merged config to temp directory
  await mkdir(tempDir, { recursive: true })
  const mergedConfigPath = join(tempDir, "tailwind.config.js")
  await writeFile(mergedConfigPath, configContent, "utf-8")

  return { configPath: mergedConfigPath, hasExtension: true }
}

/**
 * Build Tailwind CSS with merged config
 */
export async function buildTailwindCSS(options: BuildTailwindOptions): Promise<BuildResult> {
  const { serverRoot, projectRoot, outdir } = options
  const tempDir = join(serverRoot, ".tailwind-build")

  try {
    // Ensure output directory exists
    await mkdir(outdir, { recursive: true })

    // Generate merged config
    const { configPath, hasExtension } = await generateMergedConfig(
      serverRoot,
      projectRoot,
      tempDir
    )

    if (hasExtension) {
      console.log("Building Tailwind with project config from .claude/canvas/tailwind.config.js")
    }

    // Input CSS path
    const inputCss = join(serverRoot, "src/browser/styles.css")
    const outputCss = join(outdir, "canvas.css")

    // Run Tailwind build
    await $`bunx tailwindcss -i ${inputCss} -o ${outputCss} --config ${configPath} --minify`.quiet()

    // Append custom CSS if it exists
    const customCssPath = join(projectRoot, ".claude/canvas/styles.css")
    if (await fileExists(customCssPath)) {
      console.log("Appending custom styles from .claude/canvas/styles.css")
      const customCss = await readFile(customCssPath, "utf-8")
      await appendFile(outputCss, `\n/* Custom styles from .claude/canvas/styles.css */\n${customCss}`)
    }

    return {
      success: true,
      cssPath: outputCss
    }
  } catch (error) {
    return {
      success: false,
      error: `Tailwind build failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Check if Tailwind rebuild is needed
 */
export async function needsTailwindRebuild(options: BuildTailwindOptions): Promise<boolean> {
  const { serverRoot, projectRoot, outdir } = options

  const outputPath = join(outdir, "canvas.css")
  const baseConfigPath = join(serverRoot, "tailwind.config.js")
  const projectConfigPath = join(projectRoot, ".claude/canvas/tailwind.config.js")
  const inputCssPath = join(serverRoot, "src/browser/styles.css")

  // Check if output exists
  if (!await fileExists(outputPath)) {
    return true
  }

  const outputStat = await stat(outputPath)
  const outputMtime = outputStat.mtimeMs

  // Check if base config is newer
  if (await fileExists(baseConfigPath)) {
    const configStat = await stat(baseConfigPath)
    if (configStat.mtimeMs > outputMtime) {
      return true
    }
  }

  // Check if project config is newer
  if (await fileExists(projectConfigPath)) {
    const projectStat = await stat(projectConfigPath)
    if (projectStat.mtimeMs > outputMtime) {
      return true
    }
  }

  // Check if input CSS is newer
  if (await fileExists(inputCssPath)) {
    const inputStat = await stat(inputCssPath)
    if (inputStat.mtimeMs > outputMtime) {
      return true
    }
  }

  // Check if custom CSS is newer
  const customCssPath = join(projectRoot, ".claude/canvas/styles.css")
  if (await fileExists(customCssPath)) {
    const customStat = await stat(customCssPath)
    if (customStat.mtimeMs > outputMtime) {
      return true
    }
  }

  return false
}

/**
 * Get info about Tailwind config and custom styles
 */
export async function getTailwindInfo(projectRoot: string): Promise<{
  hasProjectConfig: boolean
  projectConfigPath: string
  hasCustomStyles: boolean
  customStylesPath: string
}> {
  const projectConfigPath = join(projectRoot, ".claude/canvas/tailwind.config.js")
  const customStylesPath = join(projectRoot, ".claude/canvas/styles.css")
  return {
    hasProjectConfig: await fileExists(projectConfigPath),
    projectConfigPath,
    hasCustomStyles: await fileExists(customStylesPath),
    customStylesPath
  }
}
