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
    { mode: SoundMode; voices: string[]; throttle: number; level?: number }
  >;
  bus: {
    shelf: [number, number];
    compressor: [number, number];
    reverb: number;
    room?: number;
  };
}
export function readSoundTheme(text: unknown): {
  theme: SoundTheme | null;
  diagnostics: Diagnostic[];
};
export interface SoundBus {
  input: GainNode;
  master: GainNode;
  shelf: BiquadFilterNode;
  convolver: ConvolverNode;
  wet: GainNode;
  configure(
    values: Pick<
      SoundRuntimeSettings,
      'volume' | 'tone' | 'frequency' | 'reverb' | 'room'
    > & { maxVolume?: number }
  ): void;
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
  options?: {
    at?: number;
    pan?: number;
    gain?: number;
    detune?: number;
    random?: () => number;
  }
): number;
export interface SoundConfig {
  readonly schema?: SettingsSchema;
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  subscribe(listener: (...args: any[]) => void): () => void;
}
export interface SoundCue {
  event: string;
  pan: number;
}
export type SoundMode = 'random' | 'cycle' | 'layer';
export interface SoundEventSettings {
  voices?: string[];
  mode?: SoundMode;
  level?: number;
  throttle?: number;
}
export interface SoundRuntimeSettings {
  enabled?: boolean;
  volume?: number;
  tone?: number;
  frequency?: number;
  reverb?: number;
  room?: number;
  pitchSpread?: number;
  stereo?: boolean;
  width?: number;
  hoverGap?: number;
  mode?: SoundMode | null;
  events?: Record<string, SoundEventSettings>;
  reducedMotionEvents?: string[];
}
export interface SoundPlayer {
  play(event: string, options?: { x?: number }): string[];
  cue(name: string, options?: { x?: number }): string[];
  configure(values: SoundRuntimeSettings): void;
  preview(voiceName: string, options?: { x?: number }): string[];
  onCue(handler: (cue: SoundCue) => void): () => void;
  setVolume(value: number): void;
  mute(value?: boolean): void;
  readonly enabled: boolean;
  readonly volume: number;
  readonly hoverGap: number;
  dispose(): Promise<void>;
}
export function createSoundPlayer(options: {
  theme: SoundTheme;
  config?: SoundConfig;
  now?: () => number;
  random?: () => number;
  createContext?: () => AudioContext;
  gestureTarget?: EventTarget & { innerWidth?: number };
  document?: Document;
  hasBeenActive?: () => boolean;
  maxVolume?: number;
  reducedMotionEvents?: string[];
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
  options?: { target?: string; schema?: SettingsSchema }
): ReturnType<typeof import('@link-foundation/ui-settings').bindConfig> & {
  readonly schema: SettingsSchema;
};

export function bindSoundToDocument(
  player: Pick<SoundPlayer, 'play'> & Partial<Pick<SoundPlayer, 'hoverGap'>>,
  options?: { root?: Document | Element; cueEvent?: string; now?: () => number }
): { dispose(): void };
export interface SoundSettingsOptions {
  slots?: number;
  maxVolume?: number;
}
export type SoundSettingsEvent = string | { name: string; label?: string };
/** A nested LiNo schema fragment without a schema header. */
export function generateSoundSettings(
  theme: SoundTheme,
  events: SoundSettingsEvent[],
  options?: SoundSettingsOptions
): string;
export function createSoundSettingsSchema(
  theme: SoundTheme,
  events: SoundSettingsEvent[],
  options?: SoundSettingsOptions
): SettingsSchema;
export function soundEventKey(event: string, field: string): string;
