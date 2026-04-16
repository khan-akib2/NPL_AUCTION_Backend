import { connectDB } from '@/lib/mongodb';
import AuctionSession from '@/lib/models/AuctionSession';
import Player from '@/lib/models/Player';
import Team from '@/lib/models/Team';

export async function GET() {
  try {
    await connectDB();
    const session = await AuctionSession.findOne({ status: 'active' })
      .populate('playerId')
      .populate('currentHighestBidder', 'name');
    return Response.json({ session });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
