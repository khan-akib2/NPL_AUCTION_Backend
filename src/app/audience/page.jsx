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

  const fetchTeams = () =>
    fetch('/api/teams-public').then(r => r.json()).then(d => setTeams(d.teams || []));

  useEffect(() => {
    Promise.all([
      fetch('/api/auction/active-public').then(r => r.json()),
      fetchTeams(),
    ]).then(([d]) => {
      if (d.session) {
        setActiveSession(d.session);
        setActivePlayer(d.session.playerId);
        setBidHistory(d.session.bids?.slice().reverse() || []);
      }
    });
  }, []);

  useEffect(() => {
    const s = io({ path: '/api/socket', transports: ['polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
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
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#c9a227] animate-pulse' : 'bg-white/20'}`} />
          <span className="text-white/30 text-xs">{connected ? 'Connected' : 'Connecting'}</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#c9a227]/15">
        <button onClick={() => setTab('auction')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'auction' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30 hover:text-white/60'}`}>
          Live Auction
        </button>
        <button onClick={() => setTab('teams')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'teams' ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-white/30 hover:text-white/60'}`}>
          Teams
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 lg:p-8">

        {/* Auction Tab */}
        {tab === 'auction' && (
          <>
            {/* Player card — full height like admin */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl flex flex-col overflow-hidden flex-1">
                {activeSession && activePlayer ? (
                  <div className="flex flex-col h-full">
                    {/* Full bleed image */}
                    <div className="relative overflow-hidden bg-[#0a1628]" style={{ minHeight: '280px', flex: 1 }}>
                      {activePlayer.photo ? (
                        <>
                          <img src={activePlayer.photo} alt={activePlayer.name}
                            className="absolute inset-0 w-full h-full object-cover object-top" />
                          <img src={activePlayer.photo} alt=""
                            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-[#0d1e3a]" />
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-[#0a1628] via-[#0a1628]/30 to-transparent" />

                      {/* Name overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-3">
                        <div className="absolute left-0 right-0 top-0 h-px bg-[#c9a227]/20" />
                        <p className="text-[#c9a227]/60 text-xs uppercase tracking-widest mb-1.5">{activePlayer.skills?.[0]}</p>
                        <h2 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tight leading-none mb-3">
                          {activePlayer.name}
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                        </div>
                      </div>
                    </div>

                    {/* Bid strip */}
                    <div className="border-t border-[#c9a227]/15 px-6 py-5 shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[#c9a227]/50 text-xs uppercase tracking-widest">Current Bid</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-5xl font-black text-[#c9a227] tabular-nums">{activeSession.currentBid}</span>
                            <span className="text-white/30 text-base">pts</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white/30 text-xs uppercase tracking-widest">Leading</p>
                          <p className="text-white/60 text-base font-semibold mt-1">{activeSession.currentHighestBidderName || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                    <p className="text-[#c9a227]/10 text-6xl mb-4">—</p>
                    <p className="text-white/25 text-base">Waiting for next player</p>
                    <p className="text-white/15 text-sm mt-1">Admin will start the auction shortly</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bid history sidebar */}
            {bidHistory.length > 0 && (
              <div className="lg:w-72 bg-[#0d1e3a] border border-[#c9a227]/15 rounded-2xl p-5 flex flex-col">
                <p className="text-[#c9a227]/50 text-xs uppercase tracking-widest mb-4">Bid History</p>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {bidHistory.map((b, i) => (
                    <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${i === 0 ? 'bg-[#c9a227]/10 border border-[#c9a227]/20' : 'bg-white/3'}`}>
                      <span className={`text-sm font-medium ${i === 0 ? 'text-[#c9a227]' : 'text-white/50'}`}>{b.teamName}</span>
                      <span className={`text-sm font-bold ${i === 0 ? 'text-[#c9a227]' : 'text-white/40'}`}>{b.amount} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Teams Tab */}
        {tab === 'teams' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 content-start">
            {teams.map((team, idx) => {
              const pct = Math.round((team.pointsSpent / 1000) * 100);
              return (
                <div key={team._id} className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#c9a227]/30 text-xs w-5">{idx + 1}</span>
                      <div>
                        <p className="text-white font-semibold text-sm">{team.name}</p>
                        <p className="text-white/30 text-xs">{team.playerCount}/7 players</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#c9a227] font-bold">{team.budget}</p>
                      <p className="text-white/25 text-xs">pts left</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#c9a227]/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-white/20 text-xs mt-1 text-right">{pct}% spent</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
