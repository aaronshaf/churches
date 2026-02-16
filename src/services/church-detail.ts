import { and, desc, eq, isNull } from 'drizzle-orm';
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
import { getSettingsWithCache, type SettingsMap } from '../utils/settings-cache';

type Variables = AuthVariables;

export interface ChurchDetailData {
  church: any;
  county: any;
  gatherings: any[];
  affiliations: any[];
  churchImages: any[];
  comments: any[];
  settingsMap: SettingsMap;
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
    const churchResult = await this.db
      .select({
        id: churches.id,
        name: churches.name,
        path: churches.path,
        status: churches.status,
        website: churches.website,
        phone: churches.phone,
        email: churches.email,
        gatheringAddress: churches.gatheringAddress,
        mailingAddress: churches.mailingAddress,
        latitude: churches.latitude,
        longitude: churches.longitude,
        facebook: churches.facebook,
        instagram: churches.instagram,
        youtube: churches.youtube,
        spotify: churches.spotify,
        language: churches.language,
        statementOfFaith: churches.statementOfFaith,
        publicNotes: churches.publicNotes,
        privateNotes: churches.privateNotes,
        countyId: churches.countyId,
        imagePath: churches.imagePath,
        imageAlt: churches.imageAlt,
        lastUpdated: churches.lastUpdated,
        createdAt: churches.createdAt,
        updatedAt: churches.updatedAt,
        countyName: counties.name,
        countyPath: counties.path,
      })
      .from(churches)
      .leftJoin(counties, eq(churches.countyId, counties.id))
      .where(and(eq(churches.path, churchPath), isNull(churches.deletedAt)))
      .limit(1)
      .get();

    if (!churchResult) {
      return null;
    }

    // Restructure the data to match the expected format
    const churchWithCounty = {
      ...churchResult,
      county: churchResult.countyName
        ? {
            name: churchResult.countyName,
            path: churchResult.countyPath,
          }
        : null,
    };

    // Execute all dependent queries in parallel using Promise.all
    const [gatherings, affiliationsResult, churchImagesResult, commentsResult, settingsMap] = await Promise.all([
      this.getChurchGatherings(churchWithCounty.id),
      this.getChurchAffiliations(churchWithCounty.id),
      this.getChurchImages(churchWithCounty.id),
      this.getChurchComments(churchWithCounty.id),
      getSettingsWithCache(this.c.env.SETTINGS_CACHE, this.db),
    ]);

    // Process comments to add ownership info
    const processedComments = commentsResult.map((comment) => {
      // For system comments without valid user data, try to extract from content
      if (comment.userId === null || comment.userId === '0') {
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
        time: churchGatherings.time,
        notes: churchGatherings.notes,
        createdAt: churchGatherings.createdAt,
        updatedAt: churchGatherings.updatedAt,
      })
      .from(churchGatherings)
      .where(eq(churchGatherings.churchId, churchId))
      .orderBy(churchGatherings.time)
      .all();
  }

  private async getChurchAffiliations(churchId: number) {
    return await this.db
      .select({
        id: affiliations.id,
        name: affiliations.name,
        path: affiliations.path,
        website: affiliations.website,
        publicNotes: affiliations.publicNotes,
        status: affiliations.status,
      })
      .from(churchAffiliations)
      .leftJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(and(eq(churchAffiliations.churchId, churchId), isNull(affiliations.deletedAt)))
      .orderBy(affiliations.name)
      .all();
  }

  private async getChurchImages(churchId: number) {
    try {
      // Get church images from new system
      const newImages = await this.db
        .select({
          id: churchImagesNew.id,
          imageId: churchImagesNew.imageId,
          displayOrder: churchImagesNew.displayOrder,
          isPrimary: churchImagesNew.isPrimary,
          imagePath: images.filename,
          imageAlt: images.altText,
          caption: images.caption,
          width: images.width,
          height: images.height,
          blurhash: images.blurhash,
        })
        .from(churchImagesNew)
        .innerJoin(images, eq(churchImagesNew.imageId, images.id))
        .where(eq(churchImagesNew.churchId, churchId))
        .orderBy(desc(churchImagesNew.isPrimary), churchImagesNew.displayOrder)
        .all();

      if (newImages.length > 0) {
        return newImages.map((img, index) => ({
          ...img,
          sortOrder: index,
        }));
      }

      // Fall back to old system if new system has no images
      const oldImages = await this.db
        .select({
          id: churchImages.id,
          imagePath: churchImages.imagePath,
          imageAlt: churchImages.imageAlt,
          caption: churchImages.caption,
          isFeatured: churchImages.isFeatured,
          sortOrder: churchImages.sortOrder,
        })
        .from(churchImages)
        .where(eq(churchImages.churchId, churchId))
        .orderBy(desc(churchImages.isFeatured), churchImages.sortOrder)
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
    return displayUrl.length > 50 ? `${displayUrl.substring(0, 47)}...` : displayUrl;
  }
}
