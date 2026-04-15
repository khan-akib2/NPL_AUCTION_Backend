'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import SkillBadge from '@/components/SkillBadge';

export default function AudiencePage() {
  const [socket, setSocket] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [teams, setTeams] = useState([]);
  const [connected, setConnected] = useState(false);

  // Load teams and active session on mount
  useEffect(() => {
    const fetchData = async () => {
      const [sessionRes, teamsRes] = await Promise.all([
        fetch('/api/auction/active-public'),
        fetch('/api/teams-public'),
      ]);
      if (sessionRes.ok) {
        const d = await sessionRes.json();
        if (d.session) {
          setActiveSession(d.session);
          setActivePlayer(d.session.playerId);
          setBidHistory(d.session.bids?.slice().reverse() || []);
        }
      }
      if (teamsRes.ok) {
        const d = await teamsRes.json();
        setTeams(d.teams || []);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const s = io({ path: '/api/socket', transports: ['polling'] });
    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('auction:start', ({ session, player }) => {
      setActiveSession(session);
      setActivePlayer(player);
      setBidHistory([]);
    });

    s.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? {
        ...prev,
        currentBid: data.currentBid,
        currentHighestBidderName: data.bidderTeamName,
      } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid, timestamp: new Date() }, ...prev]);
    });

    s.on('auction:sold', ({ player, team }) => {
      setActiveSession(null);
      setActivePlayer(null);
      setBidHistory([]);
      // refresh teams
      fetch('/api/teams-public').then(r => r.json()).then(d => setTeams(d.teams || []));
    });

    s.on('auction:unsold', () => {
      setActiveSession(null);
      setActivePlayer(null);
      setBidHistory([]);
    });

    s.on('auction:resale', () => {
      fetch('/api/teams-public').then(r => r.json()).then(d => setTeams(d.teams || []));
    });

    return () => s.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏏</span>
          <div>
            <div className="text-white font-bold text-xl tracking-wide">NIT SPORTS AUCTION</div>
            <div className="text-slate-400 text-xs">Live Auction — Audience View</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Connecting...'}</span>
        </div>
      </header>

      <div className="p-6 grid grid-cols-12 gap-6">

        {/* Center: Live Auction Card */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
            {activeSession && activePlayer ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 bg-green-900/40 border border-green-700 text-green-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    LIVE AUCTION
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="w-32 h-32 bg-slate-700 rounded-2xl flex items-center justify-center text-6xl border-2 border-slate-600">
                    {activePlayer.photo
                      ? <img src={activePlayer.photo} alt={activePlayer.name} className="w-full h-full object-cover rounded-2xl" />
                      : '👤'}
                  </div>
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-white">{activePlayer.name}</h2>
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                    </div>
                    <div className="text-slate-400 text-sm mt-2">Base Price: <span className="text-white font-medium">{activePlayer.basePrice} pts</span></div>
                  </div>
                </div>

                {/* Current Bid Display */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-700/50 rounded-2xl p-8 text-center pulse-glow">
                  <div className="text-slate-400 text-sm uppercase tracking-widest mb-2">Current Bid</div>
                  <div className="text-7xl font-black text-amber-400 mb-2">{activeSession.currentBid}</div>
                  <div className="text-slate-300 text-lg">points</div>
                  {activeSession.currentHighestBidderName ? (
                    <div className="mt-4 inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700 px-4 py-2 rounded-full">
                      <span className="text-slate-400 text-sm">Highest Bidder:</span>
                      <span className="text-blue-300 font-bold">{activeSession.currentHighestBidderName}</span>
                    </div>
                  ) : (
                    <div className="mt-4 text-slate-500 text-sm">No bids yet — auction just started</div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-7xl mb-6">⏳</div>
                <h2 className="text-2xl font-bold text-slate-300">Waiting for Next Player</h2>
                <p className="text-slate-500 mt-2">The admin will start the next auction shortly</p>
              </div>
            )}
          </div>

          {/* Bid History */}
          {bidHistory.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Bid History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bidHistory.map((b, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${i === 0 ? 'bg-blue-900/40 border border-blue-800' : 'bg-slate-800'}`}>
                    <span className={`font-medium ${i === 0 ? 'text-blue-300' : 'text-slate-300'}`}>{b.teamName}</span>
                    <span className={`font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>{b.amount} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Teams Scoreboard */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Teams Scoreboard</h2>
            <div className="space-y-3">
              {teams.map(team => {
                const pct = Math.round((team.pointsSpent / 1000) * 100);
                return (
                  <div key={team._id} className="bg-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-white font-semibold text-sm">{team.name}</div>
                        <div className="text-slate-500 text-xs">{team.playerCount}/7 players</div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 font-bold">{team.budget} pts</div>
                        <div className="text-slate-500 text-xs">remaining</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
