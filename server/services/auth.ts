import { createHash } from "crypto";
import { users, type DbUser } from "../../shared/schema.js";
import { getDatabase } from "../db.js";
import { eq } from "drizzle-orm";
import { storageUsesDatabase } from "../storage.js";

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
 * In-memory user storage for fallback mode
 * These users are only used when the database is unavailable
 */
const inMemoryUsers: DbUser[] = [
  {
    id: 1,
    username: "admin",
    password: hashPassword("admin123"),
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    username: "manager1",
    password: hashPassword("manager123"),
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    username: "manager2",
    password: hashPassword("manager123"),
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Authenticate a user by username and password
 * Falls back to in-memory users when database is unavailable
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<DbUser | null> {
  // Use in-memory users when database is unavailable
  if (!storageUsesDatabase) {
    console.log("[auth] Using in-memory user storage (database unavailable)");
    const user = inMemoryUsers.find(u => u.username === username);
    
    if (!user) {
      return null;
    }

    if (!verifyPassword(password, user.password)) {
      return null;
    }

    return user;
  }

  // Use database when available
  try {
    const db = await getDatabase();
    
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
  } catch (error) {
    console.error("[auth] Database authentication failed, falling back to in-memory users:", error);
    // Fallback to in-memory users if database fails
    const user = inMemoryUsers.find(u => u.username === username);
    
    if (!user) {
      return null;
    }

    if (!verifyPassword(password, user.password)) {
      return null;
    }

    return user;
  }
}

/**
 * Get user by ID
 * Falls back to in-memory users when database is unavailable
 */
export async function getUserById(id: number): Promise<DbUser | null> {
  // Use in-memory users when database is unavailable
  if (!storageUsesDatabase) {
    const user = inMemoryUsers.find(u => u.id === id);
    return user || null;
  }

  // Use database when available
  try {
    const db = await getDatabase();
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  } catch (error) {
    console.error("[auth] Database getUserById failed, falling back to in-memory users:", error);
    // Fallback to in-memory users if database fails
    const user = inMemoryUsers.find(u => u.id === id);
    return user || null;
  }
}

/**
 * Create a new user
 * Only works when database is available
 */
export async function createUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user"
): Promise<DbUser> {
  if (!storageUsesDatabase) {
    throw new Error("User creation is not supported in in-memory mode");
  }

  const db = await getDatabase();
  
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
