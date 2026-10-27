import { useCallback, useEffect, useState } from 'react';
import { healthApi } from '../api/endpoints.js';

/** Checks the API is reachable so the sign-in screen can explain connection problems up front. */
export function useApiHealth() {
  const [state, setState] = useState({ status: 'checking', error: null });

  const check = useCallback(async (signal) => {
    setState({ status: 'checking', error: null });
    try {
      await healthApi.check({ signal });
      setState({ status: 'ok', error: null });
    } catch (error) {
      if (!signal?.aborted) setState({ status: 'down', error });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal);
    return () => controller.abort();
  }, [check]);

  return { ...state, retry: () => check() };
}
