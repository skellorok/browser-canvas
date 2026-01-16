import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { useRunner } from "react-runner"
import { domToPng } from "modern-screenshot"
import { scope } from "./scope"
import { initEventBridge, cleanupEventBridge } from "./event-bridge"
import { initStateBridge, cleanupStateBridge, handleStateUpdate } from "./use-canvas-state"
import { Toolbar, type CanvasInfo } from "./components/toolbar"
import { runBrowserChecks, summarizeNotices, type Notice } from "./linter"

interface WebSocketMessage {
  type: "reload" | "screenshot-request" | "canvases-updated" | "state-update" | "components-update"
  code?: string
  canvases?: CanvasInfo[]
  state?: Record<string, unknown>
  components?: Record<string, string>  // { ComponentName: "compiled JS code" }
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback: (error: Error) => React.ReactNode
  onError?: (error: Error) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Canvas error:", error, errorInfo)
    // Report error to parent for server notification
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error)
    }
    return this.props.children
  }
}

function getCanvasIdFromPath(): string | null {
  const path = window.location.pathname
  const match = path.match(/^\/canvas\/([^/]+)/)
  return match ? match[1] : null
}

function ErrorDisplay({ error, code }: { error: Error | string, code?: string }): React.ReactElement {
  const errorMessage = typeof error === "string" ? error : error.message
  const errorStack = typeof error === "string" ? undefined : error.stack

  return (
    <div className="min-h-screen bg-red-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 overflow-hidden">
          <div className="bg-red-500 text-white px-6 py-4">
            <h1 className="text-xl font-semibold">Canvas Error</h1>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-sm font-medium text-red-800 uppercase tracking-wide mb-2">
                Error Message
              </h2>
              <pre className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm overflow-auto">
                {errorMessage}
              </pre>
            </div>
            {errorStack && (
              <div>
                <h2 className="text-sm font-medium text-red-800 uppercase tracking-wide mb-2">
                  Stack Trace
                </h2>
                <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-gray-700 text-xs overflow-auto max-h-48">
                  {errorStack}
                </pre>
              </div>
            )}
            {code && (
              <div>
                <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Source Code
                </h2>
                <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-gray-700 text-xs overflow-auto max-h-96">
                  {code}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingDisplay(): React.ReactElement {
  return (
    <div className="flex-1 bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-500 mb-4" />
        <p className="text-gray-600 text-lg">Waiting for canvas code...</p>
        <p className="text-gray-400 text-sm mt-2">
          Write to App.jsx to render your component
        </p>
      </div>
    </div>
  )
}

interface CanvasRunnerProps {
  code: string
  runnerScope: Record<string, unknown>
  onError?: (error: unknown) => void
  onRender?: (element: HTMLElement | null) => void
}

function CanvasRunner({ code, runnerScope, onError, onRender }: CanvasRunnerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  const { element, error } = useRunner({
    code,
    scope: runnerScope
  })

  // Report errors to parent when they occur
  useEffect(() => {
    if (error && onError) {
      // useRunner returns error as string or Error
      onError(error)
    }
  }, [error, onError])

  // Notify parent when render is successful (for linting)
  useEffect(() => {
    if (!error && element && onRender) {
      // Small delay to ensure DOM is fully rendered
      const timeout = setTimeout(() => {
        onRender(containerRef.current)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [element, error, onRender])

  if (error) {
    return <ErrorDisplay error={error} code={code} />
  }

  return <div ref={containerRef}>{element}</div>
}

/**
 * Evaluate compiled component code and return the component function
 * The compiled code defines a function like: function ContactForm({...}) {...}
 * We wrap it to extract and return that function.
 *
 * IMPORTANT: We inject scope as local variable declarations so the component
 * function captures them in closure. Without this, identifiers like Markdown
 * would be undefined at render time.
 */
function evalComponent(name: string, compiledCode: string, baseScope: Record<string, unknown>): React.FC | null {
  try {
    // Generate local variable declarations from scope
    // This ensures the component function closes over these values
    // Filter out invalid JS identifiers (e.g., keys with dashes)
    const scopeKeys = Object.keys(baseScope).filter(key => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key))
    const scopeDeclarations = scopeKeys
      .map(key => `const ${key} = __scope__["${key}"];`)
      .join("\n")

    // Wrap code with scope declarations, then return the component
    const wrappedCode = `
${scopeDeclarations}
${compiledCode}
return typeof ${name} === 'function' ? ${name} : null;
`

    // Create factory that receives scope object and evaluate
    const factory = new Function("__scope__", wrappedCode)
    const component = factory(baseScope)

    return component
  } catch (error) {
    console.error(`Failed to evaluate component ${name}:`, error)
    return null
  }
}

function App(): React.ReactElement {
  const [code, setCode] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [canvases, setCanvases] = useState<CanvasInfo[]>([])
  const [dynamicComponents, setDynamicComponents] = useState<Record<string, React.FC>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canvasId = getCanvasIdFromPath()

  // Merge base scope with dynamic components
  const mergedScope = useMemo(() => ({
    ...scope,
    ...dynamicComponents
  }), [dynamicComponents])

  // Fetch initial canvases list
  useEffect(() => {
    fetch("/api/canvases")
      .then((res) => res.json())
      .then((data) => {
        if (data.canvases) {
          setCanvases(data.canvases)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch canvases:", err)
      })
  }, [])

  // Report canvas errors to server so agent can read them
  const reportError = useCallback((error: Error | unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    let message: string
    if (error instanceof Error) {
      message = `${error.name}: ${error.message}${error.stack ? `\n\nStack:\n${error.stack}` : ""}`
    } else if (typeof error === "string") {
      message = error
    } else {
      message = String(error)
    }

    wsRef.current.send(JSON.stringify({
      type: "error",
      message
    }))
  }, [])

  // Report notices to server (unified errors, warnings, lints)
  const reportNotices = useCallback((notices: Notice[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (notices.length === 0) return

    wsRef.current.send(JSON.stringify({
      type: "notices",
      notices
    }))

    // Also log to console for debugging
    console.log(`Canvas checks: ${summarizeNotices(notices)}`)
  }, [])

  // Run browser-side checks after successful render
  const handleRender = useCallback((element: HTMLElement | null) => {
    if (!element) return

    // Debounce checks to avoid running multiple times during rapid updates
    const timeout = setTimeout(async () => {
      try {
        const notices = await runBrowserChecks(element)
        if (notices.length > 0) {
          reportNotices(notices)
        }
      } catch (err) {
        console.error("Browser checks failed:", err)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [reportNotices])

  const captureScreenshot = useCallback(async () => {
    if (!canvasRef.current || !wsRef.current) return

    try {
      // Use modern-screenshot for better text rendering
      // HSL 222.2 84% 4.9% = #030712 (dark blue-gray)
      const dataUrl = await domToPng(canvasRef.current, {
        backgroundColor: "#030712",
        scale: 2,
      })

      wsRef.current.send(JSON.stringify({
        type: "screenshot",
        dataUrl
      }))
    } catch (err) {
      console.error("Screenshot capture failed:", err)
      wsRef.current?.send(JSON.stringify({
        type: "error",
        message: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`
      }))
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    if (!canvasId) {
      setConnectionError("No canvas ID found in URL. Expected format: /canvas/:id")
      setIsConnecting(false)
      return
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/ws/${canvasId}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnecting(false)
        setIsConnected(true)
        setConnectionError(null)
        initEventBridge(ws)
        initStateBridge(ws)
        console.log(`Canvas ${canvasId} connected`)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          switch (message.type) {
            case "reload":
              if (message.code !== undefined) {
                setCode(message.code)
              }
              break
            case "screenshot-request":
              captureScreenshot()
              break
            case "canvases-updated":
              if (message.canvases) {
                setCanvases(message.canvases)
              }
              break
            case "state-update":
              if (message.state) {
                handleStateUpdate(message.state)
              }
              break
            case "components-update":
              if (message.components) {
                // Evaluate each compiled component and add to dynamic components
                const newComponents: Record<string, React.FC> = {}
                for (const [name, compiledCode] of Object.entries(message.components)) {
                  const component = evalComponent(name, compiledCode, scope)
                  if (component) {
                    newComponents[name] = component
                  }
                }
                setDynamicComponents(newComponents)
                console.log(`Loaded ${Object.keys(newComponents).length} dynamic component(s)`)
              }
              break
            default:
              console.warn("Unknown message type:", message)
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err)
        }
      }

      ws.onerror = (event) => {
        console.error("WebSocket error:", event)
      }

      ws.onclose = (event) => {
        cleanupEventBridge()
        cleanupStateBridge()
        wsRef.current = null
        setIsConnected(false)

        if (!event.wasClean) {
          setConnectionError("Connection lost. Attempting to reconnect...")
          setIsConnecting(true)

          // Attempt to reconnect after 2 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, 2000)
        }
      }
    } catch (err) {
      setConnectionError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`)
      setIsConnecting(false)
    }
  }, [canvasId, captureScreenshot])

  useEffect(() => {
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      cleanupEventBridge()
      cleanupStateBridge()
    }
  }, [connectWebSocket])

  if (connectionError && !isConnecting) {
    return <ErrorDisplay error={connectionError} />
  }

  if (isConnecting || code === null) {
    return (
      <div className="h-screen flex flex-col">
        <Toolbar
          currentCanvasId={canvasId || "unknown"}
          canvases={canvases}
          isConnected={isConnected}
        />
        <LoadingDisplay />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Toolbar
        currentCanvasId={canvasId || "unknown"}
        canvases={canvases}
        isConnected={isConnected}
      />
      <ErrorBoundary
        fallback={(error) => <ErrorDisplay error={error} code={code} />}
        onError={reportError}
      >
        <div ref={canvasRef} className="flex-1 overflow-auto" style={{ backgroundColor: "#030712" }}>
          <CanvasRunner code={code} runnerScope={mergedScope} onError={reportError} onRender={handleRender} />
        </div>
      </ErrorBoundary>
    </div>
  )
}

// Initialize the app
const rootElement = document.getElementById("root")
if (rootElement) {
  const root = createRoot(rootElement)
  root.render(<App />)
} else {
  console.error("Root element not found")
}
