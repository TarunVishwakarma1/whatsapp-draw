"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createChat, createDirectChat, createSelfChat } from "@/app/actions/chat-actions"
import { searchUsers } from "@/app/actions/user-actions"
import { toast } from "@/hooks/use-toast"
import { Plus, Search, User, Users, MessageSquare } from "lucide-react"

interface NewChatDialogProps {
  currentUser: {
    id: string
    username: string
    avatar_url?: string
  }
  onChatCreated?: (chatId: string) => void
}

export default function NewChatDialog({ currentUser, onChatCreated }: NewChatDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("direct")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [groupName, setGroupName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Search for users when the query changes
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        const result = await searchUsers(searchQuery)
        if (result.success) {
          setSearchResults(result.users)
        } else {
          setSearchResults([])
        }
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  // Handle selecting a user
  const handleSelectUser = (user: any) => {
    // Check if the user is already selected
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery("")
  }

  // Handle removing a selected user
  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((user) => user.id !== userId))
  }

  // Handle creating a direct chat
  const handleCreateDirectChat = async (userId: string) => {
    setIsLoading(true)
    try {
      const result = await createDirectChat(userId)
      if (result.success) {
        setOpen(false)
        if (onChatCreated) {
          onChatCreated(result.chatId)
        }
        router.push(`/chat?id=${result.chatId}`)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create chat",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Create direct chat error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle creating a self chat
  const handleCreateSelfChat = async () => {
    setIsLoading(true)
    try {
      const result = await createSelfChat()
      if (result.success) {
        setOpen(false)
        if (onChatCreated) {
          onChatCreated(result.chatId)
        }
        router.push(`/chat?id=${result.chatId}`)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create self chat",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Create self chat error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle creating a group chat
  const handleCreateGroupChat = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one user",
        variant: "destructive",
      })
      return
    }

    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a group name",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("name", groupName)
      formData.append("isGroup", "true")
      formData.append("participantIds", selectedUsers.map((user) => user.id).join(","))

      const result = await createChat(formData)
      if (result.success) {
        setOpen(false)
        if (onChatCreated) {
          onChatCreated(result.chatId)
        }
        router.push(`/chat?id=${result.chatId}`)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create group",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Create group chat error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearchQuery("")
      setSearchResults([])
      setSelectedUsers([])
      setGroupName("")
      setActiveTab("direct")
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full bg-[#128C7E] hover:bg-[#0e6b60]">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Chat</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
            <TabsTrigger value="self">Self</TabsTrigger>
          </TabsList>

          {/* Direct Chat Tab */}
          <TabsContent value="direct" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Search by username</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  placeholder="Type a username..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleCreateDirectChat(user.id)}
                  >
                    <Avatar>
                      <AvatarImage
                        src={user.avatar_url || "/placeholder.svg?height=40&width=40&query=user"}
                        alt={user.username}
                      />
                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-center p-4 text-gray-500">No users found</div>
            )}

            {searchQuery.trim().length < 2 && (
              <div className="text-center p-4 text-gray-500">
                <User className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p>Search for users by username</p>
                <p className="text-sm">Type at least 2 characters</p>
              </div>
            )}
          </TabsContent>

          {/* Group Chat Tab */}
          <TabsContent value="group" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupMembers">Add Members</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="groupMembers"
                  placeholder="Search by username..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="border rounded-md p-2">
                <p className="text-sm text-gray-500 mb-2">Selected Users:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
                      <span className="text-sm">{user.username}</span>
                      <button className="text-gray-500 hover:text-red-500" onClick={() => handleRemoveUser(user.id)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelectUser(user)}
                  >
                    <Avatar>
                      <AvatarImage
                        src={user.avatar_url || "/placeholder.svg?height=40&width=40&query=user"}
                        alt={user.username}
                      />
                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-center p-4 text-gray-500">No users found</div>
            )}

            {searchQuery.trim().length < 2 && selectedUsers.length === 0 && (
              <div className="text-center p-4 text-gray-500">
                <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p>Search for users to add to the group</p>
                <p className="text-sm">Type at least 2 characters</p>
              </div>
            )}

            <Button
              className="w-full bg-[#128C7E] hover:bg-[#0e6b60]"
              onClick={handleCreateGroupChat}
              disabled={isLoading || selectedUsers.length === 0 || !groupName.trim()}
            >
              {isLoading ? "Creating..." : "Create Group"}
            </Button>
          </TabsContent>

          {/* Self Chat Tab */}
          <TabsContent value="self" className="space-y-4">
            <div className="text-center p-6">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">Chat with Yourself</h3>
              <p className="text-gray-500 mb-4">
                Create a private space to jot down notes, save links, or send yourself reminders.
              </p>
              <Button className="bg-[#128C7E] hover:bg-[#0e6b60]" onClick={handleCreateSelfChat} disabled={isLoading}>
                {isLoading ? "Creating..." : "Start Self Chat"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
