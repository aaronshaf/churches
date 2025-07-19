import { Hono } from 'hono';
import { ChurchComments } from '../components/ChurchComments';
import { ChurchDetailsSection } from '../components/church-detail/ChurchDetailsSection';
import { ChurchHeader } from '../components/church-detail/ChurchHeader';
import { ChurchImagesSection } from '../components/church-detail/ChurchImagesSection';
import { ChurchRightColumn } from '../components/church-detail/ChurchRightColumn';
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
        address: church.gatheringAddress ? {
          '@type': 'PostalAddress',
          streetAddress: church.gatheringAddress,
        } : undefined,
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
      description: church.publicNotes || `${church.name} is a Christian church in ${county?.name || 'Utah'}.`,
      address: church.gatheringAddress ? {
        '@type': 'PostalAddress',
        streetAddress: church.gatheringAddress,
      } : undefined,
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

        {/* Church Content */}
        <div class="bg-gray-50" data-church-id={church.id} data-gathering-address={church.gatheringAddress}>
          <div class="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 py-6 md:py-8">
            <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg" data-testid="church-content-card">
              <div class="p-6 sm:p-8" data-testid="church-content">
                {/* Church Details Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="church-details-grid">
                  <ChurchDetailsSection church={church} affiliations={affiliations} gatherings={gatherings} />
                  <ChurchRightColumn church={church} affiliations={affiliations} />
                </div>

                {/* Notes Section */}
                {(church.publicNotes ||
                  (church.privateNotes && user && (user.role === 'admin' || user.role === 'contributor'))) && (
                  <div class="mt-6 pt-6 border-t border-gray-200">
                    {church.publicNotes && (
                      <div>
                        <h3 class="text-base font-medium text-gray-500">Public Notes</h3>
                        <p class="mt-1 text-base text-gray-900 whitespace-pre-wrap">{church.publicNotes}</p>
                      </div>
                    )}
                    {church.privateNotes && user && (user.role === 'admin' || user.role === 'contributor') && (
                      <div class="mt-4">
                        <h3 class="text-base font-medium text-gray-500">Private Notes</h3>
                        <p class="mt-1 text-base text-gray-900 whitespace-pre-wrap bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          {church.privateNotes}
                        </p>
                      </div>
                    )}
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
            {churchImages.length > 0 && (
              <div class="mt-8" data-testid="church-gallery-section">
                <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg" data-testid="church-gallery-card">
                  <div class="p-6 sm:p-8" data-testid="church-gallery-content">
                    <h3 class="sr-only">Photos</h3>
                    <ChurchImagesSection churchImages={churchImages} settingsMap={settingsMap} />
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Section */}
            <div class="mt-8" data-testid="feedback-section">
              {!user ? (
                <div class="text-center py-4">
                  <a
                    href={`/auth/signin?redirect=${encodeURIComponent(c.req.url)}`}
                    class="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    data-testid="signin-to-feedback-link"
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
                <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg" data-testid="feedback-form-card">
                  <div class="p-6 sm:p-8" data-testid="feedback-form-content">
                    <h3 class="text-lg font-semibold leading-6 text-gray-900 mb-4">Submit Feedback</h3>
                    <p class="text-sm text-gray-600 mb-6">
                      Help us maintain accurate information about {church.name}. Your feedback is important to us.
                    </p>

                    <form method="post" action="/feedback/submit" data-testid="feedback-form">
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
                              data-testid="feedback-textarea"
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
                            data-testid="feedback-submit-button"
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
            
            // Image modal functionality
            function openImageModal(image) {
              const modal = document.createElement('div');
              modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90';
              modal.onclick = function() { modal.remove(); };
              
              const img = document.createElement('img');
              img.src = image.src;
              img.alt = image.alt;
              img.className = 'max-w-[90vw] max-h-[90vh] object-contain';
              img.onclick = function(e) { e.stopPropagation(); };
              
              const caption = image.caption ? '<div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4">' + image.caption + '</div>' : '';
              
              modal.innerHTML = caption;
              modal.appendChild(img);
              document.body.appendChild(modal);
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
                </div>
              \`;
              document.body.appendChild(notification);
              setTimeout(function() { notification.remove(); }, 5000);
            }
            `,
          }}
        />
      </Layout>
    );

    // Cache the response if user is not authenticated
    if (!hasSession && !shouldSkipCache(c)) {
      // Wait for the response to resolve before caching
      response.then((res) => {
        const responseToCache = res.clone();
        c.executionCtx.waitUntil(putInCache(c.req.raw, responseToCache));
      });
    }

    // Apply cache headers if not authenticated
    const finalResponse = await response;
    return shouldSkipCache(c) ? finalResponse : applyCacheHeaders(finalResponse, 'church-detail');
  } catch (error) {
    console.error('Error in church detail route:', error);

    const errorId = generateErrorId();
    const statusCode = getErrorStatusCode(error);

    // Ensure error is an Error object before calling sanitizeErrorMessage
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const { message, type, details } = sanitizeErrorMessage(errorObj);

    const layoutProps = await getCommonLayoutProps(c).catch(() => ({
      faviconUrl: undefined,
      logoUrl: undefined,
      pages: [],
      siteTitle: 'Utah Churches',
      user: null,
      currentPath: c.req.path,
      t: (key: string) => key, // Fallback translation function
    }));

    return c.html(
      <Layout title="Error" {...layoutProps}>
        <ErrorPage error={message} errorType={type} errorDetails={details} statusCode={statusCode} errorId={errorId} />
      </Layout>,
      statusCode
    );
  }
});
