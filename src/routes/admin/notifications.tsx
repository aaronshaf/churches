import { Hono } from 'hono';
import { createDbWithContext } from '../../db';
import { comments, churchSuggestions, users } from '../../db/schema';
import { requireAdminBetter } from '../../middleware/better-auth';
import type { Bindings } from '../../types';
import { desc, eq, gt, sql } from 'drizzle-orm';

type Variables = {
  betterUser: any;
};

export const adminNotificationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Get new comments for admin notifications (requires admin auth)
adminNotificationsRoutes.get('/comments', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  
  // Get timestamp from query param (defaults to 1 hour ago)
  const since = c.req.query('since');
  const sinceTimestamp = since ? new Date(parseInt(since)) : new Date(Date.now() - 60 * 60 * 1000);
  
  try {
    // Get recent feedback comments
    const recentComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        type: comments.type,
        createdAt: comments.createdAt,
        userEmail: users.email,
        userName: users.name,
        churchId: comments.churchId
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(
        sql`${comments.createdAt} > ${sinceTimestamp.toISOString()} AND ${comments.type} = 'user'`
      )
      .orderBy(desc(comments.createdAt))
      .limit(50)
      .all();

    return c.json(recentComments);
  } catch (error) {
    console.error('Error fetching recent comments:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

// Get new church suggestions for admin notifications (requires admin auth)
adminNotificationsRoutes.get('/suggestions', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  
  // Get timestamp from query param (defaults to 1 hour ago)
  const since = c.req.query('since');
  const sinceTimestamp = since ? new Date(parseInt(since)) : new Date(Date.now() - 60 * 60 * 1000);
  
  try {
    // Get recent church suggestions
    const recentSuggestions = await db
      .select({
        id: churchSuggestions.id,
        churchName: churchSuggestions.churchName,
        denomination: churchSuggestions.denomination,
        address: churchSuggestions.address,
        createdAt: churchSuggestions.createdAt,
        userEmail: users.email,
        userName: users.name
      })
      .from(churchSuggestions)
      .leftJoin(users, eq(churchSuggestions.userId, users.id))
      .where(
        sql`${churchSuggestions.createdAt} > ${sinceTimestamp.toISOString()}`
      )
      .orderBy(desc(churchSuggestions.createdAt))
      .limit(50)
      .all();

    return c.json(recentSuggestions);
  } catch (error) {
    console.error('Error fetching recent suggestions:', error);
    return c.json({ error: 'Failed to fetch suggestions' }, 500);
  }
});

// Register for push notifications (requires admin auth)
adminNotificationsRoutes.post('/subscribe', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  
  try {
    const subscription = await c.req.json();
    
    // In a real implementation, you would store this subscription in the database
    // For now, we'll just acknowledge the subscription
    console.log('Admin notification subscription registered for user:', user.email);
    console.log('Subscription details:', subscription);
    
    return c.json({ success: true, message: 'Subscription registered' });
  } catch (error) {
    console.error('Error registering notification subscription:', error);
    return c.json({ error: 'Failed to register subscription' }, 500);
  }
});

// Check notification permission status (requires admin auth)
adminNotificationsRoutes.get('/status', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  
  return c.json({
    user: user.email,
    role: user.role,
    notificationsSupported: true, // Will be checked on client side
    subscriptionActive: false // Would check database in real implementation
  });
});

export { adminNotificationsRoutes };