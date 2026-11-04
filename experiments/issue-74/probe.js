/** Run in a real browser via import('/probe.js').then(m => m.probe()). */
export async function probe() {
  const { readSoundTheme, playVoice } = await import('/sound.js');
  const themes = await (await fetch('/themes')).json();
  let rendered = 0;
  for (const [name, text] of Object.entries(themes)) {
    const { theme, diagnostics } = readSoundTheme(text);
    if (diagnostics.length) {
      throw new Error(JSON.stringify(diagnostics));
    }
    for (const [id, voice] of Object.entries(theme.voices)) {
      const audio = new globalThis.OfflineAudioContext(1, 44100 * 3, 44100);
      const end = playVoice(audio, voice, audio.destination, {
        random: () => 0.75,
      });
      const buffer = await audio.startRendering();
      const samples = buffer.getChannelData(0);
      let peak = 0;
      let tail = 0;
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i]));
        if (i > Math.ceil(end * 44100) + 10) {
          tail = Math.max(tail, Math.abs(samples[i]));
        }
      }
      if (!Number.isFinite(peak) || peak === 0 || tail !== 0) {
        throw new Error(JSON.stringify({ name, id, peak, tail, end }));
      }
      rendered++;
    }
  }
  return { rendered, allAudible: true, allSilentAfterEnvelope: true };
}
