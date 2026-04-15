'use client';
import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

export default function AuctionControl() {
  const { request } = useApi();
  const socket = useSocket();
  const toast = useToast();

  const [players, setPlayers] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [teams, setTeams] = useState([]);

  const loadData = useCallback(async () => {
    const [pRes, sRes, tRes] = await Promise.all([
      request('/api/players'),
      request('/api/auction/active'),
      request('/api/teams'),
    ]);
    if (pRes) setPlayers(pRes.players || []);
    if (tRes) setTeams(tRes.teams || []);
    if (sRes?.session) {
      setActiveSession(sRes.session);
      setActivePlayer(sRes.session.playerId);
      setBidHistory(sRes.session.bids || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('auction:start', ({ session, player }) => {
      setActiveSession(session);
      setActivePlayer(player);
      setBidHistory([]);
      toast(`Auction started for ${player.name}`, 'info');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid, timestamp: new Date() }, ...prev]);
    });
    socket.on('auction:sold', ({ player, team }) => {
      toast(`${player.name} sold to ${team.name} for ${player.soldPrice} pts!`, 'success');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    socket.on('auction:unsold', ({ player }) => {
      toast(`${player.name} marked unsold`, 'warning');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    return () => { socket.off('auction:start'); socket.off('auction:bid_update'); socket.off('auction:sold'); socket.off('auction:unsold'); };
  }, [socket, toast, loadData]);

  const startBidding = async () => {
    if (!selectedPlayer) return toast('Select a player first', 'warning');
    setActionLoading(true);
    const res = await request('/api/auction/start', { method: 'POST', body: JSON.stringify({ playerId: selectedPlayer._id }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else { setActiveSession(res.session); setActivePlayer(res.player); setBidHistory([]); }
  };

  const markSold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/sold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
  };

  const markUnsold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/unsold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
  };

  const triggerResale = async (teamId) => {
    setActionLoading(true);
    const res = await request('/api/auction/resale', { method: 'POST', body: JSON.stringify({ teamId }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else { toast('Resale triggered', 'success'); loadData(); }
  };

  const availablePlayers = players.filter(p => ['available', 'resold'].includes(p.status));

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 h-full">
      <h1 className="text-2xl font-bold text-white mb-6">Auction Control</h1>
      <div className="grid grid-cols-12 gap-6 h-full">

        {/* Left: Player Queue */}
        <div className="col-span-3 bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Player Queue ({availablePlayers.length})</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {availablePlayers.map(p => (
              <button
                key={p._id}
                onClick={() => setSelectedPlayer(p)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedPlayer?._id === p._id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs opacity-70 mt-0.5">{p.skills?.join(', ')} · Base: {p.basePrice}pts</div>
                {p.status === 'resold' && <span className="text-xs text-amber-400">↩ Resold</span>}
              </button>
            ))}
            {availablePlayers.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No players available</p>}
          </div>
          <button
            onClick={startBidding}
            disabled={!selectedPlayer || !!activeSession || actionLoading}
            className="mt-4 w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {actionLoading ? <Spinner size="sm" /> : '▶ Start Bidding'}
          </button>
        </div>

        {/* Center: Active Auction */}
        <div className="col-span-6 bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col">
          {activeSession && activePlayer ? (
            <>
              <div className="flex items-start gap-6 mb-6">
                <div className="w-24 h-24 bg-slate-700 rounded-xl flex items-center justify-center text-4xl shrink-0">
                  {activePlayer.photo ? <img src={activePlayer.photo} alt={activePlayer.name} className="w-full h-full object-cover rounded-xl" /> : '👤'}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">{activePlayer.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                  </div>
                  <div className="text-slate-400 text-sm mt-2">Base Price: <span className="text-white font-medium">{activePlayer.basePrice} pts</span></div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 text-center mb-6 pulse-glow">
                <div className="text-slate-400 text-sm uppercase tracking-wider mb-1">Current Bid</div>
                <div className="text-5xl font-bold text-amber-400">{activeSession.currentBid}</div>
                <div className="text-slate-300 text-sm mt-2">
                  {activeSession.currentHighestBidderName
                    ? <>Highest: <span className="text-blue-400 font-semibold">{activeSession.currentHighestBidderName}</span></>
                    : <span className="text-slate-500">No bids yet</span>}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={markSold}
                  disabled={!activeSession.currentHighestBidder || actionLoading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-lg transition-colors"
                >
                  🏆 SOLD
                </button>
                <button
                  onClick={markUnsold}
                  disabled={actionLoading}
                  className="flex-1 bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  ✗ UNSOLD
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">🏏</div>
              <h2 className="text-xl font-semibold text-slate-300">No Active Auction</h2>
              <p className="text-slate-500 mt-2 text-sm">Select a player from the queue and click Start Bidding</p>
            </div>
          )}
        </div>

        {/* Right: Bid History + Resale */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Bids</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {bidHistory.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No bids yet</p>}
              {bidHistory.map((b, i) => (
                <div key={i} className="bg-slate-800 rounded-lg px-3 py-2 text-sm">
                  <div className="text-blue-400 font-medium">{b.teamName}</div>
                  <div className="text-amber-400 font-bold">{b.amount} pts</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Trigger Resale</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {teams.filter(t => t.budget < 50 && t.playerCount < 7).map(t => (
                <div key={t._id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm text-white font-medium">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.budget} pts left</div>
                  </div>
                  <button
                    onClick={() => triggerResale(t._id)}
                    className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    Resale
                  </button>
                </div>
              ))}
              {teams.filter(t => t.budget < 50 && t.playerCount < 7).length === 0 && (
                <p className="text-slate-500 text-xs text-center py-2">No teams need resale</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
