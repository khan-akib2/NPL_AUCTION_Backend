'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

const SKILLS = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper', 'Fielder'];
const STATUS_COLORS = { available: 'text-green-400', sold: 'text-amber-400', unsold: 'text-red-400', resold: 'text-purple-400' };

const emptyForm = { name: '', photo: '', skills: [], basePrice: 50 };

export default function PlayersPage() {
  const { request } = useApi();
  const toast = useToast();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await request('/api/players');
    if (res) setPlayers(res.players || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? players : players.filter(p => p.status === filter);

  const toggleSkill = (s) => setForm(f => ({
    ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s]
  }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Name required', 'warning');
    setSaving(true);
    const res = editId
      ? await request(`/api/players/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      : await request('/api/players', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res?.error) { toast(res.error, 'error'); return; }
    toast(editId ? 'Player updated' : 'Player added', 'success');
    setShowForm(false); setForm(emptyForm); setEditId(null);
    load();
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, photo: p.photo || '', skills: p.skills || [], basePrice: p.basePrice });
    setEditId(p._id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this player?')) return;
    const res = await request(`/api/players/${id}`, { method: 'DELETE' });
    if (res?.error) toast(res.error, 'error');
    else { toast('Deleted', 'success'); load(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Players</h1>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Add Player
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'available', 'sold', 'unsold', 'resold'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Skills</th>
              <th className="text-left px-4 py-3">Base Price</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Sold To</th>
              <th className="text-left px-4 py-3">Sold Price</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p._id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{p.skills?.map(s => <SkillBadge key={s} skill={s} />)}</div></td>
                <td className="px-4 py-3 text-slate-300">{p.basePrice} pts</td>
                <td className="px-4 py-3 capitalize"><span className={STATUS_COLORS[p.status]}>{p.status}</span></td>
                <td className="px-4 py-3 text-slate-400">{p.soldTo?.name || '—'}</td>
                <td className="px-4 py-3 text-amber-400">{p.soldPrice ? `${p.soldPrice} pts` : '—'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => handleEdit(p)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                  <button onClick={() => handleDelete(p._id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No players found</p>}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-4">{editId ? 'Edit Player' : 'Add Player'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Photo URL (optional)</label>
                <input value={form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(s => (
                    <button key={s} onClick={() => toggleSkill(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${form.skills.includes(s) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Base Price</label>
                <input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {saving ? <Spinner size="sm" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
