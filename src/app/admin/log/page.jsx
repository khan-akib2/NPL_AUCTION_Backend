'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import Spinner from '@/components/Spinner';

const ACTION_STYLES = {
  bid: 'bg-blue-900/40 text-blue-300 border-blue-800',
  sold: 'bg-amber-900/40 text-amber-300 border-amber-800',
  unsold: 'bg-red-900/40 text-red-300 border-red-800',
  resale_triggered: 'bg-purple-900/40 text-purple-300 border-purple-800',
};

export default function AuctionLogPage() {
  const { request } = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await request('/api/auction/log');
      if (res) setLogs(res.logs || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Auction Log</h1>
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Player</th>
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-left px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${ACTION_STYLES[log.action] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                    {log.action?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-white font-medium">{log.playerId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-300">{log.teamId?.name || '—'}</td>
                <td className="px-4 py-3 text-amber-400 font-medium">{log.amount ? `${log.amount} pts` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center text-slate-500 py-8">No auction activity yet</p>}
      </div>
    </div>
  );
}
