"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, UserMinus, Users } from "lucide-react"
import { searchUsers } from "@/app/actions/user-actions"
import { addUsersToChat, removeUserFromChat } from "@/app/actions/chat-actions"
import { toast } from "@/hooks/use-toast"

interface GroupParticipantsProps {
  chatId: string
  participants: any[]
  currentUserId: string
  isGroup: boolean
}

export default function GroupParticipants({ chatId, participants, currentUserId, isGroup }: GroupParticipantsProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Handle search
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return

    try {
      const result = await searchUsers(searchQuery)
      if (result.success) {
        // Filter out users who are already participants
        const filteredResults = result.users.filter((user) => !participants.some((p) => p.id === user.id))
        setSearchResults(filteredResults)
      } else {
        setSearchResults([])
        toast({
          title: "Error",
          description: result.message || "Failed to search users",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Handle selecting a user
  const handleSelectUser = (user: any) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery("")
    setSearchResults([])
  }

  // Handle removing a selected user
  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((user) => user.id !== userId))
  }

  // Handle adding users to the chat
  const handleAddUsers = async () => {
    if (selectedUsers.length === 0) return

    setIsLoading(true)
    try {
      const result = await addUsersToChat(
        chatId,
        selectedUsers.map((user) => user.id),
      )

      if (result.success) {
        toast({
          title: "Success",
          description: "Users added to the group",
        })
        setOpen(false)
        setSelectedUsers([])
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add users",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Add users error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle removing a user from the chat
  const handleRemoveUser = async (userId: string) => {
    setIsLoading(true)
    try {
      const result = await removeUserFromChat(chatId, userId)

      if (result.success) {
        toast({
          title: "Success",
          description: "User removed from the group",
        })
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to remove user",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Remove user error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  if (!isGroup) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-gray-600">
          <Users className="h-4 w-4 mr-2" />
          Participants ({participants.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group Participants</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Participants */}
          <div>
            <h3 className="text-sm font-medium mb-2">Current Participants</h3>
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {participants.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={user.avatar_url || "/placeholder.svg?height=40&width=40&query=user"}
                        alt={user.username}
                      />
                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      {user.id === currentUserId && <p className="text-xs text-gray-500">You</p>}
                    </div>
                  </div>
                  {user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveUser(user.id)}
                      disabled={isLoading}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add New Participants */}
          <div>
            <h3 className="text-sm font-medium mb-2">Add New Participants</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button variant="outline" onClick={handleSearch} disabled={searchQuery.trim().length < 2}>
                  Search
                </Button>
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="border rounded-md p-2">
                  <p className="text-xs text-gray-500 mb-1">Selected Users:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1">
                        <span className="text-sm">{user.username}</span>
                        <button
                          className="text-gray-500 hover:text-red-500"
                          onClick={() => handleRemoveSelectedUser(user.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
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
            </div>
          </div>

          {/* Add Button */}
          {selectedUsers.length > 0 && (
            <Button className="w-full bg-[#128C7E] hover:bg-[#0e6b60]" onClick={handleAddUsers} disabled={isLoading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {isLoading ? "Adding..." : `Add ${selectedUsers.length} User${selectedUsers.length > 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
