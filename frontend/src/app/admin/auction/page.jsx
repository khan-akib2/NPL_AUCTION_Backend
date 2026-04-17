'use client';
import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

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
    } else {
      setActiveSession(null);
      setActivePlayer(null);
    }
    setLoading(false);
  }, [request]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload when tab becomes visible again (e.g. admin switches back from another tab)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('auction:start', ({ session, player }) => {
      setActiveSession(session); setActivePlayer(player); setBidHistory([]);
      setMobileTab('auction');
    });
    socket.on('auction:bid_update', (data) => {
      setActiveSession(prev => prev ? { ...prev, currentBid: data.currentBid, currentHighestBidderName: data.bidderTeamName } : prev);
      setBidHistory(prev => [{ teamName: data.bidderTeamName, amount: data.currentBid }, ...prev]);
    });
    socket.on('auction:sold', ({ player, team }) => {
      toast(`${player.name} → ${team.name}`, 'success');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    socket.on('auction:unsold', ({ player }) => {
      toast(`${player.name} unsold`, 'info');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    });
    return () => { socket.off('auction:start'); socket.off('auction:bid_update'); socket.off('auction:sold'); socket.off('auction:unsold'); };
  }, [socket, toast, loadData]);

  const startBidding = async () => {
    if (!selectedPlayer) return toast('Select a player first', 'warning');
    setActionLoading(true);
    const res = await request('/api/auction/start', { method: 'POST', body: JSON.stringify({ playerId: selectedPlayer._id }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else { setActiveSession(res.session); setActivePlayer(res.player); setBidHistory([]); setMobileTab('auction'); }
  };

  const markSold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/sold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) {
      toast(res.error, 'error');
    } else {
      // Update state immediately — don't wait for socket event
      toast(`${res.player?.name} → ${res.team?.name}`, 'success');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    }
  };

  const markUnsold = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    const res = await request('/api/auction/unsold', { method: 'POST', body: JSON.stringify({ sessionId: activeSession._id }) });
    setActionLoading(false);
    if (res?.error) {
      toast(res.error, 'error');
    } else {
      // Update state immediately — don't wait for socket event
      toast(`${res.player?.name} unsold`, 'info');
      setActiveSession(null); setActivePlayer(null); setBidHistory([]);
      loadData();
    }
  };

  const triggerResale = async (teamId) => {
    setActionLoading(true);
    const res = await request('/api/auction/resale', { method: 'POST', body: JSON.stringify({ teamId }) });
    setActionLoading(false);
    if (res?.error) toast(res.error, 'error');
    else { toast('Resale triggered', 'success'); loadData(); }
  };

  const available = players.filter(p => ['available','resold'].includes(p.status));
  const resaleTeams = teams.filter(t => t.budget < 50 && t.playerCount < 7);

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

      {/* 3-column grid — fills rest of screen */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 lg:px-6 pb-4 lg:pb-6 overflow-hidden">

        {/* Queue */}
        <div className={`lg:col-span-3 flex flex-col min-h-0 ${mobileTab !== 'queue' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
            {/* iframe-style header */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="ml-2 text-white/20 text-xs">queue · {available.length} players</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {available.map(p => (
                <button key={p._id} onClick={() => setSelectedPlayer(p)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selectedPlayer?._id === p._id
                      ? 'bg-[#c9a227]/15 text-white'
                      : 'text-white/50 hover:bg-[#c9a227]/8 hover:text-white/80'
                  }`}>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">{p.skills?.join(' · ')} · {p.basePrice}pts</div>
                  {p.status === 'resold' && <span className="text-[10px] text-white/40 uppercase tracking-wider">Resold</span>}
                </button>
              ))}
              {available.length === 0 && <p className="text-white/30 text-xs text-center py-8">No players available</p>}
            </div>
            <div className="p-3 border-t border-[#c9a227]/15 shrink-0">
              <button onClick={startBidding} disabled={!selectedPlayer || !!activeSession || actionLoading}
                className="w-full bg-[#c9a227] text-[#0a1628] font-semibold py-2.5 rounded-lg text-sm transition-opacity hover:bg-[#f0c040] disabled:opacity-20 flex items-center justify-center gap-2">
                {actionLoading ? <Spinner size="sm" /> : 'Start Bidding'}
              </button>
            </div>
          </div>
        </div>

        {/* Active Auction */}
        <div className={`lg:col-span-6 flex flex-col min-h-0 ${mobileTab !== 'auction' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
            {/* iframe-style header */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
              <span className="ml-2 text-white/20 text-xs">auction · {activeSession ? 'active' : 'idle'}</span>
            </div>
            {activeSession && activePlayer ? (
              <div className="flex flex-col h-full flex-1 overflow-hidden">

                {/* Full-bleed hero photo */}
                <div className="relative overflow-hidden flex-1" style={{ minHeight: '260px' }}>
                  {activePlayer.photo ? (
                    <>
                      <img src={activePlayer.photo} alt=""
                        className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-30 pointer-events-none" />
                      <img src={activePlayer.photo} alt={activePlayer.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: '50% 20%' }} />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-[#0d1e3a]" />
                  )}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.05) 0%, rgba(10,22,40,0.15) 40%, rgba(10,22,40,0.80) 70%, rgba(10,22,40,0.97) 100%)' }} />

                  {/* Base price badge */}
                  <div className="absolute top-3 right-3 bg-[#0a1628]/80 backdrop-blur border border-[#c9a227]/30 rounded-lg px-2.5 py-1.5 text-center">
                    <p className="text-white/40 text-[8px] uppercase tracking-wider">Base</p>
                    <p className="text-[#c9a227] font-black text-base tabular-nums leading-none">{activePlayer.basePrice}</p>
                  </div>

                  {/* Player info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                    <p className="text-[#c9a227]/70 text-[10px] uppercase tracking-widest mb-1">{activePlayer.skills?.[0]}</p>
                    <h2 className="text-2xl lg:text-3xl font-black text-white uppercase leading-none tracking-tight mb-2">
                      {activePlayer.name}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {activePlayer.skills?.map(s => <SkillBadge key={s} skill={s} />)}
                    </div>
                  </div>
                </div>

                {/* Bid strip */}
                <div className="shrink-0 border-t border-[#c9a227]/15 bg-[#0a1628]/60">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/10">
                    <div>
                      <p className="text-white/40 text-[9px] uppercase tracking-widest">Current Bid</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-4xl font-black text-[#c9a227] tabular-nums leading-none">{activeSession.currentBid}</span>
                        <span className="text-white/40 text-sm">pts</span>
                      </div>
                    </div>
                    {activeSession.currentHighestBidderName && (
                      <div className="text-right">
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Leading</p>
                        <p className="text-white/80 text-sm font-bold">{activeSession.currentHighestBidderName}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <button onClick={markSold} disabled={!activeSession.currentHighestBidder || actionLoading}
                      className="bg-[#c9a227] text-[#0a1628] font-black py-3 rounded-xl text-sm hover:bg-[#f0c040] disabled:opacity-20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
                      {actionLoading ? <Spinner size="sm" /> : '✓ Mark Sold'}
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
            {/* iframe-style header */}
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
              {/* iframe-style header */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
                <span className="ml-2 text-white/20 text-xs">resale · {resaleTeams.length} teams</span>
              </div>
              <div className="p-3">
                <div className="space-y-1.5">
                {resaleTeams.map(t => (
                  <div key={t._id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/70">{t.name}</p>
                      <p className="text-xs text-white/40">{t.budget} pts</p>
                    </div>
                    <button onClick={() => triggerResale(t._id)}
                      className="text-xs bg-[#c9a227]/8 border border-[#c9a227]/20 text-white/50 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                      Trigger
                    </button>
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
