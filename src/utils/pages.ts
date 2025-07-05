import { isNotNull } from 'drizzle-orm';
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
      navbarOrder: pages.navbarOrder,
    })
    .from(pages)
    .where(isNotNull(pages.navbarOrder))
    .orderBy(pages.navbarOrder)
    .all();
  
  return navbarPages;
}