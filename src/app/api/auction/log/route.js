import { connectDB } from '@/lib/mongodb';
import AuctionLog from '@/lib/models/AuctionLog';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const logs = await AuctionLog.find().populate('playerId', 'name').populate('teamId', 'name').sort({ timestamp: -1 }).limit(200);
    return Response.json({ logs });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
