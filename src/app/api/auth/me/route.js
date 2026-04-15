import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const user = await User.findById(decoded.id).populate('teamId').select('-passwordHash');
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    return Response.json({ user });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
