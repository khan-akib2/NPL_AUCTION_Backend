import jwt from 'jsonwebtoken';

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

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export function requireAuth(decoded, role = null) {
  if (!decoded) return { error: 'Unauthorized', status: 401 };
  if (role && decoded.role !== role) return { error: 'Forbidden', status: 403 };
  return null;
}
