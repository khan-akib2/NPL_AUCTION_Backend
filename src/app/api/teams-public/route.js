import { connectDB } from '@/lib/mongodb';
import Team from '@/lib/models/Team';

export async function GET() {
  try {
    await connectDB();
    const teams = await Team.find().select('name budget pointsSpent playerCount').sort({ name: 1 });
    return Response.json({ teams });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
