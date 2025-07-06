// Environment variable validation utility

import type { D1Database } from '@cloudflare/workers-types';

export interface RequiredEnvVars {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLOUDFLARE_ACCOUNT_HASH: string;
}

export interface OptionalEnvVars {
  GOOGLE_MAPS_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_IMAGES_API_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  NODE_ENV?: string;
}

export type EnvVars = RequiredEnvVars & OptionalEnvVars;

export class EnvironmentError extends Error {
  public missingVars: string[];

  constructor(missingVars: string[]) {
    const message = `Missing required environment variables: ${missingVars.join(', ')}`;
    super(message);
    this.name = 'EnvironmentError';
    this.missingVars = missingVars;
  }
}

export const validateRequiredEnvVars: (env: any) => asserts env is EnvVars = (env) => {
  const requiredVars: (keyof RequiredEnvVars)[] = [
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLOUDFLARE_ACCOUNT_HASH',
  ];

  const missingVars = requiredVars.filter((varName) => !env[varName]);

  if (missingVars.length > 0) {
    throw new EnvironmentError(missingVars);
  }
}

export const validateDatabaseEnvVars: (env: any) => asserts env is { DB: D1Database } = (env) => {
  if (!env.DB) {
    throw new EnvironmentError(['DB']);
  }
}

export const validateAuthEnvVars: (
  env: any
) => asserts env is Pick<
  EnvVars,
  'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'
> & { DB: D1Database } = (env) => {
  const requiredVars = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missingVars = requiredVars.filter((varName) => !env[varName]);

  if (!env.DB) {
    missingVars.push('DB');
  }

  if (missingVars.length > 0) {
    throw new EnvironmentError(missingVars);
  }
}

export function getEnvVarStatus(env: any): {
  missing: string[];
  present: string[];
  allRequired: boolean;
} {
  const requiredVars: (keyof RequiredEnvVars)[] = [
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLOUDFLARE_ACCOUNT_HASH',
  ];

  const missing = requiredVars.filter((varName) => !env[varName]);
  const present = requiredVars.filter((varName) => env[varName]);

  // DB is a D1 binding, not an env var - checked separately

  return {
    missing,
    present,
    allRequired: missing.length === 0,
  };
}

// Check if Cloudflare image vars are available (but don't throw)
export function hasCloudflareImageEnvVars(env: any): boolean {
  return !!(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_IMAGES_API_TOKEN);
}

// Validate Cloudflare image vars only when needed
export const validateCloudflareImageEnvVars: (
  env: any
) => asserts env is Pick<EnvVars, 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_ACCOUNT_HASH' | 'CLOUDFLARE_IMAGES_API_TOKEN'> = (env) => {
  const requiredVars = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_HASH', 'CLOUDFLARE_IMAGES_API_TOKEN'];
  const missingVars = requiredVars.filter((varName) => !env[varName]);

  if (missingVars.length > 0) {
    throw new EnvironmentError(missingVars);
  }
}

// Check if Google Maps API key is available
export function hasGoogleMapsApiKey(env: any): boolean {
  return !!env.GOOGLE_MAPS_API_KEY;
}

// Check if OpenRouter API key is available
export function hasOpenRouterApiKey(env: any): boolean {
  return !!env.OPENROUTER_API_KEY;
}

// Get Cloudflare image env vars with validation
export const getCloudflareImageEnvVars = (env: any): {
  accountId: string;
  accountHash: string;
  apiToken: string;
} => {
  validateCloudflareImageEnvVars(env);
  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accountHash: env.CLOUDFLARE_ACCOUNT_HASH,
    apiToken: env.CLOUDFLARE_IMAGES_API_TOKEN,
  };
}
