import type { NextApiRequest } from "next"
import { getSocketIO, type NextApiResponseServerIO } from "@/lib/socket-server"

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    // Socket.IO server is already running
    res.end()
    return
  }

  // Initialize Socket.IO server
  getSocketIO(res)

  // Send response to acknowledge the Socket.IO server is set up
  res.end()
}
