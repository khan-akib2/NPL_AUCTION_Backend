'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Image from 'next/image';
import SkillBadge from '@/components/SkillBadge';
import Logo from '@/components/Logo';
import AuctionTimer from '@/components/AuctionTimer';
import { playBidSound, playSoldSound, playUnsoldSound, playTimerUrgentSound } from '@/lib/sounds';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function AudiencePage() {
  const router = useRouter();
  const [activePlayer, setActivePlayer] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [teams, setTeams] = useState([]);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState('auction');
  const [viewerCount, setViewerCount] = useState(0);
  const [timer, setTimer] = useState({ remaining: null, paused: false });

  const fetchTeams = useCallback(() =>
    fetch(`${BACKEND_URL}/api/teams-public`).then(r => r.json()).then(d => setTeams(d.teams || [])),
  []);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/auction/active-public`).then(r => r.json()),
      fetchTeams(),
    ]).then(([d]) => {
      if (d.session) {
        setActiveSession(d.session);
        setActivePlayer(d.session.playerId);
        setBidHistory(d.session.bids?.slice().reverse() || []);
        setTimer({ remaining: d.session.timerRemaining, paused: d.session.timerPaused });
      }
    });

    // Poll every 3 seconds as fallback when socket isn't available
    const interval = setInterval(async () => {
      if (!connected) {
        const [d] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auction/active-public`).then(r => r.json()),
          fetchTeams(),
        ]);
        if (d.session) {
          setActiveSession(d.session);
          setActivePlayer(d.session.playerId);
          setBidHistory(d.session.bids?.slice().reverse() || []);
          setTimer({ remaining: d.session.timerRemaining, paused: d.session.timerPaused });
        } else {
          setActiveSession(null);
          setActivePlayer(null);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [connected, fetchTeams]);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      path: '/api/socket',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('viewers:count', (count) => setViewerCount(count));
    s.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setTimer({ remaining: session.timerRemaining, paused: false });
      setTab('auction');
    });
    s.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
      playBidSound();
    });
    s.on('auction:timer', (data) => {
      setTimer(data);
      if (!data.paused && data.remaining <= 5 && data.remaining > 0) playTimerUrgentSound();
    });
    s.on('auction:sold', () => {
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      setTimer({ remaining: null, paused: false });
      playSoldSound();
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.55 }, colors: ['#c9a227', '#f0c040', '#ffffff', '#ffd700'] });
      });
      fetchTeams();
    });
    s.on('auction:unsold', () => { setActiveSession(null); setActivePlayer(null); setBidHistory([]); setTimer({ remaining: null, paused: false }); playUnsoldSound(); });
    s.on('auction:resale', () => fetchTeams());
    return () => s.disconnect();
  }, [fetchTeams]);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#0d1e3a] border-b border-[#c9a227]/20 px-4 lg:px-8 h-12 lg:h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="rounded-xl w-7 h-7" />
          <span className="text-[#c9a227] font-bold text-xs tracking-widest uppercase">APL Auction</span>
          <span className="text-[#c9a227]/20 hidden sm:block">·</span>
          <span className="text-white/25 text-xs hidden sm:block">Live</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#c9a227] animate-pulse' : 'bg-white/20'}`} />
          <span className="text-white/30 text-xs">{connected ? 'Connected' : 'Connecting'}</span>
          {viewerCount > 0 && (
            <div className="flex items-center gap-2 bg-[#c9a227]/10 border border-[#c9a227]/20 rounded-full px-2.5 py-1 ml-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a227] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#c9a227]" />
              </span>
              <span className="text-[#c9a227] text-xs font-bold tabular-nums leading-none">{viewerCount} watching live</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#c9a227]/15">
        <button onClick={() => setTab('auction')}
          className={`flex-1 lg:flex-none px-4 lg:px-6 py-3 text-xs lg:text-sm font-medium transition-colors ${tab === 'auction' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30 hover:text-white/60'}`}>
          Live Auction
        </button>
        <button onClick={() => setTab('teams')}
          className={`flex-1 lg:flex-none px-4 lg:px-6 py-3 text-xs lg:text-sm font-medium transition-colors ${tab === 'teams' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30 hover:text-white/60'}`}>
          Teams
        </button>
      </div>

      <div className="flex-1 flex flex-col p-3 lg:p-6" style={{ minHeight: 'calc(100vh - 100px)' }}>

        {/* Auction Tab */}
        {tab === 'auction' && (
          <>
            {activeSession && activePlayer ? (
              <div className="flex flex-col lg:flex-row gap-4 h-full">

                {/* LEFT: Player card + bid info */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ minHeight: '360px', height: '50vh', maxHeight: '560px' }}>
                    {activePlayer.photo ? (
                      <>
                        <Image src={activePlayer.photo} alt="" fill unoptimized
                          className="absolute inset-0 object-cover scale-110 blur-xl opacity-40 pointer-events-none"
                          onError={() => {}} />
                        <Image src={activePlayer.photo} alt={activePlayer.name} fill unoptimized
                          className="absolute inset-0 object-cover"
                          style={{ objectPosition: '50% 20%' }}
                          loading="eager"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-[#0d1e3a] flex items-center justify-center">
                        <svg className="w-16 h-16 text-[#c9a227]/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0"
                      style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.1) 0%, rgba(10,22,40,0.2) 40%, rgba(10,22,40,0.85) 70%, rgba(10,22,40,0.98) 100%)' }} />
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-500/90 backdrop-blur px-3 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-[10px] font-bold uppercase tracking-wider">Live</span>
                    </div>
                    <div className="absolute top-4 left-4 bg-[#0a1628]/80 backdrop-blur border border-[#c9a227]/30 rounded-xl px-3 py-2 text-center">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider">Base</p>
                      <p className="text-[#c9a227] font-black text-lg tabular-nums leading-none">{activePlayer.basePrice}</p>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8">
                      <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-2 opacity-90">{activePlayer.skills?.[0] || 'Player'}</p>
                      <h1 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tight mb-3">{activePlayer.name}</h1>
                      <div className="flex flex-wrap gap-2">{activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}</div>
                    </div>
                  </div>

                  {/* Bid strip */}
                  <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-xl">
                    {timer.remaining !== null && (
                      <div className="px-5 pt-3"><AuctionTimer remaining={timer.remaining} paused={timer.paused} size="md" /></div>
                    )}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-0.5">Current Bid</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-black text-[#c9a227] tabular-nums leading-none">{activeSession.currentBid}</span>
                          <span className="text-white/40 text-base font-semibold">pts</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Leading</p>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${activeSession.currentHighestBidderName ? 'bg-[#c9a227]/15 border-[#c9a227]/40' : 'bg-white/5 border-white/10'}`}>
                          {activeSession.currentHighestBidderName && <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />}
                          <span className="text-sm font-bold text-[#c9a227]">{activeSession.currentHighestBidderName || 'No bids yet'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Bid history — always visible, no scroll on page */}
                <div className="w-full lg:w-72 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-xl flex flex-col" style={{ maxHeight: '80vh' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/10 shrink-0">
                    <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Bid History</p>
                    <span className="text-[#c9a227] text-xs font-semibold bg-[#c9a227]/10 px-2 py-0.5 rounded-md">{bidHistory.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-[#c9a227]/5">
                    {bidHistory.length === 0 && (
                      <p className="text-white/30 text-xs text-center py-8">No bids yet</p>
                    )}
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
              </div>
            ) : (
              <div className="flex-1 bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-[#c9a227]/5 border border-[#c9a227]/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-[#c9a227]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-white/60 text-xl font-bold mb-2">Waiting for Auction</p>
                <p className="text-white/25 text-sm">The next player will appear here shortly</p>
              </div>
            )}
          </>
        )}

        {/* Teams Tab */}
        {tab === 'teams' && (
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 content-start">
            {teams.map((team, idx) => {
              const pct = Math.round((team.pointsSpent / 1000) * 100);
              return (
                <div key={team._id} className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-lg lg:rounded-xl p-3 sm:p-4 lg:p-5">
                  <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-start gap-1.5 sm:gap-2 flex-1 min-w-0">
                      <span className="text-[#c9a227]/30 text-[10px] sm:text-xs w-4 shrink-0 text-center">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-xs sm:text-sm truncate">{team.name}</p>
                        <p className="text-white/30 text-[10px] sm:text-xs">{team.playerCount}/7 players</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[#c9a227] font-bold text-xs sm:text-sm">{team.budget}</p>
                      <p className="text-white/25 text-[9px] sm:text-xs">pts left</p>
                    </div>
                  </div>
                  <div className="h-1 sm:h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-[#c9a227]/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-white/20 text-[9px] sm:text-xs text-right">{pct}% spent</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating back button */}
      <button
        onClick={() => router.push('/')}
        className="fixed bottom-5 left-5 flex items-center gap-2 bg-[#0d1e3a] border border-[#c9a227]/30 hover:border-[#c9a227]/60 text-white/60 hover:text-white rounded-full px-4 py-2 shadow-lg transition-all z-50"
        aria-label="Back to home"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        <span className="text-xs font-medium">Home</span>
      </button>
    </div>
  );
}
