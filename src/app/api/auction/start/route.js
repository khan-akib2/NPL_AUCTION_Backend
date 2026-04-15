import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import Player from '@/lib/models/Player';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { getIO } from '@/lib/socket-server';

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { playerId } = await request.json();

    // Close any existing active session
    await AuctionSession.updateMany({ status: 'active' }, { status: 'closed', endedAt: new Date() });

    const player = await Player.findById(playerId);
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });
    if (!['available', 'resold'].includes(player.status)) {
      return Response.json({ error: 'Player not available for auction' }, { status: 400 });
    }

    const session = await AuctionSession.create({
      playerId,
      currentBid: player.basePrice,
      status: 'active',
    });

    const io = getIO();
    if (io) {
      io.emit('auction:start', { session, player });
    }

    return Response.json({ session, player }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
