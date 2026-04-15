'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

export default function CaptainDashboard() {
  const { user, logout } = useAuth();
  const { request } = useApi();
  const socket = useSocket();
  const toast = useToast();
  const router = useRouter();

  const [team, setTeam] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);

  const loadData = useCallback(async () => {
    const [teamRes, sessionRes] = await Promise.all([
      request('/api/teams'),
      request('/api/auction/active'),
    ]);
    if (teamRes?.teams?.[0]) setTeam(teamRes.teams[0]);
    if (sessionRes?.session) {
      setActiveSession(sessionRes.session);
      setActivePlayer(sessionRes.session.playerId);
      setBidHistory(sessionRes.session.bids?.slice().reverse() || []);
    } else {
      setActiveSession(null);
      setActivePlayer(null);
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
      toast(`New auction: ${player.name}`, 'info');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName, currentHighestBidder: data.bidderTeamId } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid, timestamp: new Date() }, ...prev]);
      if (data.bidderTeamId !== team?._id?.toString()) {
        toast(`${data.bidderTeamName} bid ${data.currentBid} pts — you've been outbid!`, 'warning');
      }
    });
    socket.on('auction:sold', ({ player, team: soldTeam }) => {
      if (soldTeam._id === team?._id?.toString()) {
        toast(`You won ${player.name} for ${player.soldPrice} pts!`, 'success');
      } else {
        toast(`${player.name} sold to ${soldTeam.name}`, 'info');
      }
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    socket.on('auction:unsold', ({ player }) => {
      toast(`${player.name} went unsold`, 'info');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
    });
    return () => {
      socket.off('auction:start'); socket.off('auction:bid_update');
      socket.off('auction:sold'); socket.off('auction:unsold');
    };
  }, [socket, toast, team, loadData]);

  const placeBid = async () => {
    if (!activeSession) return;
    setBidding(true);
    const res = await request('/api/auction/bid', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setBidding(false);
    if (res?.error) toast(res.error, 'error');
    else toast('Bid placed!', 'success');
  };

  const handleLogout = () => { logout(); router.push('/login'); };

  const canBid = activeSession &&
    team &&
    team.budget >= (activeSession.currentBid + 10) &&
    team.playerCount < 7;

  const isHighestBidder = activeSession?.currentHighestBidder?.toString() === team?._id?.toString();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Spinner size="lg" /></div>;

  const budgetPct = team ? Math.round((team.pointsSpent / 1000) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Bar */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-blue-400 font-bold text-lg">🏏 NIT AUCTION</div>
          <div className="h-5 w-px bg-slate-700" />
          <div>
            <span className="text-white font-semibold">{team?.name}</span>
            <span className="text-slate-400 text-sm ml-2">· {user?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-amber-400 font-bold text-xl">{team?.budget ?? 0} pts</div>
            <div className="text-slate-500 text-xs">remaining budget</div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 text-sm transition-colors">Logout</button>
        </div>
      </header>

      <div className="p-6 grid grid-cols-12 gap-6">
        {/* Live Auction */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Live Auction</h2>
            {activeSession && activePlayer ? (
              <>
                <div className="flex items-start gap-6 mb-6">
                  <div className="w-20 h-20 bg-slate-700 rounded-xl flex items-center justify-center text-3xl shrink-0">
                    {activePlayer.photo ? <img src={activePlayer.photo} alt={activePlayer.name} className="w-full h-full object-cover rounded-xl" /> : '👤'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{activePlayer.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                    </div>
                    <div className="text-slate-400 text-sm mt-1">Base: {activePlayer.basePrice} pts</div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 text-center mb-5 pulse-glow">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Current Bid</div>
                  <div className="text-4xl font-bold text-amber-400">{activeSession.currentBid} pts</div>
                  <div className="text-sm mt-2">
                    {activeSession.currentHighestBidderName
                      ? <span className={isHighestBidder ? 'text-green-400 font-semibold' : 'text-slate-300'}>
                          {isHighestBidder ? '✓ You are highest bidder' : `Highest: ${activeSession.currentHighestBidderName}`}
                        </span>
                      : <span className="text-slate-500">No bids yet — be first!</span>}
                  </div>
                </div>

                <button
                  onClick={placeBid}
                  disabled={!canBid || bidding}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {bidding ? <Spinner size="sm" /> : `Place Bid (+10) → ${(activeSession.currentBid + 10)} pts`}
                </button>
                {!canBid && activeSession && (
                  <p className="text-center text-red-400 text-xs mt-2">
                    {team?.playerCount >= 7 ? 'Squad full (7/7)' : `Insufficient budget (need ${activeSession.currentBid + 10} pts)`}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">⏳</div>
                <h3 className="text-lg font-semibold text-slate-300">Waiting for auction to start</h3>
                <p className="text-slate-500 text-sm mt-1">Admin will start the next player auction shortly</p>
              </div>
            )}
          </div>

          {/* Bid History */}
          {bidHistory.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Bid History</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {bidHistory.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 text-sm">
                    <span className="text-blue-400 font-medium">{b.teamName}</span>
                    <span className="text-amber-400 font-bold">{b.amount} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: My Squad + Budget */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Budget */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Budget Tracker</h2>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Spent: <span className="text-white font-medium">{team?.pointsSpent || 0} pts</span></span>
              <span className="text-slate-400">Remaining: <span className="text-amber-400 font-medium">{team?.budget || 0} pts</span></span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="text-center text-slate-500 text-xs mt-1">{budgetPct}% used</div>
          </div>

          {/* My Squad */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">My Squad</h2>
              <span className="text-slate-400 text-sm">{team?.playerCount || 0}/7</span>
            </div>
            <div className="space-y-2">
              {team?.players?.map(p => (
                <div key={p._id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2.5">
                  <div>
                    <div className="text-white text-sm font-medium">{p.name}</div>
                    <div className="flex gap-1 mt-0.5">{p.skills?.slice(0, 2).map(s => <SkillBadge key={s} skill={s} />)}</div>
                  </div>
                  <div className="text-amber-400 text-sm font-bold">{p.soldPrice} pts</div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 7 - (team?.players?.length || 0)) }).map((_, i) => (
                <div key={`slot-${i}`} className="border border-dashed border-slate-700 rounded-lg px-3 py-2.5 text-center text-slate-600 text-xs">
                  Empty slot
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
