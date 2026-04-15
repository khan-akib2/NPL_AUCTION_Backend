import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import Team from '@/lib/models/Team';
import Player from '@/lib/models/Player';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const TEAM_NAMES = ['Thunder Hawks', 'Storm Riders', 'Iron Wolves', 'Fire Eagles', 'Steel Panthers', 'Blaze Titans', 'Shadow Strikers', 'Royal Knights'];
const SKILLS = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper', 'Fielder'];
const PLAYER_NAMES = [
  'Arjun Sharma','Rohit Verma','Vikas Singh','Amit Kumar','Suresh Patel','Deepak Yadav','Rahul Gupta','Nikhil Joshi',
  'Pradeep Nair','Sanjay Mehta','Karan Tiwari','Aakash Dubey','Manish Chauhan','Vikram Bose','Rajesh Pillai','Ankit Mishra',
  'Gaurav Saxena','Harish Reddy','Naveen Iyer','Sunil Kapoor','Tarun Malhotra','Vivek Pandey','Yash Srivastava','Zaid Khan',
  'Abhishek Rao','Bharat Jain','Chirag Agarwal','Dinesh Patil','Eshan Thakur','Farhan Ansari','Girish Nanda','Hemant Shukla',
  'Ishaan Trivedi','Jayesh Kulkarni','Kartik Bansal','Lokesh Choudhary','Mohit Rathore','Neeraj Bajaj','Om Prakash','Piyush Garg',
  'Qasim Ali','Ravi Shankar','Sameer Wagh','Tanmay Desai','Umesh Pawar','Varun Khanna','Wasim Akram Jr','Xander Pereira',
  'Yogesh Bhatt','Zaheer Hussain','Arun Menon','Balaji Krishnan','Chetan Solanki','Devraj Yadav','Eknath Patil','Faisal Siddiqui',
];

export async function GET(request) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.SEED_SECRET || 'seed123')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Team.deleteMany({});
    await Player.deleteMany({});

    const adminHash = await bcrypt.hash('admin123', 10);
    await User.create({ name: 'Admin', email: 'admin@nit.com', passwordHash: adminHash, role: 'admin' });

    // Create teams and captains
    for (let i = 0; i < 8; i++) {
      const captainHash = await bcrypt.hash(`captain${i + 1}`, 10);
      const captain = await User.create({
        name: `Captain ${TEAM_NAMES[i]}`,
        email: `captain${i + 1}@nit.com`,
        passwordHash: captainHash,
        role: 'captain',
      });
      const team = await Team.create({ name: TEAM_NAMES[i], captainId: captain._id });
      await User.findByIdAndUpdate(captain._id, { teamId: team._id });
    }

    // Create 56 players
    const playerDocs = PLAYER_NAMES.slice(0, 56).map((name, i) => ({
      name,
      skills: [SKILLS[i % SKILLS.length], SKILLS[(i + 1) % SKILLS.length]],
      basePrice: 50,
      status: 'available',
    }));
    await Player.insertMany(playerDocs);

    return Response.json({ message: 'Seeded successfully', teams: 8, players: 56 });
  } catch (e) {
    console.error('SEED ERROR:', e);
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
