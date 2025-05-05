import { Server } from "socket.io"
import type { NextRequest } from "next/server"
import { cookies } from "next/headers"

// Define the Socket.IO server instance
let io: any

export async function GET(request: NextRequest) {
  // Get the user ID from cookies for authentication
  const cookieStore = await cookies()
  const userId = cookieStore.get("user_id")?.value

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Create a response object with the appropriate headers for WebSocket upgrade
  const res = new Response(null, {
    status: 200,
  })

  // Get the socket.io server instance or create a new one
  const socketIoServer = getSocketIoServer(res)

  // Handle socket.io connections
  socketIoServer.on("connection", (socket: any) => {
    // Set the user ID on the socket
    socket.userId = userId

    // Join a room for the user
    socket.join(`user:${userId}`)

    // Handle chat room joining
    socket.on("join-chat", (chatId: string) => {
      socket.join(`chat:${chatId}`)
    })

    // Handle chat room leaving
    socket.on("leave-chat", (chatId: string) => {
      socket.leave(`chat:${chatId}`)
    })

    // Handle new messages
    socket.on("new-message", (message: any) => {
      // Broadcast to all users in the chat room
      socketIoServer.to(`chat:${message.chatId}`).emit("message-received", message)
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

    // Handle disconnection
    socket.on("disconnect", () => {
      // Clean up any resources
    })
  })

  return res
}

// Helper function to get or create the Socket.IO server
function getSocketIoServer(res: Response) {
  if (!io) {
    // Create a new Socket.IO server if one doesn't exist
    io = new Server({
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })
  }

  // @ts-ignore - attach the server to the response
  res.socket.server.io = io

  return io
}

export const dynamic = "force-dynamic"
