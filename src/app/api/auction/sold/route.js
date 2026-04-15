import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import Player from '@/lib/models/Player';
import Team from '@/lib/models/Team';
import AuctionLog from '@/lib/models/AuctionLog';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { getIO } from '@/lib/socket-server';

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { sessionId } = await request.json();

    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return Response.json({ error: 'No active auction' }, { status: 400 });
    if (!session.currentHighestBidder) return Response.json({ error: 'No bids placed' }, { status: 400 });

    session.status = 'closed';
    session.endedAt = new Date();
    await session.save();

    const player = await Player.findByIdAndUpdate(session.playerId, {
      status: 'sold',
      soldTo: session.currentHighestBidder,
      soldPrice: session.currentBid,
    }, { new: true });

    const team = await Team.findByIdAndUpdate(session.currentHighestBidder, {
      $push: { players: session.playerId },
      $inc: { budget: -session.currentBid, pointsSpent: session.currentBid, playerCount: 1 },
    }, { new: true });

    await AuctionLog.create({ playerId: session.playerId, teamId: session.currentHighestBidder, action: 'sold', amount: session.currentBid });

    const io = getIO();
    if (io) {
      io.emit('auction:sold', { player, team, session });
    }

    return Response.json({ player, team, session });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
