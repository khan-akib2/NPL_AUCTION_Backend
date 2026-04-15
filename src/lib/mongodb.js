import mongoose from 'mongoose';
import { setServers } from 'dns';

// Force Google DNS for Atlas SRV resolution
setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nit_auction';

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
