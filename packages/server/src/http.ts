/**
 * fetch with a hard timeout. Without it, one unresponsive job site could hang a refresh forever
 * (the refresh endpoint allows only one run at a time, so the app would be stuck until restart).
 */
export function timedFetch(timeoutMs = 30_000, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => base(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) });
}
