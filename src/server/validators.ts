import { Linter } from "eslint"
import { noticeEntry, type NoticeLogEntry, type NoticeSeverity } from "./log"

// Validator notice type (without timestamp - added when logging)
type ValidatorNotice = Omit<NoticeLogEntry, "ts">

// ESLint flat config for JSX (ESLint 9+)
const eslintConfig: Linter.Config[] = [
  {
    files: ["**/*.jsx", "**/*.tsx", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        // React globals (provided by scope)
        React: "readonly",
        useState: "readonly",
        useEffect: "readonly",
        useCallback: "readonly",
        useMemo: "readonly",
        useRef: "readonly",
        useReducer: "readonly",
        useCanvasState: "readonly",
        // Utilities
        cn: "readonly",
        format: "readonly",
        Markdown: "readonly",
        remarkGfm: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "no-constant-condition": "warn",
      "no-debugger": "warn",
      "no-duplicate-case": "error",
      "no-empty": "warn",
      "no-extra-semi": "warn",
      "no-unreachable": "error",
      "valid-typeof": "error",
    },
  }
]

const linter = new Linter({ configType: "flat" })

export function validateESLint(code: string): ValidatorNotice[] {
  const notices: ValidatorNotice[] = []

  try {
    const messages = linter.verify(code, eslintConfig, { filename: "App.jsx" })

    for (const msg of messages) {
      // Skip config warnings that aren't actual code issues
      if (msg.message.includes("No matching configuration found")) {
        continue
      }

      const severity: NoticeSeverity = msg.severity === 2 ? "error" : "warning"
      notices.push(
        noticeEntry(severity, "eslint", msg.message, {
          ruleId: msg.ruleId,
          line: msg.line,
          column: msg.column,
          endLine: msg.endLine,
          endColumn: msg.endColumn,
        })
      )
    }
  } catch (err) {
    notices.push(
      noticeEntry("error", "eslint", `ESLint failed: ${err}`)
    )
  }

  return notices
}

// Scope validation - check that code only uses available identifiers
export function validateScope(code: string, availableIdentifiers: string[]): ValidatorNotice[] {
  const notices: ValidatorNotice[] = []
  const identifierSet = new Set(availableIdentifiers)

  // Find function/class declarations to exclude from scope checking
  // Matches: function Name, const Name =, class Name
  const declarationPattern = /(?:function|const|let|var|class)\s+([A-Z][a-zA-Z0-9]*)/g
  const declaredIdentifiers = new Set<string>()
  let match
  while ((match = declarationPattern.exec(code)) !== null) {
    declaredIdentifiers.add(match[1])
  }

  // Find JSX component usage: <ComponentName
  const componentPattern = /<([A-Z][a-zA-Z0-9]*)/g
  const usedIdentifiers = new Set<string>()

  while ((match = componentPattern.exec(code)) !== null) {
    usedIdentifiers.add(match[1])
  }

  for (const identifier of usedIdentifiers) {
    // Skip if declared in this file
    if (declaredIdentifiers.has(identifier)) {
      continue
    }

    // Skip common globals and React internals
    if (["React", "Array", "Object", "String", "Number", "Boolean", "Date", "Math", "JSON", "Promise", "Error", "Map", "Set", "Symbol", "RegExp", "Intl"].includes(identifier)) {
      continue
    }

    if (!identifierSet.has(identifier)) {
      notices.push(
        noticeEntry("error", "scope", `'${identifier}' is not available in scope`, {
          identifier,
          suggestion: findSimilar(identifier, availableIdentifiers),
        })
      )
    }
  }

  return notices
}

// Find similar identifiers for suggestions
function findSimilar(target: string, candidates: string[]): string | undefined {
  const lower = target.toLowerCase()
  for (const candidate of candidates) {
    if (candidate.toLowerCase().includes(lower) || lower.includes(candidate.toLowerCase())) {
      return candidate
    }
  }
  return undefined
}

// Tailwind validation - check for invalid class names
export function validateTailwind(code: string, validClasses: Set<string>): ValidatorNotice[] {
  const notices: ValidatorNotice[] = []

  // Extract className strings
  const classNamePattern = /className=["'`]([^"'`]+)["'`]/g
  const cnPattern = /cn\s*\(\s*["'`]([^"'`]+)["'`]/g

  const extractedClasses = new Set<string>()

  let match
  while ((match = classNamePattern.exec(code)) !== null) {
    const classes = match[1].split(/\s+/)
    for (const cls of classes) {
      if (cls.trim()) extractedClasses.add(cls.trim())
    }
  }
  while ((match = cnPattern.exec(code)) !== null) {
    const classes = match[1].split(/\s+/)
    for (const cls of classes) {
      if (cls.trim()) extractedClasses.add(cls.trim())
    }
  }

  for (const cls of extractedClasses) {
    // Skip dynamic classes, CSS variables, and conditional expressions
    if (cls.includes("${") || cls.includes("[") || cls.includes("var(")) {
      continue
    }

    // Skip if it's a valid class or has a valid prefix
    const baseClass = cls.replace(/^(hover:|focus:|active:|disabled:|sm:|md:|lg:|xl:|2xl:|dark:|group-hover:)+/, "")

    if (!validClasses.has(baseClass) && !isLikelyValidClass(baseClass)) {
      notices.push(
        noticeEntry("warning", "tailwind", `Unknown Tailwind class: '${cls}'`, {
          class: cls,
          baseClass,
        })
      )
    }
  }

  return notices
}

// Heuristic check for valid Tailwind patterns
function isLikelyValidClass(cls: string): boolean {
  // Common valid patterns
  const patterns = [
    /^(bg|text|border|ring|shadow|rounded|p|m|w|h|min|max|flex|grid|gap|space|font|leading|tracking|z|opacity|scale|rotate|translate|skew|origin|cursor|select|resize|scroll|snap|touch|transition|duration|ease|delay|animate)-/,
    /^(items|justify|content|place|self|order|col|row|auto|float|clear|isolate|object|overflow|overscroll|visible|invisible|static|fixed|absolute|relative|sticky|inset|top|right|bottom|left)-/,
    /^(block|inline|hidden|sr-only|not-sr-only|antialiased|subpixel-antialiased|italic|not-italic|ordinal|slashed-zero|lining-nums|oldstyle-nums|proportional-nums|tabular-nums|diagonal-fractions|stacked-fractions)$/,
    /^(underline|overline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|truncate|break-|whitespace-)/,
    /^(list-|decoration-|outline-|accent-|caret-|fill-|stroke-)/,
    /^(aspect-|columns-|break-|box-)/,
    /^(from-|via-|to-|bg-gradient-)/,
    /^line-clamp-/,
  ]

  return patterns.some(p => p.test(cls))
}

// Bundle size check
export function validateBundleSize(code: string): ValidatorNotice[] {
  const notices: ValidatorNotice[] = []

  const sizeKB = Buffer.byteLength(code, "utf-8") / 1024

  if (sizeKB > 100) {
    notices.push(
      noticeEntry("error", "bundle", `Very large component: ${sizeKB.toFixed(1)}KB`, {
        sizeKB: Math.round(sizeKB * 10) / 10,
        threshold: 100,
      })
    )
  } else if (sizeKB > 50) {
    notices.push(
      noticeEntry("warning", "bundle", `Large component: ${sizeKB.toFixed(1)}KB (consider splitting)`, {
        sizeKB: Math.round(sizeKB * 10) / 10,
        threshold: 50,
      })
    )
  }

  return notices
}

// Run all server-side validators
export function runServerValidators(
  code: string,
  scopeIdentifiers: string[],
  tailwindClasses?: Set<string>
): ValidatorNotice[] {
  const notices: ValidatorNotice[] = []

  // ESLint validation
  notices.push(...validateESLint(code))

  // Scope validation
  notices.push(...validateScope(code, scopeIdentifiers))

  // Tailwind validation (if classes provided)
  if (tailwindClasses) {
    notices.push(...validateTailwind(code, tailwindClasses))
  }

  // Bundle size
  notices.push(...validateBundleSize(code))

  return notices
}
