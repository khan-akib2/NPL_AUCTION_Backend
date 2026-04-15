'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⚡' },
  { href: '/admin/auction', label: 'Auction Control', icon: '🏏' },
  { href: '/admin/players', label: 'Players', icon: '👤' },
  { href: '/admin/teams', label: 'Teams', icon: '🛡️' },
  { href: '/admin/log', label: 'Auction Log', icon: '📋' },
  { href: '/admin/summary', label: 'Final Summary', icon: '🏆' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <div className="text-blue-400 font-bold text-xl tracking-wide">NIT AUCTION</div>
        <div className="text-slate-400 text-xs mt-1">Admin Panel</div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 space-y-1">
        <a href="/audience" target="_blank" className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-blue-400 text-sm transition-colors">
          👁 Audience View
        </a>
        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-slate-400 hover:text-red-400 text-sm font-medium transition-colors">
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
