'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';
import Logo from '@/components/Logo';
import AuctionTimer from '@/components/AuctionTimer';
import { playBidSound, playSoldSound, playUnsoldSound, playTimerUrgentSound } from '@/lib/sounds';

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
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [timer, setTimer] = useState({ remaining: null, paused: false });

  const loadData = useCallback(async () => {
    const [teamRes, sessionRes] = await Promise.all([
      request('/api/teams'),
      request('/api/auction/active'),
    ]);
    // Try by teamId first, fallback to first team in list
    const myTeam = teamRes?.teams?.[0] || null;
    if (myTeam) setTeam(myTeam);
    if (sessionRes?.session) {
      setActiveSession(sessionRes.session);
      setActivePlayer(sessionRes.session.playerId);
      setBidHistory(sessionRes.session.bids?.slice().reverse() || []);
      setTimer({ remaining: sessionRes.session.timerRemaining, paused: sessionRes.session.timerPaused });
    } else {
      setActiveSession(null); setActivePlayer(null);
      setTimer({ remaining: null, paused: false });
    }
    setLoading(false);
  }, [request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (socket && !socket.connected) loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, [socket, loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    // Sync initial state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(socket.connected);
    socket.on('viewers:count', (count) => setViewerCount(count));
    socket.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setTimer({ remaining: session.timerRemaining, paused: false });
      setTab('auction');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName, currentHighestBidder: data.bidderTeamId } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
      playBidSound();
      if (data.bidderTeamId !== team?._id?.toString()) toast(`Outbid — ${data.currentBid} pts`, 'warning');
    });
    socket.on('auction:sold', ({ player, team: soldTeam }) => {
      if (soldTeam._id?.toString() === team?._id?.toString()) {
        toast(`Won: ${player.name}`, 'success');
        playSoldSound();
        // Confetti for winning team
        import('canvas-confetti').then(({ default: confetti }) => {
          confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 }, colors: ['#c9a227', '#f0c040', '#ffffff', '#ffd700'] });
        });
      } else {
        toast(`${player.name} → ${soldTeam.name}`, 'info');
      }
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      setTimer({ remaining: null, paused: false });
      loadData();
    });
    socket.on('auction:unsold', () => { setActiveSession(null); setActivePlayer(null); setBidHistory([]); setTimer({ remaining: null, paused: false }); playUnsoldSound(); });
    socket.on('auction:resale', () => { loadData(); });
    socket.on('auction:timer', (data) => {
      setTimer(data);
      if (!data.paused && data.remaining <= 5 && data.remaining > 0) playTimerUrgentSound();
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('viewers:count');
      socket.off('auction:start');
      socket.off('auction:bid_update');
      socket.off('auction:sold');
      socket.off('auction:unsold');
      socket.off('auction:resale');
      socket.off('auction:timer');
    };
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
  const remaining = team && activeSession ? team.budget - (activeSession.currentBid + 10) : null;

  // Budget alert thresholds
  const budgetCritical = team && team.budget <= 50;
  const budgetLow = team && team.budget <= 100 && team.budget > 50;

  // Toast once when budget drops low
  useEffect(() => {
    if (!team) return;
    if (team.budget <= 50) toast(`⚠️ Critical! Only ${team.budget} pts left`, 'error');
    else if (team.budget <= 100) toast(`Budget low — ${team.budget} pts remaining`, 'warning');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.budget]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a1628]"><Spinner size="lg" /></div>;
  if (!team) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
      <div className="text-center">
        <p className="text-white/50 text-sm mb-2">No team assigned</p>
        <p className="text-white/25 text-xs">Contact admin to assign your team</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Header */}
      <header className="bg-[#0d1e3a]/95 backdrop-blur border-b border-[#c9a227]/15 px-4 lg:px-8 h-12 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <Logo size="sm" className="shrink-0 rounded-xl w-7 h-7" />
          <span className="text-[#c9a227]/50 text-xs uppercase tracking-widest hidden sm:block">APL</span>
          <span className="text-[#c9a227]/20 hidden sm:block">·</span>
          <span className="text-white text-sm font-semibold truncate">{team?.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {viewerCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-[#c9a227]/10 border border-[#c9a227]/20 rounded-full px-3 py-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a227] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#c9a227]" />
              </span>
              <span className="text-[#c9a227] text-xs font-bold tabular-nums leading-none">{viewerCount} watching live</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border ${budgetCritical ? 'bg-red-500/15 border-red-500/40' : budgetLow ? 'bg-orange-500/10 border-orange-400/30' : 'bg-[#c9a227]/10 border-[#c9a227]/20'}`}>
            <span className={`font-black text-sm tabular-nums ${budgetCritical ? 'text-red-400' : budgetLow ? 'text-orange-400' : 'text-[#c9a227]'}`}>{team?.budget ?? 0}</span>
            <span className="text-white/40 text-xs">pts</span>
          </div>
          <button onClick={() => { logout(); router.push('/login'); }} className="text-white/30 hover:text-white/60 text-xs transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      {/* Budget progress bar */}
      <div className={`h-1 ${budgetCritical ? 'bg-red-900/40' : budgetLow ? 'bg-orange-900/30' : 'bg-[#c9a227]/8'}`}>
        <div className={`h-full transition-all duration-700 ${budgetCritical ? 'bg-red-500' : budgetLow ? 'bg-orange-400' : 'bg-[#c9a227]/60'}`}
          style={{ width: `${budgetPct}%` }} />
      </div>

      {/* Budget alert banner */}
      {(budgetCritical || budgetLow) && (
        <div className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${
          budgetCritical
            ? 'bg-red-500/15 border-b border-red-500/30 text-red-400'
            : 'bg-orange-500/10 border-b border-orange-400/25 text-orange-400'
        }`}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {budgetCritical
            ? `Critical! Only ${team?.budget} pts left — bid carefully`
            : `Budget low — ${team?.budget} pts remaining`}
        </div>
      )}

      {/* Mobile tabs */}
      <div className="flex border-b border-[#c9a227]/15 lg:hidden">
        <button onClick={() => setTab('auction')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === 'auction' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30'}`}>
          Live Auction
        </button>
        <button onClick={() => setTab('squad')}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === 'squad' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30'}`}>
          Squad ({team?.playerCount || 0}/7)
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-3 lg:p-6">

        {/* ── Auction panel ── */}
        <div className={`flex-1 min-w-0 flex flex-col gap-4 ${tab !== 'auction' ? 'hidden lg:flex' : 'flex'}`}>
          {activeSession && activePlayer ? (
            <>
              {/* HERO PLAYER CARD */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ minHeight: '420px', height: '55vh', maxHeight: '600px' }}>

                {/* Full-bleed background photo */}
                {activePlayer.photo ? (
                  <>
                    {/* Blurred bg fill */}
                    <Image src={activePlayer.photo} alt="" fill unoptimized
                      className="absolute inset-0 object-cover scale-110 blur-xl opacity-40 pointer-events-none" />
                    {/* Sharp main photo — centered to show face */}
                    <Image src={activePlayer.photo} alt={activePlayer.name} fill unoptimized
                      className="absolute inset-0 object-cover"
                      style={{ objectPosition: '50% 20%' }}
                      loading="eager" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[#0d1e3a]" />
                )}

                {/* Dark gradient overlay — heavier at bottom */}
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.1) 0%, rgba(10,22,40,0.2) 40%, rgba(10,22,40,0.85) 70%, rgba(10,22,40,0.98) 100%)' }} />

                {/* LIVE badge top-right */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-500/90 backdrop-blur px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider">Live</span>
                </div>

                {/* Base price badge top-left */}
                <div className="absolute top-4 left-4 bg-[#0a1628]/80 backdrop-blur border border-[#c9a227]/30 rounded-xl px-3 py-2 text-center">
                  <p className="text-white/40 text-[9px] uppercase tracking-wider">Base</p>
                  <p className="text-[#c9a227] font-black text-lg tabular-nums leading-none">{activePlayer.basePrice}</p>
                </div>

                {/* Player info — bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-6">
                  <p className="text-[#c9a227] text-[10px] uppercase tracking-[0.2em] font-bold mb-1 opacity-90">
                    {activePlayer.skills?.[0] || 'Player'}
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-4xl font-black text-white uppercase leading-none tracking-tight mb-2">
                    {activePlayer.name}
                  </h1>
                  <div className="flex flex-wrap gap-1.5">
                    {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                  </div>
                </div>
              </div>

              {/* BID CONTROL STRIP */}
              <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-xl">

                {/* Timer bar */}
                {timer.remaining !== null && (
                  <div className="px-5 pt-3 pb-0">
                    <AuctionTimer remaining={timer.remaining} paused={timer.paused} size="md" />
                  </div>
                )}

                {/* Current bid + leading */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#c9a227]/10">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-0.5">Current Bid</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl lg:text-4xl font-black text-[#c9a227] tabular-nums leading-none">{activeSession.currentBid}</span>
                      <span className="text-white/40 text-sm font-semibold">pts</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                    isLeading ? 'bg-[#c9a227]/15 border-[#c9a227]/40' : 'bg-white/5 border-white/10'
                  }`}>
                    {isLeading && <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />}
                    <div>
                      <p className="text-white/30 text-[9px] uppercase tracking-wider">Leading</p>
                      <p className={`text-sm font-bold ${isLeading ? 'text-[#c9a227]' : 'text-white/60'}`}>
                        {activeSession.currentHighestBidderName
                          ? isLeading ? 'You' : activeSession.currentHighestBidderName
                          : 'No bids yet'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Budget impact row */}
                <div className="grid grid-cols-3 divide-x divide-[#c9a227]/10 border-b border-[#c9a227]/10">
                  <div className="px-3 py-2 text-center">
                    <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Your Budget</p>
                    <p className="text-white/80 text-sm font-bold tabular-nums">{team?.budget ?? '—'} pts</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Next Bid</p>
                    <p className="text-[#c9a227] text-sm font-bold tabular-nums">{activeSession.currentBid + 10} pts</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">After Bid</p>
                    <p className={`text-sm font-bold tabular-nums ${remaining !== null && remaining < 0 ? 'text-red-400' : 'text-white/80'}`}>
                      {remaining !== null ? remaining : '—'} pts
                    </p>
                  </div>
                </div>

                {/* Bid button */}
                <div className="p-3">
                  <button
                    onClick={placeBid}
                    disabled={!canBid || bidding}
                    className="w-full bg-[#c9a227] text-[#0a1628] font-black py-3 rounded-xl text-base transition-all hover:bg-[#f0c040] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#c9a227]/20 active:scale-[0.98]"
                  >
                    {bidding ? <Spinner size="sm" /> : (
                      <>
                        <span className="text-lg">↑</span>
                        <span>Place Bid · {activeSession.currentBid + 10} pts</span>
                      </>
                    )}
                  </button>
                  {!canBid && activeSession && (
                    <p className="mt-2 text-center text-white/40 text-xs">
                      {team?.playerCount >= 7
                        ? 'Squad full (7/7 players)'
                        : `Need ${activeSession.currentBid + 10} pts · have ${team?.budget}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Bid history */}
              {bidHistory.length > 0 && (
                <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/10">
                    <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Bid History</p>
                    <span className="text-[#c9a227] text-xs font-semibold bg-[#c9a227]/10 px-2 py-0.5 rounded-md">{bidHistory.length}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#c9a227]/5">
                    {bidHistory.map((b, i) => (
                      <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i === 0 ? 'bg-[#c9a227]/8' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-white/25 text-xs font-mono w-6 text-right">#{bidHistory.length - i}</span>
                          <span className={`text-sm font-semibold ${i === 0 ? 'text-white' : 'text-white/60'}`}>{b.teamName}</span>
                        </div>
                        <span className={`text-sm font-black tabular-nums ${i === 0 ? 'text-[#c9a227]' : 'text-white/50'}`}>{b.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 bg-[#0d1e3a] border border-[#c9a227]/10 rounded-2xl flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-[#c9a227]/5 border border-[#c9a227]/10 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#c9a227]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-white/60 text-xl font-bold mb-2">Waiting for Auction</p>
              <p className="text-white/25 text-sm">The next player will appear here</p>
            </div>
          )}
        </div>

        {/* ── Squad panel ── */}
        <div className={`lg:w-72 flex flex-col gap-4 ${tab !== 'squad' ? 'hidden lg:flex' : 'flex'}`}>

          {/* Budget card */}
          <div className={`rounded-2xl p-4 shadow-xl border ${budgetCritical ? 'bg-red-500/10 border-red-500/30' : budgetLow ? 'bg-orange-500/8 border-orange-400/25' : 'bg-[#0d1e3a] border-[#c9a227]/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs uppercase tracking-wider font-bold ${budgetCritical ? 'text-red-400/70' : budgetLow ? 'text-orange-400/70' : 'text-white/40'}`}>Budget</p>
              <p className={`font-black text-base tabular-nums ${budgetCritical ? 'text-red-400' : budgetLow ? 'text-orange-400' : 'text-[#c9a227]'}`}>
                {team?.budget} <span className="text-white/30 text-xs font-normal">pts</span>
              </p>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${budgetCritical ? 'bg-red-500' : budgetLow ? 'bg-orange-400' : 'bg-[#c9a227]/70'}`}
                style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-1.5">
              <span>Spent: {team?.pointsSpent || 0} pts</span>
              <span>{budgetPct}%</span>
            </div>
          </div>

          {/* Squad list */}
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl p-4 flex-1 flex flex-col shadow-xl">
            <p className="text-white/40 text-xs uppercase tracking-wider font-bold mb-3">
              My Squad · {team?.playerCount || 0}/7
            </p>
            <div className="space-y-2 overflow-y-auto">
              {team?.players?.map(p => (
                <div key={p._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#0a1628]/50 border border-[#c9a227]/8">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-semibold truncate">{p.name}</p>
                    <div className="flex gap-1 mt-0.5">{p.skills?.slice(0,1).map(s => <SkillBadge key={s} skill={s} />)}</div>
                  </div>
                  <span className="text-[#c9a227] text-xs font-bold ml-2 shrink-0">{p.soldPrice} pts</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 7 - (team?.players?.length || 0)) }).map((_, i) => (
                <div key={i} className="py-2.5 px-3 rounded-xl border border-dashed border-white/8">
                  <p className="text-white/15 text-xs">Slot {(team?.players?.length || 0) + i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
