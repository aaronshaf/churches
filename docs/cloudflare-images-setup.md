# Cloudflare Images Setup

## Image Variants Configuration

To properly support the image variants used in this application, you need to configure the following variants in your Cloudflare Images dashboard:

1. Go to your Cloudflare dashboard
2. Navigate to Images > Variants
3. Create the following variants:

### Favicon Variant
- **Name**: `favicon`
- **Width**: 64px
- **Height**: 64px
- **Fit**: Cover
- **Quality**: 85

### Thumbnail Variant
- **Name**: `thumbnail`
- **Width**: 150px
- **Height**: 150px
- **Fit**: Cover
- **Quality**: 85

### Small Variant
- **Name**: `small`
- **Width**: 300px
- **Height**: 300px
- **Fit**: Cover
- **Quality**: 85

### Medium Variant
- **Name**: `medium`
- **Width**: 600px
- **Height**: 600px
- **Fit**: Contain
- **Quality**: 85

### Large Variant
- **Name**: `large`
- **Width**: 1200px
- **Height**: 1200px
- **Fit**: Contain
- **Quality**: 90

### Public Variant
This variant is created by default and shows the original image.

## Favicon Support

The application supports uploading JPG, PNG, and other image formats for the favicon. Cloudflare Images will serve the favicon in the uploaded format (not as .ico). Modern browsers support PNG and JPG favicons.

The favicon uses the `favicon` variant (64x64) for optimal size and performance.

## Environment Variables

Make sure the following are set:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCOUNT_HASH`
- `CLOUDFLARE_IMAGES_API_TOKEN`