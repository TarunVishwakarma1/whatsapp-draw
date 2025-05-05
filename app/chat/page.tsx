"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ChatSidebar from "@/components/chat-sidebar"
import ChatWindow from "@/components/chat-window"
import DrawingCanvas from "@/components/drawing-canvas"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMobile } from "@/hooks/use-mobile"
import { getCurrentUser } from "@/app/actions/auth-actions"
import { getUserChats } from "@/app/actions/chat-actions"

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [chats, setChats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useMobile()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get chat ID from URL if present
  useEffect(() => {
    const chatId = searchParams.get("id")
    if (chatId) {
      setActiveChat(chatId)
    }
  }, [searchParams])

  // Fetch current user and chats
  useEffect(() => {
    async function fetchData() {
      try {
        const user = await getCurrentUser()

        if (!user) {
          router.push("/login")
          return
        }

        setCurrentUser(user)

        const chatsResult = await getUserChats()

        if (chatsResult.success) {
          setChats(chatsResult.chats)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Handle chat selection
  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId)
    // Update URL with chat ID
    router.push(`/chat?id=${chatId}`)
  }

  // If no chat is selected and we're on mobile, show only the sidebar
  const showSidebarOnly = isMobile && !activeChat

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#128C7E] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar (hidden on mobile when a chat is active) */}
      {(!isMobile || showSidebarOnly) && (
        <div className={`${isMobile && activeChat ? "hidden" : "w-full md:w-80"} bg-white border-r`}>
          <ChatSidebar
            currentUser={currentUser}
            onSelectChat={handleSelectChat}
            activeChat={activeChat}
            chats={chats}
          />
        </div>
      )}

      {/* Main chat area (hidden on mobile when no chat is selected) */}
      {(!isMobile || activeChat) && (
        <div className={`${showSidebarOnly ? "hidden" : "flex-1"} flex flex-col`}>
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            <div className="bg-[#128C7E] text-white p-2 flex items-center justify-between">
              {isMobile && activeChat && (
                <button onClick={() => setActiveChat(null)} className="p-2 rounded-full hover:bg-[#0e6b60]">
                  ←
                </button>
              )}
              <TabsList className="bg-[#0e6b60]">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="drawing">Drawing</TabsTrigger>
              </TabsList>
              <div className="w-8"></div> {/* Spacer for alignment */}
            </div>

            <TabsContent value="chat" className="flex-1 overflow-hidden">
              <ChatWindow chatId={activeChat} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="drawing" className="flex-1 overflow-hidden bg-white">
              <DrawingCanvas chatId={activeChat} currentUser={currentUser} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
