import mongoose from 'mongoose';
import './Team.js';

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  photo: { type: String, default: '' },
  skills: [{ type: String }],
  basePrice: { type: Number, default: 50 },
  status: { type: String, enum: ['available', 'sold', 'unsold', 'resold'], default: 'available' },
  soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  soldPrice: { type: Number, default: null },
}, { timestamps: true });

export default mongoose.models.Player || mongoose.model('Player', PlayerSchema);
