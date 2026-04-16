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
          <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl flex flex-col overflow-hidden" style={{ minHeight: '420px' }}>
            {activeSession && activePlayer ? (
              <div className="flex flex-col h-full">
                {/* Player card */}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-[#0a1628]/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3">
                    <div className="absolute left-0 right-0 top-0 h-px bg-[#c9a227]/20" />
                    <p className="text-[#c9a227]/60 text-xs uppercase tracking-widest mb-1.5">{activePlayer.skills?.[0]}</p>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-2">{activePlayer.name}</h2>
                    <div className="flex flex-wrap gap-1">{activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}</div>
                  </div>
                </div>

                {/* Bid strip */}
                <div className="border-t border-[#c9a227]/15 px-4 py-4 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-widest">Current Bid</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-3xl font-black text-[#c9a227] tabular-nums">{activeSession.currentBid}</span>
                        <span className="text-white/40 text-sm">pts</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs uppercase tracking-widest">Status</p>
                      <p className={`text-sm font-medium mt-0.5 ${isLeading ? 'text-white/70' : 'text-white/30'}`}>
                        {activeSession.currentHighestBidderName
                          ? isLeading ? '↑ Leading' : activeSession.currentHighestBidderName
                          : 'No bids'}
                      </p>
                    </div>
                  </div>
                  <button onClick={placeBid} disabled={!canBid || bidding}
                    className="w-full bg-[#c9a227] text-[#0a1628] font-bold py-3 rounded-lg text-sm transition-opacity hover:bg-[#f0c040] disabled:opacity-20 flex items-center justify-center gap-2 active:scale-[0.99]">
                    {bidding ? <Spinner size="sm" /> : `Bid ${activeSession.currentBid + 10} pts`}
                  </button>
                  {!canBid && activeSession && (
                    <p className="text-center text-white/40 text-xs mt-2">
                      {team?.playerCount >= 7 ? 'Squad full' : `Need ${activeSession.currentBid + 10} pts · You have ${team?.budget}`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-white/20 text-4xl mb-3">—</p>
                <p className="text-white/40 text-sm">Waiting for auction to start</p>
              </div>
            )}
          </div>

          {bidHistory.length > 0 && (
            <div className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl p-4">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Bid History</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {bidHistory.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/40">{b.teamName}</span>
                    <span className="text-white/60 font-medium">{b.amount} pts</span>
                  </div>
                ))}
              </div>
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
