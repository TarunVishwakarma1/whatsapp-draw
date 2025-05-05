import crypto from "crypto"

// Encryption key from environment variables
const ENCRYPTION_KEY = crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY||"").digest();

// For AES, this is always 16
const IV_LENGTH = 16

// Encrypt text
export function encrypt(text: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return Buffer.concat([iv, Buffer.from(encrypted, "hex")])
}

// Decrypt text
export function decrypt(buffer: Buffer): string {
  const iv = buffer.subarray(0, IV_LENGTH)
  const encryptedText = buffer.subarray(IV_LENGTH)
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString("utf8")
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Generate a salt
    crypto.randomBytes(16, (err, salt) => {
      if (err) return reject(err)

      // Hash the password with the salt
      crypto.pbkdf2(password, salt, 310000, 32, "sha256", (err, derivedKey) => {
        if (err) return reject(err)

        // Return the salt and derived key concatenated
        resolve(`${salt.toString("hex")}:${derivedKey.toString("hex")}`)
      })
    })
  })
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":")

    // Hash the password with the stored salt
    crypto.pbkdf2(password, Buffer.from(salt, "hex"), 310000, 32, "sha256", (err, derivedKey) => {
      if (err) return reject(err)

      // Compare the derived key with the stored key
      resolve(key === derivedKey.toString("hex"))
    })
  })
}
