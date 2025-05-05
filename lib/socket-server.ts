import type { Server as NetServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import type { NextApiResponse } from "next"

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

// Global variable to maintain the Socket.IO instance
let io: SocketIOServer | null = null

export function getSocketIO(res?: NextApiResponseServerIO) {
  // If we already have an instance, return it
  if (io) return io

  // If we don't have an instance and no response object, return null
  if (!res) return null

  // Create a new Socket.IO server
  io = new SocketIOServer(res.socket.server, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  })

  // Set up event handlers
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id)

    // Store user ID on socket
    socket.on("set-user-id", (userId: string) => {
      socket.data.userId = userId
      socket.join(`user:${userId}`)
      console.log(`User ${userId} connected with socket ${socket.id}`)
    })

    // Handle chat room joining
    socket.on("join-chat", (chatId: string) => {
      socket.join(`chat:${chatId}`)
      console.log(`Socket ${socket.id} joined chat ${chatId}`)
    })

    // Handle chat room leaving
    socket.on("leave-chat", (chatId: string) => {
      socket.leave(`chat:${chatId}`)
      console.log(`Socket ${socket.id} left chat ${chatId}`)
    })

    // Handle new messages
    socket.on("new-message", (message: any) => {
      // Broadcast to all users in the chat room
      io?.to(`chat:${message.chatId}`).emit("message-received", message)
    })

    // Handle typing indicators
    socket.on("typing", ({ chatId, userId, username }: { chatId: string; userId: string; username: string }) => {
      // Broadcast to all users in the chat room except the sender
      socket.to(`chat:${chatId}`).emit("user-typing", { userId, username })
    })

    // Handle stop typing
    socket.on("stop-typing", ({ chatId, userId }: { chatId: string; userId: string }) => {
      socket.to(`chat:${chatId}`).emit("user-stop-typing", { userId })
    })

    // Handle drawing points
    socket.on("drawing-point", ({ chatId, point }: { chatId: string; point: any }) => {
      socket.to(`chat:${chatId}`).emit("drawing-point", point)
    })

    // Handle clear canvas
    socket.on("clear-canvas", ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit("clear-canvas")
    })

    // Handle new drawings
    socket.on("new-drawing", (data: any) => {
      io?.to(`chat:${data.chatId}`).emit("new-drawing", data)
    })

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id)
    })
  })

  // Attach Socket.IO to the server
  res.socket.server.io = io

  return io
}
