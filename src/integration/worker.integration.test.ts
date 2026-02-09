import { describe, expect, test } from 'bun:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const compatibilityDate = '2025-01-19';

async function buildWorker(outdir: string) {
  const outfile = path.join(outdir, 'worker.mjs');
  await build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    mainFields: ['module', 'main'],
    target: 'es2022',
    outfile,
  });
  return { outfile, scriptPath: 'worker.mjs' as const };
}

describe('worker integration (Miniflare)', () => {
  test('envCheck returns JSON 500 on API requests when required env vars are missing', async () => {
    // Miniflare/workerd is strict about module file paths; keep build artifacts inside repo.
    mkdirSync('dist', { recursive: true });
    const outdir = mkdtempSync(path.join(process.cwd(), 'dist', 'tmp-worker-test-'));
    try {
      const { scriptPath } = await buildWorker(outdir);
      const mf = new Miniflare({
        rootPath: outdir,
        modules: true,
        scriptPath,
        compatibilityDate,
      });

      const res = await mf.dispatchFetch('http://localhost/api/whatever', {
        headers: { Accept: 'application/json' },
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(json.error).toBe('Configuration Error');
      expect(Array.isArray(json.missingVariables)).toBe(true);
      expect(json.missingVariables).toContain('DB');
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });

  test('traffic advice endpoint returns expected JSON when env is configured', async () => {
    mkdirSync('dist', { recursive: true });
    const outdir = mkdtempSync(path.join(process.cwd(), 'dist', 'tmp-worker-test-'));
    try {
      const { scriptPath } = await buildWorker(outdir);
      const mf = new Miniflare({
        rootPath: outdir,
        modules: true,
        scriptPath,
        compatibilityDate,
        d1Databases: ['DB'],
        r2Buckets: ['IMAGES_BUCKET'],
        kvNamespaces: ['SETTINGS_CACHE'],
        bindings: {
          BETTER_AUTH_SECRET: 'placeholder-secret-at-least-32-chars',
          BETTER_AUTH_URL: 'http://localhost:8787',
          GOOGLE_CLIENT_ID: 'placeholder',
          GOOGLE_CLIENT_SECRET: 'placeholder',
          CLOUDFLARE_ACCOUNT_HASH: 'placeholder',
        },
      });

      const res = await mf.dispatchFetch('http://localhost/.well-known/traffic-advice');
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.version).toBe(1);
      expect(Array.isArray(json.endpoints)).toBe(true);
      expect(json.endpoints[0].location).toBe('.');
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });
});
