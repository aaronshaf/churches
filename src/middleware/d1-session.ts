import type { D1Database, D1DatabaseSession } from '@cloudflare/workers-types';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Bindings } from '../types';

export interface D1SessionVariables {
  dbSession?: D1DatabaseSession;
  sessionBookmark?: string;
}

/**
 * D1 Session Middleware
 * Creates a D1 session with read replication support
 * Handles bookmark passing for sequential consistency
 */
export async function d1SessionMiddleware(
  c: Context<{ Bindings: Bindings; Variables: D1SessionVariables }>,
  next: Next
) {
  // Get bookmark from request header or cookie
  const bookmarkFromHeader = c.req.header('x-d1-bookmark');
  const bookmarkFromCookie = getCookie(c, 'd1-bookmark');
  const bookmark = bookmarkFromHeader || bookmarkFromCookie || 'first-unconstrained';

  // Create D1 session with bookmark
  const session = c.env.DB.withSession(bookmark);

  // Store session in context for use in routes
  c.set('dbSession', session);

  // Process the request
  await next();

  // Get the new bookmark from the session
  const newBookmark = session.getBookmark();

  if (newBookmark && c.res) {
    // Set bookmark in response header
    c.res.headers.set('x-d1-bookmark', newBookmark);

    // Also set as httpOnly cookie for browser persistence
    // Max age of 1 hour to balance consistency with performance
    c.res.headers.append('Set-Cookie', `d1-bookmark=${newBookmark}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);

    // Store bookmark in context for potential use
    c.set('sessionBookmark', newBookmark);
  }
}

/**
 * Get the D1 session from context
 * Falls back to regular DB if session not available
 */
export function getD1Session(
  c: Context<{ Bindings: Bindings; Variables: D1SessionVariables }>
): D1Database | D1DatabaseSession {
  return c.get('dbSession') || c.env.DB;
}
