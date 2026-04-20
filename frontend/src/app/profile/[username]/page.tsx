'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Props = { params: Promise<{ username: string }> };

type ApiProfile = {
  username: string;
  rating: number;
  createdAt: string;
  stats?: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    avgAPM: number;
    avgPPS: number;
    totalLinesCleared: number;
  } | null;
};

type ProfileCustomization = {
  displayName: string;
  bio: string;
  country: string;
  avatarDataUrl: string;
  badges: string[];
  achievements: string[];
};

const DEFAULT_BADGES = ['Supporter', 'Combo Fox', 'T-Spin Learner'];
const DEFAULT_ACHIEVEMENTS = ['First 10k score', '40L sub 2:00', 'Back-to-back x4'];

export default function ProfilePage({ params }: Props) {
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draftBadge, setDraftBadge] = useState('');
  const [draftAchievement, setDraftAchievement] = useState('');
  const [custom, setCustom] = useState<ProfileCustomization>({
    displayName: '',
    bio: '',
    country: '',
    avatarDataUrl: '',
    badges: [...DEFAULT_BADGES],
    achievements: [...DEFAULT_ACHIEVEMENTS],
  });

  const profileStorageKey = useMemo(() => `meowtetr.profile.custom.${username}`, [username]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const resolved = await params;
        const decoded = decodeURIComponent(resolved.username);
        if (cancelled) return;
        setUsername(decoded);

        const response = await api.get<ApiProfile>(`/api/users/profile/${encodeURIComponent(decoded)}`);
        if (cancelled) return;
        setProfile(response.data);

        const storageKey = `meowtetr.profile.custom.${decoded}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<ProfileCustomization>;
            setCustom((prev) => ({
              ...prev,
              ...parsed,
              badges: parsed.badges?.length ? parsed.badges : prev.badges,
              achievements: parsed.achievements?.length ? parsed.achievements : prev.achievements,
            }));
          } catch {
            setCustom((prev) => ({ ...prev, displayName: decoded }));
          }
        } else {
          setCustom((prev) => ({ ...prev, displayName: decoded }));
        }
      } catch {
        if (!cancelled) setError('Profile олдсонгүй эсвэл сервертэй холбогдож чадсангүй.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!username) return;
    localStorage.setItem(profileStorageKey, JSON.stringify(custom));
  }, [custom, profileStorageKey, username]);

  function addBadge() {
    const cleaned = draftBadge.trim();
    if (!cleaned) return;
    setCustom((prev) => ({ ...prev, badges: [...prev.badges, cleaned] }));
    setDraftBadge('');
  }

  function addAchievement() {
    const cleaned = draftAchievement.trim();
    if (!cleaned) return;
    setCustom((prev) => ({ ...prev, achievements: [...prev.achievements, cleaned] }));
    setDraftAchievement('');
  }

  function removeBadge(index: number) {
    setCustom((prev) => ({ ...prev, badges: prev.badges.filter((_, i) => i !== index) }));
  }

  function removeAchievement(index: number) {
    setCustom((prev) => ({ ...prev, achievements: prev.achievements.filter((_, i) => i !== index) }));
  }

  function onAvatarSelected(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setCustom((prev) => ({ ...prev, avatarDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-300">
        Loading profile...
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="min-h-screen bg-[#050508] text-white">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-24">
          <p className="text-sm text-red-400">{error || 'Profile not found'}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-bold text-cyan-400 hover:text-cyan-300">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const displayName = custom.displayName || profile.username;
  const winRate =
    profile.stats && profile.stats.gamesPlayed > 0
      ? `${Math.round((profile.stats.wins / profile.stats.gamesPlayed) * 100)}%`
      : '—';

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-20 sm:pt-24">
        <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Player profile</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-cyan-300">{displayName}</h1>
            <p className="mt-1 text-sm text-zinc-400">@{profile.username}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? 'Done' : 'Edit profile'}
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="rounded-sm border border-white/10 bg-zinc-950/70 p-4">
            <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-zinc-900">
              {custom.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={custom.avatarDataUrl} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl font-black text-zinc-700">{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            {isEditing ? (
              <label className="mt-4 block cursor-pointer rounded border border-white/15 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300">
                Change picture
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAvatarSelected(e.target.files?.[0])}
                />
              </label>
            ) : null}
            <div className="mt-4 rounded-sm border border-white/10 bg-black/40 p-3 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Tetra rating</p>
              <p className="mt-2 text-3xl font-black text-cyan-400">{profile.rating.toLocaleString()} TR</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-sm border border-white/10 bg-zinc-950/70 p-4">
              <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Identity</p>
              {isEditing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Display name"
                    value={custom.displayName}
                    onChange={(e) => setCustom((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                  <Input
                    label="Country / Flag"
                    value={custom.country}
                    onChange={(e) => setCustom((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="MN, JP, ... "
                  />
                  <Input
                    label="Bio"
                    value={custom.bio}
                    onChange={(e) => setCustom((prev) => ({ ...prev, bio: e.target.value }))}
                    className="sm:col-span-2"
                    placeholder="Your playstyle, favorite opener, goals..."
                  />
                </div>
              ) : (
                <div className="space-y-2 text-sm text-zinc-300">
                  <p>
                    <span className="text-zinc-500">Name:</span> {displayName}
                  </p>
                  <p>
                    <span className="text-zinc-500">Country:</span> {custom.country || '—'}
                  </p>
                  <p>
                    <span className="text-zinc-500">Bio:</span> {custom.bio || '—'}
                  </p>
                  <p>
                    <span className="text-zinc-500">Joined:</span>{' '}
                    {new Date(profile.createdAt).toLocaleDateString('en-CA')}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <StatCard label="Games" value={profile.stats?.gamesPlayed?.toLocaleString() || '—'} />
              <StatCard label="Win rate" value={winRate} />
              <StatCard label="Lines" value={profile.stats?.totalLinesCleared?.toLocaleString() || '—'} />
              <StatCard label="APM" value={profile.stats?.avgAPM?.toFixed(2) || '—'} />
              <StatCard label="PPS" value={profile.stats?.avgPPS?.toFixed(2) || '—'} />
              <StatCard label="Losses" value={profile.stats?.losses?.toLocaleString() || '—'} />
            </div>

            <div className="rounded-sm border border-white/10 bg-zinc-950/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Badges</p>
                <span className="text-xs text-zinc-500">{custom.badges.length} total</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {custom.badges.map((badge, idx) => (
                  <button
                    key={`${badge}-${idx}`}
                    type="button"
                    onClick={() => (isEditing ? removeBadge(idx) : undefined)}
                    className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-300"
                  >
                    {badge}
                  </button>
                ))}
              </div>
              {isEditing ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={draftBadge}
                    onChange={(e) => setDraftBadge(e.target.value)}
                    placeholder="New badge name"
                  />
                  <Button variant="secondary" size="sm" onClick={addBadge}>
                    Add
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-sm border border-white/10 bg-zinc-950/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Achievements</p>
                <span className="text-xs text-zinc-500">{custom.achievements.length} total</span>
              </div>
              <div className="space-y-2">
                {custom.achievements.map((achievement, idx) => (
                  <button
                    key={`${achievement}-${idx}`}
                    type="button"
                    onClick={() => (isEditing ? removeAchievement(idx) : undefined)}
                    className="block w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-zinc-200"
                  >
                    {achievement}
                  </button>
                ))}
              </div>
              {isEditing ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={draftAchievement}
                    onChange={(e) => setDraftAchievement(e.target.value)}
                    placeholder="New achievement text"
                  />
                  <Button variant="secondary" size="sm" onClick={addAchievement}>
                    Add
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-zinc-950/80 px-3 py-4 text-center">
      <p className="text-xl font-black tabular-nums text-cyan-300">{value}</p>
      <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}
