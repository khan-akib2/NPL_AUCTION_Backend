import { Router } from 'express';
import AuctionSession from '../models/AuctionSession.js';
import AuctionLog from '../models/AuctionLog.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';
import { authMiddleware, adminOnly, captainOnly } from '../lib/auth.js';

const router = Router();
const getIO = () => global._io;

// Server-side timer — one interval per active session
let _timerInterval = null;

function clearTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

async function autoUnsold(sessionId) {
  clearTimer();
  try {
    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return;
    session.status = 'closed'; session.endedAt = new Date(); await session.save();
    const player = await Player.findByIdAndUpdate(session.playerId, { status: 'unsold' }, { returnDocument: 'after' });
    await AuctionLog.create({ playerId: session.playerId, action: 'unsold', amount: 0 });
    const io = getIO();
    if (io) io.emit('auction:unsold', { player, session });
  } catch (e) { console.error('autoUnsold error:', e.message); }
}

export function startTimerResume(session) {
  startTimer(session);
}

function startTimer(session) {
  clearTimer();
  _timerInterval = setInterval(async () => {
    try {
      const s = await AuctionSession.findById(session._id);
      if (!s || s.status !== 'active' || s.timerPaused) return;
      s.timerRemaining = Math.max(0, s.timerRemaining - 1);
      await s.save();
      const io = getIO();
      if (io) io.emit('auction:timer', { remaining: s.timerRemaining, paused: false });
      if (s.timerRemaining <= 0) await autoUnsold(s._id);
    } catch (e) { console.error('timer tick error:', e.message); }
  }, 1000);
}

// GET /api/auction/active
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const session = await AuctionSession.findOne({ status: 'active' })
      .populate('playerId').populate('currentHighestBidder', 'name');
    if (session && !session.playerId) {
      session.status = 'closed'; session.endedAt = new Date(); await session.save();
      return res.json({ session: null });
    }
    res.json({ session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auction/active-public
router.get('/active-public', async (_req, res) => {
  try {
    const session = await AuctionSession.findOne({ status: 'active' })
      .populate('playerId').populate('currentHighestBidder', 'name');
    res.json({ session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/start
router.post('/start', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { playerId, timerDuration = 30 } = req.body;
    await AuctionSession.updateMany({ status: 'active' }, { status: 'closed', endedAt: new Date() });
    clearTimer();
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (!['available', 'resold', 'unsold'].includes(player.status))
      return res.status(400).json({ error: 'Player not available' });

    const session = await AuctionSession.create({
      playerId, currentBid: player.basePrice, status: 'active',
      timerDuration, timerRemaining: timerDuration, timerPaused: false,
    });
    const io = getIO();
    if (io) io.emit('auction:start', { session, player });
    startTimer(session);
    res.status(201).json({ session, player });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/bid
router.post('/bid', authMiddleware, captainOnly, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    if (!req.user.teamId) return res.status(400).json({ error: 'No team assigned to your account' });

    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ error: 'No active auction' });

    const team = await Team.findById(req.user.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.playerCount >= 7) return res.status(400).json({ error: 'Squad is full (7 players max)' });

    const newBid = session.currentBid + 10;
    if (team.budget < newBid) return res.status(400).json({ error: 'Insufficient budget' });

    session.currentBid = newBid;
    session.currentHighestBidder = team._id;
    session.currentHighestBidderName = team.name;
    session.bids.push({ teamId: team._id, teamName: team.name, amount: newBid });
    // Do NOT reset timer on bid — timer only resumes manually
    await session.save();
    await AuctionLog.create({ playerId: session.playerId, teamId: team._id, action: 'bid', amount: newBid });

    const io = getIO();
    if (io) {
      io.emit('auction:bid_update', { sessionId: session._id, currentBid: newBid, bidderTeamName: team.name, bidderTeamId: team._id });
      io.emit('auction:timer', { remaining: session.timerRemaining, paused: false });
    }
    res.json({ session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/sold
router.post('/sold', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ error: 'No active auction' });
    if (!session.currentHighestBidder) return res.status(400).json({ error: 'No bids placed' });

    session.status = 'closed'; session.endedAt = new Date(); await session.save();
    clearTimer();
    const player = await Player.findByIdAndUpdate(session.playerId,
      { status: 'sold', soldTo: session.currentHighestBidder, soldPrice: session.currentBid }, { returnDocument: 'after' });
    const team = await Team.findByIdAndUpdate(session.currentHighestBidder,
      { $push: { players: session.playerId }, $inc: { budget: -session.currentBid, pointsSpent: session.currentBid, playerCount: 1 } },
      { returnDocument: 'after' });

    await AuctionLog.create({ playerId: session.playerId, teamId: session.currentHighestBidder, action: 'sold', amount: session.currentBid });
    const io = getIO();
    if (io) io.emit('auction:sold', { player, team, session });
    res.json({ player, team, session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/unsold
router.post('/unsold', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await AuctionSession.findById(sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ error: 'No active auction' });

    session.status = 'closed'; session.endedAt = new Date(); await session.save();
    clearTimer();
    const player = await Player.findByIdAndUpdate(session.playerId, { status: 'unsold' }, { returnDocument: 'after' });
    await AuctionLog.create({ playerId: session.playerId, action: 'unsold', amount: 0 });

    const io = getIO();
    if (io) io.emit('auction:unsold', { player, session });
    res.json({ player, session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/timer/pause
router.post('/timer/pause', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await AuctionSession.findOne({ status: 'active' });
    if (!session) return res.status(400).json({ error: 'No active auction' });
    session.timerPaused = true; await session.save();
    const io = getIO();
    if (io) io.emit('auction:timer', { remaining: session.timerRemaining, paused: true });
    res.json({ remaining: session.timerRemaining, paused: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/timer/resume
router.post('/timer/resume', authMiddleware, adminOnly, async (req, res) => {
  try {
    const session = await AuctionSession.findOne({ status: 'active' });
    if (!session) return res.status(400).json({ error: 'No active auction' });
    session.timerPaused = false; await session.save();
    // Restart interval if not running
    if (!_timerInterval) startTimer(session);
    const io = getIO();
    if (io) io.emit('auction:timer', { remaining: session.timerRemaining, paused: false });
    res.json({ remaining: session.timerRemaining, paused: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auction/resale
router.post('/resale', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { teamId } = req.body;
    const team = await Team.findById(teamId).populate('players');
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const soldPlayers = await Player.find({ _id: { $in: team.players }, status: 'sold', soldTo: teamId });
    if (!soldPlayers.length) return res.status(400).json({ error: 'No players to resell' });

    const highest = soldPlayers.reduce((a, b) => a.soldPrice > b.soldPrice ? a : b);
    const refund = highest.soldPrice;

    await Player.findByIdAndUpdate(highest._id, { status: 'resold', soldTo: null, soldPrice: null });
    await Team.findByIdAndUpdate(teamId, {
      $pull: { players: highest._id },
      $inc: { budget: refund, pointsSpent: -refund, playerCount: -1 },
    });
    await AuctionLog.create({ playerId: highest._id, teamId, action: 'resale_triggered', amount: refund });

    const updatedTeam = await Team.findById(teamId).populate('players');
    const io = getIO();
    if (io) io.emit('auction:resale', { player: highest, team: updatedTeam });
    res.json({ player: highest, team: updatedTeam });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auction/log
router.get('/log', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, pageSize = 500 } = req.query;
    const p = Math.max(1, parseInt(page));
    const ps = Math.min(500, parseInt(pageSize));
    const total = await AuctionLog.countDocuments();
    const logs = await AuctionLog.find()
      .populate('playerId', 'name').populate('teamId', 'name')
      .sort({ timestamp: -1 }).skip((p - 1) * ps).limit(ps);
    res.json({ logs, total, page: p, pageSize: ps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
