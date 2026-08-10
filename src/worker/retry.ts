export type HttpLikeError = {
  response?: {
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
  };
};

export function retryAfterMs(error: unknown, fallbackMs = 15 * 60 * 1000): number | undefined {
  const response = (error as HttpLikeError).response;
  if (response?.statusCode !== 429) return undefined;
  const header = response.headers?.['retry-after'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value && /^\d+$/.test(value)) return Number(value) * 1000;
  if (value) {
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return fallbackMs;
}

export function exponentialBackoffMs(attempt: number, baseMs: number, maxMs: number): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}
