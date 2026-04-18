import { Router } from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';

const router = Router();

// GET /api/teams
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'captain') {
      const team = await Team.findById(req.user.teamId).populate('players').populate('captainId', 'name email');
      return res.json({ teams: team ? [team] : [] });
    }
    const teams = await Team.find().populate('players').populate('captainId', 'name email');
    res.json({ teams });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json({ team });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/teams/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ team });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    await User.updateMany({ teamId: req.params.id }, { teamId: null });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/teams/:teamId/remove-player/:playerId
// Admin removes a specific player from a team — player goes back to resold queue
import Player from '../models/Player.js';
import AuctionLog from '../models/AuctionLog.js';

router.post('/:teamId/remove-player/:playerId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { teamId, playerId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.soldTo?.toString() !== teamId)
      return res.status(400).json({ error: 'Player does not belong to this team' });

    const refund = player.soldPrice || 0;

    // Remove player from team, refund budget
    await Team.findByIdAndUpdate(teamId, {
      $pull: { players: player._id },
      $inc: { budget: refund, pointsSpent: -refund, playerCount: -1 },
    });

    // Mark player as resold
    await Player.findByIdAndUpdate(playerId, { status: 'resold', soldTo: null, soldPrice: null });

    await AuctionLog.create({ playerId, teamId, action: 'resale_triggered', amount: refund });

    const io = global._io;
    if (io) io.emit('auction:resale', { player, team });

    res.json({ success: true, refund });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
