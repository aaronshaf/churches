import { describe, expect, test } from 'bun:test';
import {
  EnvironmentError,
  getEnvVarStatus,
  hasGoogleMapsApiKey,
  hasOpenRouterApiKey,
  validateAuthEnvVars,
  validateDatabaseEnvVars,
  validateRequiredEnvVars,
} from './env-validation';

function makeValidEnv() {
  return {
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    BETTER_AUTH_SECRET: 'secret',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    CLOUDFLARE_ACCOUNT_HASH: 'hash',
    GOOGLE_MAPS_API_KEY: 'maps-key',
    OPENROUTER_API_KEY: 'openrouter-key',
  } as any;
}

describe('EnvironmentError', () => {
  test('contains missing variable list and message', () => {
    const error = new EnvironmentError(['A', 'B']);

    expect(error.name).toBe('EnvironmentError');
    expect(error.message).toContain('A, B');
    expect(error.missingVars).toEqual(['A', 'B']);
  });
});

describe('validateRequiredEnvVars', () => {
  test('does not throw when required vars exist', () => {
    const env = makeValidEnv();
    expect(() => validateRequiredEnvVars(env)).not.toThrow();
  });

  test('throws missing required vars', () => {
    const env = makeValidEnv();
    delete env.BETTER_AUTH_SECRET;
    delete env.CLOUDFLARE_ACCOUNT_HASH;

    expect(() => validateRequiredEnvVars(env)).toThrow(EnvironmentError);
  });
});

describe('validateDatabaseEnvVars', () => {
  test('does not throw when Turso vars are present', () => {
    const env = makeValidEnv();
    expect(() => validateDatabaseEnvVars(env)).not.toThrow();
  });

  test('throws when Turso vars are missing', () => {
    const env = makeValidEnv();
    delete env.TURSO_DATABASE_URL;
    delete env.TURSO_AUTH_TOKEN;
    expect(() => validateDatabaseEnvVars(env)).toThrow(EnvironmentError);
  });
});

describe('validateAuthEnvVars', () => {
  test('does not throw when auth vars and Turso vars are present', () => {
    const env = makeValidEnv();
    expect(() => validateAuthEnvVars(env)).not.toThrow();
  });

  test('throws when auth vars are missing', () => {
    const env = makeValidEnv();
    delete env.GOOGLE_CLIENT_SECRET;
    expect(() => validateAuthEnvVars(env)).toThrow(EnvironmentError);
  });

  test('throws when Turso vars are missing', () => {
    const env = makeValidEnv();
    delete env.TURSO_DATABASE_URL;
    delete env.TURSO_AUTH_TOKEN;
    expect(() => validateAuthEnvVars(env)).toThrow(EnvironmentError);
  });
});

describe('environment status and key helpers', () => {
  test('returns missing and present required vars', () => {
    const env = makeValidEnv();
    delete env.GOOGLE_CLIENT_ID;

    const status = getEnvVarStatus(env);
    expect(status.allRequired).toBe(false);
    expect(status.missing).toContain('GOOGLE_CLIENT_ID');
    expect(status.present).toContain('BETTER_AUTH_SECRET');
  });

  test('checks optional API key availability', () => {
    const env = makeValidEnv();

    expect(hasGoogleMapsApiKey(env)).toBe(true);
    expect(hasOpenRouterApiKey(env)).toBe(true);

    delete env.GOOGLE_MAPS_API_KEY;
    delete env.OPENROUTER_API_KEY;

    expect(hasGoogleMapsApiKey(env)).toBe(false);
    expect(hasOpenRouterApiKey(env)).toBe(false);
  });
});
