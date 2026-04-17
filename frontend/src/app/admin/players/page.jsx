'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import SkillBadge from '@/components/SkillBadge';
import Spinner from '@/components/Spinner';

const SKILLS = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper', 'Fielder'];
const emptyForm = { name: '', photo: '', skills: [], basePrice: 50 };

function PhotoUpload({ value, onChange, token, toast }) {
  const [uploading, setUploading] = useState(false);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) onChange(data.url);
    else toast('Upload failed', 'error');
  };
  return (
    <div className="space-y-2">
      {value && (
        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#c9a227]/20">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange('')} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white/60 hover:text-white text-xs flex items-center justify-center">✕</button>
        </div>
      )}
      {/* Use a label wrapping the input — works reliably on iOS/Android without JS click() */}
      <label className={`relative flex items-center justify-center gap-2 bg-[#c9a227]/8 border border-[#c9a227]/20 hover:bg-[#c9a227]/12 text-white/50 hover:text-white text-sm px-4 py-2.5 rounded-lg transition-colors w-full cursor-pointer ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
        {uploading ? <Spinner size="sm" /> : <>{value ? 'Change Photo' : 'Upload Photo'}</>}
        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFile} disabled={uploading} />
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="or paste image URL"
        className="w-full bg-[#c9a227]/8 border border-[#c9a227]/20 rounded-lg px-3 py-2 text-white/50 text-xs focus:outline-none focus:border-white/20 transition-colors placeholder-white/20" />
    </div>
  );
}

export default function PlayersPage() {
  const { request } = useApi();
  const { token } = useAuth();
  const toast = useToast();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await request('/api/players?pageSize=200');
    if (res) setPlayers(res.players || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = players
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggleSkill = s => setForm(f => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s] }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Name required', 'warning');
    setSaving(true);
    const res = editId
      ? await request(`/api/players/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      : await request('/api/players', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res?.error) { toast(res.error, 'error'); return; }
    toast(editId ? 'Updated' : 'Added', 'success');
    setShowForm(false); setForm(emptyForm); setEditId(null);
    load();
  };

  const handleEdit = p => { setForm({ name: p.name, photo: p.photo || '', skills: p.skills || [], basePrice: p.basePrice }); setEditId(p._id); setShowForm(true); };
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const res = await request(`/api/players/${deleteConfirm}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    if (res?.error) toast(res.error, 'error');
    else { toast('Deleted', 'success'); load(); }
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-[#c9a227]/15 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Players</h1>
          <p className="text-white/40 text-xs mt-0.5">{filtered.length} of {players.length}</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
          className="bg-[#c9a227] text-[#0a1628] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#f0c040] transition-colors">
          + Add
        </button>
      </div>

      {/* Filters — horizontal scroll on mobile */}
      <div className="flex gap-2 px-4 lg:px-6 py-3 border-b border-[#c9a227]/15 shrink-0 overflow-x-auto">
        <div className="relative shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-lg pl-7 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#c9a227]/40 placeholder-white/20 w-40"
          />
        </div>
        {['all','available','sold','unsold','resold'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${filter === f ? 'bg-[#c9a227]/15 text-[#c9a227] border border-[#c9a227]/20' : 'text-white/30 hover:text-white/60 bg-[#0d1e3a] border border-[#c9a227]/10'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="h-full border border-[#c9a227]/20 rounded-xl overflow-hidden bg-[#060f1e] flex flex-col">
          {/* iframe-style header bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#c9a227]/15 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]/20" />
            <span className="ml-2 text-white/20 text-xs">players · {filtered.length} of {players.length}</span>
          </div>

          {/* scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40"><Spinner size="lg" /></div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="lg:hidden divide-y divide-[#c9a227]/10">
                  {filtered.map(p => (
                    <div key={p._id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#0d1e3a] border border-[#c9a227]/15 shrink-0">
                        {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{p.name}</div>
                        <div className="flex gap-1 mt-0.5 flex-wrap">{p.skills?.slice(0,2).map(s => <SkillBadge key={s} skill={s} />)}</div>
                        <div className="text-white/30 text-xs mt-0.5 capitalize">{p.status} {p.soldTo?.name ? `· ${p.soldTo.name}` : ''} {p.soldPrice ? `· ${p.soldPrice}pts` : ''}</div>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => handleEdit(p)} className="text-white/30 hover:text-white text-xs">Edit</button>
                        <button onClick={() => setDeleteConfirm(p._id)} className="text-white/20 hover:text-white/60 text-xs">Del</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="sticky top-0 bg-[#0a1628] z-10">
                      <tr className="border-b border-[#c9a227]/15">
                        <th className="text-left px-6 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Skills</th>
                        <th className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Base</th>
                        <th className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Team</th>
                        <th className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Price</th>
                        <th className="text-right px-6 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => (
                        <tr key={p._id} className="border-b border-[#c9a227]/8 hover:bg-[#c9a227]/5 transition-colors">
                          <td className="px-6 py-3 text-white font-medium">{p.name}</td>
                          <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{p.skills?.map(s => <SkillBadge key={s} skill={s} />)}</div></td>
                          <td className="px-4 py-3 text-white/40">{p.basePrice}</td>
                          <td className="px-4 py-3 text-white/50 capitalize">{p.status}</td>
                          <td className="px-4 py-3 text-white/30">{p.soldTo?.name || '—'}</td>
                          <td className="px-4 py-3 text-white/50">{p.soldPrice || '—'}</td>
                          <td className="px-6 py-3 text-right space-x-4">
                            <button onClick={() => handleEdit(p)} className="text-white/30 hover:text-white text-xs">Edit</button>
                            <button onClick={() => setDeleteConfirm(p._id)} className="text-white/20 hover:text-white/60 text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!loading && filtered.length === 0 && <p className="text-center text-white/30 py-16 text-sm">No players found</p>}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-white mb-4">{editId ? 'Edit Player' : 'Add Player'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#c9a227]/50 uppercase tracking-wider mb-1.5 block">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0a1628] border border-[#c9a227]/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a227]/50" />
              </div>
              <div>
                <label className="text-xs text-[#c9a227]/50 uppercase tracking-wider mb-1.5 block">Photo</label>
                <PhotoUpload value={form.photo} onChange={url => setForm(f => ({ ...f, photo: url }))} token={token} toast={toast} />
              </div>
              <div>
                <label className="text-xs text-[#c9a227]/50 uppercase tracking-wider mb-2 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(s => (
                    <button key={s} onClick={() => toggleSkill(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${form.skills.includes(s) ? 'bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/30' : 'bg-[#0a1628] text-white/30 border border-[#c9a227]/10 hover:text-white/60'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#c9a227]/50 uppercase tracking-wider mb-1.5 block">Base Price</label>
                <input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: Number(e.target.value) }))}
                  className="w-full bg-[#0a1628] border border-[#c9a227]/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a227]/50" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                className="flex-1 bg-[#0a1628] border border-[#c9a227]/15 text-white/50 py-2.5 rounded-lg text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#c9a227] text-[#0a1628] font-bold py-2.5 rounded-lg text-sm hover:bg-[#f0c040] disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Spinner size="sm" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1e3a] border border-[#c9a227]/20 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-2">Delete this player?</h2>
            <p className="text-white/50 text-sm mb-6">This action cannot be undone. The player will be permanently removed from the system.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-[#0a1628] border border-[#c9a227]/15 text-white/50 py-2.5 rounded-lg text-sm hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 bg-red-600/90 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
