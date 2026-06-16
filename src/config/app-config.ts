import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  publicBaseUrl: string;
  lanBaseUrl?: string;
  productionBaseUrl: string;
  databaseUrl: string;
  databaseSsl: boolean;
  redisUrl?: string;
  redisKeyPrefix: string;
  authIssuerUrl: string;
  authJwksUrl?: string;
  authAudience: string;
  authServiceKey: string;
  authDeniedPermissions: string[];
  authApiBaseUrl: string;
  oidcClientId: string;
  oidcClientSecret?: string;
  oidcRedirectUri: string;
  oidcLoginTransactionTtlSeconds: number;
  sessionCookieName: string;
  sessionMaxAgeSeconds: number;
  localTimeZone: string;
}

loadDotEnvFile();

function loadDotEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function boolFromEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function localDatabaseUrl(): string {
  const user = process.env.USER || process.env.LOGNAME || 'body_lab';
  return `postgres://${encodeURIComponent(user)}@localhost:5432/body_lab`;
}

export function loadAppConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: intFromEnv('PORT', 3020),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3020',
    lanBaseUrl: process.env.LAN_BASE_URL,
    productionBaseUrl: process.env.PRODUCTION_BASE_URL ?? 'https://lab.lafamila.xyz',
    databaseUrl: process.env.DATABASE_URL ?? localDatabaseUrl(),
    databaseSsl: boolFromEnv('DATABASE_SSL', false),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX ?? 'body-lab',
    authIssuerUrl: process.env.AUTH_ISSUER_URL ?? 'http://localhost:3032',
    authJwksUrl: process.env.AUTH_JWKS_URL,
    authAudience: process.env.AUTH_AUDIENCE ?? 'service:body-lab',
    authServiceKey: process.env.AUTH_SERVICE_KEY ?? 'body-lab',
    authDeniedPermissions: listFromEnv('AUTH_DENIED_PERMISSIONS', ['visitor']),
    authApiBaseUrl: process.env.AUTH_API_BASE_URL ?? process.env.AUTH_ISSUER_URL ?? 'http://localhost:3032',
    oidcClientId: process.env.BODY_LAB_OIDC_CLIENT_ID ?? 'body-lab-api',
    oidcClientSecret: process.env.BODY_LAB_OIDC_CLIENT_SECRET,
    oidcRedirectUri: process.env.BODY_LAB_OIDC_REDIRECT_URI ?? 'http://localhost:3020/session/oidc/callback',
    oidcLoginTransactionTtlSeconds: intFromEnv('BODY_LAB_OIDC_LOGIN_TRANSACTION_TTL_SECONDS', 300),
    sessionCookieName: process.env.BODY_LAB_SESSION_COOKIE_NAME ?? 'body_lab_session',
    sessionMaxAgeSeconds: intFromEnv('BODY_LAB_SESSION_MAX_AGE_SECONDS', 60 * 60 * 24 * 30),
    localTimeZone: process.env.BODY_LAB_LOCAL_TIME_ZONE ?? 'Asia/Seoul',
  };
}
