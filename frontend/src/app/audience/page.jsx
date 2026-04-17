'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import SkillBadge from '@/components/SkillBadge';
import Logo from '@/components/Logo';

export default function AudiencePage() {
  const [activePlayer, setActivePlayer] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [teams, setTeams] = useState([]);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState('auction');
  const [viewerCount, setViewerCount] = useState(0);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const fetchTeams = () =>
    fetch(`${BACKEND_URL}/api/teams-public`).then(r => r.json()).then(d => setTeams(d.teams || []));

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/auction/active-public`).then(r => r.json()),
      fetchTeams(),
    ]).then(([d]) => {
      if (d.session) {
        setActiveSession(d.session);
        setActivePlayer(d.session.playerId);
        setBidHistory(d.session.bids?.slice().reverse() || []);
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
        } else {
          setActiveSession(null);
          setActivePlayer(null);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    const s = io(BACKEND_URL, { path: '/api/socket', transports: ['polling', 'websocket'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('viewers:count', (count) => setViewerCount(count));
    s.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setTab('auction');
    });
    s.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
    });
    s.on('auction:sold', () => { setActiveSession(null); setActivePlayer(null); setBidHistory([]); fetchTeams(); });
    s.on('auction:unsold', () => { setActiveSession(null); setActivePlayer(null); setBidHistory([]); });
    s.on('auction:resale', () => fetchTeams());
    return () => s.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#0d1e3a] border-b border-[#c9a227]/20 px-4 lg:px-8 h-12 lg:h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="rounded-xl w-7 h-7" />
          <span className="text-[#c9a227] font-bold text-xs tracking-widest uppercase">NIT Auction</span>
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

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 p-3 lg:p-8 content-start" style={{ minHeight: 'calc(100vh - 100px)' }}>

        {/* Auction Tab */}
        {tab === 'auction' && (
          <>
            {activeSession && activePlayer ? (
              <>
                {/* HERO PLAYER CARD — same design as captain page */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ minHeight: '420px', height: '55vh', maxHeight: '600px' }}>
                    {activePlayer.photo ? (
                      <>
                        <img src={activePlayer.photo} alt=""
                          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none" />
                        <img src={activePlayer.photo} alt={activePlayer.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ objectPosition: '50% 20%' }} />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-[#0d1e3a] flex items-center justify-center">
                        <span className="text-8xl text-[#c9a227]/20">👤</span>
                      </div>
                    )}
                    <div className="absolute inset-0"
                      style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.1) 0%, rgba(10,22,40,0.2) 40%, rgba(10,22,40,0.85) 70%, rgba(10,22,40,0.98) 100%)' }} />

                    {/* LIVE badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-500/90 backdrop-blur px-3 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-[10px] font-bold uppercase tracking-wider">Live</span>
                    </div>

                    {/* Base price */}
                    <div className="absolute top-4 left-4 bg-[#0a1628]/80 backdrop-blur border border-[#c9a227]/30 rounded-xl px-3 py-2 text-center">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider">Base</p>
                      <p className="text-[#c9a227] font-black text-lg tabular-nums leading-none">{activePlayer.basePrice}</p>
                    </div>

                    {/* Player info */}
                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8">
                      <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-2 opacity-90">
                        {activePlayer.skills?.[0] || 'Player'}
                      </p>
                      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase leading-none tracking-tight mb-3">
                        {activePlayer.name}
                      </h1>
                      <div className="flex flex-wrap gap-2">
                        {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                      </div>
                    </div>
                  </div>

                  {/* Current bid strip */}
                  <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-xl">
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
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
                          activeSession.currentHighestBidderName
                            ? 'bg-[#c9a227]/15 border-[#c9a227]/40'
                            : 'bg-white/5 border-white/10'
                        }`}>
                          {activeSession.currentHighestBidderName && (
                            <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />
                          )}
                          <span className="text-sm font-bold text-[#c9a227]">
                            {activeSession.currentHighestBidderName || 'No bids yet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bid history */}
                {bidHistory.length > 0 && (
                  <div className="w-full lg:w-80 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl overflow-hidden shadow-xl flex flex-col" style={{ maxHeight: '600px' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/10">
                      <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Bid History</p>
                      <span className="text-[#c9a227] text-xs font-semibold bg-[#c9a227]/10 px-2 py-0.5 rounded-md">{bidHistory.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[#c9a227]/5">
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
              <div className="flex-1 bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-[#c9a227]/5 border border-[#c9a227]/10 flex items-center justify-center mb-4">
                  <span className="text-4xl">⏳</span>
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
    </div>
  );
}
