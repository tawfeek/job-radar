import { verifyPassword, issueToken } from '../middleware/auth.js';

// POST /api/auth/login  body: { password }
export function login(req, res) {
  const { password } = req.body || {};
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.json({ token: issueToken() });
}
