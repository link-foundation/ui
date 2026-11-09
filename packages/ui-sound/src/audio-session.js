import { createSoundBus } from './graph.js';

/** One lazy context; failures remain opt-in diagnostics, never UI exceptions. */
export function audioSession({
  theme,
  state,
  createContext,
  random,
  onDiagnostic,
  document,
}) {
  let audio;
  let bus;
  let failed = false;
  const report = (error) =>
    onDiagnostic({
      code: 'audio-unavailable',
      severity: 'warning',
      message: String(error?.message ?? error),
    });
  const attempt = (action) => {
    try {
      Promise.resolve(action()).catch(report);
    } catch (error) {
      report(error);
    }
  };
  const apply = () =>
    bus?.configure({ ...state, volume: state.enabled ? state.volume : 0 });
  const resume = () => {
    if (audio?.state === 'suspended' && !document?.hidden) {
      attempt(() => audio.resume());
    }
  };
  const ensure = () => {
    if (document?.hidden || failed) {
      return null;
    }
    try {
      if (!audio) {
        audio = createContext();
        bus = createSoundBus(audio, { ...theme.bus, room: state.room }, random);
        // Start silent before routing the first source, then ramp to preference.
        bus.master.gain.value = 0;
        apply();
      }
      resume();
      return { audio, bus };
    } catch (error) {
      bus?.disconnect();
      const context = audio;
      audio = bus = null;
      failed = true;
      attempt(() => context?.close?.());
      report(error);
      return null;
    }
  };
  const visibility = () => {
    if (document?.hidden && audio) {
      attempt(() => audio.suspend());
    }
  };
  document?.addEventListener('visibilitychange', visibility);
  return {
    ensure,
    apply,
    report,
    retry() {
      failed = false;
    },
    async dispose() {
      document?.removeEventListener('visibilitychange', visibility);
      bus?.disconnect();
      try {
        await audio?.close?.();
      } catch (error) {
        report(error);
      }
    },
  };
}
