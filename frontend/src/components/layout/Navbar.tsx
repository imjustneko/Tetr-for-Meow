'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useAudioStore } from '@/store/audioStore';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/8 bg-[#050508]/90 backdrop-blur-md">
      <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-4 sm:h-14">
        {/* Logo */}
        <Link href="/" className="shrink-0 text-lg font-black tracking-tight select-none sm:text-xl">
          <span style={{ color: '#ff4477', textShadow: '0 0 14px rgba(255,68,119,0.4)' }}>Meow</span>
          <span className="text-white">Tetr</span>
        </Link>

        {isAuthenticated ? (
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-wider">
            <NavLink href="/dashboard"   label="Home"        current={pathname} />
            <NavLink href="/leaderboard" label="Leaderboard" current={pathname} />
            <NavLink href="/train"       label="Train"       current={pathname} />
            <NavLink href="/settings"    label="Settings"    current={pathname} />
            <Link
              href={`/profile/${encodeURIComponent(user?.username ?? '')}`}
              className="font-extrabold text-cyan-400 transition-colors hover:text-cyan-300"
            >
              {user?.username}
            </Link>
            <MuteButton />
            <Button variant="ghost" size="sm" type="button" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">Register</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function NavLink({ href, label, current }: { href: string; label: string; current: string }) {
  const active = current === href || current.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`whitespace-nowrap transition-colors ${
        active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {label}
    </Link>
  );
}

function MuteButton() {
  const { sfxEnabled, musicEnabled, toggleSfx, toggleMusic } = useAudioStore();
  const allMuted = !sfxEnabled && !musicEnabled;

  const handleToggle = () => {
    if (allMuted) {
      if (!sfxEnabled) toggleSfx();
      if (!musicEnabled) toggleMusic();
    } else {
      if (sfxEnabled) toggleSfx();
      if (musicEnabled) toggleMusic();
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="text-base text-zinc-500 transition-colors hover:text-white"
      title={allMuted ? 'Unmute' : 'Mute'}
    >
      {allMuted ? '🔇' : '🔊'}
    </button>
  );
}
