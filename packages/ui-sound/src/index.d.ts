import type { Config } from '@link-foundation/ui-config';
import type { SettingsSchema } from '@link-foundation/ui-settings';

export interface Diagnostic {
  code: string;
  severity: 'warning' | 'error';
  message: string;
}
export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  curve?: 'linear' | 'exponential';
}
export interface VoicePart {
  kind: 'tone' | 'noise';
  wave: OscillatorType;
  frequency: number;
  to: number;
  glide: number | null;
  gain: number;
  delay: number;
  pan: number;
  detune: number;
  envelope: Envelope;
  fm?: { ratio: number; index: number };
  filter?: { type: BiquadFilterType; from: number; to: number; q: number };
}
export interface SoundVoice {
  parts: VoicePart[];
  repeat: number;
  gap: number;
  repeatDecay: number;
  source: {
    label: string;
    license: string;
    character?: string;
    url?: string;
    port?: string;
  };
}
export interface SoundTheme {
  name: string;
  voices: Record<string, SoundVoice>;
  events: Record<
    string,
    { mode: 'random' | 'cycle' | 'layer'; voices: string[]; throttle: number }
  >;
  bus: {
    shelf: [number, number];
    compressor: [number, number];
    reverb: number;
  };
}
export function readSoundTheme(text: unknown): {
  theme: SoundTheme | null;
  diagnostics: Diagnostic[];
};
export interface SoundBus {
  input: GainNode;
  master: GainNode;
  disconnect(): void;
}
export function createSoundBus(
  audio: BaseAudioContext,
  settings: SoundTheme['bus'],
  random?: () => number
): SoundBus;
export function playVoice(
  audio: BaseAudioContext,
  voice: SoundVoice,
  output: AudioNode,
  options?: { at?: number; pan?: number; gain?: number; random?: () => number }
): number;
export interface SoundConfig {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  subscribe(listener: (...args: any[]) => void): () => void;
}
export interface SoundCue {
  event: string;
  pan: number;
}
export interface SoundPlayer {
  play(event: string, options?: { x?: number }): string[];
  cue(name: string, options?: { x?: number }): string[];
  onCue(handler: (cue: SoundCue) => void): () => void;
  setVolume(value: number): void;
  mute(value?: boolean): void;
  readonly enabled: boolean;
  readonly volume: number;
  dispose(): Promise<void>;
}
export function createSoundPlayer(options: {
  theme: SoundTheme;
  config?: SoundConfig;
  now?: () => number;
  random?: () => number;
  createContext?: () => AudioContext;
  gestureTarget?: EventTarget & { innerWidth?: number };
  reducedMotion?: () => boolean;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}): SoundPlayer;
export const DEFAULT_SOUND_MAPPING: string;
export function bindSound(
  player: Pick<SoundPlayer, 'play'>,
  options?: {
    mapping?: string;
    machines?: Array<{
      subscribe(
        listener: (snapshot: { event: { type: string } | null }) => void
      ): () => void;
    }>;
  }
): {
  onAction(detail: { event: string }, event?: Event): void;
  dispose(): void;
};
export const SOUND_SETTINGS_LINO: string;
export const SOUND_COMFORT_KEYS: readonly string[];
export function soundSettingsSchema(): SettingsSchema;
export function bindSoundConfig(
  config: Config,
  options?: { target?: string }
): SoundConfig;
