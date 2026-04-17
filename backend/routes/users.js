import { Router } from 'express';
import User from '../models/User.js';
import { authMiddleware, adminOnly } from '../lib/auth.js';

const router = Router();

router.get('/', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const users = await User.find({ role: 'captain' }).select('-passwordHash').sort({ name: 1 });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
