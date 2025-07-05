import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChurchComments } from '../components/ChurchComments';
import { ErrorPage } from '../components/ErrorPage';
import { Layout } from '../components/Layout';
import { createDbWithContext } from '../db';
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
import type { Bindings } from '../types';
import { getGravatarUrl } from '../utils/crypto';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from '../utils/error-handling';
import { getNavbarPages } from '../utils/pages';
import { getFaviconUrl, getLogoUrl } from '../utils/settings';

type Variables = {
  user: any;
};

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
        countyName: sql<string | null>`${counties.name}`.as('countyName'),
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
        website: affiliations.website,
        publicNotes: affiliations.publicNotes,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(eq(churchAffiliations.churchId, church.id))
      .orderBy(affiliations.name)
      .all();

    // Get church images
    const churchImagesList = await db
      .select()
      .from(churchImages)
      .where(eq(churchImages.churchId, church.id))
      .orderBy(churchImages.displayOrder)
      .all();

    // Get comments for this church
    const allComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        type: comments.type,
        userId: comments.userId,
        churchId: comments.churchId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.churchId, church.id))
      .orderBy(comments.createdAt)
      .all();

    // Process comments to add ownership info
    const processedComments = allComments.map((comment) => ({
      ...comment,
      isOwn: user && comment.userId === user.id,
      userImage: user?.image || null,
      userName: user?.name || null,
      userEmail: user?.email || '',
    }));

    // Get site settings for JSON-LD
    const siteDomainSetting = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'site_domain')).get();
    const siteRegionSetting = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'site_region')).get();

    const siteDomain = siteDomainSetting?.value || 'utahchurches.org';
    const siteRegion = siteRegionSetting?.value || 'UT';

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
    };

    return c.html(
      <Layout
        title={`${church.name}`}
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

          {/* Main Content */}
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Info */}
              <div class="lg:col-span-2 space-y-8">
                {/* Contact Information */}
                <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                  <h2 class="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
                  <dl class="space-y-3">
                    {church.phone && (
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Phone</dt>
                        <dd class="text-sm text-gray-900">
                          <a href={`tel:${church.phone}`} class="hover:text-primary-600 transition-colors">
                            {church.phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    {church.email && (
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Email</dt>
                        <dd class="text-sm text-gray-900">
                          <a href={`mailto:${church.email}`} class="hover:text-primary-600 transition-colors">
                            {church.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {church.website && (
                      <div>
                        <dt class="text-sm font-medium text-gray-500">Website</dt>
                        <dd class="text-sm text-gray-900">
                          <a
                            href={church.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:text-primary-600 transition-colors"
                          >
                            {formatUrlForDisplay(church.website)}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Worship Services */}
                {churchGatheringsList.length > 0 && (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Worship Services</h2>
                    <div class="space-y-3">
                      {churchGatheringsList.map((gathering) => (
                        <div key={gathering.id} class="border-l-4 border-primary-500 pl-4">
                          <div class="text-sm font-medium text-gray-900">{gathering.time}</div>
                          {gathering.notes && <div class="text-sm text-gray-600 mt-1">{gathering.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Church Images */}
                {churchImagesList.length > 0 && (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {churchImagesList.map((image) => (
                        <div
                          key={image.id}
                          class="relative group cursor-pointer"
                          onclick={`openImageModal('${image.url}', '${image.caption || ''}')`}
                        >
                          <img
                            src={image.url}
                            alt={image.caption || `${church.name} photo`}
                            class="w-full h-48 object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                          />
                          {image.caption && (
                            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-sm p-2 rounded-b-lg">
                              {image.caption}
                            </div>
                          )}
                        </div>
                      ))}
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

                {/* Feedback Section */}
                <div class="mt-8 border-t pt-8">
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
                    <div class="bg-white ring-1 ring-gray-900/5 sm:rounded-xl">
                      <div class="px-4 py-6 sm:p-8">
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

              {/* Right Column - Sidebar */}
              <div class="space-y-6">
                {/* Social Media Links */}
                {(church.facebook || church.instagram || church.youtube || church.spotify) && (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-3">Follow Us</h3>
                    <div class="space-y-2">
                      {church.facebook && (
                        <a
                          href={church.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                        >
                          <span class="mr-2">📘</span>
                          Facebook
                        </a>
                      )}
                      {church.instagram && (
                        <a
                          href={church.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                        >
                          <span class="mr-2">📷</span>
                          Instagram
                        </a>
                      )}
                      {church.youtube && (
                        <a
                          href={church.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                        >
                          <span class="mr-2">📺</span>
                          YouTube
                        </a>
                      )}
                      {church.spotify && (
                        <a
                          href={church.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
                        >
                          <span class="mr-2">🎵</span>
                          Spotify
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Church Affiliations */}
                {churchAffiliationsList.length > 0 && (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-3">Affiliations</h3>
                    <div class="space-y-2">
                      {churchAffiliationsList.map((affiliation) => (
                        <div key={affiliation.affiliationId}>
                          {affiliation.website ? (
                            <a
                              href={affiliation.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                            >
                              {affiliation.name}
                            </a>
                          ) : (
                            <span class="text-sm text-gray-600">{affiliation.name}</span>
                          )}
                          {affiliation.publicNotes && (
                            <p class="text-xs text-gray-500 mt-1">{affiliation.publicNotes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                {(church.statementOfFaith || church.publicNotes || church.language) && (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-3">Additional Information</h3>
                    <div class="space-y-3">
                      {church.language && church.language !== 'English' && (
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide">Language</dt>
                          <dd class="text-sm text-gray-900 mt-1">{church.language}</dd>
                        </div>
                      )}
                      {church.statementOfFaith && (
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide">Statement of Faith</dt>
                          <dd class="text-sm text-gray-900 mt-1">
                            <a
                              href={church.statementOfFaith}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="hover:text-primary-600 transition-colors"
                            >
                              View Statement →
                            </a>
                          </dd>
                        </div>
                      )}
                      {church.publicNotes && (
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</dt>
                          <dd class="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{church.publicNotes}</dd>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Image Modal */}
        <div
          id="imageModal"
          class="hidden fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              aria-hidden="true"
              onclick="closeImageModal()"
            ></div>
            <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div class="flex justify-end mb-2">
                  <button
                    type="button"
                    onclick="closeImageModal()"
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span class="sr-only">Close</span>
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <img id="modalImage" src="" alt="" class="w-full h-auto max-h-96 object-contain" />
                <p id="modalCaption" class="mt-4 text-sm text-gray-600 text-center"></p>
              </div>
            </div>
          </div>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            function openImageModal(imageUrl, caption) {
              const modal = document.getElementById('imageModal');
              const modalImage = document.getElementById('modalImage');
              const modalCaption = document.getElementById('modalCaption');
              
              modalImage.src = imageUrl;
              modalCaption.textContent = caption || '';
              modal.classList.remove('hidden');
              document.body.style.overflow = 'hidden';
            }
            
            function closeImageModal() {
              const modal = document.getElementById('imageModal');
              modal.classList.add('hidden');
              document.body.style.overflow = '';
            }
            
            // Close modal on escape key
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            });
            
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
