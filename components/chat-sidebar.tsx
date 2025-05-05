"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"
import { logoutUser } from "@/app/actions/auth-actions"
import { Button } from "@/components/ui/button"
import { useSocket } from "@/contexts/socket-context"
import NewChatDialog from "./new-chat-dialog"

interface ChatSidebarProps {
  currentUser: {
    id: string
    username: string
    avatar_url?: string
  }
  onSelectChat: (chatId: string) => void
  activeChat: string | null
  chats: any[]
}

export default function ChatSidebar({ currentUser, onSelectChat, activeChat, chats }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [updatedChats, setUpdatedChats] = useState<any[]>(chats)
  const { socket, isConnected } = useSocket()

  // Update chats when props change
  useEffect(() => {
    setUpdatedChats(chats)
  }, [chats])

  // Listen for new messages to update the chat list
  useEffect(() => {
    if (!socket) return

    const handleMessageReceived = (message: any) => {
      setUpdatedChats((prevChats) => {
        return prevChats.map((chat) => {
          if (chat.id === message.chatId) {
            return {
              ...chat,
              lastMessage: {
                id: message.id,
                senderId: message.senderId,
                senderName: message.senderName,
                content: message.content,
                isDrawing: message.isDrawing,
                createdAt: message.createdAt,
              },
              // Move this chat to the top
              updated_at: new Date().toISOString(),
            }
          }
          return chat
        })
      })
    }

    const handleNewDrawing = (data: any) => {
      setUpdatedChats((prevChats) => {
        return prevChats.map((chat) => {
          if (chat.id === data.chatId) {
            return {
              ...chat,
              lastMessage: {
                id: data.messageId,
                senderId: data.senderId,
                senderName: data.senderName,
                content: "Sent a drawing",
                isDrawing: true,
                createdAt: data.createdAt,
              },
              // Move this chat to the top
              updated_at: new Date().toISOString(),
            }
          }
          return chat
        })
      })
    }

    socket.on("message-received", handleMessageReceived)
    socket.on("new-drawing", handleNewDrawing)

    return () => {
      socket.off("message-received", handleMessageReceived)
      socket.off("new-drawing", handleNewDrawing)
    }
  }, [socket])

  const filteredChats = updatedChats
    .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    // Sort by most recent message
    .sort((a, b) => {
      const aDate = a.lastMessage?.createdAt || a.updated_at
      const bDate = b.lastMessage?.createdAt || b.updated_at
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  function formatTime(date: string) {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch (error) {
      return date
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#128C7E] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage
              src={currentUser.avatar_url || "/placeholder.svg?height=40&width=40&query=user"}
              alt={currentUser.username}
            />
            <AvatarFallback>{getInitials(currentUser.username)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{currentUser.username}</span>
            <span className="text-xs">{isConnected ? "Online" : "Connecting..."}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:bg-[#0e6b60]" onClick={() => logoutUser()}>
          Logout
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search or start new chat"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No chats found</div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer ${
                activeChat === chat.id ? "bg-gray-100" : ""
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <Avatar>
                <AvatarImage
                  src={chat.avatar_url || "/placeholder.svg?height=40&width=40&query=group"}
                  alt={chat.name}
                />
                <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium truncate">{chat.name}</span>
                  <span className="text-xs text-gray-500">
                    {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : formatTime(chat.updated_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600 truncate">
                    {chat.lastMessage ? chat.lastMessage.content : "No messages yet"}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-[#25D366] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New chat button */}
      <div className="p-3 border-t">
        <NewChatDialog currentUser={currentUser} onChatCreated={onSelectChat} />
      </div>
    </div>
  )
}
