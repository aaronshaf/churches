import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { pages } from '../db/schema';
import type { Bindings } from '../types';

export async function getNavbarPages(env: Bindings) {
  const db = createDb(env);
  
  const navbarPages = await db
    .select({
      id: pages.id,
      title: pages.title,
      path: pages.path,
    })
    .from(pages)
    .where(eq(pages.showInNavbar, true))
    .orderBy(pages.navbarOrder)
    .all();
  
  return navbarPages;
}