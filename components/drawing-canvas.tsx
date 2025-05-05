"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Trash2, Download, Undo, Redo, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { sendDrawingMessage, getChatDetails } from "@/app/actions/chat-actions"
import { toast } from "@/hooks/use-toast"
import { useSocket } from "@/contexts/socket-context"

interface DrawingCanvasProps {
  chatId: string | null
  currentUser: {
    id: string
    username: string
    avatar_url?: string
  }
}

interface DrawPoint {
  x: number
  y: number
  color: string
  size: number
  type: "start" | "move" | "end"
}

export default function DrawingCanvas({ chatId, currentUser }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState("#000000")
  const [brushSize, setBrushSize] = useState([5])
  const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isSending, setIsSending] = useState(false)
  const [chatDetails, setChatDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { socket, isConnected, joinChat, leaveChat } = useSocket()

  // Load chat details
  useEffect(() => {
    async function fetchChatDetails() {
      if (!chatId) {
        setChatDetails(null)
        return
      }

      setLoading(true)

      try {
        const result = await getChatDetails(chatId)

        if (result.success) {
          setChatDetails(result.chat)
        }
      } catch (error) {
        console.error("Error fetching chat details:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchChatDetails()

    // Join the chat room when chatId changes
    if (chatId) {
      joinChat(chatId)
    }

    // Leave the chat room when component unmounts or chatId changes
    return () => {
      if (chatId) {
        leaveChat(chatId)
      }
    }
  }, [chatId, joinChat, leaveChat])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Set canvas size to match container
    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return

      canvas.width = container.clientWidth
      canvas.height = container.clientHeight - 60 // Subtract toolbar height

      // Redraw canvas after resize
      if (historyIndex >= 0 && drawingHistory[historyIndex]) {
        context.putImageData(drawingHistory[historyIndex], 0, 0)
      } else {
        // Clear canvas
        context.fillStyle = "white"
        context.fillRect(0, 0, canvas.width, canvas.height)

        // Save initial state
        const initialState = context.getImageData(0, 0, canvas.width, canvas.height)
        setDrawingHistory([initialState])
        setHistoryIndex(0)
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [drawingHistory, historyIndex])

  // Set up WebSocket for collaborative drawing
  useEffect(() => {
    if (!socket || !chatId) return

    // Handle incoming drawing points
    const handleDrawingPoint = (point: DrawPoint) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const context = canvas.getContext("2d")
      if (!context) return

      // Set drawing style
      context.strokeStyle = point.color
      context.lineWidth = point.size
      context.lineCap = "round"
      context.lineJoin = "round"

      if (point.type === "start") {
        context.beginPath()
        context.moveTo(point.x, point.y)
      } else if (point.type === "move") {
        context.lineTo(point.x, point.y)
        context.stroke()
      } else if (point.type === "end") {
        context.closePath()

        // Save current state to history
        const currentState = context.getImageData(0, 0, canvas.width, canvas.height)
        setDrawingHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1)
          return [...newHistory, currentState]
        })
        setHistoryIndex((prev) => prev + 1)
      }
    }

    socket.on("drawing-point", handleDrawingPoint)

    return () => {
      socket.off("drawing-point", handleDrawingPoint)
    }
  }, [socket, chatId, historyIndex])

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!chatId) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    setIsDrawing(true)

    // Get coordinates
    let x, y
    if ("touches" in e) {
      // Touch event
      const rect = canvas.getBoundingClientRect()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      // Mouse event
      x = e.nativeEvent.offsetX
      y = e.nativeEvent.offsetY
    }

    // Start new path
    context.beginPath()
    context.moveTo(x, y)

    // Set drawing style
    context.strokeStyle = color
    context.lineWidth = brushSize[0]
    context.lineCap = "round"
    context.lineJoin = "round"

    // Emit drawing point to other users
    if (socket && isConnected) {
      socket.emit("drawing-point", {
        chatId,
        point: {
          x,
          y,
          color,
          size: brushSize[0],
          type: "start",
        },
      })
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !chatId) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    // Get coordinates
    let x, y
    if ("touches" in e) {
      // Touch event
      const rect = canvas.getBoundingClientRect()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      // Mouse event
      x = e.nativeEvent.offsetX
      y = e.nativeEvent.offsetY
    }

    // Draw line
    context.lineTo(x, y)
    context.stroke()

    // Emit drawing point to other users
    if (socket && isConnected) {
      socket.emit("drawing-point", {
        chatId,
        point: {
          x,
          y,
          color,
          size: brushSize[0],
          type: "move",
        },
      })
    }
  }

  const stopDrawing = () => {
    if (!isDrawing || !chatId) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    context.closePath()
    setIsDrawing(false)

    // Save current state to history
    const currentState = context.getImageData(0, 0, canvas.width, canvas.height)

    // Remove any "redo" states
    const newHistory = drawingHistory.slice(0, historyIndex + 1)

    setDrawingHistory([...newHistory, currentState])
    setHistoryIndex(newHistory.length)

    // Emit drawing end to other users
    if (socket && isConnected) {
      socket.emit("drawing-point", {
        chatId,
        point: {
          x: 0,
          y: 0,
          color,
          size: brushSize[0],
          type: "end",
        },
      })
    }
  }

  // Handle undo/redo
  const handleUndo = () => {
    if (historyIndex <= 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    setHistoryIndex(historyIndex - 1)
    context.putImageData(drawingHistory[historyIndex - 1], 0, 0)
  }

  const handleRedo = () => {
    if (historyIndex >= drawingHistory.length - 1) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    setHistoryIndex(historyIndex + 1)
    context.putImageData(drawingHistory[historyIndex + 1], 0, 0)
  }

  // Handle clear canvas
  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Save cleared state to history
    const clearedState = context.getImageData(0, 0, canvas.width, canvas.height)
    setDrawingHistory([...drawingHistory, clearedState])
    setHistoryIndex(drawingHistory.length)

    // Broadcast clear canvas to other users
    if (socket && isConnected && chatId) {
      socket.emit("clear-canvas", { chatId })
    }
  }

  // Handle download
  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataURL = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `drawchat-${Date.now()}.png`
    link.href = dataURL
    link.click()
  }

  // Handle send drawing
  const handleSendDrawing = async () => {
    if (!chatId) return

    const canvas = canvasRef.current
    if (!canvas) return

    setIsSending(true)

    try {
      // Get drawing data
      const dataURL = canvas.toDataURL("image/png")

      // Create drawing data object
      const drawingData = {
        dataURL,
        width: canvas.width,
        height: canvas.height,
        timestamp: new Date().toISOString(),
      }

      // Send drawing to server
      const formData = new FormData()
      formData.append("chatId", chatId)
      formData.append("drawingData", JSON.stringify(drawingData))

      const result = await sendDrawingMessage(formData)

      if (result.success) {
        toast({
          title: "Drawing sent",
          description: "Your drawing has been sent to the chat",
        })

        // Clear canvas after sending
        handleClear()

        // Notify other users about the new drawing
        if (socket && isConnected) {
          socket.emit("new-drawing", {
            chatId,
            messageId: result.messageId,
            senderId: currentUser.id,
            senderName: currentUser.username,
            createdAt: result.createdAt,
          })
        }
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to send drawing",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error sending drawing:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Color options
  const colorOptions = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FF9900"]

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <h3 className="text-xl font-medium text-gray-700">Select a chat to start drawing</h3>
          <p className="text-gray-500 mt-2">Collaborate on drawings in real-time</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#128C7E] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Drawing toolbar */}
      <div className="bg-white p-2 border-b flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {colorOptions.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-offset-2" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Select ${c} color`}
            />
          ))}
        </div>

        <div className="flex-1 flex items-center gap-2 ml-2">
          <span className="text-xs">Size:</span>
          <Slider value={brushSize} min={1} max={20} step={1} onValueChange={setBrushSize} className="w-24" />
        </div>

        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndex <= 0}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRedo}
            disabled={historyIndex >= drawingHistory.length - 1}
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button
            className="bg-[#128C7E] hover:bg-[#0e6b60] text-white"
            onClick={handleSendDrawing}
            disabled={isSending}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-white">
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  )
}
