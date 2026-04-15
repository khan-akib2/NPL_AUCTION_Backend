import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    await connectDB();
    const { email, password } = await request.json();
    if (!email || !password) return Response.json({ error: 'Email and password required' }, { status: 400 });

    const user = await User.findOne({ email }).populate('teamId');
    if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = signToken({ id: user._id, role: user.role, teamId: user.teamId?._id || null });
    return Response.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, teamId: user.teamId },
    });
  } catch (e) {
    console.error('LOGIN ERROR:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
