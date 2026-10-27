import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Calls `callback` every `intervalMs` while the tab is visible, and straight away when the
 * user comes back to the tab or reconnects — so teammates' changes appear without a refresh.
 */
export function usePolling(callback, { intervalMs, enabled = true }) {
  const saved = useRef(callback);
  useLayoutEffect(() => {
    saved.current = callback;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let lastRun = Date.now();
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRun < 1500) return; // focus + visibilitychange often fire together
      lastRun = Date.now();
      saved.current();
    };
    const timer = setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled, intervalMs]);
}
