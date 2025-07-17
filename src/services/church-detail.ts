import { eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { createDbWithContext } from '../db';
import { users } from '../db/auth-schema';
import {
  affiliations,
  churchAffiliations,
  churches,
  churchGatherings,
  churchImages,
  churchImagesNew,
  comments,
  counties,
  images,
} from '../db/schema';
import type { AuthVariables, Bindings } from '../types';
import { getSettingsWithCache } from '../utils/settings-cache';
import type { D1SessionVariables } from '../middleware/d1-session';

type Variables = AuthVariables & D1SessionVariables;

export interface ChurchDetailData {
  church: any;
  county: any;
  gatherings: any[];
  affiliations: any[];
  churchImages: any[];
  comments: any[];
  settingsMap: Map<string, string>;
}

export class ChurchDetailService {
  private c: Context<{ Bindings: Bindings; Variables: Variables }>;
  private db: ReturnType<typeof createDbWithContext>;

  constructor(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
    this.c = c;
    this.db = createDbWithContext(c);
  }

  async getChurchData(churchPath: string): Promise<ChurchDetailData | null> {
    // Get church with county info first (we need the church ID for other queries)
    const churchWithCounty = await this.db
      .select({
        id: churches.id,
        name: churches.name,
        path: churches.path,
        status: churches.status,
        website: churches.website,
        phone: churches.phone,
        email: churches.email,
        address: churches.address,
        city: churches.city,
        state: churches.state,
        zip: churches.zip,
        latitude: churches.latitude,
        longitude: churches.longitude,
        facebook: churches.facebook,
        instagram: churches.instagram,
        twitter: churches.twitter,
        youtube: churches.youtube,
        statementOfFaith: churches.statementOfFaith,
        publicNotes: churches.publicNotes,
        privateNotes: churches.privateNotes,
        countyId: churches.countyId,
        createdAt: churches.createdAt,
        updatedAt: churches.updatedAt,
        county: {
          name: counties.name,
          path: counties.path,
        },
      })
      .from(churches)
      .leftJoin(counties, eq(churches.countyId, counties.id))
      .where(eq(churches.path, churchPath))
      .limit(1)
      .get();

    if (!churchWithCounty) {
      return null;
    }

    // Execute all dependent queries in parallel using Promise.all
    const [gatherings, affiliationsResult, churchImagesResult, commentsResult, settingsMap] = await Promise.all([
      this.getChurchGatherings(churchWithCounty.id),
      this.getChurchAffiliations(churchWithCounty.id),
      this.getChurchImages(churchWithCounty.id),
      this.getChurchComments(churchWithCounty.id),
      getSettingsWithCache(this.c.env.SETTINGS_CACHE, this.c.env.DB),
    ]);

    // Process comments to add ownership info
    const processedComments = commentsResult.map((comment) => {
      // For system comments without valid user data, try to extract from content
      if (comment.userId === 0) {
        const auditMatch = comment.content.match(/by (.+?)(?:$|\s)/);
        if (auditMatch) {
          const username = auditMatch[1];
          // If it looks like an email, use it for gravatar
          if (username.includes('@')) {
            return {
              ...comment,
              user: { name: username, email: username },
            };
          }
        }
      }
      return {
        ...comment,
        churchId: comment.churchId as number,
      };
    });

    return {
      church: churchWithCounty,
      county: churchWithCounty.county,
      gatherings,
      affiliations: affiliationsResult,
      churchImages: churchImagesResult,
      comments: processedComments,
      settingsMap,
    };
  }

  private async getChurchGatherings(churchId: number) {
    return await this.db
      .select({
        id: churchGatherings.id,
        day: churchGatherings.day,
        time: churchGatherings.time,
        type: churchGatherings.type,
        notes: churchGatherings.notes,
      })
      .from(churchGatherings)
      .where(eq(churchGatherings.churchId, churchId))
      .orderBy(
        sql`CASE 
          WHEN ${churchGatherings.day} = 'Sunday' THEN 1
          WHEN ${churchGatherings.day} = 'Monday' THEN 2
          WHEN ${churchGatherings.day} = 'Tuesday' THEN 3
          WHEN ${churchGatherings.day} = 'Wednesday' THEN 4
          WHEN ${churchGatherings.day} = 'Thursday' THEN 5
          WHEN ${churchGatherings.day} = 'Friday' THEN 6
          WHEN ${churchGatherings.day} = 'Saturday' THEN 7
          ELSE 8
        END`,
        churchGatherings.time
      )
      .all();
  }

  private async getChurchAffiliations(churchId: number) {
    return await this.db
      .select({
        id: affiliations.id,
        name: affiliations.name,
        description: affiliations.description,
        website: affiliations.website,
        status: affiliations.status,
      })
      .from(churchAffiliations)
      .leftJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(eq(churchAffiliations.churchId, churchId))
      .orderBy(affiliations.name)
      .all();
  }

  private async getChurchImages(churchId: number) {
    try {
      // Get church images from new system
      const newImages = await this.db
        .select({
          id: churchImagesNew.id,
          imagePath: churchImagesNew.imagePath,
          imageAlt: churchImagesNew.imageAlt,
          caption: churchImagesNew.caption,
          width: churchImagesNew.width,
          height: churchImagesNew.height,
          blurhash: churchImagesNew.blurhash,
          sortOrder: churchImagesNew.sortOrder,
        })
        .from(churchImagesNew)
        .where(eq(churchImagesNew.churchId, churchId))
        .orderBy(churchImagesNew.sortOrder)
        .all();

      if (newImages.length > 0) {
        return newImages;
      }

      // Fall back to old system if new system fails
      const oldImages = await this.db
        .select({
          id: churchImages.id,
          imagePath: images.imagePath,
          imageAlt: images.imageAlt,
          caption: images.caption,
          width: images.width,
          height: images.height,
          blurhash: images.blurhash,
          sortOrder: sql`ROW_NUMBER() OVER (ORDER BY ${churchImages.id})`.mapWith(Number),
        })
        .from(churchImages)
        .leftJoin(images, eq(churchImages.imageId, images.id))
        .where(eq(churchImages.churchId, churchId))
        .orderBy(churchImages.id)
        .all();

      return oldImages;
    } catch (error) {
      console.error('Error fetching church images:', error);
      return [];
    }
  }

  private async getChurchComments(churchId: number) {
    return await this.db
      .select({
        id: comments.id,
        content: comments.content,
        userId: comments.userId,
        churchId: comments.churchId,
        createdAt: comments.createdAt,
        user: {
          name: users.name,
          email: users.email,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.churchId, churchId))
      .orderBy(comments.createdAt)
      .all();
  }

  // Helper function to format URLs for display
  static formatUrlForDisplay(url: string): string {
    // Remove protocol
    let displayUrl = url.replace(/^https?:\/\//, '');
    // Remove www.
    displayUrl = displayUrl.replace(/^www\./, '');
    // Remove trailing slash
    displayUrl = displayUrl.replace(/\/$/, '');
    // Truncate if too long
    return displayUrl.length > 50 ? displayUrl.substring(0, 47) + '...' : displayUrl;
  }
}
