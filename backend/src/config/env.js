// Central configuration. Every secret and environment-specific value is read from
// backend/.env (see .env.example) — nothing sensitive is hardcoded in the source.
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

// `node --test` sets NODE_TEST_CONTEXT in test processes, so tests get NODE_ENV=test automatically.
const nodeEnv = process.env.NODE_ENV || (process.env.NODE_TEST_CONTEXT ? 'test' : 'development');
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const toBool = (value, fallback) => (value === undefined || value === '' ? fallback : /^(1|true|yes)$/i.test(value));
const list = (value) => (value || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

const port = toInt(process.env.PORT, 4000);
const frontendPort = toInt(process.env.FRONTEND_PORT, 5173);

// GitHub Codespaces exposes each forwarded port on its own URL, e.g.
// https://<codespace-name>-5173.app.github.dev. Codespaces sets these two variables,
// so we can work out the frontend's forwarded origin (for CORS) and the API's public URL.
const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
const codespacesUrl = (p) =>
  CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${CODESPACE_NAME}-${p}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const configuredOrigins = list(process.env.CLIENT_ORIGIN);
const clientOrigins = [
  ...new Set([
    ...(configuredOrigins.length ? configuredOrigins : [`http://localhost:${frontendPort}`, `http://127.0.0.1:${frontendPort}`]),
    codespacesUrl(frontendPort),
  ].filter(Boolean)),
];

let jwtSecret = (process.env.JWT_SECRET || '').trim();
let jwtSecretGenerated = false;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET must be set in backend/.env when NODE_ENV=production.');
  // Development convenience only: a random per-process secret, so the app still runs
  // without a .env file. Tokens stop working whenever the server restarts.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  jwtSecretGenerated = true;
}

export const env = Object.freeze({
  nodeEnv,
  isProd,
  isTest,
  port,
  frontendPort,
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  mongoDbName: process.env.MONGODB_DB || 'taskparty',
  jwtSecret,
  jwtSecretGenerated,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h', // Assessment 1 §4: 24-hour tokens
  bcryptRounds: Math.max(10, toInt(process.env.BCRYPT_ROUNDS, 12)), // Assessment 1 §3.3: at least 10 rounds
  clientOrigins,
  seedOnEmpty: toBool(process.env.SEED_ON_EMPTY, !isProd && !isTest),
  authRateLimit: toInt(process.env.AUTH_RATE_LIMIT, 50),
  // Codespaces forwards traffic through a proxy; trusting one hop gives rate limiting the real client IP.
  trustProxy: process.env.TRUST_PROXY !== undefined ? toInt(process.env.TRUST_PROXY, 0) : CODESPACE_NAME ? 1 : 0,
  publicApiUrl: codespacesUrl(port) || `http://localhost:${port}`,
});
