"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/encryption"
import crypto from "crypto"

// Register a new user
export async function registerUser(formData: FormData) {
  const username = formData.get("username") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const avatarUrl = (formData.get("avatarUrl") as string) || null

  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email} OR username = ${username}
    `

    if (existingUser.length > 0) {
      return { success: false, message: "User already exists" }
    }

    // Hash the password
    const passwordHash = await hashPassword(password)

    // Insert the new user
    const result = await sql`
      INSERT INTO users (username, email, password_hash, avatar_url)
      VALUES (${username}, ${email}, ${passwordHash}, ${avatarUrl})
      RETURNING id
    `

    const userId = result[0].id

    // Create a session
    const sessionToken:string = crypto.randomBytes(32).toString("hex");

    // In a real app, you would store this in a sessions table
    // For simplicity, we'll just set a cookie
    (await cookies()).set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    (await cookies()).set("user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    })

    return { success: true, userId }
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, message: "Registration failed" }
  }
}

// Login a user
export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    // Get the user
    const users = await sql`
      SELECT id, password_hash FROM users WHERE email = ${email}
    `

    if (users.length === 0) {
      return { success: false, message: "Invalid email or password" }
    }

    const user = users[0]

    // Verify the password
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      return { success: false, message: "Invalid email or password" }
    }

    // Create a session
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // In a real app, you would store this in a sessions table
    // For simplicity, we'll just set a cookie
    (await cookies()).set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    (await cookies()).set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    })

    return { success: true, userId: user.id }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, message: "Login failed" }
  }
}

// Logout a user
export async function logoutUser() {
  (await cookies()).delete("session_token");
  (await cookies()).delete("user_id");
  redirect("/login")
}

// Get the current user
export async function getCurrentUser() {
  const userId = (await cookies()).get("user_id")?.value

  if (!userId) {
    return null
  }

  try {
    const users = await sql`
      SELECT id, username, email, avatar_url FROM users WHERE id = ${userId}
    `

    if (users.length === 0) {
      return null
    }

    return users[0]
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}
