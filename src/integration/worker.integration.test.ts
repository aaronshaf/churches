import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { envCheckMiddleware } from '../middleware/env-check';
import { assetsRoutes } from '../routes/assets';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', envCheckMiddleware);
app.route('/', assetsRoutes);

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    BETTER_AUTH_SECRET: 'placeholder-secret-at-least-32-chars',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GOOGLE_CLIENT_ID: 'placeholder',
    GOOGLE_CLIENT_SECRET: 'placeholder',
    CLOUDFLARE_ACCOUNT_HASH: 'placeholder',
    IMAGES_BUCKET: {} as any,
    SETTINGS_CACHE: {} as any,
    ...overrides,
  };
}

describe('worker integration', () => {
  test('envCheck returns JSON 500 on API requests when required env vars are missing', async () => {
    const env = makeEnv({
      TURSO_DATABASE_URL: undefined as any,
    });

    const res = await app.request('http://localhost/api/whatever', { headers: { Accept: 'application/json' } }, env);

    expect(res.status).toBe(500);
    const json = (await res.json()) as any;
    expect(json.error).toBe('Configuration Error');
    expect(Array.isArray(json.missingVariables)).toBe(true);
    expect(json.missingVariables).toContain('TURSO_DATABASE_URL');
  });

  test('traffic advice endpoint returns expected JSON when env is configured', async () => {
    const env = makeEnv();
    const res = await app.request('http://localhost/.well-known/traffic-advice', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.version).toBe(1);
    expect(Array.isArray(json.endpoints)).toBe(true);
    expect(json.endpoints[0].location).toBe('.');
  });
});
