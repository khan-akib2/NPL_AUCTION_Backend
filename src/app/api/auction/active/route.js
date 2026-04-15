import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const session = await AuctionSession.findOne({ status: 'active' }).populate('playerId').populate('currentHighestBidder', 'name');
    return Response.json({ session });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
