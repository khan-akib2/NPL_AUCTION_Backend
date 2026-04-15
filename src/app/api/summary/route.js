import { connectDB } from '@/lib/mongodb';
import Team from '@/lib/models/Team';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const teams = await Team.find().populate({ path: 'players', populate: { path: 'soldTo', select: 'name' } }).populate('captainId', 'name email');
    return Response.json({ teams });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
