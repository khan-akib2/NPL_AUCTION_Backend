import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';

const router = Router();

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

// GET /api/seed?secret=<SEED_SECRET>
router.get('/', async (req, res) => {
  const secret = req.query.secret;
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await User.deleteMany({});
    await Team.deleteMany({});
    await Player.deleteMany({});

    const adminHash = await bcrypt.hash('admin123', 10);
    await User.create({ name: 'Admin', email: 'admin@nit.com', passwordHash: adminHash, role: 'admin' });

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

    const playerDocs = PLAYER_NAMES.slice(0, 56).map((name, i) => ({
      name,
      skills: [SKILLS[i % SKILLS.length], SKILLS[(i + 1) % SKILLS.length]],
      basePrice: 50,
      status: 'available',
    }));
    await Player.insertMany(playerDocs);

    res.json({ message: 'Seeded successfully', teams: 8, players: 56 });
  } catch (e) {
    console.error('SEED ERROR:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
