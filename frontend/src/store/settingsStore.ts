import { create } from 'zustand';

export type IrsMode = 'off' | 'hold' | 'tap';

export interface Keybinds {
  moveLeft: string;
  moveRight: string;
  softDrop: string;
  hardDrop: string;
  rotateClockwise: string;
  rotateCounter: string;
  rotate180: string;
  hold: string;
}

export interface HandlingConfig {
  dcd: number;
  preventAccidentalHardDrop: boolean;
  cancelDASOnDirectionChange: boolean;
  preferSoftDropOverMovement: boolean;
  irs: IrsMode;
}

export const DEFAULT_HANDLING: HandlingConfig = {
  dcd: 17,
  /** false = tap Space hard-drops (default). true = hold ~200ms (safety). */
  preventAccidentalHardDrop: false,
  cancelDASOnDirectionChange: false,
  preferSoftDropOverMovement: true,
  irs: 'tap',
};

export const DEFAULT_KEYBINDS: Keybinds = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'Space',
  rotateClockwise: 'ArrowUp',
  rotateCounter: 'KeyZ',
  rotate180: 'KeyA',
  hold: 'KeyC',
};

function parseHandling(raw: unknown): HandlingConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HANDLING };
  const o = raw as Record<string, unknown>;
  const irs = o.irs === 'off' || o.irs === 'hold' || o.irs === 'tap' ? o.irs : DEFAULT_HANDLING.irs;
  return {
    dcd: typeof o.dcd === 'number' && o.dcd >= 0 && o.dcd <= 200 ? o.dcd : DEFAULT_HANDLING.dcd,
    preventAccidentalHardDrop:
      typeof o.preventAccidentalHardDrop === 'boolean'
        ? o.preventAccidentalHardDrop
        : DEFAULT_HANDLING.preventAccidentalHardDrop,
    cancelDASOnDirectionChange:
      typeof o.cancelDASOnDirectionChange === 'boolean'
        ? o.cancelDASOnDirectionChange
        : DEFAULT_HANDLING.cancelDASOnDirectionChange,
    preferSoftDropOverMovement:
      typeof o.preferSoftDropOverMovement === 'boolean'
        ? o.preferSoftDropOverMovement
        : DEFAULT_HANDLING.preferSoftDropOverMovement,
    irs,
  };
}

export type ServerSettingsRow = {
  keybinds?: unknown;
  das?: number;
  arr?: number;
  softDropFactor?: number;
  handlingConfig?: unknown;
  musicVolume?: number;
  sfxVolume?: number;
  boardSkin?: string;
};

function parseKeybinds(raw: unknown): Keybinds {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_KEYBINDS };
  const o = raw as Record<string, unknown>;
  const next = { ...DEFAULT_KEYBINDS };
  for (const k of Object.keys(DEFAULT_KEYBINDS) as (keyof Keybinds)[]) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) next[k] = v;
  }
  return next;
}

interface SettingsState {
  keybinds: Keybinds;
  das: number;
  arr: number;
  softDropFactor: number;
  handling: HandlingConfig;
  musicVolume: number;
  sfxVolume: number;
  boardSkin: string;
  setKeybind: (action: keyof Keybinds, key: string) => void;
  setDAS: (val: number) => void;
  setARR: (val: number) => void;
  setSoftDropFactor: (val: number) => void;
  setDCD: (val: number) => void;
  setPreventAccidentalHardDrop: (v: boolean) => void;
  setCancelDASOnDirectionChange: (v: boolean) => void;
  setPreferSoftDropOverMovement: (v: boolean) => void;
  setIrs: (v: IrsMode) => void;
  setMusicVolume: (val: number) => void;
  setSfxVolume: (val: number) => void;
  resetHandlingDefaults: () => void;
  loadSettings: (settings: Partial<SettingsState>) => void;
  applyServerSettings: (row: ServerSettingsRow | null | undefined) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  keybinds: { ...DEFAULT_KEYBINDS },
  das: 133,
  arr: 16,
  softDropFactor: 20,
  handling: { ...DEFAULT_HANDLING },
  musicVolume: 0.5,
  sfxVolume: 0.8,
  boardSkin: 'default',

  setKeybind: (action, key) =>
    set((state) => ({ keybinds: { ...state.keybinds, [action]: key } })),
  setDAS: (val) => set({ das: val }),
  setARR: (val) => set({ arr: val }),
  setSoftDropFactor: (val) => set({ softDropFactor: val }),
  setDCD: (val) => set((s) => ({ handling: { ...s.handling, dcd: val } })),
  setPreventAccidentalHardDrop: (v) =>
    set((s) => ({ handling: { ...s.handling, preventAccidentalHardDrop: v } })),
  setCancelDASOnDirectionChange: (v) =>
    set((s) => ({ handling: { ...s.handling, cancelDASOnDirectionChange: v } })),
  setPreferSoftDropOverMovement: (v) =>
    set((s) => ({ handling: { ...s.handling, preferSoftDropOverMovement: v } })),
  setIrs: (v) => set((s) => ({ handling: { ...s.handling, irs: v } })),
  setMusicVolume: (val) => set({ musicVolume: val }),
  setSfxVolume: (val) => set({ sfxVolume: val }),
  resetHandlingDefaults: () =>
    set({
      das: 133,
      arr: 16,
      softDropFactor: 20,
      handling: { ...DEFAULT_HANDLING },
    }),
  loadSettings: (settings) => set((state) => ({ ...state, ...settings })),
  applyServerSettings: (row) => {
    if (!row) return;
    set((state) => ({
      ...state,
      keybinds: row.keybinds !== undefined ? parseKeybinds(row.keybinds) : state.keybinds,
      das: typeof row.das === 'number' ? row.das : state.das,
      arr: typeof row.arr === 'number' ? row.arr : state.arr,
      softDropFactor:
        typeof row.softDropFactor === 'number' ? row.softDropFactor : state.softDropFactor,
      handling: row.handlingConfig !== undefined ? parseHandling(row.handlingConfig) : state.handling,
      musicVolume: typeof row.musicVolume === 'number' ? row.musicVolume : state.musicVolume,
      sfxVolume: typeof row.sfxVolume === 'number' ? row.sfxVolume : state.sfxVolume,
      boardSkin: typeof row.boardSkin === 'string' ? row.boardSkin : state.boardSkin,
    }));
  },
}));
