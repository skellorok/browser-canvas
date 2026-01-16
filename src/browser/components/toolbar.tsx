import React, { useState, useRef, useEffect } from "react"

export interface CanvasInfo {
  id: string
  name: string
  hasCode: boolean
}

interface ToolbarProps {
  currentCanvasId: string
  canvases: CanvasInfo[]
  isConnected: boolean
}

export function Toolbar({ currentCanvasId, canvases, isConnected }: ToolbarProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleCanvasSelect = (canvasId: string) => {
    if (canvasId !== currentCanvasId) {
      window.location.href = `/canvas/${canvasId}`
    }
    setIsOpen(false)
  }

  return (
    <div className="h-9 bg-zinc-100 border-b border-zinc-200 flex items-center px-3 gap-3 shrink-0">
      {/* Logo and branding */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-amber-500 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">◆</span>
        </div>
        <span className="text-sm font-medium text-zinc-700">Claude Canvas</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-zinc-300" />

      {/* Canvas selector dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 rounded transition-colors"
        >
          <span className="max-w-[200px] truncate">{currentCanvasId}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-white rounded-md shadow-lg border border-zinc-200 py-1 z-50">
            {canvases.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-400">No artifacts found</div>
            ) : (
              canvases.map((canvas) => (
                <button
                  key={canvas.id}
                  onClick={() => handleCanvasSelect(canvas.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 flex items-center gap-2 ${
                    canvas.id === currentCanvasId
                      ? "text-orange-600 bg-orange-50"
                      : "text-zinc-700"
                  }`}
                >
                  {canvas.id === currentCanvasId && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <span className={canvas.id === currentCanvasId ? "" : "ml-5"}>{canvas.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-green-500" : "bg-zinc-300"
          }`}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
    </div>
  )
}
