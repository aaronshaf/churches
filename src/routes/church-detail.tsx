import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChurchComments } from '../components/ChurchComments';
import { ErrorPage } from '../components/ErrorPage';
import { Layout } from '../components/Layout';
import { OptimizedImage } from '../components/OptimizedImage';
import { createDbWithContext } from '../db';
import { users } from '../db/auth-schema';
import {
  affiliations,
  churchAffiliations,
  churches,
  churchGatherings,
  churchImages,
  comments,
  counties,
  settings,
} from '../db/schema';
import { getUser } from '../middleware/better-auth';
import type { AuthVariables, Bindings } from '../types';
import { getGravatarUrl } from '../utils/crypto';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from '../utils/error-handling';
import { getNavbarPages } from '../utils/pages';
import { getFaviconUrl, getLogoUrl } from '../utils/settings';

type Variables = AuthVariables;

export const churchDetailRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

churchDetailRoutes.get('/churches/:path', async (c) => {
  const db = createDbWithContext(c);
  const churchPath = c.req.param('path');

  // Check for admin user (optional)
  const user = await getUser(c);

  // Helper function to format URLs for display
  const formatUrlForDisplay = (url: string, maxLength: number = 40): string => {
    // Remove protocol
    let displayUrl = url.replace(/^https?:\/\//i, '');
    // Remove www.
    displayUrl = displayUrl.replace(/^www\./i, '');
    // Remove trailing slash
    displayUrl = displayUrl.replace(/\/$/, '');
    // Truncate if too long
    if (displayUrl.length > maxLength) {
      return `${displayUrl.substring(0, maxLength)}...`;
    }
    return displayUrl;
  };

  try {
    // Get church with county info
    const church = await db
      .select({
        id: churches.id,
        name: churches.name,
        path: churches.path,
        status: churches.status,
        gatheringAddress: churches.gatheringAddress,
        latitude: churches.latitude,
        longitude: churches.longitude,
        phone: churches.phone,
        email: churches.email,
        website: churches.website,
        facebook: churches.facebook,
        instagram: churches.instagram,
        youtube: churches.youtube,
        spotify: churches.spotify,
        statementOfFaith: churches.statementOfFaith,
        language: churches.language,
        publicNotes: churches.publicNotes,
        privateNotes: churches.privateNotes,
        lastUpdated: churches.lastUpdated,
        countyId: churches.countyId,
        imagePath: churches.imagePath,
        imageAlt: churches.imageAlt,
        countyName: counties.name,
      })
      .from(churches)
      .leftJoin(counties, eq(churches.countyId, counties.id))
      .where(eq(churches.path, churchPath))
      .get();

    if (!church) {
      return c.html(
        <Layout title="Church Not Found">
          <ErrorPage error="Church not found" statusCode={404} />
        </Layout>,
        404
      );
    }

    // Get church gatherings (services)
    const churchGatheringsList = await db
      .select()
      .from(churchGatherings)
      .where(eq(churchGatherings.churchId, church.id))
      .orderBy(churchGatherings.id)
      .all();

    // Get church affiliations
    const churchAffiliationsList = await db
      .select({
        affiliationId: churchAffiliations.affiliationId,
        name: affiliations.name,
        path: affiliations.path,
        website: affiliations.website,
        publicNotes: affiliations.publicNotes,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(eq(churchAffiliations.churchId, church.id))
      .orderBy(affiliations.name)
      .all();

    // Get church images (with error handling for missing table)
    let churchImagesList: Array<typeof churchImages.$inferSelect> = [];
    try {
      churchImagesList = await db
        .select()
        .from(churchImages)
        .where(eq(churchImages.churchId, church.id))
        .orderBy(churchImages.sortOrder, churchImages.createdAt)
        .all();
    } catch (error) {
      console.error('Failed to fetch church images:', error);
      // Continue without images if table doesn't exist
    }

    // Get comments for this church with user info
    const allComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        type: comments.type,
        metadata: comments.metadata,
        userId: comments.userId,
        churchId: comments.churchId,
        createdAt: comments.createdAt,
        userName: users.name,
        userEmail: users.email,
        userImage: users.image,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.churchId, church.id))
      .orderBy(comments.createdAt)
      .all();

    // Process comments to add ownership info
    const processedComments = allComments.map((comment) => {
      // For system comments without valid user data, try to extract from content
      let displayName = comment.userName || null;
      let displayEmail = comment.userEmail || '';

      if (comment.type === 'system' && !comment.userEmail && comment.content) {
        // Try to extract username from audit comment content
        const match = comment.content.match(/^([^:]+):/);
        if (match) {
          displayName = match[1].trim();
          // If it looks like an email, use it for gravatar
          if (displayName.includes('@')) {
            displayEmail = displayName;
          }
        }
      }

      return {
        ...comment,
        churchId: comment.churchId as number, // Safe since we filter by churchId
        isOwn: user ? comment.userId === user.id : false,
        userName: displayName,
        userEmail: displayEmail,
        userImage: comment.userImage || null,
      };
    });

    // Get site settings for JSON-LD
    const siteDomainSetting = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'site_domain'))
      .get();
    const siteRegionSetting = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'site_region'))
      .get();
    const r2ImageDomainSetting = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'r2_image_domain'))
      .get();

    const siteDomain = siteDomainSetting?.value || c.env.SITE_DOMAIN || 'localhost';
    const siteRegion = siteRegionSetting?.value || 'UT';
    const r2ImageDomain = r2ImageDomainSetting?.value;

    // Get favicon URL and logo URL
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);

    // Get navbar pages
    const navbarPages = await getNavbarPages(c.env);

    // Create events for JSON-LD
    const events = churchGatheringsList.map((gathering) => ({
      '@type': 'Event',
      '@id': `https://${siteDomain}/churches/${church.path}#gathering-${gathering.id}`,
      name: `${church.name} Service`,
      description: gathering.notes || `${church.name} worship service`,
      startDate: gathering.time,
      eventSchedule: {
        '@type': 'Schedule',
        repeatFrequency: 'P1W', // Weekly
        byDay: gathering.time.includes('Sunday') ? 'https://schema.org/Sunday' : undefined,
      },
      location: {
        '@type': 'Place',
        name: church.name,
        address: church.gatheringAddress
          ? {
              '@type': 'PostalAddress',
              streetAddress: church.gatheringAddress,
              addressLocality: church.countyName ? church.countyName.replace(' County', '') : undefined,
              addressRegion: siteRegion,
              addressCountry: 'US',
            }
          : undefined,
      },
      organizer: {
        '@type': 'Organization',
        name: church.name,
      },
    }));

    // Create JSON-LD structured data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Church',
      '@id': `https://${siteDomain}/churches/${church.path}`,
      name: church.name,
      ...(church.status === 'Heretical' && {
        additionalType: `https://${siteDomain}/schema/HereticalChurch`,
      }),
      // alternateName: church.alternateName || undefined, // Not in schema
      ...(church.gatheringAddress && {
        address: {
          '@type': 'PostalAddress',
          streetAddress: church.gatheringAddress,
          addressLocality: church.countyName ? church.countyName.replace(' County', '') : undefined,
          addressRegion: siteRegion,
          addressCountry: 'US',
          // postalCode: church.zip || undefined, // Not in schema
        },
      }),
      ...(church.latitude &&
        church.longitude && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: church.latitude.toString(),
            longitude: church.longitude.toString(),
          },
        }),
      ...(church.phone && { telephone: church.phone }),
      ...(church.email && { email: `mailto:${church.email}` }),
      ...(church.website && { url: church.website }),
      ...(churchGatheringsList.length > 0 && {
        openingHours: churchGatheringsList.map((g) => g.time).join(', '),
      }),
      ...(church.publicNotes && { description: church.publicNotes }),
      ...(churchAffiliationsList.length > 0 && {
        memberOf: churchAffiliationsList.map((a) => ({
          '@type': 'Organization',
          '@id': a.website || undefined,
          name: a.name,
          ...(a.website && { url: a.website }),
        })),
      }),
      sameAs: [church.facebook, church.instagram, church.youtube, church.spotify].filter(Boolean),
      ...(events.length > 0 && { event: events }),
      ...(church.statementOfFaith && {
        subjectOf: {
          '@type': 'CreativeWork',
          name: 'Statement of Faith',
          url: church.statementOfFaith,
        },
      }),
      ...(churchImagesList.length > 0 &&
        (() => {
          const firstImage = churchImagesList[0];
          return {
            image: {
              '@type': 'ImageObject',
              url: `https://${siteDomain}/cdn-cgi/image/format=auto,width=1200/${firstImage.imagePath}`,
              contentUrl: `https://${siteDomain}/cdn-cgi/image/format=auto,width=800/${firstImage.imagePath}`,
              thumbnailUrl: `https://${siteDomain}/cdn-cgi/image/format=auto,width=300/${firstImage.imagePath}`,
              ...(firstImage.imageAlt && { description: firstImage.imageAlt }),
              ...(firstImage.caption && { caption: firstImage.caption }),
            },
          };
        })()),
    };

    const firstImage = churchImagesList[0];
    const ogImageUrl = firstImage
      ? `https://${siteDomain}/cdn-cgi/image/format=auto,width=1200,height=630,fit=cover/${firstImage.imagePath}`
      : undefined;

    return c.html(
      <Layout
        title={`${church.name}`}
        description={church.publicNotes || `Christian church in ${church.countyName || 'Utah'}`}
        ogImage={ogImageUrl}
        jsonLd={jsonLd}
        user={user}
        churchId={church.id.toString()}
        faviconUrl={faviconUrl}
        logoUrl={logoUrl}
        pages={navbarPages}
        currentPath={`/churches/${church.path}`}
      >
        <div>
          {/* Header */}
          <div class="bg-gradient-to-r from-primary-600 to-primary-700" data-testid="church-header">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="py-12 md:py-16">
                <div class="md:flex md:items-center md:justify-between">
                  <div class="flex-1 min-w-0">
                    <h1 class="text-4xl font-bold text-white md:text-5xl" data-testid="church-name">
                      {church.name}
                    </h1>
                    {church.gatheringAddress && (
                      <p class="mt-4 text-xl text-primary-100" data-testid="church-address">
                        {church.gatheringAddress}
                      </p>
                    )}
                    {church.status && church.status !== 'Listed' && (
                      <div class="mt-4">
                        <span
                          class={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
                            church.status === 'Unlisted'
                              ? 'bg-primary-800 text-primary-100'
                              : church.status === 'Heretical'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-primary-800 text-primary-100'
                          }`}
                          data-testid="church-status"
                        >
                          {church.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Church Content */}
          <div class="bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
                <div class="p-6 sm:p-8">
                  {/* Church Details Grid */}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4" data-testid="church-details">
                      {church.gatheringAddress && (
                        <div data-testid="church-directions">
                          <h3 class="text-base font-medium text-gray-500">Directions</h3>
                          {church.latitude && church.longitude && (
                            <div class="flex gap-2 mt-3">
                              <a
                                href={`https://maps.google.com/?q=${church.latitude},${church.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="google-maps-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#0F9D58] group-focus:text-[#0F9D58] transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <span class="hidden sm:inline">Google Maps</span>
                                <span class="sm:hidden">Google</span>
                              </a>
                              <a
                                href={`https://maps.apple.com/?ll=${church.latitude},${church.longitude}&q=${encodeURIComponent(church.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="apple-maps-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#007AFF] group-focus:text-[#007AFF] transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                                </svg>
                                <span class="hidden sm:inline">Apple Maps</span>
                                <span class="sm:hidden">Apple</span>
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {churchGatheringsList.length > 0 && (
                        <div data-testid="church-gatherings">
                          <h3 class="text-base font-medium text-gray-500">Gatherings</h3>
                          <div class="mt-1 space-y-1">
                            {churchGatheringsList.map((gathering, index) => (
                              <div class="text-base text-gray-900" data-testid={`gathering-${index}`}>
                                <span class="font-medium" data-testid={`gathering-time-${index}`}>
                                  {gathering.time}
                                </span>
                                {gathering.notes && (
                                  <span class="text-gray-600" data-testid={`gathering-notes-${index}`}>
                                    {' '}
                                    – {gathering.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {church.phone && (
                        <div data-testid="church-phone">
                          <h3 class="text-base font-medium text-gray-500">Phone</h3>
                          <a
                            href={`tel:${church.phone}`}
                            class="mt-1 text-base text-primary-600 hover:text-primary-500"
                          >
                            {church.phone}
                          </a>
                        </div>
                      )}

                      {church.email && (
                        <div data-testid="church-email">
                          <h3 class="text-base font-medium text-gray-500">Email</h3>
                          <a
                            href={`mailto:${church.email}`}
                            class="mt-1 text-base text-primary-600 hover:text-primary-500"
                          >
                            {church.email}
                          </a>
                        </div>
                      )}
                    </div>

                    <div class="space-y-4">
                      {church.website && (
                        <div data-testid="church-website">
                          <h3 class="text-base font-medium text-gray-500">Website</h3>
                          <a
                            href={church.website}
                            rel="noopener noreferrer"
                            class="mt-1 text-base text-primary-600 hover:text-primary-500"
                          >
                            {formatUrlForDisplay(church.website)}
                          </a>
                        </div>
                      )}

                      {church.statementOfFaith && (
                        <div data-testid="church-statement-of-faith">
                          <h3 class="text-base font-medium text-gray-500">Statement of Faith</h3>
                          <a
                            href={church.statementOfFaith}
                            rel="noopener noreferrer"
                            class="mt-1 text-base text-primary-600 hover:text-primary-500"
                          >
                            {formatUrlForDisplay(church.statementOfFaith)}
                          </a>
                        </div>
                      )}

                      {/* Social Media Links */}
                      {(church.facebook || church.instagram || church.youtube || church.spotify) && (
                        <div>
                          <h3 class="text-base font-medium text-gray-500">Social Media</h3>
                          <div class="flex gap-2 mt-3 flex-wrap" data-testid="social-media-links">
                            {church.facebook && (
                              <a
                                href={church.facebook}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="facebook-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#1877f2] group-focus:text-[#1877f2] transition-colors"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                                </svg>
                                <span>Facebook</span>
                              </a>
                            )}
                            {church.instagram && (
                              <a
                                href={church.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="instagram-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#E4405F] group-focus:text-[#E4405F] transition-colors"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                                </svg>
                                <span>Instagram</span>
                              </a>
                            )}
                            {church.youtube && (
                              <a
                                href={church.youtube}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="youtube-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#FF0000] group-focus:text-[#FF0000] transition-colors"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                </svg>
                                <span>YouTube</span>
                              </a>
                            )}
                            {church.spotify && (
                              <a
                                href={church.spotify}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 group transition-colors"
                                data-testid="spotify-link"
                              >
                                <svg
                                  class="w-5 h-5 mr-1.5 group-hover:text-[#1DB954] group-focus:text-[#1DB954] transition-colors"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                <span>Spotify</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {churchAffiliationsList.length > 0 && (
                        <div data-testid="church-affiliations">
                          <h3 class="text-base font-medium text-gray-500">Affiliations</h3>
                          <div class="mt-1 space-y-1">
                            {churchAffiliationsList.map((affiliation) => (
                              <div key={affiliation.affiliationId}>
                                <a
                                  href={`/networks/${affiliation.path}`}
                                  class="text-base text-primary-600 hover:text-primary-500"
                                >
                                  {affiliation.name}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes Section */}
                  {(church.publicNotes ||
                    (church.privateNotes && user && (user.role === 'admin' || user.role === 'contributor'))) && (
                    <div class="mt-6 pt-6 border-t border-gray-200">
                      {church.publicNotes && (
                        <div>
                          <h3 class="text-base font-medium text-gray-500">Notes</h3>
                          <p class="mt-1 text-base text-gray-900 whitespace-pre-wrap">{church.publicNotes}</p>
                        </div>
                      )}
                      {church.privateNotes && user && (user.role === 'admin' || user.role === 'contributor') && (
                        <div class="mt-4">
                          <h3 class="text-base font-medium text-gray-500">Private Notes (Admin Only)</h3>
                          <p class="mt-1 text-base text-gray-900 whitespace-pre-wrap bg-yellow-50 p-3 rounded-md border border-yellow-200">
                            {church.privateNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Actions */}
                  {user && (user.role === 'admin' || user.role === 'contributor') && church.youtube && (
                    <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 class="text-lg font-semibold text-blue-900 mb-2">Admin Actions</h3>
                      <div class="space-y-2">
                        <button
                          id="update-sermons-btn"
                          onclick="updateSermons()"
                          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span id="update-sermons-text">Update Sermons</span>
                        </button>
                        <p class="text-xs text-blue-700">
                          Finds the most recent video over 30 minutes and extracts sermon information using AI.
                        </p>
                        <div id="update-sermons-message" class="text-sm hidden"></div>
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  {(() => {
                    if (!user) return null;
                    const canSeeAllComments = user && (user.role === 'admin' || user.role === 'contributor');
                    const visibleComments = canSeeAllComments
                      ? processedComments
                      : processedComments.filter((comment) => comment.isOwn);
                    if (visibleComments.length === 0) return null;

                    return (
                      <div id="comments" class="mt-6 pt-6 border-t border-gray-200" data-testid="comments-section">
                        <ChurchComments
                          churchId={church.id}
                          churchName={church.name}
                          churchPath={church.path || ''}
                          comments={processedComments}
                          user={user}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Image Gallery */}
              {churchImagesList.length > 0 && (
                <div class="mt-8">
                  <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
                    <div class="p-6 sm:p-8">
                      <h3 class="text-lg font-semibold leading-6 text-gray-900 mb-6">Photos</h3>
                      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {churchImagesList.map((image, index) => (
                          <div
                            key={image.id}
                            class="relative group cursor-pointer"
                            onclick={`openImageModal({
                              src: '${
                                r2ImageDomain
                                  ? `https://${siteDomain}/cdn-cgi/image/format=auto,width=1200/https://${r2ImageDomain}/${image.imagePath}`
                                  : `https://${siteDomain}/cdn-cgi/image/format=auto,width=1200/${image.imagePath}`
                              }',
                              alt: '${(image.imageAlt || `${church.name} photo ${index + 1}`).replace(/'/g, "\\'")}',
                              caption: '${(image.caption || '').replace(/'/g, "\\'")}'
                            })`}
                          >
                            <OptimizedImage
                              path={image.imagePath}
                              alt={image.imageAlt || `${church.name} photo ${index + 1}`}
                              width={300}
                              height={200}
                              className="w-full h-32 md:h-40 object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
                              domain={siteDomain}
                              r2Domain={r2ImageDomain || undefined}
                            />
                            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                              <svg
                                class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Section */}
              <div class="mt-8">
                {!user ? (
                  <div class="text-center py-4">
                    <a
                      href={`/auth/signin?redirect=${encodeURIComponent(c.req.url)}`}
                      class="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      Sign in to submit feedback
                    </a>
                  </div>
                ) : (
                  <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
                    <div class="p-6 sm:p-8">
                      <h3 class="text-lg font-semibold leading-6 text-gray-900 mb-4">Submit Feedback</h3>
                      <p class="text-sm text-gray-600 mb-6">
                        Help us maintain accurate information about {church.name}. Your feedback is important to us.
                      </p>

                      <form method="post" action="/feedback/submit">
                        <input type="hidden" name="type" value="church" />
                        <input type="hidden" name="churchId" value={church.id} />

                        <div class="space-y-4">
                          <div>
                            <label for="feedback-content" class="block text-sm font-medium leading-6 text-gray-900">
                              Your feedback <span class="text-red-500">*</span>
                            </label>
                            <div class="mt-2">
                              <textarea
                                id="feedback-content"
                                name="content"
                                rows={4}
                                required
                                class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                                placeholder="Provide information about this church..."
                              ></textarea>
                            </div>
                            <p class="mt-2 text-sm text-gray-500">
                              Share corrections, updates, or additional information about this church.
                            </p>
                          </div>

                          <div class="flex items-center justify-end gap-x-3">
                            <button
                              type="submit"
                              class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                            >
                              Submit Feedback
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            
            
            // Edit hotkey for admins and contributors
            ${
              user && (user.role === 'admin' || user.role === 'contributor')
                ? `
            document.addEventListener('keydown', function(e) {
              // Check if user is not in an input field
              const tagName = e.target.tagName.toLowerCase();
              const isInputField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.contentEditable === 'true';
              
              if (e.key === 'e' && !isInputField && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                window.location.href = '/admin/churches/${church.id}/edit';
              }
            });
            `
                : ''
            }
            
            // Check for feedback status in URL and show notification
            document.addEventListener('DOMContentLoaded', function() {
              const urlParams = new URLSearchParams(window.location.search);
              const feedbackStatus = urlParams.get('feedback');
              
              if (feedbackStatus === 'success') {
                showNotification('Feedback submitted successfully! Thank you for helping us improve.', 'success');
                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);
              } else if (feedbackStatus === 'error') {
                showNotification('Sorry, there was an error submitting your feedback. Please try again.', 'error');
                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);
              }
            });
            
            function showNotification(message, type) {
              const notification = document.createElement('div');
              notification.className = \`fixed top-4 right-4 z-50 p-4 rounded-md max-w-sm \${
                type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }\`;
              notification.innerHTML = \`
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    \${type === 'success' 
                      ? '<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                      : '<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
                    }
                  </div>
                  <div class="ml-3">
                    <p class="text-sm font-medium">\${message}</p>
                  </div>
                  <div class="ml-auto pl-3">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              \`;
              
              document.body.appendChild(notification);
              
              // Auto-remove after 5 seconds
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.remove();
                }
              }, 5000);
            }
            
            // Image modal functionality
            function openImageModal(imageData) {
              // Create modal
              const modal = document.createElement('div');
              modal.id = 'image-modal';
              modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75';
              modal.onclick = function(e) {
                if (e.target === modal) closeImageModal();
              };
              
              modal.innerHTML = \`
                <div class="relative max-w-4xl max-h-full">
                  <button onclick="closeImageModal()" class="absolute -top-10 right-0 text-white hover:text-gray-300 z-10">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                  <img src="\${imageData.src}" alt="\${imageData.alt}" class="max-w-full max-h-full object-contain rounded-lg" />
                  \${imageData.caption ? \`<p class="text-white text-center mt-4 text-sm">\${imageData.caption}</p>\` : ''}
                </div>
              \`;
              
              document.body.appendChild(modal);
              document.body.style.overflow = 'hidden';
              
              // Close on escape key
              document.addEventListener('keydown', handleEscapeKey);
            }
            
            function closeImageModal() {
              const modal = document.getElementById('image-modal');
              if (modal) {
                modal.remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', handleEscapeKey);
              }
            }
            
            function handleEscapeKey(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            }
          `,
          }}
        />
      </Layout>
    );
  } catch (error) {
    console.error('Error loading church:', error);
    const errorId = generateErrorId();
    const statusCode = getErrorStatusCode(error);
    const { message, type, details } = sanitizeErrorMessage(error);

    return c.html(
      <Layout title="Error">
        <ErrorPage error={details || message} errorType={type} statusCode={statusCode} errorId={errorId} />
      </Layout>,
      statusCode
    );
  }
});
