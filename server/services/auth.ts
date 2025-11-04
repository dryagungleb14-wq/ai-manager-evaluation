import { createHash } from "crypto";
import { users, type DbUser } from "../../shared/schema.js";
import { getDatabase } from "../db.js";
import { eq } from "drizzle-orm";

/**
 * Hash a password using SHA-256
 * 
 * ⚠️ SECURITY NOTE: SHA-256 is used here for MVP simplicity.
 * For production, use bcrypt, scrypt, or argon2 with proper salt.
 * SHA-256 is vulnerable to rainbow table attacks and too fast for brute force protection.
 */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Authenticate a user by username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<DbUser | null> {
  const db = getDatabase();
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.password)) {
    return null;
  }

  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<DbUser | null> {
  const db = getDatabase();
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user || null;
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user"
): Promise<DbUser> {
  const db = getDatabase();
  
  const hashedPassword = hashPassword(password);
  
  const [newUser] = await db
    .insert(users)
    .values({
      username,
      password: hashedPassword,
      role,
    })
    .returning();

  return newUser;
}
