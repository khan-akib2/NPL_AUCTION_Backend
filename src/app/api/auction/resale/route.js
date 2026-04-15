import { connectDB } from '@/lib/mongodb';
import Team from '@/lib/models/Team';
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
    const { teamId } = await request.json();

    const team = await Team.findById(teamId).populate('players');
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    // Find highest-priced player in team
    const soldPlayers = await Player.find({ _id: { $in: team.players }, status: 'sold', soldTo: teamId });
    if (!soldPlayers.length) return Response.json({ error: 'No players to resell' }, { status: 400 });

    const highestPriced = soldPlayers.reduce((a, b) => (a.soldPrice > b.soldPrice ? a : b));

    // Return player to pool
    const refundAmount = highestPriced.soldPrice;
    await Player.findByIdAndUpdate(highestPriced._id, { status: 'resold', soldTo: null, soldPrice: null });
    await Team.findByIdAndUpdate(teamId, {
      $pull: { players: highestPriced._id },
      $inc: { budget: refundAmount, pointsSpent: -refundAmount, playerCount: -1 },
    });

    await AuctionLog.create({ playerId: highestPriced._id, teamId, action: 'resale_triggered', amount: refundAmount });

    const updatedTeam = await Team.findById(teamId).populate('players');
    const io = getIO();
    if (io) io.emit('auction:resale', { player: highestPriced, team: updatedTeam });

    return Response.json({ player: highestPriced, team: updatedTeam });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
