import { connectDB } from '@/lib/mongodb';
import AuctionLog from '@/lib/models/AuctionLog';
import Player from '@/lib/models/Player';
import Team from '@/lib/models/Team';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(500, parseInt(searchParams.get('pageSize') || '500'));

    const total = await AuctionLog.countDocuments();
    const logs = await AuctionLog.find()
      .populate('playerId', 'name')
      .populate('teamId', 'name')
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    return Response.json({ logs, total, page, pageSize });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
