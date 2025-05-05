import { neon } from "@neondatabase/serverless"

// Create a SQL client
export const sql = neon(process.env.DATABASE_URL!)

// Export the SQL client for direct queries
