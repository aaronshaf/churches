import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../../db';
import { affiliationImages, churchImagesNew, countyImages, images, siteImages } from '../../db/schema';
import { createAuth } from '../../lib/auth';
import type { Bindings } from '../../types';
import { deleteImage, uploadImage } from '../../utils/r2-images';

const uploadV2 = new Hono<{ Bindings: Bindings }>();

interface ImageUploadRequest {
  entityType: 'church' | 'county' | 'affiliation' | 'site';
  entityId?: number; // Required for church, county, affiliation
  location?: string; // Required for site images
  altText?: string;
  caption?: string;
  isPrimary?: boolean;
  displayOrder?: number;
  // Image metadata from client-side processing
  width: number;
  height: number;
  blurhash: string;
}

uploadV2.post('/image', async (c) => {
  try {
    // Check authentication
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'contributor')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('image') as File;
    const metadataStr = formData.get('metadata') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!metadataStr) {
      return c.json({ error: 'No metadata provided' }, 400);
    }

    const metadata: ImageUploadRequest = JSON.parse(metadataStr);

    // Validate metadata
    if (!metadata.entityType || !['church', 'county', 'affiliation', 'site'].includes(metadata.entityType)) {
      return c.json({ error: 'Invalid entity type' }, 400);
    }

    if (metadata.entityType !== 'site' && !metadata.entityId) {
      return c.json({ error: 'Entity ID required' }, 400);
    }

    if (metadata.entityType === 'site' && !metadata.location) {
      return c.json({ error: 'Location required for site images' }, 400);
    }

    // Determine folder based on entity type
    const folderMap = {
      church: 'churches',
      county: 'counties',
      affiliation: 'pages', // Using pages folder for affiliations for now
      site: 'site',
    } as const;
    const folder = folderMap[metadata.entityType];

    // Upload to R2
    const uploadResult = await uploadImage(file, folder, c.env);

    const db = createDb(c.env.DB);

    // Start transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // 1. Insert into images table
      const [insertedImage] = await tx
        .insert(images)
        .values({
          filename: uploadResult.path,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          width: metadata.width,
          height: metadata.height,
          blurhash: metadata.blurhash,
          altText: metadata.altText,
          caption: metadata.caption,
          uploadedBy: session.user.id,
        })
        .returning();

      // 2. Create junction table entry based on entity type
      switch (metadata.entityType) {
        case 'church':
          await tx.insert(churchImagesNew).values({
            churchId: metadata.entityId!,
            imageId: insertedImage.id,
            isPrimary: metadata.isPrimary || false,
            displayOrder: metadata.displayOrder || 0,
          });
          break;

        case 'county':
          await tx.insert(countyImages).values({
            countyId: metadata.entityId!,
            imageId: insertedImage.id,
            isPrimary: metadata.isPrimary || false,
            displayOrder: metadata.displayOrder || 0,
          });
          break;

        case 'affiliation':
          await tx.insert(affiliationImages).values({
            affiliationId: metadata.entityId!,
            imageId: insertedImage.id,
            isPrimary: metadata.isPrimary || false,
            displayOrder: metadata.displayOrder || 0,
          });
          break;

        case 'site':
          await tx.insert(siteImages).values({
            imageId: insertedImage.id,
            location: metadata.location!,
            isActive: true,
            displayOrder: metadata.displayOrder || 0,
          });
          break;
      }

      return {
        id: insertedImage.id,
        url: uploadResult.url,
        path: uploadResult.path,
        width: insertedImage.width,
        height: insertedImage.height,
        blurhash: insertedImage.blurhash,
      };
    });

    return c.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      500
    );
  }
});

uploadV2.delete('/image/:imageId', async (c) => {
  try {
    // Check authentication
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'contributor')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imageId = parseInt(c.req.param('imageId'));
    if (Number.isNaN(imageId)) {
      return c.json({ error: 'Invalid image ID' }, 400);
    }

    const db = createDb(c.env.DB);

    // Get image details before deletion
    const [image] = await db.select().from(images).where(eq(images.id, imageId));
    if (!image) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Delete from database (cascade will handle junction tables)
    await db.delete(images).where(eq(images.id, imageId));

    // Delete from R2
    await deleteImage(image.filename, c.env);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// Update display order for images
uploadV2.patch('/image/:imageId/order', async (c) => {
  try {
    // Check authentication
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'contributor')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const imageId = parseInt(c.req.param('imageId'));
    const { entityType, entityId, displayOrder } = await c.req.json<{
      entityType: string;
      entityId: number;
      displayOrder: number;
    }>();

    if (Number.isNaN(imageId) || !entityType || typeof displayOrder !== 'number') {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    const db = createDb(c.env.DB);

    // Update the appropriate junction table
    switch (entityType) {
      case 'church':
        await db
          .update(churchImagesNew)
          .set({ displayOrder })
          .where(and(eq(churchImagesNew.churchId, entityId), eq(churchImagesNew.imageId, imageId)));
        break;

      case 'county':
        await db
          .update(countyImages)
          .set({ displayOrder })
          .where(and(eq(countyImages.countyId, entityId), eq(countyImages.imageId, imageId)));
        break;

      case 'affiliation':
        await db
          .update(affiliationImages)
          .set({ displayOrder })
          .where(and(eq(affiliationImages.affiliationId, entityId), eq(affiliationImages.imageId, imageId)));
        break;

      case 'site':
        await db.update(siteImages).set({ displayOrder }).where(eq(siteImages.imageId, imageId));
        break;

      default:
        return c.json({ error: 'Invalid entity type' }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Update order error:', error);
    return c.json({ error: 'Update failed' }, 500);
  }
});

export default uploadV2;
