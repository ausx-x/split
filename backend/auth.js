/**
 * Authentication and Security Module
 * Salted Scrypt hashing, timingSafeEqual, session tokens
 */

const crypto = require('node:crypto');
const db = require('./db');

// Hash password with salt
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

// Verify password against stored hash & salt
function verifyPassword(password, savedHash, salt) {
  if (!password || !savedHash || !salt) return false;
  try {
    const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(savedHash, 'hex'),
      Buffer.from(derivedHash, 'hex')
    );
  } catch (e) {
    return false;
  }
}

// Create a new session token (30 days validity)
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return { token, expiresAt };
}

// Destroy a session token
function destroySession(token) {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

// Clean up expired sessions periodically
function purgeExpiredSessions() {
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);
}

// Validate bearer token and return user
function authenticateToken(token) {
  if (!token) return null;

  purgeExpiredSessions();

  const session = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, u.id, u.name, u.short_name, u.email, u.avatar, u.color, u.default_currency, u.upi_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) return null;

  return {
    id: session.id,
    name: session.name,
    short_name: session.short_name,
    email: session.email,
    avatar: session.avatar,
    color: session.color,
    default_currency: session.default_currency,
    upi_id: session.upi_id
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  authenticateToken
};
