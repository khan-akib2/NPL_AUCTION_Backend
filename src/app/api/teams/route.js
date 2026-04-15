import { connectDB } from '@/lib/mongodb';
import Team from '@/lib/models/Team';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    if (decoded.role === 'captain') {
      const team = await Team.findById(decoded.teamId).populate('players').populate('captainId', 'name email');
      return Response.json({ teams: team ? [team] : [] });
    }
    const teams = await Team.find().populate('players').populate('captainId', 'name email');
    return Response.json({ teams });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const body = await request.json();
    const team = await Team.create(body);
    return Response.json({ team }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
