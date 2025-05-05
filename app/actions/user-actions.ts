"use server"

import { sql } from "@/lib/db"
import { cookies } from "next/headers"

// Search for users by username
export async function searchUsers(query: string) {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return { success: false, message: "Not authenticated" }
  }

  try {
    // Search for users whose username contains the query
    // Exclude the current user from results
    const users = await sql`
      SELECT id, username, email, avatar_url
      FROM users
      WHERE username ILIKE ${`%${query}%`}
      AND id != ${userId}
      LIMIT 10
    `

    return { success: true, users }
  } catch (error) {
    console.error("Search users error:", error)
    return { success: false, message: "Failed to search users" }
  }
}

// Get user by ID
export async function getUserById(id: string) {
  try {
    const users = await sql`
      SELECT id, username, email, avatar_url
      FROM users
      WHERE id = ${id}
    `

    if (users.length === 0) {
      return { success: false, message: "User not found" }
    }

    return { success: true, user: users[0] }
  } catch (error) {
    console.error("Get user error:", error)
    return { success: false, message: "Failed to get user" }
  }
}
 