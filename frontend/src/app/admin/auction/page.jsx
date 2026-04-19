'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';
import AuctionTimer from '@/components/AuctionTimer';

export default function AuctionControl() {
  const { request } = useApi();
  const socket = useSocket();
  const toast = useToast();

  const [players, setPlayers] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [mobileTab, setMobileTab] = useState('auction');
  const [timer, setTimer] = useState({ remaining: null, paused: false });
  const [timerDuration, setTimerDuration] = useState(30);
  const [queueSearch, setQueueSearch] = useState('');
  const [timerOpen, setTimerOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [pRes, sRes, tRes] = await Promise.all([
      request('/api/players?pageSize=100'),
      request('/api/auction/active'),
      request('/api/teams'),
    ]);
    if (pRes) setPlayers(pRes.players || []);
    if (tRes) setTeams(tRes.teams || []);
    if (sRes?.session) {
      setActiveSession(sRes.session);
      setActivePlayer(sRes.session.playerId);
      setBidHistory(sRes.session.bids?.slice().reverse() || []);
      setTimer({ remaining: sRes.session.timerRemaining, paused: sRes.session.timerPaused });
    } else {
      setActiveSession(null); setActivePlayer(null);
      setTimer({ remaining: null, paused: false });
    }
    setLoading(false);
  }, [request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  // Close timer dropdown on outside click
  const timerDropdownRef = useRef(null);
  useEffect(() => {
    if (!timerOpen) return;
    const handler = (e) => {
      if (timerDropdownRef.current && !timerDropdownRef.current.contains(e.target)) {
        setTimerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [timerOpen]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setTimer({ remaining: session.timerRemaining, paused: false });
      setMobileTab('auction');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
    });
    socket.on('auction:timer', (data) => setTimer(data));
    socket.on('auction:sold', ({ player, team }) => {
      toast(`${player.name} → ${team.name}`, 'success');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      setTimer({ remaining: null, paused: false });
      loadData();
    });
    socket.on('auction:unsold', ({ player }) => {
      toast(`${player.name} unsold`, 'info');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      setTimer({ remaining: null, paused: false });
      loadData();
    });
    socket.on('players:updated', () => loadData());
    return () => {
      socket.off('auction:start'); socket.off('auction:bid_update');
      socket.off('auction:timer'); socket.off('auction:sold'); socket.off('auction:unsold');
      socket.off('players:updated');
    };
  }, [socket, toast, loadData]);

  const startBidding = async () => {
    if (!selectedPlayer) return toast('Select a player first', 'warning');
    setActionLoading(true);
    const res = await request('/api/auction/start', { method: 'POST', body: JSON.stringify({ playerId: selectedPlayer._id, timerDuration }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else {
      setActiveSession(res.session); setActivePlayer(res.player); setBidHistory([]);
      setTimer({ remaining: res.session.timerRemaining, paused: false });
      setMobileTab('auction');
    }
  };

  const markSold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/sold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) { toast(res.error, 'error'); return; }
    toast(`${res.player?.name} → ${res.team?.name}`, 'success');
    setActiveSession(null); setActivePlayer(null); setBidHistory([]);
    setTimer({ remaining: null, paused: false });
    loadData();
  };

  const markUnsold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/unsold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) { toast(res.error, 'error'); return; }
    toast(`${res.player?.name} unsold`, 'info');
    setActiveSession(null); setActivePlayer(null); setBidHistory([]);
    setTimer({ remaining: null, paused: false });
    loadData();
  };

  const pauseTimer = async () => {
    setTimer(t => ({ ...t, paused: true }));
    const res = await request('/api/auction/timer/pause', { method: 'POST' });
    if (res?.error) { toast(res.error, 'error'); setTimer(t => ({ ...t, paused: false })); }
  };

  const resumeTimer = async () => {
    setTimer(t => ({ ...t, paused: false }));
    const res = await request('/api/auction/timer/resume', { method: 'POST' });
    if (res?.error) { toast(res.error, 'error'); setTimer(t => ({ ...t, paused: true })); }
  };

  const triggerResale = async (teamId) => {
    setActionLoading(true);
    const res = await request('/api/auction/resale', { method: 'POST', body: JSON.stringify({ teamId }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else { toast('Resale triggered', 'success'); loadData(); }
  };

  const available = players
    .filter(p => ['available','resold','unsold'].includes(p.status))
    .filter(p => !queueSearch.trim() || p.name.toLowerCase().includes(queueSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const resaleTeams = teams.filter(t => t.playerCount < 7 && t.players?.length > 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header + tabs */}
      <div className="shrink-0 px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-white">Auction Control</h1>
          {activeSession && (
            <span className="flex items-center gap-1.5 text-xs text-white/40 bg-[#c9a227]/8 border border-[#c9a227]/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex lg:hidden border border-[#c9a227]/20 rounded-lg overflow-hidden">
          {['queue','auction','bids'].map(t => (
            <button key={t} onClick={() => setMobileTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${mobileTab === t ? 'bg-[#c9a227]/15 text-white' : 'text-white/30'}`}>
              {t === 'queue' ? 'Queue' : t === 'auction' ? 'Auction' : 'Bids'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 lg:px-6 pb-4 lg:pb-6 overflow-y-auto" style={{ overflowX: 'visible' }}>

        {/* Queue */}
        <div className={`lg:col-span-3 flex flex-col min-h-0 overflow-visible ${mobileTab !== 'queue' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="ml-2 text-white/20 text-xs">queue · {queueSearch ? `${available.length} of ${players.filter(p => ['available','resold'].includes(p.status)).length}` : `${available.length} players`}</span>
            </div>
            <div className="px-2 pt-2 shrink-0">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  value={queueSearch}
                  onChange={e => setQueueSearch(e.target.value)}
                  placeholder="Search players..."
                  className="w-full bg-[#0a1628] border border-[#c9a227]/15 rounded-lg pl-7 pr-3 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#c9a227]/40 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {available.map(p => (
                <button key={p._id} onClick={() => setSelectedPlayer(p)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selectedPlayer?._id === p._id ? 'bg-[#c9a227]/15 text-white' : 'text-white/50 hover:bg-[#c9a227]/8 hover:text-white/80'
                  }`}>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">{p.skills?.join(' · ')} · {p.basePrice}pts</div>
                  {p.status === 'resold' && <span className="text-[10px] text-orange-400/60 uppercase tracking-wider">Resold</span>}
                  {p.status === 'unsold' && <span className="text-[10px] text-red-400/60 uppercase tracking-wider">Unsold</span>}
                </button>
              ))}
              {available.length === 0 && <p className="text-white/30 text-xs text-center py-8">No players available</p>}
            </div>
          </div>
          {/* Timer duration selector + start — outside card so dropdown isn't clipped */}
          <div className="shrink-0 pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/30 text-xs shrink-0">Timer</label>
              {/* Custom dropdown */}
              <div className="relative flex-1" ref={timerDropdownRef}>
                <button
                  type="button"
                  disabled={!!activeSession}
                  onClick={() => setTimerOpen(o => !o)}
                  className="w-full flex items-center justify-between bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg px-3 py-1.5 text-white text-xs disabled:opacity-40 hover:border-[#c9a227]/40 transition-colors"
                >
                  <span>{timerDuration}s</span>
                  <svg className={`w-3 h-3 text-white/40 transition-transform ${timerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {timerOpen && !activeSession && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg overflow-hidden shadow-xl z-50">
                    {[15, 20, 30, 45, 60].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setTimerDuration(v); setTimerOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          timerDuration === v
                            ? 'bg-[#c9a227]/15 text-[#c9a227] font-semibold'
                            : 'text-white/60 hover:bg-[#c9a227]/8 hover:text-white'
                        }`}
                      >
                        {v}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={startBidding} disabled={!selectedPlayer || !!activeSession || actionLoading}
              className="w-full bg-[#c9a227] text-[#0a1628] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#f0c040] disabled:opacity-20 flex items-center justify-center gap-2">
              {actionLoading ? <Spinner size="sm" /> : 'Start Bidding'}
            </button>
          </div>
        </div>

        {/* Active Auction */}
        <div className={`lg:col-span-6 flex flex-col min-h-0 ${mobileTab !== 'auction' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="ml-2 text-white/20 text-xs">auction · {activeSession ? 'active' : 'idle'}</span>
            </div>
            {activeSession && activePlayer ? (
              <div className="flex flex-col h-full flex-1 overflow-hidden">
                {/* Image LEFT + Bid RIGHT layout */}
                <div className="flex flex-1 min-h-0">
                  {/* Left: Player Image */}
                  <div className="relative w-2/5 shrink-0 overflow-hidden" style={{ minHeight: '260px' }}>
                    {activePlayer.photo ? (
                      <Image src={activePlayer.photo} alt={activePlayer.name} fill unoptimized
                        className="absolute inset-0 object-cover"
                        style={{ objectPosition: '50% 20%' }}
                        onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="absolute inset-0 bg-[#0a1628] flex items-center justify-center">
                        <svg className="w-12 h-12 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 60%, rgba(13,30,58,0.8) 100%)' }} />
                    {/* Base price */}
                    <div className="absolute top-3 left-3 bg-[#0a1628]/80 backdrop-blur border border-[#c9a227]/30 rounded-lg px-2.5 py-1.5 text-center">
                      <p className="text-white/40 text-[8px] uppercase tracking-wider">Base</p>
                      <p className="text-[#c9a227] font-black text-base tabular-nums leading-none">{activePlayer.basePrice}</p>
                    </div>
                  </div>

                  {/* Right: Player Info + Bid */}
                  <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
                    <div>
                      <AuctionTimer remaining={timer.remaining} paused={timer.paused} size="sm" />
                      <p className="text-[#c9a227]/70 text-[10px] uppercase tracking-widest mt-3 mb-1">{activePlayer.skills?.[0]}</p>
                      <h2 className="text-xl lg:text-2xl font-black text-white uppercase leading-none tracking-tight mb-2">
                        {activePlayer.name}
                      </h2>
                      <div className="flex flex-wrap gap-1">
                        {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">Current Bid</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-[#c9a227] tabular-nums leading-none">{activeSession.currentBid}</span>
                        <span className="text-white/40 text-sm">pts</span>
                      </div>
                      {activeSession.currentHighestBidderName && (
                        <p className="text-white/60 text-xs mt-1">↑ {activeSession.currentHighestBidderName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bid strip */}
                <div className="shrink-0 border-t border-[#c9a227]/15 bg-[#0a1628]/60">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/10">
                    <div className="flex items-center gap-2">
                      {/* Pause / Resume */}
                      <button
                        onClick={timer.paused ? resumeTimer : pauseTimer}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                          timer.paused
                            ? 'bg-[#c9a227]/15 border-[#c9a227]/40 text-[#c9a227]'
                            : 'bg-white/5 border-white/15 text-white/50 hover:text-white'
                        }`}>
                        {timer.paused ? (
                          <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Resume</>
                        ) : (
                          <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>Pause</>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <button onClick={markSold} disabled={!activeSession.currentHighestBidder || actionLoading}
                      className="bg-[#c9a227] text-[#0a1628] font-black py-3 rounded-xl text-sm hover:bg-[#f0c040] disabled:opacity-20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
                      {actionLoading ? <Spinner size="sm" /> : 'Mark Sold'}
                    </button>
                    <button onClick={markUnsold} disabled={actionLoading}
                      className="bg-white/5 border border-white/10 text-white/50 font-semibold py-3 rounded-xl text-sm hover:bg-white/10 hover:text-white transition-all">
                      Mark Unsold
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <p className="text-white/20 text-4xl mb-3">—</p>
                <p className="text-white/40 text-sm">No active auction</p>
                <p className="text-white/20 text-xs mt-1">Select a player and start bidding</p>
              </div>
            )}
          </div>
        </div>

        {/* Bids + Resale */}
        <div className={`lg:col-span-3 flex flex-col gap-3 min-h-0 ${mobileTab !== 'bids' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl flex flex-col flex-1 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="ml-2 text-white/20 text-xs">bid-feed · {bidHistory.length} bids</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
              {bidHistory.length === 0 && <p className="text-white/30 text-xs text-center py-6">No bids yet</p>}
              {bidHistory.map((b, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-[#c9a227]/12 border border-[#c9a227]/20' : 'bg-[#c9a227]/5'}`}>
                  <span className="text-white/60 truncate mr-2">{b.teamName}</span>
                  <span className="text-white font-semibold shrink-0">{b.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {resaleTeams.length > 0 && (
            <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="ml-2 text-white/20 text-xs">resale · {resaleTeams.length} teams</span>
              </div>
              <div className="p-3 space-y-1.5">
                {resaleTeams.map(t => (
                  <div key={t._id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/70">{t.name}</p>
                      <p className="text-xs text-white/40">{t.budget} pts · {t.playerCount}/7</p>
                    </div>
                    <button onClick={() => triggerResale(t._id)}
                      className="text-xs bg-[#c9a227]/8 border border-[#c9a227]/20 text-white/50 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                      Trigger
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
