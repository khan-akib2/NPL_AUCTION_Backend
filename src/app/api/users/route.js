import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const users = await User.find({ role: 'captain' }).select('-passwordHash').sort({ name: 1 });
    return Response.json({ users });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
