'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  useSettingsStore,
  type IrsMode,
  type Keybinds,
} from '@/store/settingsStore';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';

const ACTION_LABELS: Record<keyof Keybinds, string> = {
  moveLeft: 'Move left',
  moveRight: 'Move right',
  softDrop: 'Soft drop',
  hardDrop: 'Hard drop / lock',
  rotateClockwise: 'Rotate clockwise',
  rotateCounter: 'Rotate counter-CW',
  rotate180: 'Rotate 180°',
  hold: 'Hold piece',
};

function msToFrames(ms: number): number {
  return Math.max(0, Math.round((ms / 1000) * 60));
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [rebinding, setRebinding] = useState<keyof Keybinds | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const keybinds = useSettingsStore((s) => s.keybinds);
  const das = useSettingsStore((s) => s.das);
  const arr = useSettingsStore((s) => s.arr);
  const softDropFactor = useSettingsStore((s) => s.softDropFactor);
  const handling = useSettingsStore((s) => s.handling);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);

  const setDAS = useSettingsStore((s) => s.setDAS);
  const setARR = useSettingsStore((s) => s.setARR);
  const setSoftDropFactor = useSettingsStore((s) => s.setSoftDropFactor);
  const setDCD = useSettingsStore((s) => s.setDCD);
  const setPreventAccidentalHardDrop = useSettingsStore((s) => s.setPreventAccidentalHardDrop);
  const setCancelDASOnDirectionChange = useSettingsStore((s) => s.setCancelDASOnDirectionChange);
  const setPreferSoftDropOverMovement = useSettingsStore((s) => s.setPreferSoftDropOverMovement);
  const setIrs = useSettingsStore((s) => s.setIrs);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume);
  const resetHandlingDefaults = useSettingsStore((s) => s.resetHandlingDefaults);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      useSettingsStore.getState().setKeybind(rebinding, e.code);
      setRebinding(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rebinding]);

  const handleSave = async () => {
    const s = useSettingsStore.getState();
    try {
      await api.patch('/api/users/settings', {
        keybinds: s.keybinds,
        das: s.das,
        arr: s.arr,
        softDropFactor: s.softDropFactor,
        handlingConfig: { ...s.handling },
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        boardSkin: s.boardSkin,
      });
      setSaveError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setSaveError('Save failed');
    }
  };

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const timer = setTimeout(() => {
      void handleSave();
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keybinds, das, arr, softDropFactor, handling, musicVolume, sfxVolume]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8 pt-20">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-zinc-500">Config</p>
            <h1 className="text-3xl font-black tracking-tight text-white">Handling & keys</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Tune DAS, ARR, and soft drop. Changes apply in-game immediately; save to sync across devices.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost">← Hub</Button>
          </Link>
        </header>

        <Section
          title="Handling"
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" type="button" className="text-xs" onClick={resetHandlingDefaults}>
                Reset
              </Button>
              <Link href="/play/solo">
                <Button variant="ghost" type="button" className="text-xs">
                  Test
                </Button>
              </Link>
            </div>
          }
        >
          <HandlingSlider
            label="ARR (auto repeat rate)"
            sub="Faster side-to-side once DAS engages"
            value={arr}
            min={0}
            max={200}
            formatValue={(v) => `${v}ms · ${msToFrames(v)}F`}
            onChange={setARR}
          />
          <HandlingSlider
            label="DAS (delayed auto shift)"
            sub="Hold before auto-shift starts"
            value={das}
            min={0}
            max={333}
            formatValue={(v) => `${v}ms · ${msToFrames(v)}F`}
            onChange={setDAS}
          />
          <HandlingSlider
            label="DCD (DAS cut delay)"
            sub="Pause when switching horizontal direction"
            value={handling.dcd}
            min={0}
            max={100}
            formatValue={(v) => `${v}ms · ${msToFrames(v)}F`}
            onChange={setDCD}
          />
          <div className="py-3">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">SDF (soft drop factor)</p>
                <p className="text-xs text-zinc-500">
                  Like TETR.IO: <span className="text-cyan-400/90">0 = ∞</span> instant to floor; higher = faster
                  soft-drop while held (try 20–41).
                </p>
              </div>
              <span className="font-mono text-sm text-cyan-300">
                {softDropFactor <= 0 ? '∞' : `${softDropFactor}×`}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={softDropFactor <= 0 ? 'primary' : 'secondary'}
                className="text-xs"
                onClick={() => setSoftDropFactor(0)}
              >
                Instant (∞)
              </Button>
              <Button type="button" variant="ghost" className="text-xs" onClick={() => setSoftDropFactor(20)}>
                Default (20×)
              </Button>
            </div>
            <HandlingSlider
              label=""
              sub=""
              value={softDropFactor}
              min={0}
              max={60}
              step={1}
              formatValue={(v) => (v <= 0 ? '∞' : `${v}×`)}
              onChange={setSoftDropFactor}
              hideLabels
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
            <ToggleRow
              label="Prevent accidental hard drops (hold Space ~200ms instead of tap)"
              checked={handling.preventAccidentalHardDrop}
              onChange={setPreventAccidentalHardDrop}
            />
            <ToggleRow
              label="Cancel DAS when changing directions"
              checked={handling.cancelDASOnDirectionChange}
              onChange={setCancelDASOnDirectionChange}
            />
            <ToggleRow
              label="Prefer soft drop over movement"
              checked={handling.preferSoftDropOverMovement}
              onChange={setPreferSoftDropOverMovement}
            />
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Rotation buffering (IRS)
            </p>
            <div className="flex flex-wrap gap-1">
              {(['off', 'hold', 'tap'] as IrsMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIrs(m)}
                  className={`min-w-[4.5rem] border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    handling.irs === m
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Keybinds">
          <div className="flex flex-col gap-1">
            {(Object.keys(ACTION_LABELS) as (keyof Keybinds)[]).map((action) => (
              <div
                key={action}
                className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-0"
              >
                <span className="text-sm text-zinc-300">{ACTION_LABELS[action]}</span>
                <button
                  type="button"
                  onClick={() => setRebinding(action)}
                  className={`min-w-[8rem] border px-3 py-1.5 text-center font-mono text-xs transition-colors ${
                    rebinding === action
                      ? 'animate-pulse border-cyan-500 bg-cyan-500/15 text-cyan-300'
                      : 'border-white/10 bg-black/40 text-white hover:border-cyan-500/40'
                  }`}
                >
                  {rebinding === action ? 'Press key…' : keybinds[action]}
                </button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Audio">
          <SliderRow
            label="Music volume"
            value={Math.round(musicVolume * 100)}
            min={0}
            max={100}
            onChange={(v) => setMusicVolume(v / 100)}
          />
          <SliderRow
            label="SFX volume"
            value={Math.round(sfxVolume * 100)}
            min={0}
            max={100}
            onChange={(v) => setSfxVolume(v / 100)}
          />
        </Section>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button variant="primary" onClick={handleSave}>
            Save settings
          </Button>
          {saved ? <span className="text-sm text-emerald-400">Saved</span> : null}
          {saveError ? <span className="text-sm text-red-400">{saveError}</span> : null}
        </div>

        <p className="mt-12 border-t border-white/5 pt-6 text-center text-[0.65rem] font-medium uppercase tracking-[0.25em] text-zinc-600">
          Tweak your settings for a smoother stack experience
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 border border-white/10 bg-zinc-950/60 p-6 backdrop-blur-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-40 shrink-0 text-sm text-zinc-300">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-none bg-zinc-800 accent-cyan-500"
      />
      <span className="w-14 text-right font-mono text-sm text-cyan-300">{value}</span>
    </div>
  );
}

function HandlingSlider({
  label,
  sub,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
  hideLabels = false,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue: (v: number) => string;
  onChange: (v: number) => void;
  hideLabels?: boolean;
}) {
  return (
    <div className="py-3">
      {!hideLabels ? (
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{label}</p>
            <p className="text-xs text-zinc-500">{sub}</p>
          </div>
          <span className="font-mono text-sm text-cyan-300">{formatValue(value)}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="w-10 text-[0.65rem] uppercase text-zinc-600">Slow</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-none bg-zinc-800 accent-cyan-500"
        />
        <span className="w-10 text-right text-[0.65rem] uppercase text-zinc-600">Fast</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-sm font-medium uppercase tracking-wide text-zinc-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50"
      />
    </label>
  );
}
