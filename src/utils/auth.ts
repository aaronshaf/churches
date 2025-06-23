import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { sessions, users } from '../db/schema';

export async function generateSessionId(): Promise<string> {
  return crypto.randomUUID();
}

export async function createSession(userId: number, env: any): Promise<string> {
  const db = createDb(env);
  const sessionId = await generateSessionId();

  // Session expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

export async function validateSession(sessionId: string | null, env: any): Promise<any | null> {
  if (!sessionId) return null;

  const db = createDb(env);

  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

  if (!session || session.expiresAt < new Date()) {
    // Delete expired session
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    return null;
  }

  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  return user;
}

export async function deleteSession(sessionId: string, env: any): Promise<void> {
  const db = createDb(env);
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
