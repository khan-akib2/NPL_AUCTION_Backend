'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

export default function TeamsPage() {
  const { request } = useApi();
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await request('/api/teams');
      if (res) setTeams(res.teams || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Teams</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map(team => {
          const pct = Math.round((team.pointsSpent / 1000) * 100);
          return (
            <div key={team._id} className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{team.name}</h2>
                  <p className="text-slate-400 text-sm">{team.captainId?.name || 'No captain'}</p>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold text-lg">{team.budget}</div>
                  <div className="text-slate-500 text-xs">pts remaining</div>
                </div>
              </div>

              {/* Budget bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Spent: {team.pointsSpent} pts</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-slate-400">Players: <span className="text-white font-medium">{team.playerCount}/7</span></span>
                <button onClick={() => setExpanded(expanded === team._id ? null : team._id)}
                  className="text-blue-400 hover:text-blue-300 text-xs">
                  {expanded === team._id ? 'Hide Squad ▲' : 'View Squad ▼'}
                </button>
              </div>

              {expanded === team._id && (
                <div className="border-t border-slate-700 pt-3 space-y-2">
                  {team.players?.length === 0 && <p className="text-slate-500 text-xs text-center py-2">No players yet</p>}
                  {team.players?.map(p => (
                    <div key={p._id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm text-white font-medium">{p.name}</div>
                        <div className="flex gap-1 mt-0.5">{p.skills?.slice(0, 2).map(s => <SkillBadge key={s} skill={s} />)}</div>
                      </div>
                      <div className="text-amber-400 text-sm font-bold">{p.soldPrice} pts</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
