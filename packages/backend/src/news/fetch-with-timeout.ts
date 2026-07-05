const DEFAULT_TIMEOUT_MS = 15_000

// Node's fetch has no default timeout — an unresponsive server (or one that
// hangs on HEAD, as some redirect services do) stalls this promise forever,
// which wedges the whole pipeline run since every stage here is sequential.
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}
