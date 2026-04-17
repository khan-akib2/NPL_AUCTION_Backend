'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
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
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-48px)]">
      <div className="px-4 lg:px-6 py-4 border-b border-[#c9a227]/15 shrink-0">
        <h1 className="text-base font-semibold text-white">Final Summary</h1>
        <p className="text-white/40 text-xs mt-0.5">All 8 teams and their squads</p>
      </div>
      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="h-full border border-[#c9a227]/20 rounded-xl overflow-hidden bg-[#060f1e]">
          {/* iframe-style header bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="ml-2 text-white/20 text-xs">summary · {teams.length} teams</span>
          </div>
          {/* scrollable content */}
          <div className="overflow-y-auto h-[calc(100%-36px)] p-3 space-y-3">
            {teams.map(team => (
              <div key={team._id} className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a227]/15">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{team.name}</h2>
                    <p className="text-white/40 text-xs mt-0.5">Captain: {team.captainId?.name || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[#c9a227] text-sm font-medium">{team.budget} pts left</div>
                    <div className="text-white/40 text-xs">{team.playerCount}/7 · {team.pointsSpent} spent</div>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {team.players?.map(p => (
                    <div key={p._id} className="bg-[#0a1628] border border-[#c9a227]/10 rounded-lg p-2 text-center">
                      <div className="text-white/70 text-xs font-medium leading-tight">{p.name}</div>
                      <div className="text-[#c9a227]/60 text-xs mt-1">{p.soldPrice}pts</div>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 7 - (team.players?.length || 0)) }).map((_, i) => (
                    <div key={i} className="border border-dashed border-[#c9a227]/10 rounded-lg p-2 flex items-center justify-center">
                      <span className="text-white/15 text-xs">—</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
