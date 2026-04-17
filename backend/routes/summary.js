import { Router } from 'express';
import Team from '../models/Team.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';

const router = Router();

router.get('/', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const teams = await Team.find()
      .populate({ path: 'players', populate: { path: 'soldTo', select: 'name' } })
      .populate('captainId', 'name email');
    res.json({ teams });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
