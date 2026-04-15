'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import Spinner from '@/components/Spinner';

export default function AdminDashboard() {
  const { request } = useApi();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [playersRes, teamsRes] = await Promise.all([
        request('/api/players'),
        request('/api/teams'),
      ]);
      if (playersRes && teamsRes) {
        const players = playersRes.players || [];
        const teams = teamsRes.teams || [];
        setStats({
          total: players.length,
          sold: players.filter(p => p.status === 'sold').length,
          unsold: players.filter(p => p.status === 'unsold').length,
          available: players.filter(p => ['available', 'resold'].includes(p.status)).length,
          teams: teams.length,
          totalBudget: teams.reduce((s, t) => s + t.budget, 0),
          totalSpent: teams.reduce((s, t) => s + t.pointsSpent, 0),
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const cards = [
    { label: 'Total Players', value: stats?.total, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800' },
    { label: 'Sold', value: stats?.sold, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800' },
    { label: 'Unsold', value: stats?.unsold, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' },
    { label: 'Available', value: stats?.available, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800' },
    { label: 'Teams', value: stats?.teams, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800' },
    { label: 'Points Spent', value: stats?.totalSpent, color: 'text-cyan-400', bg: 'bg-cyan-900/20 border-cyan-800' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">NIT Sports Auction Overview</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-6`}>
            <div className={`text-3xl font-bold ${c.color}`}>{c.value ?? '—'}</div>
            <div className="text-slate-400 text-sm mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
