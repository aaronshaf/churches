import type { FC } from 'hono/jsx';

type SettingsFormProps = {
  siteTitle?: string;
  tagline?: string;
  frontPageTitle?: string;
  siteDomain?: string;
  siteRegion?: string;
  imagePrefix?: string;
  r2ImageDomain?: string;
  faviconUrl?: string;
  logoUrl?: string;
  error?: string;
};

export const SettingsForm: FC<SettingsFormProps> = ({
  siteTitle,
  tagline,
  frontPageTitle,
  siteDomain,
  siteRegion,
  imagePrefix,
  r2ImageDomain,
  faviconUrl,
  logoUrl,
  error,
}) => {
  return (
    <form
      method="post"
      action="/admin/settings"
      class="space-y-6"
      data-testid="settings-form"
      enctype="multipart/form-data"
    >
      <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div class="px-4 py-6 sm:p-8">
          <div class="max-w-2xl">
            <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-8">Site Settings</h2>

            {error && (
              <div class="rounded-md bg-red-50 p-4 mb-6" data-testid="error-settings-form">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div class="sm:col-span-4">
                <label for="siteTitle" class="block text-sm font-medium leading-6 text-gray-900">
                  Site Title
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="siteTitle"
                    id="siteTitle"
                    value={siteTitle || 'Utah Churches'}
                    data-testid="input-siteTitle"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Utah Churches"
                  />
                  <p class="mt-2 text-sm text-gray-500">The main title shown in the browser tab and site header.</p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="tagline" class="block text-sm font-medium leading-6 text-gray-900">
                  Tagline
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="tagline"
                    id="tagline"
                    value={tagline || 'A directory of evangelical churches'}
                    data-testid="input-tagline"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="A directory of evangelical churches"
                  />
                  <p class="mt-2 text-sm text-gray-500">A short description of your site.</p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="frontPageTitle" class="block text-sm font-medium leading-6 text-gray-900">
                  Front Page Title
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="frontPageTitle"
                    id="frontPageTitle"
                    value={frontPageTitle || 'Christian Churches in Utah'}
                    data-testid="input-frontPageTitle"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="Christian Churches in Utah"
                  />
                  <p class="mt-2 text-sm text-gray-500">The title shown in the browser tab on the homepage only.</p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="siteDomain" class="block text-sm font-medium leading-6 text-gray-900">
                  Site Domain
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="siteDomain"
                    id="siteDomain"
                    value={siteDomain || ''}
                    data-testid="input-siteDomain"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="example.com"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Your site's domain name (used in sitemap and structured data).
                  </p>
                </div>
              </div>

              <div class="sm:col-span-2">
                <label for="siteRegion" class="block text-sm font-medium leading-6 text-gray-900">
                  Site Region
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="siteRegion"
                    id="siteRegion"
                    value={siteRegion || ''}
                    data-testid="input-siteRegion"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="UT"
                    maxlength={2}
                  />
                  <p class="mt-2 text-sm text-gray-500">Two-letter region/state code (e.g., UT, CA, TX).</p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="imagePrefix" class="block text-sm font-medium leading-6 text-gray-900">
                  Image Prefix
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="imagePrefix"
                    id="imagePrefix"
                    value={imagePrefix || ''}
                    data-testid="input-imagePrefix"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="utahchurches"
                    pattern="[a-z0-9-]+"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Prefix for uploaded images in Cloudflare (lowercase letters, numbers, hyphens only). If not set,
                    will use domain name prefix.
                  </p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="r2ImageDomain" class="block text-sm font-medium leading-6 text-gray-900">
                  R2 Image Domain
                </label>
                <div class="mt-2">
                  <input
                    type="text"
                    name="r2ImageDomain"
                    id="r2ImageDomain"
                    value={r2ImageDomain || ''}
                    data-testid="input-r2ImageDomain"
                    class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                    placeholder="images.example.com"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Custom domain for R2 image delivery (e.g., images.example.com). Leave empty to use default R2
                    domain.
                  </p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="favicon" class="block text-sm font-medium leading-6 text-gray-900">
                  Favicon
                </label>
                <div class="mt-2">
                  {faviconUrl && (
                    <div class="mb-4 flex items-center space-x-4">
                      <img src={faviconUrl} alt="Current favicon" class="h-8 w-8 rounded" />
                      <p class="text-sm text-gray-500">Current favicon</p>
                    </div>
                  )}
                  <input
                    type="file"
                    name="favicon"
                    id="favicon"
                    accept="image/*"
                    data-testid="input-favicon"
                    class="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Upload a square image (64x64 or larger). Supports JPEG, PNG, WebP, and other formats.
                  </p>
                </div>
              </div>

              <div class="sm:col-span-4">
                <label for="logo" class="block text-sm font-medium leading-6 text-gray-900">
                  Site Logo
                </label>
                <div class="mt-2">
                  {logoUrl && (
                    <div class="mb-4 flex items-center space-x-4">
                      <img src={logoUrl} alt="Current logo" class="h-12 w-auto" />
                      <p class="text-sm text-gray-500">Current logo</p>
                    </div>
                  )}
                  <input
                    type="file"
                    name="logo"
                    id="logo"
                    accept="image/*"
                    data-testid="input-logo"
                    class="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <p class="mt-2 text-sm text-gray-500">
                    Upload a logo image (recommended height: 40-60px). Will be displayed in the navigation bar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-x-4 border-t border-gray-900/10 px-4 py-4 sm:px-8">
          <a
            href="/admin"
            class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
            data-testid="btn-cancel"
          >
            Cancel
          </a>
          <button
            type="submit"
            data-testid="btn-submit"
            class="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Save Settings
          </button>
        </div>
      </div>
    </form>
  );
};
