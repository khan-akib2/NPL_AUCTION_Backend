import { Router } from 'express';
import Player from '../models/Player.js';
import AuctionSession from '../models/AuctionSession.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';

const router = Router();

// GET /api/players/public — no auth required, shows all players with basic info
router.get('/public', async (_req, res) => {
  try {
    const players = await Player.find()
      .populate('soldTo', 'name')
      .select('name photo skills basePrice status soldTo soldPrice')
      .sort({ name: 1 });
    res.json({ players });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/players
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query;
    const p = Math.max(1, parseInt(page));
    const ps = Math.min(200, parseInt(pageSize));

    let query = req.user.role === 'captain' ? { status: { $in: ['available', 'resold'] } } : {};
    if (status && status !== 'all') query = { ...query, status };

    const total = await Player.countDocuments(query);
    const players = await Player.find(query)
      .populate('soldTo', 'name')
      .sort({ createdAt: -1 })
      .skip((p - 1) * ps)
      .limit(ps);

    res.json({ players, total, page: p, pageSize: ps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/players
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const player = await Player.create(req.body);
    res.status(201).json({ player });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/players/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json({ player });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/players/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await AuctionSession.updateMany(
      { playerId: req.params.id, status: 'active' },
      { status: 'closed', endedAt: new Date() }
    );
    await Player.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
