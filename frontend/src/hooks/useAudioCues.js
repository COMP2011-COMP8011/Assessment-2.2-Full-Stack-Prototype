import { useCallback, useMemo, useRef } from 'react';

// Audio cues synthesised with the Web Audio API, per Assessment 1 §2.3.
// No audio files are shipped; every cue is a generated oscillator.
const NOTES = { D5: 587.33, A2: 110.0, E4: 329.63 };
const MASTER_GAIN = 0.18; // keeps output well under the 70 dB ceiling

export function useAudioCues(enabled = true) {
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (freq, durationMs, startOffset = 0, sweepTo = null) => {
      if (!enabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime + startOffset / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (sweepTo) osc.frequency.linearRampToValueAtTime(sweepTo, t0 + durationMs / 1000);
      gain.gain.setValueAtTime(MASTER_GAIN, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durationMs / 1000);
    },
    [enabled, getCtx]
  );

  // Memoised so components can safely depend on the cue functions.
  return useMemo(
    () => ({
      taskCompleted: () => tone(NOTES.D5, 200), // "ding": D5, 200 ms sine
      taskDeleted: () => tone(NOTES.A2, 150), // "thud": A2, 150 ms sine
      error: () => {
        tone(NOTES.E4, 100); // double beep: E4, E4, 100 ms each, 50 ms gap
        tone(NOTES.E4, 100, 150);
      },
      navigate: () => tone(800, 100, 0, 1200), // "whoosh": 800 → 1200 Hz sweep, 100 ms
    }),
    [tone],
  );
}
