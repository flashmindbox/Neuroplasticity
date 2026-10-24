// A soft bell made with the Web Audio API (no audio files to load).
export function bell(times = 1) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 1.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.15);
    }
  } catch {
    // Audio unavailable (e.g., autoplay restrictions) — the visual timer still ends.
  }
}
