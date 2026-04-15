import { connectDB } from '@/lib/mongodb';
import Team from '@/lib/models/Team';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const team = await Team.findByIdAndUpdate(id, body, { new: true });
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });
    return Response.json({ team });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
