'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';
import Logo from '@/components/Logo';

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
  const [tab, setTab] = useState('auction');

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
      setActiveSession(null); setActivePlayer(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setTab('auction');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName, currentHighestBidder: data.bidderTeamId } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
      if (data.bidderTeamId !== team?._id?.toString()) toast(`Outbid — ${data.currentBid} pts`, 'warning');
    });
    socket.on('auction:sold', ({ player, team: soldTeam }) => {
      if (soldTeam._id === team?._id?.toString()) toast(`Won: ${player.name}`, 'success');
      else toast(`${player.name} → ${soldTeam.name}`, 'info');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    socket.on('auction:unsold', () => { setActiveSession(null); setActivePlayer(null); setBidHistory([]); });
    return () => { socket.off('auction:start'); socket.off('auction:bid_update'); socket.off('auction:sold'); socket.off('auction:unsold'); };
  }, [socket, toast, team, loadData]);

  const placeBid = async () => {
    if (!activeSession) return;
    setBidding(true);
    const res = await request('/api/auction/bid', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setBidding(false);
    if (res?.error) toast(res.error, 'error');
  };

  const canBid = activeSession && team && team.budget >= (activeSession.currentBid + 10) && team.playerCount < 7;
  const isLeading = activeSession?.currentHighestBidder?.toString() === team?._id?.toString();
  const budgetPct = team ? Math.round((team.pointsSpent / 1000) * 100) : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a1628]"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Header */}
      <header className="bg-[#0d1e3a] border-b border-[#c9a227]/15 px-4 lg:px-8 h-12 lg:h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Logo size="sm" className="shrink-0 rounded-xl w-7 h-7" />
          <span className="text-[#c9a227]/50 text-xs uppercase tracking-widest hidden sm:block">NIT</span>
          <span className="text-[#c9a227]/20 hidden sm:block">·</span>
          <span className="text-white text-sm font-semibold truncate">{team?.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[#c9a227] font-bold text-sm">{team?.budget ?? 0}</span>
            <span className="text-white/40 text-xs ml-1">pts</span>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }} className="text-white/30 hover:text-white/50 text-xs transition-colors">
            Out
          </button>
        </div>
      </header>

      {/* Budget strip */}
      <div className="h-0.5 bg-[#c9a227]/8">
        <div className="h-full bg-white/20 transition-all duration-700" style={{ width: `${budgetPct}%` }} />
      </div>

      {/* Mobile tabs */}
      <div className="flex border-b border-[#c9a227]/15 lg:hidden">
        <button onClick={() => setTab('auction')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${tab === 'auction' ? 'text-white border-b border-white' : 'text-white/30'}`}>
          Live Auction
        </button>
        <button onClick={() => setTab('squad')}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${tab === 'squad' ? 'text-white border-b border-white' : 'text-white/30'}`}>
          My Squad ({team?.playerCount || 0}/7)
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row lg:gap-5 p-4 lg:p-6 gap-4">

        {/* Auction panel */}
        <div className={`flex-1 flex flex-col gap-4 ${tab !== 'auction' ? 'hidden lg:flex' : 'flex'}`}>
          {activeSession && activePlayer ? (
            <>
              {/* Main player card */}
              <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-2xl">
                {/* Player photo section */}
                <div className="relative h-64 lg:h-80 overflow-hidden bg-gradient-to-br from-[#0a1628] to-[#0d1e3a]">
                  {activePlayer.photo ? (
                    <>
                      <img src={activePlayer.photo} alt={activePlayer.name}
                        className="absolute inset-0 w-full h-full object-cover object-top" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1e3a] via-[#0d1e3a]/60 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-[#c9a227]/10 flex items-center justify-center">
                        <span className="text-6xl text-[#c9a227]/30">👤</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Player info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#c9a227] text-xs uppercase tracking-[0.15em] font-semibold mb-2 opacity-80">
                          {activePlayer.skills?.[0] || 'Player'}
                        </p>
                        <h1 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight leading-none mb-3">
                          {activePlayer.name}
                        </h1>
                        <div className="flex flex-wrap gap-1.5">
                          {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                        </div>
                      </div>
                      <div className="bg-[#0a1628]/80 backdrop-blur-sm border border-[#c9a227]/20 rounded-lg px-3 py-2 text-center shrink-0">
                        <p className="text-white/40 text-[10px] uppercase tracking-wider">Base</p>
                        <p className="text-white font-bold text-sm">{activePlayer.basePrice}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bidding section */}
                <div className="p-5 lg:p-6 bg-[#0a1628]/50">
                  {/* Current bid display */}
                  <div className="flex items-center justify-between mb-5 pb-5 border-b border-[#c9a227]/10">
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-[0.12em] mb-1.5">Current Bid</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl lg:text-5xl font-black text-[#c9a227] tabular-nums leading-none">
                          {activeSession.currentBid}
                        </span>
                        <span className="text-white/30 text-base font-medium">pts</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs uppercase tracking-[0.12em] mb-1.5">Leading</p>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                        isLeading 
                          ? 'bg-[#c9a227]/15 border border-[#c9a227]/30' 
                          : 'bg-white/5 border border-white/10'
                      }`}>
                        {isLeading && <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />}
                        <span className={`text-sm font-semibold ${isLeading ? 'text-[#c9a227]' : 'text-white/50'}`}>
                          {activeSession.currentHighestBidderName
                            ? isLeading ? 'You' : activeSession.currentHighestBidderName
                            : 'No bids'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bid button */}
                  <button 
                    onClick={placeBid} 
                    disabled={!canBid || bidding}
                    className="w-full bg-[#c9a227] text-[#0a1628] font-black py-4 rounded-xl text-base transition-all hover:bg-[#f0c040] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-[#c9a227]/20 active:scale-[0.98]"
                  >
                    {bidding ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <span className="text-2xl">↑</span>
                        <span>Place Bid · {activeSession.currentBid + 10} pts</span>
                      </>
                    )}
                  </button>
                  
                  {/* Status message */}
                  {!canBid && activeSession && (
                    <div className="mt-3 text-center">
                      <p className="text-white/40 text-xs">
                        {team?.playerCount >= 7 
                          ? '⚠️ Squad is full (7/7 players)' 
                          : `⚠️ Insufficient budget · Need ${activeSession.currentBid + 10} pts, have ${team?.budget} pts`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bid history */}
              {bidHistory.length > 0 && (
                <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📊</span>
                    <p className="text-white/60 text-sm font-semibold uppercase tracking-wider">Bid History</p>
                    <span className="ml-auto text-white/30 text-xs">{bidHistory.length} bids</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {bidHistory.map((b, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#0a1628]/50 border border-[#c9a227]/5 hover:border-[#c9a227]/15 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white/20 text-xs font-mono">#{bidHistory.length - i}</span>
                          <span className="text-white/60 text-sm">{b.teamName}</span>
                        </div>
                        <span className="text-[#c9a227] font-bold text-sm tabular-nums">{b.amount} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
              <div className="w-20 h-20 rounded-full bg-[#c9a227]/5 flex items-center justify-center mb-4">
                <span className="text-4xl">⏳</span>
              </div>
              <p className="text-white/60 text-lg font-semibold mb-2">Waiting for Auction</p>
              <p className="text-white/30 text-sm">The next player will appear here shortly</p>
            </div>
          )}
        </div>

        {/* Squad panel */}
        <div className={`lg:w-72 flex flex-col gap-4 ${tab !== 'squad' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/40 text-xs uppercase tracking-wider">Budget</p>
              <p className="text-white text-sm font-medium">{team?.budget} pts</p>
            </div>
            <div className="h-1 bg-[#c9a227]/8 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-white/25 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-1.5">
              <span>Spent: {team?.pointsSpent || 0}</span>
              <span>{budgetPct}%</span>
            </div>
          </div>

          <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl p-4 flex-1">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">My Squad · {team?.playerCount || 0}/7</p>
            <div className="space-y-1.5">
              {team?.players?.map(p => (
                <div key={p._id} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
                  <div>
                    <p className="text-white/70 text-sm">{p.name}</p>
                    <div className="flex gap-1 mt-0.5">{p.skills?.slice(0,1).map(s => <SkillBadge key={s} skill={s} />)}</div>
                  </div>
                  <span className="text-white/40 text-xs">{p.soldPrice} pts</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 7 - (team?.players?.length || 0)) }).map((_, i) => (
                <div key={i} className="py-2 border-b border-white/4 last:border-0">
                  <p className="text-white/20 text-xs">Slot {(team?.players?.length || 0) + i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
