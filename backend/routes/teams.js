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

export default router;
