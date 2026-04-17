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

  // Poll every 3s as fallback when socket isn't connected
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket && !socket.connected) loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [socket, loadData]);

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
      <div className="h-0.5 sm:h-1 bg-[#c9a227]/8">
        <div className="h-full bg-white/20 transition-all duration-700" style={{ width: `${budgetPct}%` }} />
      </div>

      {/* Mobile tabs */}
      <div className="flex border-b border-[#c9a227]/15 lg:hidden">
        <button onClick={() => setTab('auction')}
          className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${tab === 'auction' ? 'text-white border-b-2 sm:border-b border-white' : 'text-white/30'}`}>
          Live Auction
        </button>
        <button onClick={() => setTab('squad')}
          className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${tab === 'squad' ? 'text-white border-b-2 sm:border-b border-white' : 'text-white/30'}`}>
          My Squad ({team?.playerCount || 0}/7)
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row lg:gap-6 p-3 lg:p-8 gap-3 lg:gap-4 content-start">

        {/* Auction panel */}
        <div className={`flex-1 min-w-0 flex flex-col gap-4 ${tab !== 'auction' ? 'hidden lg:flex' : 'flex'}`}>
          {activeSession && activePlayer ? (
            <>
              {/* Main player card */}
              <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl overflow-hidden shadow-2xl h-fit">
                {/* Player photo section */}
                <div className="relative h-56 sm:h-64 lg:h-72 overflow-hidden bg-gradient-to-br from-[#0a1628] to-[#0d1e3a]">
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
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 lg:p-6">
                    <div className="flex items-end justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#c9a227] text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.15em] lg:tracking-[0.18em] font-bold mb-2 lg:mb-3 opacity-90">
                          {activePlayer.skills?.[0] || 'Player'}
                        </p>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white uppercase tracking-wide leading-tight mb-2 sm:mb-3">
                          {activePlayer.name}
                        </h1>
                        <div className="flex flex-wrap gap-1.5 lg:gap-2">
                          {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                        </div>
                      </div>
                        <div className="bg-gradient-to-br from-[#c9a227]/20 to-[#c9a227]/5 backdrop-blur-sm border border-[#c9a227]/30 rounded-lg px-2.5 py-2 sm:px-3 lg:px-4 lg:py-3 text-center shrink-0 shadow-lg">
                          <p className="text-white/50 text-[8px] sm:text-[9px] lg:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.12em] lg:tracking-[0.15em] font-semibold">Base</p>
                          <p className="text-[#c9a227] font-black text-base sm:text-lg lg:text-2xl tabular-nums">{activePlayer.basePrice}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bidding section */}
                <div className="p-4 sm:p-5 lg:p-6 bg-gradient-to-br from-[#0a1628]/80 to-[#0d1e3a]/50">
                  {/* Current bid display */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-[#c9a227]/10">
                    <div>
                      <p className="text-white/50 text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-[0.1em] sm:tracking-[0.12em] lg:tracking-[0.15em] font-bold mb-1 sm:mb-1.5">Current Bid</p>
                      <div className="flex items-baseline gap-1 sm:gap-1.5">
                        <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#c9a227] tabular-nums leading-none">
                          {activeSession.currentBid}
                        </span>
                        <span className="text-white/40 text-xs lg:text-sm font-semibold tracking-wide">pts</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/50 text-[10px] lg:text-xs uppercase tracking-[0.12em] lg:tracking-[0.15em] font-bold mb-1.5 lg:mb-2">Leading</p>
                      <div className={`inline-flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-2.5 rounded-lg transition-all ${
                        isLeading 
                          ? 'bg-gradient-to-r from-[#c9a227]/20 to-[#c9a227]/10 border border-[#c9a227]/40' 
                          : 'bg-white/5 border border-white/10'
                      }`}>
                        {isLeading && <span className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-[#c9a227] animate-pulse" />}
                        <span className={`text-xs lg:text-sm font-bold ${isLeading ? 'text-[#c9a227]' : 'text-white/50'}`}>
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
                    className="w-full bg-[#c9a227] text-[#0a1628] font-black py-2.5 sm:py-3 lg:py-4 rounded-lg lg:rounded-xl text-xs sm:text-sm lg:text-base transition-all hover:bg-[#f0c040] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-3 shadow-lg shadow-[#c9a227]/20 active:scale-[0.98]"
                  >
                    {bidding ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <span className="text-lg sm:text-xl lg:text-2xl">↑</span>
                        <span className="hidden sm:inline">Place Bid · {activeSession.currentBid + 10} pts</span>
                        <span className="sm:hidden text-[10px]">{activeSession.currentBid + 10}</span>
                      </>
                    )}
                  </button>
                  
                  {/* Status message */}
                  {!canBid && activeSession && (
                    <div className="mt-2 sm:mt-3 text-center">
                      <p className="text-white/40 text-[8px] sm:text-[10px] lg:text-xs">
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
                <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-2xl max-h-[300px] sm:max-h-[400px] lg:max-h-[300px] overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-[#c9a227]/15">
                    <svg className="w-4 sm:w-5 h-4 sm:h-5 text-[#c9a227] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-white/70 text-[9px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider">Bid History</p>
                    <span className="ml-auto text-[#c9a227] text-[8px] sm:text-[10px] lg:text-xs font-semibold bg-[#c9a227]/15 px-2 py-1 rounded-md">
                      {bidHistory.length} bids
                    </span>
                  </div>
                  <div className="space-y-1.5 overflow-y-auto pr-2">
                    {bidHistory.map((b, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center justify-between py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg transition-all ${
                          i === 0 
                            ? 'bg-gradient-to-r from-[#c9a227]/20 to-[#c9a227]/10 border border-[#c9a227]/40' 
                            : 'bg-[#0a1628]/60 border border-[#c9a227]/10 hover:border-[#c9a227]/25'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                          <span className={`text-[9px] sm:text-[10px] lg:text-xs font-mono font-bold tabular-nums w-4 sm:w-5 text-center ${
                            i === 0 ? 'text-[#c9a227]' : 'text-white/40'
                          }`}>
                            #{bidHistory.length - i}
                          </span>
                          <span className={`text-[10px] sm:text-xs lg:text-sm font-semibold truncate ${
                            i === 0 ? 'text-white' : 'text-white/70'
                          }`}>
                            {b.teamName}
                          </span>
                        </div>
                        <span className={`font-black text-[10px] sm:text-xs lg:text-sm tabular-nums ml-1.5 sm:ml-2 shrink-0 ${
                          i === 0 ? 'text-[#c9a227]' : 'text-white/60'
                        }`}>
                          {b.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-lg lg:rounded-2xl flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 text-center min-h-[300px] sm:min-h-[400px] h-fit">
              <div className="w-14 sm:w-16 lg:w-20 h-14 sm:h-16 lg:h-20 rounded-full bg-[#c9a227]/5 flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-2xl sm:text-3xl lg:text-4xl">⏳</span>
              </div>
              <p className="text-white/60 text-base sm:text-lg lg:text-lg font-semibold mb-1 sm:mb-2">Waiting for Auction</p>
              <p className="text-white/30 text-xs sm:text-sm">The next player will appear here shortly</p>
            </div>
          )}
        </div>

        {/* Squad panel */}
        <div className={`lg:w-80 flex flex-col gap-3 sm:gap-4 h-fit ${tab !== 'squad' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-[9px] sm:text-xs uppercase tracking-wider font-bold">Budget</p>
              <p className="text-[#c9a227] font-bold text-xs sm:text-sm">{team?.budget} pts</p>
            </div>
            <div className="h-1.5 sm:h-2 bg-[#c9a227]/8 rounded-full overflow-hidden mt-2 sm:mt-3">
              <div className="h-full bg-[#c9a227]/50 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] sm:text-xs text-white/40 mt-1.5 sm:mt-2">
              <span>Spent: {team?.pointsSpent || 0}</span>
              <span>{budgetPct}%</span>
            </div>
          </div>

          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl p-4 sm:p-5 lg:p-6 flex-1 flex flex-col shadow-2xl">
            <p className="text-white/50 text-[9px] sm:text-xs uppercase tracking-wider font-bold mb-3 sm:mb-4">My Squad \u00b7 {team?.playerCount || 0}/7</p>
            <div className="space-y-2 overflow-y-auto pr-1">
              {team?.players?.map(p => (
                <div key={p._id} className="flex items-center justify-between py-2.5 sm:py-3 px-2.5 sm:px-3 rounded-lg bg-[#0a1628]/40 border border-[#c9a227]/10 hover:border-[#c9a227]/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs sm:text-sm font-semibold truncate">{p.name}</p>
                    <div className="flex gap-1 mt-0.5 sm:mt-1">{p.skills?.slice(0,1).map(s => <SkillBadge key={s} skill={s} />)}</div>
                  </div>
                  <span className="text-[#c9a227] text-[9px] sm:text-xs font-bold ml-1.5 sm:ml-2 shrink-0">{p.soldPrice}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 7 - (team?.players?.length || 0)) }).map((_, i) => (
                <div key={i} className="py-2.5 sm:py-3 px-2.5 sm:px-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-white/20 text-[9px] sm:text-xs">Slot {(team?.players?.length || 0) + i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
