"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { useRouter } from "next/navigation"
import { getCookie } from "cookies-next"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinChat: (chatId: string) => void
  leaveChat: (chatId: string) => void
  sendMessage: (message: any) => void
  sendTyping: (chatId: string, userId: string, username: string) => void
  sendStopTyping: (chatId: string, userId: string) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinChat: () => {},
  leaveChat: () => {},
  sendMessage: () => {},
  sendTyping: () => {},
  sendStopTyping: () => {},
})

export const useSocket = () => useContext(SocketContext)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Initialize the Socket.IO server first
    fetch("/api/socketio").finally(() => {
      // Get the user ID from cookies
      const userId = getCookie("user_id")

      if (!userId) {
        console.log("No user ID found, not connecting to socket")
        return
      }

      // Initialize socket connection
      const socketInstance = io({
        path: "/api/socketio",
        addTrailingSlash: false,
      })

      // Set up event listeners
      socketInstance.on("connect", () => {
        console.log("Socket connected with ID:", socketInstance.id)
        setIsConnected(true)

        // Set the user ID on the socket
        socketInstance.emit("set-user-id", userId)
      })

      socketInstance.on("disconnect", () => {
        console.log("Socket disconnected")
        setIsConnected(false)
      })

      socketInstance.on("connect_error", (err) => {
        console.error("Socket connection error:", err)
        setIsConnected(false)
      })

      // Store the socket instance
      setSocket(socketInstance)

      // Clean up on unmount
      return () => {
        socketInstance.disconnect()
      }
    })
  }, [])

  // Join a chat room
  const joinChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit("join-chat", chatId)
    }
  }

  // Leave a chat room
  const leaveChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit("leave-chat", chatId)
    }
  }

  // Send a message
  const sendMessage = (message: any) => {
    if (socket && isConnected) {
      socket.emit("new-message", message)
    }
  }

  // Send typing indicator
  const sendTyping = (chatId: string, userId: string, username: string) => {
    if (socket && isConnected) {
      socket.emit("typing", { chatId, userId, username })
    }
  }

  // Send stop typing indicator
  const sendStopTyping = (chatId: string, userId: string) => {
    if (socket && isConnected) {
      socket.emit("stop-typing", { chatId, userId })
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinChat,
        leaveChat,
        sendMessage,
        sendTyping,
        sendStopTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
