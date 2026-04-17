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
                {/* Main player card */}
                <div className="flex-1 min-w-0 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl overflow-hidden shadow-2xl flex flex-col h-fit">
                  {/* Player photo section */}
                  <div className="relative h-56 sm:h-64 lg:h-72 overflow-hidden bg-gradient-to-br from-[#0a1628] to-[#0d1e3a]">
                    {activePlayer.photo ? (
                      <>
                        <img src={activePlayer.photo} alt={activePlayer.name}
                          className="absolute inset-0 w-full h-full object-cover object-top" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1e3a] via-[#0d1e3a]/70 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 rounded-full bg-[#c9a227]/10 flex items-center justify-center">
                          <span className="text-7xl text-[#c9a227]/30">👤</span>
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

                  {/* Current bid display */}
                  <div className="p-4 sm:p-5 lg:p-6 bg-gradient-to-br from-[#0a1628]/80 to-[#0d1e3a]/50">
                    <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 lg:gap-6 lg:flex lg:items-center lg:justify-between">
                      <div>
                        <p className="text-white/50 text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-[0.1em] sm:tracking-[0.12em] lg:tracking-[0.15em] font-bold mb-1.5 lg:mb-2.5">Current Bid</p>
                        <div className="flex items-baseline gap-1 sm:gap-1.5 lg:gap-2.5">
                          <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#c9a227] tabular-nums leading-none">
                            {activeSession.currentBid}
                          </span>
                          <span className="text-white/40 text-[10px] sm:text-xs lg:text-sm font-semibold tracking-wide">pts</span>
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1 lg:text-right">
                        <p className="text-white/50 text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-[0.1em] sm:tracking-[0.12em] lg:tracking-[0.15em] font-bold mb-1.5 lg:mb-2.5">Leading</p>
                        <div className="inline-flex sm:w-full lg:float-right items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3 lg:px-4 lg:py-2.5 rounded-lg bg-gradient-to-r from-[#c9a227]/20 to-[#c9a227]/10 border border-[#c9a227]/40 shadow-lg">
                          {activeSession.currentHighestBidderName && (
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2.5 lg:h-2.5 rounded-full bg-[#c9a227] animate-pulse" />
                          )}
                          <span className="text-[10px] sm:text-xs lg:text-sm font-bold text-[#c9a227] tracking-wide truncate">
                            {activeSession.currentHighestBidderName || 'No bids'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bid history */}
                {bidHistory.length > 0 && (
                  <div className="w-full lg:w-80 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg lg:rounded-2xl p-4 sm:p-5 lg:p-6 flex flex-col shadow-2xl h-fit max-h-[300px] sm:max-h-[400px] lg:max-h-[600px]">
                    <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-[#c9a227]/15">
                      <svg className="w-4 sm:w-5 h-4 sm:h-5 text-[#c9a227] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-white/70 text-[11px] sm:text-xs lg:text-sm font-bold uppercase tracking-wider">Bid History</p>
                      <span className="ml-auto text-[#c9a227] text-[9px] sm:text-[10px] lg:text-xs font-semibold bg-[#c9a227]/15 px-2 py-0.5 sm:py-1 rounded-md">
                        {bidHistory.length} bids
                      </span>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 overflow-y-auto pr-2">
                      {bidHistory.map((b, i) => (
                        <div 
                          key={i} 
                          className={`flex items-center justify-between py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg transition-all duration-200 ${
                            i === 0 
                              ? 'bg-gradient-to-r from-[#c9a227]/20 to-[#c9a227]/10 border border-[#c9a227]/40 shadow-md' 
                              : 'bg-[#0a1628]/60 border border-[#c9a227]/10 hover:border-[#c9a227]/25 hover:bg-[#0a1628]/80'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            <span className={`text-[9px] sm:text-[10px] lg:text-xs font-mono font-bold tabular-nums w-5 text-center ${
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
              <div className="flex-1 bg-[#0d1e3a] border border-[#c9a227]/15 rounded-lg lg:rounded-2xl flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 text-center min-h-[400px] sm:min-h-[500px]">
                <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-[#c9a227]/5 flex items-center justify-center mb-4">
                  <span className="text-3xl sm:text-4xl">⏳</span>
                </div>
                <p className="text-white/60 text-base sm:text-lg font-semibold mb-2">Waiting for Auction</p>
                <p className="text-white/30 text-xs sm:text-sm">The next player will appear here shortly</p>
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
