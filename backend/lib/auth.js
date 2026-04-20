import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nit_auction_secret_2024';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  // Validate token matches active session in DB
  const user = await User.findById(decoded.id).select('activeToken role teamId');
  if (!user || user.activeToken !== token) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }

  req.user = decoded;
  next();
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

export function captainOnly(req, res, next) {
  if (req.user?.role !== 'captain') return res.status(403).json({ error: 'Forbidden' });
  next();
}
