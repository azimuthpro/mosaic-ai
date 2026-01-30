/**
 * Sound Manager - Web Audio API singleton for MPC-style pad sounds
 */

type SoundType = "padEmpty" | "padTile" | "padRelease";

interface SoundConfig {
  url: string;
  volume: number;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  padEmpty: {
    url: "/sounds/pad-empty.mp3",
    volume: 0.3,
  },
  padTile: {
    url: "/sounds/pad-tile.mp3",
    volume: 0.4,
  },
  padRelease: {
    url: "/sounds/pad-release.mp3",
    volume: 0.2,
  },
};

class SoundManager {
  private static instance: SoundManager | null = null;
  private audioContext: AudioContext | null = null;
  private buffers: Map<SoundType, AudioBuffer> = new Map();
  private isInitialized = false;
  private isEnabled = true;

  private constructor() {}

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === "undefined") return;

    try {
      this.audioContext = new AudioContext();

      // Preload all sounds
      await Promise.all(
        Object.entries(SOUND_CONFIGS).map(async ([key, config]) => {
          try {
            const response = await fetch(config.url);
            if (!response.ok) {
              console.warn(`Sound file not found: ${config.url}`);
              return;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer =
              await this.audioContext!.decodeAudioData(arrayBuffer);
            this.buffers.set(key as SoundType, audioBuffer);
          } catch (error) {
            console.warn(`Failed to load sound ${key}:`, error);
          }
        }),
      );

      this.isInitialized = true;
    } catch (error) {
      console.warn("Failed to initialize SoundManager:", error);
    }
  }

  play(type: SoundType): void {
    if (!this.isEnabled || !this.audioContext || !this.buffers.has(type))
      return;

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const buffer = this.buffers.get(type)!;
    const config = SOUND_CONFIGS[type];

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.value = config.volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  // Synthesize a simple MPC-style click if no audio files are loaded
  synthesizeClick(pitch: number = 800, duration: number = 0.08): void {
    if (!this.isEnabled || !this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(pitch, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      pitch * 0.5,
      this.audioContext.currentTime + duration,
    );

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Play empty pad click (higher pitch, shorter)
  playEmptyClick(): void {
    if (this.buffers.has("padEmpty")) {
      this.play("padEmpty");
    } else {
      this.synthesizeClick(1000, 0.06);
    }
  }

  // Play tile pad click (lower pitch, longer sustain)
  playTileClick(): void {
    if (this.buffers.has("padTile")) {
      this.play("padTile");
    } else {
      this.synthesizeClick(600, 0.12);
    }
  }
}

export const soundManager = SoundManager.getInstance();
export type { SoundType };
