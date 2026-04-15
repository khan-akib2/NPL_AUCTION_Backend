// Socket.IO server singleton — set by custom server.js via global._io
export function getIO() {
  return global._io || null;
}
