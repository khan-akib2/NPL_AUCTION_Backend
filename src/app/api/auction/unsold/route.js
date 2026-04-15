import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import Player from '@/lib/models/Player';
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

    session.status = 'closed';
    session.endedAt = new Date();
    await session.save();

    const player = await Player.findByIdAndUpdate(session.playerId, { status: 'unsold' }, { new: true });
    await AuctionLog.create({ playerId: session.playerId, action: 'unsold', amount: 0 });

    const io = getIO();
    if (io) io.emit('auction:unsold', { player, session });

    return Response.json({ player, session });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
