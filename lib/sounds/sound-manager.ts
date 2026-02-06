/**
 * Sound Manager - Web Audio API singleton for synthesized UI sounds
 */

class SoundManager {
  private static instance: SoundManager | null = null;
  private audioContext: AudioContext | null = null;
  private isEnabled = true;

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  initialize(): void {
    if (this.audioContext || typeof window === "undefined") return;
    this.audioContext = new AudioContext();
  }

  private ensureContext(): AudioContext | null {
    if (!this.isEnabled || !this.audioContext) return null;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /** Short percussive click for tile select, empty cell click, and run/start actions */
  playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, t);
    oscillator.frequency.exponentialRampToValueAtTime(400, t + 0.06);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(t);
    oscillator.stop(t + 0.06);
  }

  /** Distinct descending tone for stop/close actions */
  playStop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(500, t);
    oscillator.frequency.exponentialRampToValueAtTime(200, t + 0.1);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(t);
    oscillator.stop(t + 0.1);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }
}

export const soundManager = SoundManager.getInstance();
