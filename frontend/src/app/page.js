'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Logo from '@/components/Logo';

function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

const MOCK_PLAYERS = [
  { name: 'Arjun Sharma', skill: 'Batsman', bid: 150, team: 'Thunder Hawks' },
  { name: 'Rohit Verma', skill: 'Bowler', bid: 210, team: 'Storm Riders' },
  { name: 'Vikas Singh', skill: 'All-Rounder', bid: 180, team: 'Iron Wolves' },
];

function Navbar({ scrolled }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#060f1e]/95 backdrop-blur-xl shadow-2xl shadow-black/30 border-b border-white/5' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="sm" className="rounded-xl w-8 h-8" />
          <div>
            <span className="text-[#c9a227] font-black text-sm uppercase tracking-widest block leading-none">NIT Auction</span>
            <span className="text-white/20 text-[9px] uppercase tracking-wider">Season 8</span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-8">
          {[
            { label: 'Home', href: '#hero' },
            { label: 'Auction', href: '#live-auction' },
            { label: 'Features', href: '#features' },
            { label: 'How It Works', href: '#how-it-works' },
            { label: 'Stats', href: '#stats' },
          ].map(item => (
            <a key={item.label} href={item.href}
              onClick={e => { e.preventDefault(); document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-white/40 hover:text-white text-sm font-medium transition-colors relative group cursor-pointer">
              {item.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#c9a227] group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/audience" className="hidden sm:flex items-center gap-1.5 text-white/50 hover:text-white text-sm font-medium transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse" />
            Watch Live
          </Link>
          <Link href="/login" className="bg-[#c9a227] hover:bg-[#f0c040] text-[#0a1628] text-sm font-black px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-[#c9a227]/20">
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[#060f1e]" />
      {/* Radial glow top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-25"
        style={{ background: 'radial-gradient(ellipse, rgba(201,162,39,0.6) 0%, transparent 70%)' }} />
      {/* Animated orbs */}
      <div className="absolute top-1/3 left-1/6 w-72 h-72 rounded-full opacity-10 blur-3xl animate-pulse"
        style={{ background: 'radial-gradient(circle, #c9a227, transparent)' }} />
      <div className="absolute bottom-1/4 right-1/6 w-56 h-56 rounded-full opacity-8 blur-3xl animate-pulse"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', animationDelay: '1.5s' }} />
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(201,162,39,1) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,39,1) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
      {/* Diagonal lines decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute h-px bg-[#c9a227]"
            style={{ width: '200%', top: `${10 + i * 12}%`, left: '-50%', transform: 'rotate(-25deg)' }} />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 text-center pt-20">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2.5 bg-[#c9a227]/8 border border-[#c9a227]/20 rounded-full px-5 py-2 mb-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a227] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9a227]" />
          </span>
          <span className="text-[#c9a227] text-xs font-bold uppercase tracking-[0.2em]">Live Auction Season 8 · NIT Sports</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[88px] font-black text-white uppercase leading-[0.9] tracking-tight mb-8">
          Experience<br />
          the <span className="text-[#c9a227]">Ultimate</span><br />
          Sports Auction
        </h1>

        <p className="text-white/40 text-lg sm:text-xl max-w-xl mx-auto mb-12 leading-relaxed font-light">
          Bid, Compete, and Build Your Dream Team in Real-Time. The most thrilling inter-college sports auction platform.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link href="/login"
            className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-[#c9a227] hover:bg-[#f0c040] text-[#0a1628] font-black px-8 py-4 rounded-xl text-base transition-all hover:scale-105 hover:shadow-2xl hover:shadow-[#c9a227]/30 active:scale-95">
            Enter Auction
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link href="/audience"
            className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c9a227]/30 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:scale-105">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a227] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9a227]" />
            </span>
            Watch Live
          </Link>
          <a href="#players"
            className="w-full sm:w-auto flex items-center justify-center gap-2 text-white/40 hover:text-white font-medium px-8 py-4 rounded-xl text-base transition-all border border-transparent hover:border-white/10">
            View Players ↓
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {['56 Players', '8 Teams', 'Real-Time Bids', 'Season 8'].map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-white/25 text-xs">
              <span className="w-1 h-1 rounded-full bg-[#c9a227]/40" />
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060f1e] to-transparent" />
    </section>
  );
}

function LiveAuctionCard() {
  const [idx, setIdx] = useState(0);
  const [bid, setBid] = useState(MOCK_PLAYERS[0].bid);

  useEffect(() => {
    const t = setInterval(() => setBid(p => p + Math.floor(Math.random() * 20 + 10)), 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const next = (idx + 1) % MOCK_PLAYERS.length;
      setIdx(next);
      setBid(MOCK_PLAYERS[next].bid);
    }, 5000);
    return () => clearInterval(t);
  }, [idx]);

  const player = MOCK_PLAYERS[idx];

  return (
    <section id="live-auction" className="py-24 px-5 bg-[#060f1e]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-3">Happening Right Now</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Live Auction Feed</h2>
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-[#c9a227]/15 shadow-2xl shadow-black/50">
          {/* Top glow bar */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a227]/60 to-transparent" />
          <div className="bg-[#0a1628] p-8 sm:p-12">
            <div className="absolute inset-0 opacity-10"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,162,39,0.8) 0%, transparent 60%)' }} />

            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-10">
              <div className="text-center sm:text-left flex-1">
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-5">
                  <span className="flex items-center gap-1.5 bg-red-500 px-3 py-1 rounded-full shadow-lg shadow-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Live</span>
                  </span>
                  <span className="text-[#c9a227]/50 text-xs uppercase tracking-widest font-semibold">{player.skill}</span>
                </div>
                <h3 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase tracking-tight leading-none mb-3">{player.name}</h3>
                <p className="text-white/30 text-sm">Currently on auction block</p>
              </div>

              <div className="flex flex-col items-center gap-4 shrink-0">
                <div className="relative bg-[#060f1e] border border-[#c9a227]/20 rounded-2xl px-10 py-6 text-center shadow-inner">
                  <div className="absolute inset-0 rounded-2xl opacity-20"
                    style={{ background: 'radial-gradient(circle at 50% 100%, rgba(201,162,39,0.5), transparent 70%)' }} />
                  <p className="text-white/30 text-[9px] uppercase tracking-[0.2em] mb-2">Current Bid</p>
                  <p className="text-6xl font-black text-[#c9a227] tabular-nums leading-none">{bid}</p>
                  <p className="text-white/20 text-xs mt-1 uppercase tracking-wider">points</p>
                </div>
                <div className="bg-[#c9a227]/10 border border-[#c9a227]/20 rounded-xl px-6 py-3 text-center w-full">
                  <p className="text-white/25 text-[9px] uppercase tracking-wider mb-0.5">Leading Team</p>
                  <p className="text-[#c9a227] font-black text-sm">{player.team}</p>
                </div>
                <Link href="/audience"
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse" />
                  Watch Full Auction
                </Link>
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a227]/20 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: '⚡', title: 'Real-Time Bidding', desc: 'Instant bid updates via WebSockets. Every bid reflects across all screens in milliseconds.' },
    { icon: '🏆', title: 'Team Management', desc: 'Build your squad with a smart budget system. Track spending and acquisitions live.' },
    { icon: '📊', title: 'Player Analytics', desc: 'View detailed player profiles, skills, and base prices before placing strategic bids.' },
    { icon: '🔍', title: 'Transparent Results', desc: 'Full auction log with every bid recorded. Complete transparency for all participants.' },
  ];

  return (
    <section id="features" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-3">Platform Features</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Built for the Best Experience</h2>
          <p className="text-white/30 max-w-lg mx-auto text-sm leading-relaxed">Everything you need for a seamless, exciting auction — from first bid to final whistle.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i}
              className="group relative bg-[#0a1628] border border-white/5 hover:border-[#c9a227]/25 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#c9a227]/5 overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,162,39,0.06) 0%, transparent 70%)' }} />
              <div className="relative">
                <div className="text-3xl mb-5 w-12 h-12 flex items-center justify-center bg-[#c9a227]/8 rounded-xl border border-[#c9a227]/10">{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { num: '01', icon: '🔐', title: 'Register / Login', desc: 'Sign in with your captain credentials provided by the auction admin.' },
    { num: '02', icon: '🎯', title: 'Join Auction', desc: 'Enter the live auction room and watch players go up for bidding in real-time.' },
    { num: '03', icon: '💰', title: 'Bid & Build Team', desc: 'Place bids strategically within your budget to assemble the strongest squad.' },
  ];

  return (
    <section id="how-it-works" className="py-24 px-5 bg-[#060f1e]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-3">Simple Process</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">How It Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[#c9a227]/20 to-transparent" />
          {steps.map((s, i) => (
            <div key={i} className="relative text-center group">
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0a1628] border border-[#c9a227]/15 group-hover:border-[#c9a227]/40 text-3xl mb-6 shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                {s.icon}
                <span className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-[#c9a227] text-[#0a1628] text-xs font-black flex items-center justify-center shadow-lg">{i + 1}</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-white/35 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const stats = [
    { value: useCounter(56, 1500, visible), label: 'Total Players', suffix: '+' },
    { value: useCounter(8, 1200, visible), label: 'Teams Competing', suffix: '' },
    { value: useCounter(7, 1000, visible), label: 'Seasons Completed', suffix: '' },
    { value: useCounter(500, 2000, visible), label: 'Bids Placed', suffix: '+' },
  ];

  return (
    <section id="stats" ref={ref} className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-white/5 bg-[#0a1628]">
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/5">
            {stats.map((s, i) => (
              <div key={i} className="p-8 text-center">
                <p className="text-4xl sm:text-5xl font-black text-[#c9a227] tabular-nums mb-2">{s.value}{s.suffix}</p>
                <p className="text-white/30 text-xs uppercase tracking-wider font-medium">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#c9a227]/20 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 px-5 bg-[#060f1e]">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-[#c9a227]/15 bg-[#0a1628] p-12 sm:p-16 text-center">
          <div className="absolute inset-0 opacity-15"
            style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(201,162,39,0.8) 0%, transparent 60%)' }} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent" />
          <div className="relative">
            <p className="text-[#c9a227] text-xs uppercase tracking-[0.2em] font-bold mb-5">Get Started Today</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-tight">
              Ready to Build Your<br />
              <span className="text-[#c9a227]">Winning Team?</span>
            </h2>
            <p className="text-white/35 mb-10 max-w-md mx-auto text-sm leading-relaxed">
              Join the auction, place your bids, and assemble the ultimate squad before time runs out.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login"
                className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-[#c9a227] hover:bg-[#f0c040] text-[#0a1628] font-black px-10 py-4 rounded-xl text-base transition-all hover:scale-105 hover:shadow-2xl hover:shadow-[#c9a227]/30">
                Start Bidding Now
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link href="/audience"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c9a227]/20 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:scale-105">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a227] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9a227]" />
                </span>
                Watch as Audience
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-5 bg-[#060f1e]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="rounded-xl w-7 h-7" />
            <div>
              <span className="text-[#c9a227] font-black text-sm uppercase tracking-widest block leading-none">NIT Auction</span>
              <span className="text-white/20 text-[9px] uppercase tracking-wider">Sports Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {['Auction', 'Teams', 'Players', 'Results'].map(l => (
              <a key={l} href="#" className="text-white/25 hover:text-white/60 text-xs font-medium transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/audience" className="flex items-center gap-1.5 text-white/30 hover:text-[#c9a227] text-xs transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse" />
              Watch Live
            </Link>
            <Link href="/login" className="text-white/30 hover:text-white text-xs transition-colors">Login</Link>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 text-center">
          <p className="text-white/15 text-xs">© 2026 NIT Sports Auction. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user?.role === 'admin') router.replace('/admin');
    else if (user?.role === 'captain') router.replace('/captain');
  }, [user, loading, router]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="min-h-screen bg-[#060f1e] text-white">
      <Navbar scrolled={scrolled} />
      <HeroSection />
      <LiveAuctionCard />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
