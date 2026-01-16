import { useState, useEffect, useCallback, useRef } from "react"

type CanvasState = Record<string, unknown>
type SetCanvasState = (state: CanvasState | ((prev: CanvasState) => CanvasState)) => void

// Global state and listeners for sharing across components
let globalState: CanvasState = {}
let globalWs: WebSocket | null = null
const listeners = new Set<(state: CanvasState) => void>()

function notifyListeners(state: CanvasState): void {
  globalState = state
  for (const listener of listeners) {
    listener(state)
  }
}

// Initialize state bridge - called from app.tsx when WebSocket connects
export function initStateBridge(ws: WebSocket): void {
  globalWs = ws
}

// Clean up state bridge
export function cleanupStateBridge(): void {
  globalWs = null
  globalState = {}
}

// Handle incoming state update from server
export function handleStateUpdate(state: CanvasState): void {
  notifyListeners(state)
}

// Send state to server
function sendState(state: CanvasState): void {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({
      type: "set-state",
      state
    }))
  }
}

/**
 * React hook for two-way state sync with the agent.
 *
 * @example
 * function App() {
 *   const [state, setState] = useCanvasState();
 *
 *   return (
 *     <div>
 *       <p>Step: {state.step}</p>
 *       <Button onClick={() => setState({ ...state, confirmed: true })}>
 *         Confirm
 *       </Button>
 *     </div>
 *   );
 * }
 */
export function useCanvasState(): [CanvasState, SetCanvasState] {
  const [state, setLocalState] = useState<CanvasState>(globalState)
  const stateRef = useRef(state)
  stateRef.current = state

  // Subscribe to global state updates
  useEffect(() => {
    const listener = (newState: CanvasState) => {
      setLocalState(newState)
    }
    listeners.add(listener)

    // Sync with current global state
    if (Object.keys(globalState).length > 0) {
      setLocalState(globalState)
    }

    return () => {
      listeners.delete(listener)
    }
  }, [])

  // Setter that updates locally and sends to server
  const setState: SetCanvasState = useCallback((update) => {
    const newState = typeof update === "function"
      ? update(stateRef.current)
      : update

    // Update local state immediately
    setLocalState(newState)
    globalState = newState

    // Send to server (will propagate to agent's _state.json)
    sendState(newState)
  }, [])

  return [state, setState]
}

// Expose on window for simple access without hook
declare global {
  interface Window {
    canvasState: CanvasState
    setCanvasState: (state: CanvasState) => void
  }
}

// Set up window globals
if (typeof window !== "undefined") {
  Object.defineProperty(window, "canvasState", {
    get: () => globalState,
    configurable: true
  })

  window.setCanvasState = (state: CanvasState) => {
    notifyListeners(state)
    sendState(state)
  }
}
