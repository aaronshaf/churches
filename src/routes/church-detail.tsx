import { Hono } from 'hono';
import { ChurchComments } from '../components/ChurchComments';
import { ChurchDetailsSection } from '../components/church-detail/ChurchDetailsSection';
import { ChurchHeader } from '../components/church-detail/ChurchHeader';
import { ChurchImagesSection } from '../components/church-detail/ChurchImagesSection';
import { ChurchSocialMediaSection } from '../components/church-detail/ChurchSocialMediaSection';
import { ErrorPage } from '../components/ErrorPage';
import { Layout } from '../components/Layout';
import { getUser } from '../middleware/better-auth';
import { applyCacheHeaders, shouldSkipCache } from '../middleware/cache';
import type { D1SessionVariables } from '../middleware/d1-session';
import { ChurchDetailService } from '../services/church-detail';
import type { AuthVariables, Bindings } from '../types';
import { getFromCache, putInCache } from '../utils/cf-cache';
import { getGravatarUrl } from '../utils/crypto';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from '../utils/error-handling';
import { getCommonLayoutProps } from '../utils/layout-props';

type Variables = AuthVariables & D1SessionVariables;

export const churchDetailRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

churchDetailRoutes.get('/churches/:path', async (c) => {
  const churchPath = c.req.param('path');

  // Check if user is authenticated (skip cache for auth users)
  const hasSession = c.req.header('cookie')?.includes('session=');

  // Try to serve from cache first (only for non-authenticated users)
  if (!hasSession) {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      console.log(`Cache HIT for church: ${churchPath}`);
      return cachedResponse;
    }
  }

  try {
    // Get common layout props (includes user, i18n, favicon, etc.)
    const [layoutProps, user] = await Promise.all([getCommonLayoutProps(c), getUser(c)]);

    // Get church data using the service
    const churchDetailService = new ChurchDetailService(c);
    const churchData = await churchDetailService.getChurchData(churchPath);

    if (!churchData) {
      return c.html(
        <Layout title="Church Not Found" {...layoutProps}>
          <ErrorPage
            error="The church you are looking for could not be found."
            errorType="not_found"
            statusCode={404}
          />
        </Layout>,
        404
      );
    }

    const { church, county, gatherings, affiliations, churchImages, comments, settingsMap } = churchData;

    // Create events for JSON-LD
    const events = gatherings.map((gathering) => ({
      '@type': 'Event',
      name: gathering.type || 'Church Service',
      startDate: gathering.day,
      startTime: gathering.time,
      location: {
        '@type': 'Place',
        name: church.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: church.address,
          addressLocality: church.city,
          addressRegion: church.state,
          postalCode: church.zip,
        },
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
      name: church.name,
      description: church.publicNotes || `${church.name} is a church located in ${church.city}, ${church.state}.`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: church.address,
        addressLocality: church.city,
        addressRegion: church.state,
        postalCode: church.zip,
      },
      telephone: church.phone,
      email: church.email,
      url: church.website,
      geo:
        church.latitude && church.longitude
          ? {
              '@type': 'GeoCoordinates',
              latitude: church.latitude,
              longitude: church.longitude,
            }
          : undefined,
      sameAs: [church.facebook, church.instagram, church.twitter, church.youtube].filter(Boolean),
      memberOf: affiliations.map((affiliation) => ({
        '@type': 'Organization',
        name: affiliation.name,
        description: affiliation.description,
        url: affiliation.website,
      })),
      event: events,
      subjectOf: church.statementOfFaith
        ? {
            '@type': 'CreativeWork',
            name: 'Statement of Faith',
            text: church.statementOfFaith,
          }
        : undefined,
    };

    // Process comments to add gravatar URLs
    const processedComments = comments.map((comment) => ({
      ...comment,
      gravatarUrl: getGravatarUrl(comment.user?.email || ''),
    }));

    const response = c.html(
      <Layout title={church.name} {...layoutProps}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />

        <ChurchHeader church={church} county={county} />

        <div class="bg-gray-50" data-church-id={church.id}>
          <div class="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 py-6 md:py-8">
            <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg" data-testid="church-content-card">
              <div class="p-6 sm:p-8" data-testid="church-content">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="church-details-grid">
                  <ChurchDetailsSection church={church} affiliations={affiliations} gatherings={gatherings} />

                  <div class="space-y-4">
                    <ChurchImagesSection churchImages={churchImages} settingsMap={settingsMap} />

                    <ChurchSocialMediaSection church={church} />

                    {church.statementOfFaith && (
                      <div>
                        <h3 class="text-base font-medium text-gray-500">Statement of Faith</h3>
                        <div class="mt-2 prose prose-sm max-w-none text-gray-700">
                          {church.statementOfFaith.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {church.publicNotes && (
                      <div>
                        <h3 class="text-base font-medium text-gray-500">Notes</h3>
                        <div class="mt-2 prose prose-sm max-w-none text-gray-700">
                          {church.publicNotes.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div class="mt-8 pt-8 border-t border-gray-200">
                  <ChurchComments comments={processedComments} churchId={church.id} user={user} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );

    // Cache the response if user is not authenticated
    if (!hasSession && !shouldSkipCache(c)) {
      await putInCache(c.req.raw, response.clone());
    }

    // Apply cache headers
    applyCacheHeaders(c, 300); // 5 minutes

    return response;
  } catch (error: any) {
    console.error('Error in church detail route:', error);

    const errorId = generateErrorId();
    const statusCode = getErrorStatusCode(error);
    const message = sanitizeErrorMessage(error.message);

    const layoutProps = await getCommonLayoutProps(c).catch(() => ({
      faviconUrl: undefined,
      logoUrl: undefined,
      navbarPages: [],
      currentPath: c.req.path,
    }));

    return c.html(
      <Layout title="Error" {...layoutProps}>
        <ErrorPage error={message} errorType="server_error" statusCode={statusCode} errorId={errorId} />
      </Layout>,
      statusCode
    );
  }
});
