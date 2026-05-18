class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicPlaying = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.15;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = vol;
    if (this.sfxGain) this.sfxGain.gain.value = vol;
  }

  setMusicVolume(vol: number) {
    this.musicVolume = vol;
    if (this.musicGain) this.musicGain.gain.value = vol;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.3,
    attack = 0.005,
    decay = 0.1,
    sustain = 0,
    pitchEnd?: number
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (pitchEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(pitchEnd, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gain.gain.linearRampToValueAtTime(sustain, ctx.currentTime + attack + decay);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private playNoise(duration: number, volume = 0.2, filterFreq = 2000) {
    const ctx = this.getCtx();
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  move() {
    this.playTone(440, 0.04, 'square', 0.08, 0.001, 0.04);
  }

  rotate() {
    this.playTone(300, 0.06, 'sine', 0.12, 0.002, 0.06, 0, 600);
  }

  softDrop() {
    this.playTone(200, 0.03, 'sine', 0.06, 0.001, 0.03);
  }

  hardDrop() {
    this.playTone(80, 0.12, 'sawtooth', 0.35, 0.001, 0.08, 0, 40);
    this.playNoise(0.1, 0.15, 800);
  }

  hold() {
    this.playTone(350, 0.06, 'sine', 0.15, 0.002, 0.06);
    setTimeout(() => this.playTone(500, 0.06, 'sine', 0.12, 0.002, 0.06), 60);
  }

  lineClear(lines: number) {
    if (lines === 1) {
      this.playTone(600, 0.15, 'sine', 0.25, 0.005, 0.15);
      this.playNoise(0.08, 0.1, 3000);
    } else if (lines === 2) {
      this.playTone(500, 0.08, 'sine', 0.2, 0.005, 0.08);
      setTimeout(() => this.playTone(700, 0.15, 'sine', 0.25, 0.005, 0.15), 80);
    } else if (lines === 3) {
      this.playTone(400, 0.07, 'sine', 0.2, 0.005, 0.07);
      setTimeout(() => this.playTone(600, 0.07, 'sine', 0.2, 0.005, 0.07), 70);
      setTimeout(() => this.playTone(900, 0.2, 'sine', 0.3, 0.005, 0.2), 140);
    } else {
      this.playTone(300, 0.06, 'square', 0.15, 0.005, 0.06);
      setTimeout(() => this.playTone(400, 0.06, 'square', 0.15, 0.005, 0.06), 60);
      setTimeout(() => this.playTone(500, 0.06, 'square', 0.15, 0.005, 0.06), 120);
      setTimeout(() => this.playTone(800, 0.4, 'sine', 0.35, 0.01, 0.4), 180);
      setTimeout(() => this.playNoise(0.2, 0.25, 5000), 180);
    }
  }

  tSpin() {
    const freqs = [400, 533, 711, 950];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.12, 'sine', 0.2, 0.005, 0.12), i * 50));
  }

  tSpinDouble() {
    const freqs = [300, 450, 675, 1000, 1400];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.15, 'sine', 0.25, 0.005, 0.15), i * 45));
    setTimeout(() => this.playNoise(0.15, 0.2, 4000), 200);
  }

  combo(count: number) {
    const baseFreq = 300 + count * 80;
    this.playTone(baseFreq, 0.12, 'sine', 0.2 + Math.min(count * 0.02, 0.2), 0.005, 0.12);
    if (count >= 4) setTimeout(() => this.playTone(baseFreq * 1.5, 0.1, 'sine', 0.15, 0.005, 0.1), 80);
  }

  backToBack() {
    this.playTone(1200, 0.05, 'sine', 0.1, 0.002, 0.05);
    setTimeout(() => this.playTone(1600, 0.05, 'sine', 0.1, 0.002, 0.05), 50);
    setTimeout(() => this.playTone(2000, 0.1, 'sine', 0.15, 0.002, 0.1), 100);
  }

  perfectClear() {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => setTimeout(() => this.playTone(f, 0.25, 'sine', 0.3, 0.01, 0.25), i * 60));
    setTimeout(() => this.playNoise(0.3, 0.3, 8000), 400);
  }

  levelUp() {
    [400, 500, 600, 800].forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'square', 0.2, 0.005, 0.1), i * 80));
  }

  ko() {
    this.playTone(400, 0.5, 'sawtooth', 0.4, 0.005, 0.5, 0, 50);
    this.playNoise(0.4, 0.3, 500);
  }

  gameOver() {
    const notes = [600, 500, 400, 300, 200];
    notes.forEach((f, i) => setTimeout(() => this.playTone(f, 0.2, 'sine', 0.2, 0.01, 0.2), i * 120));
  }

  win() {
    const notes = [523, 523, 784, 523, 784, 1047];
    const times = [0, 150, 300, 500, 600, 750];
    notes.forEach((f, i) => setTimeout(() => this.playTone(f, 0.25, 'square', 0.25, 0.01, 0.25), times[i]));
  }

  countdown() {
    this.playTone(880, 0.1, 'sine', 0.3, 0.005, 0.1);
  }

  countdownGo() {
    this.playTone(1760, 0.15, 'sine', 0.4, 0.005, 0.15);
    setTimeout(() => this.playNoise(0.1, 0.2, 5000), 50);
  }

  garbageReceive(lines: number) {
    this.playTone(60 + lines * 5, 0.2 + lines * 0.03, 'sawtooth', 0.2 + lines * 0.03, 0.01, 0.2);
    this.playNoise(0.15, 0.15, 300);
  }

  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.getCtx();

    const notes = [220, 261.63, 329.63, 440, 329.63, 261.63, 349.23, 440];
    const bassNotes = [110, 130.81, 164.81, 110, 130.81, 164.81, 174.61, 110];
    const noteDuration = 0.18;
    let step = 0;

    const playStep = () => {
      if (!this.musicPlaying) return;
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.value = notes[step % notes.length];
      leadGain.gain.setValueAtTime(0.12, now);
      leadGain.gain.linearRampToValueAtTime(0.08, now + noteDuration * 0.7);
      leadGain.gain.linearRampToValueAtTime(0, now + noteDuration);
      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain!);
      leadOsc.start(now);
      leadOsc.stop(now + noteDuration);

      if (step % 2 === 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.value = bassNotes[Math.floor(step / 2) % bassNotes.length];
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.linearRampToValueAtTime(0, now + noteDuration * 1.8);
        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain!);
        bassOsc.start(now);
        bassOsc.stop(now + noteDuration * 2);
      }

      step++;
      if (this.musicPlaying) this.musicTimer = setTimeout(playStep, noteDuration * 1000);
    };

    playStep();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  pauseMusic() {
    this.stopMusic();
  }
}

export const soundEngine = new SoundEngine();
