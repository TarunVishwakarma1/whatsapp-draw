"use server"

import { sql } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/encryption"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Get all chats for the current user
export async function getUserChats() {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    const chats = await sql`
      SELECT c.id, c.name, c.is_group, c.avatar_url, c.created_at, c.updated_at
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ${userId}
      ORDER BY c.updated_at DESC
    `

    // For each chat, get the last message
    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const messages = await sql`
          SELECT m.id, m.sender_id, m.content_encrypted, m.is_drawing, m.created_at, u.username as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.chat_id = ${chat.id}
          ORDER BY m.created_at DESC
          LIMIT 1
        `

        let lastMessage = null
        if (messages.length > 0) {
          const message = messages[0]
          const decryptedContent = message.is_drawing ? "Sent a drawing" : decrypt(message.content_encrypted)

          lastMessage = {
            id: message.id,
            senderId: message.sender_id,
            senderName: message.sender_name,
            content: decryptedContent,
            isDrawing: message.is_drawing,
            createdAt: message.created_at,
          }
        }

        // Get unread message count
        // In a real app, you would track read status for messages
        // For simplicity, we'll just return 0
        const unreadCount = 0

        return {
          ...chat,
          lastMessage,
          unreadCount,
        }
      }),
    )

    return { success: true, chats: chatsWithLastMessage }
  } catch (error) {
    console.error("Get user chats error:", error)
    return { success: false, message: "Failed to get chats" }
  }
}

// Create a new chat
export async function createChat(formData: FormData) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  const name = formData.get("name") as string
  const isGroup = formData.get("isGroup") === "true"
  const avatarUrl = (formData.get("avatarUrl") as string) || null
  const participantIds = (formData.get("participantIds") as string).split(",").filter(Boolean)

  // Make sure the current user is included in participants
  if (!participantIds.includes(userId)) {
    participantIds.push(userId)
  }

  try {
    // Start a transaction
    await sql`BEGIN`

    // Create the chat
    const chatResult = await sql`
      INSERT INTO chats (name, is_group, avatar_url)
      VALUES (${name}, ${isGroup}, ${avatarUrl})
      RETURNING id
    `

    const chatId = chatResult[0].id

    // Add participants
    for (const participantId of participantIds) {
      await sql`
        INSERT INTO chat_participants (chat_id, user_id)
        VALUES (${chatId}, ${participantId})
      `
    }

    // Commit the transaction
    await sql`COMMIT`

    revalidatePath("/chat")
    return { success: true, chatId }
  } catch (error) {
    // Rollback the transaction
    await sql`ROLLBACK`
    console.error("Create chat error:", error)
    return { success: false, message: "Failed to create chat" }
  }
}

// Create a direct chat with another user
export async function createDirectChat(otherUserId: string) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  // Check if the other user exists
  const otherUserResult = await sql`
    SELECT id, username FROM users WHERE id = ${otherUserId}
  `

  if (otherUserResult.length === 0) {
    return { success: false, message: "User not found" }
  }

  const otherUser = otherUserResult[0]

  // Check if a direct chat already exists between these users
  const existingChatResult = await sql`
    SELECT c.id
    FROM chats c
    JOIN chat_participants cp1 ON c.id = cp1.chat_id
    JOIN chat_participants cp2 ON c.id = cp2.chat_id
    WHERE c.is_group = false
    AND cp1.user_id = ${userId}
    AND cp2.user_id = ${otherUserId}
    AND (
      SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id
    ) = 2
  `

  // If a chat already exists, return it
  if (existingChatResult.length > 0) {
    return { success: true, chatId: existingChatResult[0].id, existing: true }
  }

  try {
    // Start a transaction
    await sql`BEGIN`

    // Create the chat
    const chatResult = await sql`
      INSERT INTO chats (name, is_group, avatar_url)
      VALUES (${otherUser.username}, false, null)
      RETURNING id
    `

    const chatId = chatResult[0].id

    // Add participants
    await sql`
      INSERT INTO chat_participants (chat_id, user_id)
      VALUES (${chatId}, ${userId}), (${chatId}, ${otherUserId})
    `

    // Commit the transaction
    await sql`COMMIT`

    revalidatePath("/chat")
    return { success: true, chatId, existing: false }
  } catch (error) {
    // Rollback the transaction
    await sql`ROLLBACK`
    console.error("Create direct chat error:", error)
    return { success: false, message: "Failed to create chat" }
  }
}

// Create a self chat
export async function createSelfChat() {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  // Get user details
  const userResult = await sql`
    SELECT username FROM users WHERE id = ${userId}
  `

  if (userResult.length === 0) {
    return { success: false, message: "User not found" }
  }

  const username = userResult[0].username

  // Check if a self chat already exists
  const existingChatResult = await sql`
    SELECT c.id
    FROM chats c
    JOIN chat_participants cp ON c.id = cp.chat_id
    WHERE c.name = ${`${username} (You)`}
    AND cp.user_id = ${userId}
    AND (
      SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id
    ) = 1
  `

  // If a self chat already exists, return it
  if (existingChatResult.length > 0) {
    return { success: true, chatId: existingChatResult[0].id, existing: true }
  }

  try {
    // Start a transaction
    await sql`BEGIN`

    // Create the chat
    const chatResult = await sql`
      INSERT INTO chats (name, is_group, avatar_url)
      VALUES (${`${username} (You)`}, false, null)
      RETURNING id
    `

    const chatId = chatResult[0].id

    // Add only the current user as participant
    await sql`
      INSERT INTO chat_participants (chat_id, user_id)
      VALUES (${chatId}, ${userId})
    `

    // Commit the transaction
    await sql`COMMIT`

    revalidatePath("/chat")
    return { success: true, chatId, existing: false }
  } catch (error) {
    // Rollback the transaction
    await sql`ROLLBACK`
    console.error("Create self chat error:", error)
    return { success: false, message: "Failed to create self chat" }
  }
}

// Get messages for a chat
export async function getChatMessages(chatId: string) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to view this chat" }
    }

    // Get the messages
    const messages = await sql`
      SELECT m.id, m.sender_id, m.content_encrypted, m.is_drawing, m.created_at, u.username as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ${chatId}
      ORDER BY m.created_at ASC
    `

    // Decrypt the messages
    const decryptedMessages = messages.map((message) => {
      const content = message.is_drawing ? "Sent a drawing" : decrypt(message.content_encrypted)

      return {
        id: message.id,
        senderId: message.sender_id,
        senderName: message.sender_name,
        senderAvatar: message.sender_avatar,
        content,
        isDrawing: message.is_drawing,
        createdAt: message.created_at,
      }
    })

    // Get drawing data for drawing messages
    const drawingMessages = messages.filter((m) => m.is_drawing)

    if (drawingMessages.length > 0) {
      const drawingIds = drawingMessages.map((m) => m.id)

      const drawings = await sql`
        SELECT d.message_id, d.drawing_data
        FROM drawings d
        WHERE d.message_id = ANY(${drawingIds})
      `

      // Add drawing data to the messages
      for (const message of decryptedMessages) {
        if (message.isDrawing) {
          const drawing = drawings.find((d) => d.message_id === message.id)
          if (drawing) {
            message.drawingData = drawing.drawing_data
          }
        }
      }
    }

    return { success: true, messages: decryptedMessages }
  } catch (error) {
    console.error("Get chat messages error:", error)
    return { success: false, message: "Failed to get messages" }
  }
}

// Send a text message
export async function sendTextMessage(formData: FormData) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  const chatId = formData.get("chatId") as string
  const content = formData.get("content") as string

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to send messages to this chat" }
    }

    // Encrypt the message content
    const encryptedContent = encrypt(content)

    // Insert the message
    const result = await sql`
      INSERT INTO messages (chat_id, sender_id, content_encrypted, is_drawing)
      VALUES (${chatId}, ${userId}, ${encryptedContent}, false)
      RETURNING id, created_at
    `

    // Update the chat's updated_at timestamp
    await sql`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ${chatId}
    `

    revalidatePath(`/chat`)
    return {
      success: true,
      messageId: result[0].id,
      createdAt: result[0].created_at,
    }
  } catch (error) {
    console.error("Send text message error:", error)
    return { success: false, message: "Failed to send message" }
  }
}

// Send a drawing message
export async function sendDrawingMessage(formData: FormData) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  const chatId = formData.get("chatId") as string
  const drawingData = formData.get("drawingData") as string

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to send messages to this chat" }
    }

    // Start a transaction
    await sql`BEGIN`

    // Encrypt a placeholder message content
    const encryptedContent = encrypt("Sent a drawing")

    // Insert the message
    const messageResult = await sql`
      INSERT INTO messages (chat_id, sender_id, content_encrypted, is_drawing)
      VALUES (${chatId}, ${userId}, ${encryptedContent}, true)
      RETURNING id, created_at
    `

    const messageId = messageResult[0].id

    // Parse the drawing data
    const drawingDataObj = JSON.parse(drawingData)

    // Insert the drawing
    await sql`
      INSERT INTO drawings (message_id, drawing_data)
      VALUES (${messageId}, ${drawingDataObj})
    `

    // Update the chat's updated_at timestamp
    await sql`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ${chatId}
    `

    // Commit the transaction
    await sql`COMMIT`

    revalidatePath(`/chat`)
    return {
      success: true,
      messageId,
      createdAt: messageResult[0].created_at,
    }
  } catch (error) {
    // Rollback the transaction
    await sql`ROLLBACK`
    console.error("Send drawing message error:", error)
    return { success: false, message: "Failed to send drawing" }
  }
}

// Get chat details
export async function getChatDetails(chatId: string) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to view this chat" }
    }

    // Get the chat details
    const chats = await sql`
      SELECT c.id, c.name, c.is_group, c.avatar_url, c.created_at, c.updated_at
      FROM chats c
      WHERE c.id = ${chatId}
    `

    if (chats.length === 0) {
      return { success: false, message: "Chat not found" }
    }

    const chat = chats[0]

    // Get the participants
    const chatParticipants = await sql`
      SELECT u.id, u.username, u.avatar_url
      FROM users u
      JOIN chat_participants cp ON u.id = cp.user_id
      WHERE cp.chat_id = ${chatId}
    `

    return {
      success: true,
      chat: {
        ...chat,
        participants: chatParticipants,
      },
    }
  } catch (error) {
    console.error("Get chat details error:", error)
    return { success: false, message: "Failed to get chat details" }
  }
}

// Add users to a group chat
export async function addUsersToChat(chatId: string, userIds: string[]) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to add users to this chat" }
    }

    // Check if the chat is a group
    const chatResult = await sql`
      SELECT is_group FROM chats WHERE id = ${chatId}
    `

    if (chatResult.length === 0) {
      return { success: false, message: "Chat not found" }
    }

    if (!chatResult[0].is_group) {
      return { success: false, message: "Cannot add users to a direct chat" }
    }

    // Start a transaction
    await sql`BEGIN`

    // Add each user to the chat
    for (const userId of userIds) {
      // Check if the user is already in the chat
      const existingParticipant = await sql`
        SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
      `

      if (existingParticipant.length === 0) {
        await sql`
          INSERT INTO chat_participants (chat_id, user_id)
          VALUES (${chatId}, ${userId})
        `
      }
    }

    // Commit the transaction
    await sql`COMMIT`

    revalidatePath("/chat")
    return { success: true }
  } catch (error) {
    // Rollback the transaction
    await sql`ROLLBACK`
    console.error("Add users to chat error:", error)
    return { success: false, message: "Failed to add users to chat" }
  }
}

// Remove a user from a group chat
export async function removeUserFromChat(chatId: string, userIdToRemove: string) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    // Check if the user is a participant in the chat
    const participants = await sql`
      SELECT user_id FROM chat_participants WHERE chat_id = ${chatId} AND user_id = ${userId}
    `

    if (participants.length === 0) {
      return { success: false, message: "Not authorized to remove users from this chat" }
    }

    // Check if the chat is a group
    const chatResult = await sql`
      SELECT is_group FROM chats WHERE id = ${chatId}
    `

    if (chatResult.length === 0) {
      return { success: false, message: "Chat not found" }
    }

    if (!chatResult[0].is_group) {
      return { success: false, message: "Cannot remove users from a direct chat" }
    }

    // Remove the user from the chat
    await sql`
      DELETE FROM chat_participants
      WHERE chat_id = ${chatId} AND user_id = ${userIdToRemove}
    `

    revalidatePath("/chat")
    return { success: true }
  } catch (error) {
    console.error("Remove user from chat error:", error)
    return { success: false, message: "Failed to remove user from chat" }
  }
}
