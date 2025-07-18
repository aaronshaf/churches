import { isNotNull } from 'drizzle-orm';
import { createDb } from '../db';
import { pages } from '../db/schema';
import type { Bindings } from '../types';

export async function getNavbarPages(
  env: Bindings
): Promise<Array<{ id: number; title: string; path: string; navbarOrder: number | null }>> {
  const db = createDb(env.DB);

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
