import { join, dirname } from "path"
import {
  buildBrowserBundle,
  getScopeInfo,
} from "./src/server/scope-builder"
import {
  buildTailwindCSS,
  getTailwindInfo,
} from "./src/server/tailwind-builder"

const SERVER_ROOT = dirname(import.meta.path)
const PROJECT_ROOT = process.cwd()
const DIST_DIR = join(SERVER_ROOT, "dist")

console.log("Building browser-canvas...")

const buildOptions = {
  serverRoot: SERVER_ROOT,
  projectRoot: PROJECT_ROOT,
  outdir: DIST_DIR
}

// Check for project extensions
const scopeInfo = await getScopeInfo(PROJECT_ROOT)
const tailwindInfo = await getTailwindInfo(PROJECT_ROOT)

if (scopeInfo.hasProjectExtension) {
  console.log(`Found project scope extension at: ${scopeInfo.projectScopePath}`)
}
if (tailwindInfo.hasProjectConfig) {
  console.log(`Found project Tailwind config at: ${tailwindInfo.projectConfigPath}`)
}

// Build browser bundle
console.log("Building browser bundle...")
const jsResult = await buildBrowserBundle(buildOptions)
if (!jsResult.success) {
  console.error("Browser bundle build failed:", jsResult.error)
  process.exit(1)
}
console.log("Browser bundle built successfully")

// Build Tailwind CSS
console.log("Building Tailwind CSS...")
const cssResult = await buildTailwindCSS(buildOptions)
if (!cssResult.success) {
  console.error("Tailwind CSS build failed:", cssResult.error)
  process.exit(1)
}
console.log("Tailwind CSS built successfully")

console.log("Build complete!")
