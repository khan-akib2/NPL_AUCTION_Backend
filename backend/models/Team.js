import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: '' },
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  budget: { type: Number, default: 1000 },
  pointsSpent: { type: Number, default: 0 },
  playerCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.Team || mongoose.model('Team', TeamSchema);
