"use client"

import { useState, useRef, useEffect } from "react"
import { Send, ImageIcon, Paperclip, Smile } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getChatMessages, sendTextMessage, getChatDetails } from "@/app/actions/chat-actions"
import { formatDistanceToNow } from "date-fns"
import { useSocket } from "@/contexts/socket-context"
import { v4 as uuidv4 } from "uuid"
import GroupParticipants from "./group-participant"

interface ChatWindowProps {
  chatId: string | null
  currentUser: {
    id: string
    username: string
    avatar_url?: string
  }
}

export default function ChatWindow({ chatId, currentUser }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState("")
  const [messages, setMessages] = useState<any[]>([])
  const [chatDetails, setChatDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({})
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket, isConnected, joinChat, leaveChat, sendMessage, sendTyping, sendStopTyping } = useSocket()

  // Load chat data when chatId changes
  useEffect(() => {
    async function fetchData() {
      if (!chatId) {
        setMessages([])
        setChatDetails(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Get chat details
        const detailsResult = await getChatDetails(chatId)

        if (detailsResult.success) {
          setChatDetails(detailsResult.chat)
        } else {
          setError(detailsResult.message || "Failed to load chat details")
          return
        }

        // Get messages
        const messagesResult = await getChatMessages(chatId)

        if (messagesResult.success) {
          setMessages(messagesResult.messages)
        } else {
          setError(messagesResult.message || "Failed to load messages")
        }
      } catch (error) {
        console.error("Error fetching chat data:", error)
        setError("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Join the chat room when chatId changes
    if (chatId) {
      joinChat(chatId)
    }

    // Leave the chat room when component unmounts or chatId changes
    return () => {
      if (chatId) {
        leaveChat(chatId)
      }
      // Clear typing state
      setTypingUsers({})
    }
  }, [chatId, joinChat, leaveChat])

  // Listen for new messages
  useEffect(() => {
    if (!socket) return

    // Handle incoming messages
    const handleMessageReceived = (message: any) => {
      // Only add the message if it's for the current chat
      if (message.chatId === chatId) {
        setMessages((prevMessages) => {
          // Check if we already have this message (to prevent duplicates)
          const exists = prevMessages.some((m) => m.id === message.id)
          if (exists) return prevMessages

          return [...prevMessages, message]
        })

        // Clear typing indicator for the sender
        setTypingUsers((prev) => {
          const newTypingUsers = { ...prev }
          delete newTypingUsers[message.senderId]
          return newTypingUsers
        })
      }
    }

    // Handle typing indicators
    const handleUserTyping = ({ userId, username }: { userId: string; username: string }) => {
      if (userId !== currentUser.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: username,
        }))
      }
    }

    // Handle stop typing
    const handleUserStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const newTypingUsers = { ...prev }
        delete newTypingUsers[userId]
        return newTypingUsers
      })
    }

    socket.on("message-received", handleMessageReceived)
    socket.on("user-typing", handleUserTyping)
    socket.on("user-stop-typing", handleUserStopTyping)

    return () => {
      socket.off("message-received", handleMessageReceived)
      socket.off("user-typing", handleUserTyping)
      socket.off("user-stop-typing", handleUserStopTyping)
    }
  }, [socket, chatId, currentUser.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingUsers])

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && chatId) {
      setIsTyping(true)
      sendTyping(chatId, currentUser.id, currentUser.username)
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      if (chatId) {
        setIsTyping(false)
        sendStopTyping(chatId, currentUser.id)
      }
    }, 3000) // Stop typing after 3 seconds of inactivity
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !chatId) return

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    setIsTyping(false)
    if (chatId) {
      sendStopTyping(chatId, currentUser.id)
    }

    const formData = new FormData()
    formData.append("chatId", chatId)
    formData.append("content", newMessage)

    // Generate a temporary ID for optimistic UI update
    const tempId = uuidv4()
    const optimisticMessage = {
      id: tempId,
      senderId: currentUser.id,
      senderName: currentUser.username,
      senderAvatar: currentUser.avatar_url,
      content: newMessage,
      isDrawing: false,
      createdAt: new Date().toISOString(),
      pending: true,
    }

    // Add message to UI immediately (optimistic update)
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage("")

    try {
      const result = await sendTextMessage(formData)

      if (result.success) {
        // Replace the optimistic message with the real one
        const confirmedMessage = {
          id: result.messageId,
          senderId: currentUser.id,
          senderName: currentUser.username,
          senderAvatar: currentUser.avatar_url,
          content: newMessage,
          isDrawing: false,
          chatId,
          createdAt: result.createdAt,
        }

        // Update the messages list
        setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...confirmedMessage, pending: false } : msg)))

        // Broadcast the message to other users
        sendMessage(confirmedMessage)
      } else {
        console.error("Failed to send message:", result.message)
        // Mark the message as failed
        setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, failed: true, pending: false } : msg)))
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Mark the message as failed
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, failed: true, pending: false } : msg)))
    }
  }

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

  // Check if this is a self chat
  const isSelfChat = chatDetails?.participants?.length === 1 && chatDetails.participants[0].id === currentUser.id

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <h3 className="text-xl font-medium text-gray-700">Select a chat to start messaging</h3>
          <p className="text-gray-500 mt-2">Or create a new conversation</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#128C7E] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-6">
          <h3 className="text-xl font-medium text-red-600">Error</h3>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  // Get typing indicator text
  const typingUsernames = Object.values(typingUsers)
  let typingText = ""
  if (typingUsernames.length === 1) {
    typingText = `${typingUsernames[0]} is typing...`
  } else if (typingUsernames.length === 2) {
    typingText = `${typingUsernames[0]} and ${typingUsernames[1]} are typing...`
  } else if (typingUsernames.length > 2) {
    typingText = `${typingUsernames.length} people are typing...`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-white p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage
              src={chatDetails?.avatar_url || "/placeholder.svg?height=40&width=40&query=chat"}
              alt={chatDetails?.name}
            />
            <AvatarFallback>{chatDetails?.name ? getInitials(chatDetails.name) : "CH"}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{chatDetails?.name}</h3>
            <p className="text-xs text-gray-500">
              {isSelfChat
                ? "Note to self"
                : chatDetails?.is_group
                  ? `${chatDetails?.participants?.length || 0} participants`
                  : "Online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Reconnecting...</span>
          )}
          {chatDetails?.is_group && (
            <GroupParticipants
              chatId={chatId}
              participants={chatDetails.participants}
              currentUserId={currentUser.id}
              isGroup={chatDetails.is_group}
            />
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#E5DDD5] bg-opacity-30">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <h3 className="text-lg font-medium text-gray-700">No messages yet</h3>
              <p className="text-gray-500 mt-2">
                {isSelfChat ? "Send yourself a message or note" : "Start the conversation!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderId === currentUser.id ? "justify-end" : "justify-start"}`}
              >
                {message.senderId !== currentUser.id && (
                  <Avatar className="mr-2 flex-shrink-0 self-end mb-1">
                    <AvatarImage
                      src={message.senderAvatar || "/placeholder.svg?height=32&width=32&query=user"}
                      alt={message.senderName}
                    />
                    <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.senderId === currentUser.id ? "bg-[#DCF8C6] rounded-tr-none" : "bg-white rounded-tl-none"
                  } ${message.pending ? "opacity-70" : ""} ${message.failed ? "bg-red-100" : ""}`}
                >
                  {message.senderId !== currentUser.id && chatDetails?.is_group && (
                    <p className="text-xs font-medium text-[#128C7E] mb-1">{message.senderName}</p>
                  )}
                  <p>{message.content}</p>
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <p className="text-right text-xs text-gray-500">{formatTime(message.createdAt)}</p>
                    {message.pending && <span className="text-xs text-gray-400">Sending...</span>}
                    {message.failed && <span className="text-xs text-red-500">Failed to send</span>}
                    {message.senderId === currentUser.id && !message.pending && !message.failed && (
                      <span className="text-xs text-gray-400">✓</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typingText && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="flex">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
                <span>{typingText}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="bg-white p-3 border-t flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-gray-500">
          <Smile className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500">
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500">
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Input
          placeholder="Type a message"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
            }
          }}
          onInput={handleTyping}
          className="flex-1"
        />
        <Button
          onClick={handleSendMessage}
          size="icon"
          className="bg-[#128C7E] hover:bg-[#0e6b60] text-white rounded-full"
          disabled={!newMessage.trim()}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
