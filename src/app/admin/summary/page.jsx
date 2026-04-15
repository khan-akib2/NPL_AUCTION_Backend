'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

export default function SummaryPage() {
  const { request } = useApi();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await request('/api/summary');
      if (res) setTeams(res.teams || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Final Squad Summary</h1>
      <p className="text-slate-400 text-sm mb-6">Complete overview of all 8 teams and their squads</p>
      <div className="space-y-6">
        {teams.map(team => (
          <div key={team._id} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
              <div>
                <h2 className="text-lg font-bold text-white">{team.name}</h2>
                <p className="text-slate-400 text-sm">Captain: {team.captainId?.name || 'N/A'}</p>
              </div>
              <div className="text-right">
                <div className="text-amber-400 font-bold">{team.budget} pts left</div>
                <div className="text-slate-400 text-sm">{team.playerCount}/7 players · {team.pointsSpent} pts spent</div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {team.players?.map(p => (
                <div key={p._id} className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">👤</div>
                  <div className="text-white text-xs font-medium leading-tight">{p.name}</div>
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {p.skills?.slice(0, 1).map(s => <SkillBadge key={s} skill={s} />)}
                  </div>
                  <div className="text-amber-400 text-xs font-bold mt-1">{p.soldPrice} pts</div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 7 - (team.players?.length || 0)) }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-800/40 border border-dashed border-slate-700 rounded-lg p-3 flex items-center justify-center">
                  <span className="text-slate-600 text-xs">Empty</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
