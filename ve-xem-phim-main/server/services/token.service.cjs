const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.cjs');

const JWT_SECRET = process.env.JWT_SECRET || 'cinex_jwt_secret_key_2026';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(user, role) {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  const accessToken = jwt.sign(
    { userId: user.id, role, type: 'access', jti: accessJti },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  const refreshToken = jwt.sign(
    { userId: user.id, role, type: 'refresh', jti: refreshJti },
    JWT_SECRET,
    { expiresIn: REFRESH_TTL }
  );
  const decoded = jwt.decode(refreshToken);
  await pool.query(
    `INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, FROM_UNIXTIME(?))`,
    [refreshJti, user.id, hashToken(refreshToken), decoded.exp]
  );
  return { token: accessToken, access_token: accessToken, refresh_token: refreshToken, expires_in: 900 };
}

async function rotateRefreshToken(refreshToken) {
  const decoded = jwt.verify(refreshToken, JWT_SECRET);
  if (decoded.type !== 'refresh' || !decoded.jti) throw new Error('INVALID_REFRESH_TOKEN');
  const [rows] = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE jti = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [decoded.jti, hashToken(refreshToken)]
  );
  if (!rows[0]) throw new Error('REFRESH_TOKEN_REVOKED');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = ? AND revoked_at IS NULL',
      [decoded.jti]
    );
    if (result.affectedRows !== 1) throw new Error('REFRESH_TOKEN_REUSED');
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { userId: decoded.userId, role: decoded.role };
}

async function blacklistAccessToken(token) {
  if (!token) return;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access' || !decoded.jti) return;
    await pool.query(
      `INSERT IGNORE INTO token_blacklist (jti, user_id, expires_at)
       VALUES (?, ?, FROM_UNIXTIME(?))`,
      [decoded.jti, decoded.userId, decoded.exp]
    );
  } catch {
    // An invalid or expired token needs no blacklist entry.
  }
}

async function revokeRefreshToken(token) {
  if (!token) return;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    if (decoded.type === 'refresh' && decoded.jti) {
      await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = ? AND revoked_at IS NULL', [decoded.jti]);
    }
  } catch {}
}

async function isBlacklisted(jti) {
  if (!jti) return true;
  const [rows] = await pool.query(
    'SELECT 1 FROM token_blacklist WHERE jti = ? AND expires_at > NOW() LIMIT 1',
    [jti]
  );
  return rows.length > 0;
}

module.exports = { JWT_SECRET, issueTokens, rotateRefreshToken, blacklistAccessToken, revokeRefreshToken, isBlacklisted };
