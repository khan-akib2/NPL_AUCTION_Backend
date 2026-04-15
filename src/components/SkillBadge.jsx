const colors = {
  Batsman: 'bg-blue-900 text-blue-300 border-blue-700',
  Bowler: 'bg-red-900 text-red-300 border-red-700',
  'All-rounder': 'bg-purple-900 text-purple-300 border-purple-700',
  Wicketkeeper: 'bg-amber-900 text-amber-300 border-amber-700',
  Fielder: 'bg-green-900 text-green-300 border-green-700',
};

export default function SkillBadge({ skill }) {
  const cls = colors[skill] || 'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{skill}</span>
  );
}
