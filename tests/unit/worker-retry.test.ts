import { describe, expect, it } from 'vitest';
import { exponentialBackoffMs, retryAfterMs } from '../../src/worker/retry.js';

describe('retentativas do worker', () => {
  it('respeita Retry-After em segundos para HTTP 429', () => {
    expect(retryAfterMs({ response: { statusCode: 429, headers: { 'retry-after': '120' } } })).toBe(
      120_000,
    );
  });

  it('não classifica outros erros como rate limit', () => {
    expect(retryAfterMs({ response: { statusCode: 503, headers: {} } })).toBeUndefined();
  });

  it('aplica backoff exponencial com teto', () => {
    expect([1, 2, 3, 8].map((attempt) => exponentialBackoffMs(attempt, 60_000, 3_600_000))).toEqual(
      [60_000, 120_000, 240_000, 3_600_000],
    );
  });
});
