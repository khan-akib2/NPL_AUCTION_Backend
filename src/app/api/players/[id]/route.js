import { connectDB } from '@/lib/mongodb';
import Player from '@/lib/models/Player';
import AuctionSession from '@/lib/models/AuctionSession';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const player = await Player.findByIdAndUpdate(id, body, { new: true });
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });
    return Response.json({ player });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { id } = await params;

    // Close any active auction session for this player
    await AuctionSession.updateMany(
      { playerId: id, status: 'active' },
      { status: 'closed', endedAt: new Date() }
    );

    await Player.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
