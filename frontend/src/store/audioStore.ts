import { create } from 'zustand';
import { soundEngine } from '@/lib/audio/soundEngine';

interface AudioState {
  sfxVolume: number;
  musicVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  initAudio: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  sfxVolume: 0.8,
  musicVolume: 0.15,
  musicEnabled: true,
  sfxEnabled: true,

  setSfxVolume: (v) => {
    set({ sfxVolume: v });
    soundEngine.setSfxVolume(get().sfxEnabled ? v : 0);
  },

  setMusicVolume: (v) => {
    set({ musicVolume: v });
    soundEngine.setMusicVolume(get().musicEnabled ? v : 0);
  },

  toggleMusic: () => {
    const next = !get().musicEnabled;
    set({ musicEnabled: next });
    if (next) {
      soundEngine.setMusicVolume(get().musicVolume);
      soundEngine.startMusic();
    } else {
      soundEngine.stopMusic();
      soundEngine.setMusicVolume(0);
    }
  },

  toggleSfx: () => {
    const next = !get().sfxEnabled;
    set({ sfxEnabled: next });
    soundEngine.setSfxVolume(next ? get().sfxVolume : 0);
  },

  initAudio: () => {
    soundEngine.setSfxVolume(get().sfxEnabled ? get().sfxVolume : 0);
    soundEngine.setMusicVolume(get().musicEnabled ? get().musicVolume : 0);
  },
}));
