import { connectDB } from '@/lib/mongodb';
import Player from '@/lib/models/Player';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const params = new URLSearchParams(request.nextUrl.search);
    const page = Math.max(1, parseInt(params.get('page') || '1'));
    const pageSize = Math.min(200, parseInt(params.get('pageSize') || '10'));
    const status = params.get('status');

    let query = decoded.role === 'captain' ? { status: { $in: ['available', 'resold'] } } : {};
    if (status && status !== 'all') query = { ...query, status };

    const total = await Player.countDocuments(query);
    const players = await Player.find(query)
      .populate('soldTo', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    return Response.json({ players, total, page, pageSize });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const body = await request.json();
    const player = await Player.create(body);
    return Response.json({ player }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
