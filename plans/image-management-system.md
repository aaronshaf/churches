# Image Management System Technical Plan

## Overview

This plan outlines the implementation of a comprehensive image management system that supports multiple entity types (churches, counties, affiliations, site images) with advanced features including dimension extraction, blurhash generation, and optimized loading states.

## Database Schema Design

### Core Images Table

```sql
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  blurhash TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_images_uploaded_by ON images(uploaded_by);
```

### Junction Tables

```sql
-- Church Images (replaces existing church_images table)
CREATE TABLE church_images_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(church_id, image_id)
);

CREATE INDEX idx_church_images_church_id ON church_images_new(church_id);
CREATE INDEX idx_church_images_image_id ON church_images_new(image_id);
CREATE INDEX idx_church_images_display_order ON church_images_new(display_order);

-- County Images
CREATE TABLE county_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  county_id INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(county_id, image_id)
);

CREATE INDEX idx_county_images_county_id ON county_images(county_id);
CREATE INDEX idx_county_images_image_id ON county_images(image_id);

-- Affiliation Images
CREATE TABLE affiliation_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliation_id INTEGER NOT NULL REFERENCES affiliations(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(affiliation_id, image_id)
);

CREATE INDEX idx_affiliation_images_affiliation_id ON affiliation_images(affiliation_id);
CREATE INDEX idx_affiliation_images_image_id ON affiliation_images(image_id);

-- Site Images (for homepage, about page, etc.)
CREATE TABLE site_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  location TEXT NOT NULL, -- 'homepage_hero', 'about_banner', etc.
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(location, image_id)
);

CREATE INDEX idx_site_images_location ON site_images(location);
CREATE INDEX idx_site_images_is_active ON site_images(is_active);
```

## Migration Strategy

### Phase 1: Create New Schema
1. Create `images` table and all junction tables
2. Add migration to track this change

### Phase 2: Data Migration
```sql
-- Migrate existing church_images data
INSERT INTO images (
  filename,
  original_filename,
  mime_type,
  file_size,
  width,
  height,
  blurhash,
  alt_text,
  created_at,
  updated_at
)
SELECT 
  filename,
  filename as original_filename,
  'image/jpeg' as mime_type, -- Default, will need to detect actual type
  0 as file_size, -- Will need to update after processing
  0 as width, -- Will need to update after processing
  0 as height, -- Will need to update after processing
  '' as blurhash, -- Will need to generate
  alt_text,
  created_at,
  updated_at
FROM church_images;

-- Create junction table entries
INSERT INTO church_images_new (church_id, image_id, display_order, is_primary, created_at)
SELECT 
  ci.church_id,
  i.id as image_id,
  ci.display_order,
  ci.is_primary,
  ci.created_at
FROM church_images ci
JOIN images i ON i.filename = ci.filename;
```

### Phase 3: Process Existing Images
Script to process existing images and update metadata:

```typescript
// scripts/process-existing-images.ts
import { db } from '../src/db';
import { images } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { encode } from 'blurhash';
import fs from 'fs/promises';
import path from 'path';

async function processExistingImages() {
  const unprocessedImages = await db
    .select()
    .from(images)
    .where(eq(images.blurhash, ''));

  for (const image of unprocessedImages) {
    try {
      const imagePath = path.join(process.cwd(), 'public', 'images', image.filename);
      const buffer = await fs.readFile(imagePath);
      
      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      
      // Generate blurhash
      const { data, info } = await sharp(buffer)
        .raw()
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });
      
      const blurhash = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        4,
        4
      );
      
      // Get file size
      const stats = await fs.stat(imagePath);
      
      // Update image record
      await db
        .update(images)
        .set({
          width: metadata.width || 0,
          height: metadata.height || 0,
          blurhash,
          fileSize: stats.size,
          mimeType: `image/${metadata.format}`,
          updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(images.id, image.id));
      
      console.log(`Processed ${image.filename}`);
    } catch (error) {
      console.error(`Error processing ${image.filename}:`, error);
    }
  }
}
```

### Phase 4: Cleanup
1. Drop old `church_images` table
2. Rename `church_images_new` to `church_images`

## Client-Side Upload Processing

### Image Upload Component

```tsx
// src/components/ImageUpload.tsx
import { useState, useRef } from 'react';
import { encode } from 'blurhash';

interface ImageUploadProps {
  onUpload: (file: File, metadata: ImageMetadata) => Promise<void>;
  accept?: string;
  maxSize?: number; // in MB
}

interface ImageMetadata {
  width: number;
  height: number;
  blurhash: string;
  fileSize: number;
}

export function ImageUpload({ onUpload, accept = 'image/*', maxSize = 10 }: ImageUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File): Promise<ImageMetadata> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = async () => {
        try {
          // Get dimensions
          const width = img.width;
          const height = img.height;
          
          // Generate blurhash
          const aspectRatio = width / height;
          const targetWidth = 32;
          const targetHeight = Math.round(targetWidth / aspectRatio);
          
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx!.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          const imageData = ctx!.getImageData(0, 0, targetWidth, targetHeight);
          const blurhash = encode(
            imageData.data,
            targetWidth,
            targetHeight,
            4,
            4
          );
          
          resolve({
            width,
            height,
            blurhash,
            fileSize: file.size
          });
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Process image client-side
      const metadata = await processImage(file);
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      
      // Upload with metadata
      await onUpload(file, metadata);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={isProcessing}
        className="hidden"
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isProcessing ? 'Processing...' : 'Select Image'}
      </button>
      
      {preview && (
        <div className="mt-4">
          <img src={preview} alt="Preview" className="max-w-xs rounded shadow" />
        </div>
      )}
    </div>
  );
}
```

## Server-Side Implementation

### Image Upload Handler

```typescript
// src/routes/admin/images.ts
import { Hono } from 'hono';
import { db } from '../../db';
import { images } from '../../db/schema';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';

const app = new Hono<{ Bindings: Env }>();

app.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const metadata = JSON.parse(formData.get('metadata') as string);
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }
  
  try {
    // Generate unique filename
    const ext = path.extname(file.name);
    const filename = `${nanoid()}${ext}`;
    
    // Save file
    const buffer = await file.arrayBuffer();
    const uploadPath = path.join(process.cwd(), 'public', 'images', filename);
    await fs.writeFile(uploadPath, Buffer.from(buffer));
    
    // Verify dimensions server-side
    const sharpInstance = sharp(Buffer.from(buffer));
    const actualMetadata = await sharpInstance.metadata();
    
    // Create database record
    const [newImage] = await db.insert(images).values({
      filename,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      width: actualMetadata.width || metadata.width,
      height: actualMetadata.height || metadata.height,
      blurhash: metadata.blurhash,
      uploadedBy: c.get('user').id,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    }).returning();
    
    return c.json({ success: true, image: newImage });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

export default app;
```

### Blurhash Image Component

```tsx
// src/components/BlurhashImage.tsx
import { useState, useEffect } from 'react';
import { decode } from 'blurhash';

interface BlurhashImageProps {
  src: string;
  blurhash: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
}

export function BlurhashImage({ 
  src, 
  blurhash, 
  width, 
  height, 
  alt, 
  className = '' 
}: BlurhashImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [blurhashUrl, setBlurhashUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blurhash) return;

    // Generate blurhash canvas
    const pixels = decode(blurhash, 32, 32);
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(32, 32);
    imageData.data.set(pixels);
    ctx!.putImageData(imageData, 0, 0);
    setBlurhashUrl(canvas.toDataURL());
  }, [blurhash]);

  const aspectRatio = (height / width) * 100;

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ paddingBottom: `${aspectRatio}%` }}
    >
      {blurhashUrl && !isLoaded && (
        <img
          src={blurhashUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
```

### Image Gallery Component

```tsx
// src/components/ImageGallery.tsx
interface ImageGalleryProps {
  images: Array<{
    id: number;
    filename: string;
    width: number;
    height: number;
    blurhash: string;
    altText?: string;
    caption?: string;
  }>;
  onReorder?: (images: number[]) => void;
  onDelete?: (imageId: number) => void;
  editable?: boolean;
}

export function ImageGallery({ 
  images, 
  onReorder, 
  onDelete, 
  editable = false 
}: ImageGalleryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <div key={image.id} className="relative group">
          <BlurhashImage
            src={`/images/${image.filename}`}
            blurhash={image.blurhash}
            width={image.width}
            height={image.height}
            alt={image.altText || ''}
            className="rounded-lg shadow-md"
          />
          
          {image.caption && (
            <p className="mt-2 text-sm text-gray-600">{image.caption}</p>
          )}
          
          {editable && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onDelete?.(image.id)}
                className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## UI/UX Considerations

### Loading States
1. **Blurhash Placeholder**: Immediate visual feedback with blurred preview
2. **Aspect Ratio Container**: Prevents layout shift during image load
3. **Fade Transition**: Smooth transition from placeholder to loaded image
4. **Progress Indicators**: For upload operations

### Responsive Design
```css
/* Responsive image grid */
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Maintain aspect ratio */
.image-container {
  position: relative;
  overflow: hidden;
}

.image-container::before {
  content: '';
  display: block;
  padding-top: var(--aspect-ratio, 100%);
}

.image-container img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Accessibility
- Alt text for all images
- Keyboard navigation for gallery
- ARIA labels for interactive elements
- Focus indicators

## Image Management Interface

### Admin Image Manager

```tsx
// src/routes/admin/churches/[id]/images.tsx
export function ChurchImageManager({ churchId }: { churchId: number }) {
  const [images, setImages] = useState<ChurchImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File, metadata: ImageMetadata) => {
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    try {
      const response = await fetch('/admin/images/upload', {
        method: 'POST',
        body: formData
      });
      
      const { image } = await response.json();
      
      // Link to church
      await fetch(`/admin/churches/${churchId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id })
      });
      
      // Refresh images
      await loadImages();
    } finally {
      setIsUploading(false);
    }
  };

  const handleReorder = async (imageIds: number[]) => {
    await fetch(`/admin/churches/${churchId}/images/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds })
    });
  };

  const handleSetPrimary = async (imageId: number) => {
    await fetch(`/admin/churches/${churchId}/images/${imageId}/primary`, {
      method: 'PUT'
    });
    await loadImages();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Church Images</h3>
        <ImageUpload 
          onUpload={handleUpload} 
          accept="image/jpeg,image/png,image/webp"
          maxSize={10}
        />
      </div>
      
      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span>Uploading image...</span>
          </div>
        </div>
      )}
      
      <ImageGallery
        images={images}
        onReorder={handleReorder}
        onDelete={handleDelete}
        editable={true}
      />
    </div>
  );
}
```

## Performance Optimizations

### Image Delivery
1. **CDN Integration**: Serve images through Cloudflare CDN
2. **Responsive Images**: Generate multiple sizes on upload
3. **WebP Conversion**: Auto-convert to WebP for supported browsers
4. **Lazy Loading**: Load images only when in viewport

### Database Queries
```typescript
// Efficient image loading with joins
const churchWithImages = await db
  .select({
    church: churches,
    images: {
      id: images.id,
      filename: images.filename,
      width: images.width,
      height: images.height,
      blurhash: images.blurhash,
      altText: images.altText,
      displayOrder: churchImages.displayOrder,
      isPrimary: churchImages.isPrimary
    }
  })
  .from(churches)
  .leftJoin(churchImages, eq(churches.id, churchImages.churchId))
  .leftJoin(images, eq(churchImages.imageId, images.id))
  .where(eq(churches.id, churchId))
  .orderBy(churchImages.displayOrder);
```

## Testing Strategy

### Unit Tests
```typescript
// tests/blurhash.test.ts
import { describe, it, expect } from 'vitest';
import { generateBlurhash } from '../src/utils/blurhash';

describe('Blurhash Generation', () => {
  it('should generate valid blurhash', async () => {
    const imageBuffer = await fs.readFile('test-image.jpg');
    const blurhash = await generateBlurhash(imageBuffer);
    
    expect(blurhash).toMatch(/^[A-Za-z0-9+/]+$/);
    expect(blurhash.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```typescript
// tests/image-upload.test.ts
describe('Image Upload', () => {
  it('should upload image and extract metadata', async () => {
    const formData = new FormData();
    formData.append('file', new File(['...'], 'test.jpg'));
    formData.append('metadata', JSON.stringify({
      width: 800,
      height: 600,
      blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
      fileSize: 50000
    }));
    
    const response = await app.request('/admin/images/upload', {
      method: 'POST',
      body: formData
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.image).toHaveProperty('id');
    expect(data.image.width).toBe(800);
  });
});
```

### E2E Tests
- Test complete upload flow
- Verify blurhash placeholder rendering
- Test image reordering
- Verify delete functionality
- Test responsive behavior

## Rollout Plan

### Phase 1: Infrastructure (Week 1)
- Create database schema
- Implement migration scripts
- Deploy schema changes

### Phase 2: Core Implementation (Week 2)
- Build upload components
- Implement server handlers
- Create image display components

### Phase 3: Migration (Week 3)
- Process existing images
- Generate blurhashes
- Migrate church_images data

### Phase 4: Integration (Week 4)
- Update church admin interface
- Add county/affiliation image support
- Implement site images

### Phase 5: Optimization (Week 5)
- CDN configuration
- Performance testing
- Bug fixes and polish

## Security Considerations

1. **File Validation**
   - Verify MIME types
   - Check file signatures
   - Limit file sizes
   - Sanitize filenames

2. **Access Control**
   - Require authentication for uploads
   - Track upload user
   - Implement rate limiting

3. **Storage Security**
   - Store outside web root
   - Serve through controlled endpoint
   - Regular backups

## Monitoring and Metrics

1. **Upload Metrics**
   - Success/failure rates
   - Processing times
   - File sizes distribution

2. **Performance Metrics**
   - Image load times
   - Blurhash generation time
   - CDN hit rates

3. **Error Tracking**
   - Failed uploads
   - Processing errors
   - Missing images

## Future Enhancements

1. **Advanced Features**
   - AI-powered auto-tagging
   - Smart cropping
   - Image search
   - Batch upload

2. **Optimization**
   - AVIF format support
   - Progressive JPEG encoding
   - Adaptive serving based on connection

3. **Integration**
   - External image services
   - Social media sharing
   - Image galleries on public pages