'use client';
import { useEffect, useState, useRef } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/Toast';
import Spinner from '@/components/Spinner';

const emptyForm = { name: '', captainId: '', budget: 1000 };

function CaptainSelect({ captains, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = captains.find(c => c._id === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full bg-[#c9a227]/8 border border-[#c9a227]/20 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:border-white/30 transition-colors hover:border-white/20">
        <span className={selected ? 'text-white' : 'text-white/40'}>
          {selected ? selected.name : '— No captain —'}
        </span>
        <svg className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#0d1e3a] border border-[#c9a227]/20 rounded-xl overflow-hidden shadow-2xl">
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#c9a227]/8 ${!value ? 'text-white/60' : 'text-white/40'}`}>
              — No captain —
            </button>
            {captains.map(c => (
              <button key={c._id} type="button"
                onClick={() => { onChange(c._id); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#c9a227]/8 ${value === c._id ? 'text-white bg-[#c9a227]/8' : 'text-white/60'}`}>
                <div className="font-medium">{c.name}</div>
                <div className="text-white/40 text-xs mt-0.5">{c.email}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const { request } = useApi();
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tRes, uRes] = await Promise.all([
      request('/api/teams'),
      request('/api/users'),
    ]);
    if (tRes) setTeams((tRes.teams || []).map(t => ({ ...t, _id: t._id?.toString() || t._id })));
    if (uRes) setCaptains(uRes.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (team) => {
    setForm({ name: team.name, captainId: team.captainId?._id || '', budget: team.budget ?? 1000 });
    setEditId(team._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Team name required', 'warning');
    setSaving(true);
    const res = editId
      ? await request(`/api/teams/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      : await request('/api/teams', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res?.error) { toast(res.error, 'error'); return; }
    toast(editId ? 'Team updated' : 'Team created', 'success');
    setShowForm(false); setForm(emptyForm); setEditId(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this team? This will unlink the captain.')) return;
    const res = await request(`/api/teams/${id}`, { method: 'DELETE' });
    if (res?.error) toast(res.error, 'error');
    else { toast('Team deleted', 'success'); load(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-[#c9a227]/15 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Teams</h1>
          <p className="text-white/40 text-xs mt-0.5">{teams.length} teams</p>
        </div>
        <button onClick={openAdd}
          className="bg-[#c9a227] text-[#0a1628] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#f0c040] transition-colors">
          + Add Team
        </button>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {teams.map(team => {
            const pct = Math.round((team.pointsSpent / 1000) * 100);
            const id = team._id?.toString?.() ?? String(team._id);
            const isExpanded = expanded !== null && expanded === id;
            return (
              <div key={team._id} className="bg-[#0d1e3a] border border-[#c9a227]/15 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">{team.name}</h2>
                      <p className="text-white/40 text-xs mt-0.5">{team.captainId?.name || 'No captain'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{team.budget}</div>
                      <div className="text-white/40 text-xs">pts budget</div>
                    </div>
                  </div>

                  <div className="h-1 bg-[#c9a227]/8 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-[#0d1e3a]0 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/40 mb-4">
                    <span>{team.playerCount}/7 players</span>
                    <span>{pct}% spent</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpanded(isExpanded ? null : id)}
                      className="flex-1 text-xs text-white/30 hover:text-white bg-[#0d1e3a] border border-[#c9a227]/15 hover:bg-[#c9a227]/12 py-1.5 rounded-lg transition-colors">
                      {isExpanded ? 'Hide Squad' : 'View Squad'}
                    </button>
                    <button onClick={() => openEdit(team)}
                      className="text-xs text-white/30 hover:text-white bg-[#0d1e3a] border border-[#c9a227]/15 hover:bg-[#c9a227]/12 px-3 py-1.5 rounded-lg transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(team._id)}
                      className="text-xs text-white/30 hover:text-white/60 bg-[#0d1e3a] border border-[#c9a227]/15 hover:bg-[#c9a227]/12 px-3 py-1.5 rounded-lg transition-colors">
                      Del
                    </button>
                  </div>
                </div>

                {isExpanded && team.players !== undefined && (
                  <div className="border-t border-[#c9a227]/15 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                    {team.players?.length === 0 && (
                      <p className="text-white/30 text-xs text-center py-3">No players yet</p>
                    )}
                    {team.players?.map(p => (
                      <div key={p._id} className="flex items-center justify-between bg-[#0d1e3a] rounded-lg px-3 py-2">
                        <span className="text-white/60 text-xs">{p.name}</span>
                        <span className="text-white/35 text-xs">{p.soldPrice} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-white mb-5">{editId ? 'Edit Team' : 'Add Team'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider mb-1.5 block">Team Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Thunder Hawks"
                  className="w-full bg-[#c9a227]/8 border border-[#c9a227]/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider mb-1.5 block">Assign Captain</label>
                <CaptainSelect
                  captains={captains}
                  value={form.captainId}
                  onChange={val => setForm(f => ({ ...f, captainId: val }))}
                />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-wider mb-1.5 block">Budget (points)</label>
                <input
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))}
                  className="w-full bg-[#c9a227]/8 border border-[#c9a227]/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors"
                />
                <p className="text-white/30 text-xs mt-1">Current budget allocated to this team</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 bg-[#c9a227]/8 border border-[#c9a227]/20 text-white/50 py-2.5 rounded-lg text-sm hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#c9a227] text-[#0a1628] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#f0c040] disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Spinner size="sm" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
