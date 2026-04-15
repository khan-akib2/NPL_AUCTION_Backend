import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import Team from '@/lib/models/Team';
import AuctionLog from '@/lib/models/AuctionLog';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { getIO } from '@/lib/socket-server';

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'captain') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { sessionId } = await request.json();

    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return Response.json({ error: 'No active auction' }, { status: 400 });

    const team = await Team.findById(decoded.teamId);
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    if (team.playerCount >= 7) return Response.json({ error: 'Squad is full (7 players max)' }, { status: 400 });

    const newBid = session.currentBid + 10;
    if (team.budget < newBid) return Response.json({ error: 'Insufficient budget' }, { status: 400 });

    session.currentBid = newBid;
    session.currentHighestBidder = team._id;
    session.currentHighestBidderName = team.name;
    session.bids.push({ teamId: team._id, teamName: team.name, amount: newBid });
    await session.save();

    await AuctionLog.create({ playerId: session.playerId, teamId: team._id, action: 'bid', amount: newBid });

    const io = getIO();
    if (io) {
      io.emit('auction:bid_update', {
        sessionId: session._id,
        currentBid: newBid,
        bidderTeamName: team.name,
        bidderTeamId: team._id,
      });
    }

    return Response.json({ session });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
