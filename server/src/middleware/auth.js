// Single-password auth, simplified from the portfolio admin's JWT setup.
// Why so minimal: this is a self-hosted local-run tool where the threat
// model is "stop a curious roommate from messing with my Kanban", not
// "withstand a determined attacker". For multi-user SaaS, swap this out
// for proper user accounts + bcrypt + refresh tokens.

import './../config/env.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRY = '7d';

// Verify a plaintext password against the configured ADMIN_PASSWORD.
// Plain string compare (timing-safe) — bcrypt isn't worth its complexity
// for a single-password app. If you want to be cautious, hash it once
// and store the hash in env instead.
export function verifyPassword(plaintext) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  if (typeof plaintext !== 'string') return false;
  if (plaintext.length !== expected.length) return false;
  // Constant-time compare to avoid trivial timing attacks.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= plaintext.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function issueToken() {
  return jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Used by the tests / future scripts to hash a password once and stash it.
// Not used at runtime — left in for completeness.
export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 10);
}
