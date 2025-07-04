import { Context, Next } from 'hono';
import { Layout } from '../components/Layout';

// All required environment variables
const REQUIRED_ENV_VARS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'GOOGLE_MAPS_API_KEY',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_ACCOUNT_HASH',
  'CLOUDFLARE_IMAGES_API_TOKEN',
  'OPENROUTER_API_KEY',
] as const;

export async function envCheckMiddleware(c: Context, next: Next) {
  const missingRequired = REQUIRED_ENV_VARS.filter(varName => !c.env[varName]);
  
  if (missingRequired.length > 0) {
    // Check if this is an API request
    const isApiRequest = c.req.path.startsWith('/api/') || 
                        c.req.header('Accept')?.includes('application/json');
    
    if (isApiRequest) {
      return c.json({
        error: 'Configuration Error',
        message: 'The application is not properly configured',
        missingVariables: missingRequired,
        required: REQUIRED_ENV_VARS,
      }, 500);
    }
    
    // For HTML requests, return a user-friendly error page
    return c.html(
      <Layout title="Configuration Error" currentPath={c.req.path}>
        <div class="max-w-4xl mx-auto px-6 py-12">
          <div class="bg-red-50 border border-red-200 rounded-lg p-8">
            <h1 class="text-2xl font-bold text-red-800 mb-4">Configuration Error</h1>
            <p class="text-red-700 mb-6">
              The application is not properly configured. The following required environment variables are missing:
            </p>
            <ul class="list-disc list-inside space-y-2 mb-6">
              {missingRequired.map(varName => (
                <li class="text-red-600 font-mono">{varName}</li>
              ))}
            </ul>
            <div class="bg-red-100 rounded p-4">
              <p class="text-sm text-red-800">
                <strong>For administrators:</strong> Please ensure all required environment variables are set in your deployment configuration.
              </p>
            </div>
          </div>
        </div>
      </Layout>,
      500
    );
  }
  
  await next();
}