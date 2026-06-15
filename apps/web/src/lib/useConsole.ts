'use client';

import { useEffect, useState } from 'react';
import { ApiClient } from './apiClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Browser-bound ApiClient. Operator routes derive tenant + role from the signed
 * session (sent as a cookie/Authorization by the deployment's edge), so the
 * console never supplies a tenant id. `fetch` is the standard browser fetch,
 * which already satisfies the injected FetchLike shape.
 */
export function consoleClient(): ApiClient {
  return new ApiClient({ baseUrl: API_BASE, fetch: (url, init) => fetch(url, init) });
}

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

/**
 * Run an async loader on mount. Surfaces loading/error/ready explicitly so every
 * page can render all three states honestly — and an unreachable API degrades to
 * an error state rather than a crash or a fabricated value.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    load().then(
      (data) => live && setState({ status: 'ready', data }),
      (error) => live && setState({ status: 'error', error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
