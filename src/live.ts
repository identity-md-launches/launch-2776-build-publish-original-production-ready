import { rulesFor, type Rules } from './engine.ts';

export const STATUS_URL = 'https://api.squeekchain.com/v1/status';
export const POLL_MS = 15_000;
export const TIMEOUT_MS = 5_000;
export interface Measurement {
  coreStatus: 'SPINNING' | 'IDLE';
  rpmMilli?: number;
  observedAt: string;
  staleAfterMs: number;
}
export type LiveProblem = 'loading' | 'network' | 'timeout' | 'invalid' | 'stale';
export interface LiveState { measurement?: Measurement; fetchedAt?: number; problem?: LiveProblem; failures: number; nextAt?: number }

export function parseStatus(data: unknown, now: number): Measurement {
  if (!data || typeof data !== 'object' || !('measurement' in data)) throw new Error('invalid');
  const m = (data as { measurement: unknown }).measurement;
  if (!m || typeof m !== 'object') throw new Error('invalid');
  const raw = m as Record<string, unknown>;
  if (raw.coreStatus !== 'SPINNING' && raw.coreStatus !== 'IDLE') throw new Error('invalid');
  if (typeof raw.observedAt !== 'string' || !Number.isFinite(Date.parse(raw.observedAt))) throw new Error('invalid');
  const staleAfterMs = typeof raw.staleAfterSeconds === 'number' && raw.staleAfterSeconds > 0 ? Math.min(raw.staleAfterSeconds * 1000, 120_000) : 45_000;
  if (raw.freshness !== undefined && raw.freshness !== 'online') throw new Error('stale');
  if (now - Date.parse(raw.observedAt) > staleAfterMs || Date.parse(raw.observedAt) > now + 10_000) throw new Error('stale');
  return { coreStatus: raw.coreStatus, observedAt: raw.observedAt, staleAfterMs,
    ...(typeof raw.rpmMilli === 'number' && Number.isFinite(raw.rpmMilli) && raw.rpmMilli >= 0 ? { rpmMilli: raw.rpmMilli } : {}) };
}
export function isFresh(live: LiveState, now = Date.now()): boolean {
  return !live.problem && !!live.measurement && now - Date.parse(live.measurement.observedAt) <= live.measurement.staleAfterMs;
}
export function currentRules(live: LiveState, now = Date.now()): Rules {
  if (!isFresh(live, now)) return rulesFor('practice');
  return rulesFor(live.measurement!.coreStatus === 'SPINNING' ? 'spinning' : 'nap', live.measurement!.observedAt);
}
export function retryDelay(failures: number): number { return Math.min(POLL_MS * 2 ** Math.min(failures, 3), 120_000); }

export class LivePoller {
  state: LiveState = { problem: 'loading', failures: 0 };
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private stopped = true;
  private busy = false;
  private onChange: (state: LiveState) => void;
  private fetcher: typeof fetch;
  private timeoutMs: number;
  constructor(onChange: (state: LiveState) => void, fetcher: typeof fetch = globalThis.fetch.bind(globalThis), timeoutMs = TIMEOUT_MS) {
    this.onChange = onChange; this.fetcher = fetcher; this.timeoutMs = timeoutMs;
  }
  start() { if (!this.stopped) return; this.stopped = false; void this.poll(); }
  stop() { this.stopped = true; clearTimeout(this.timer); this.controller?.abort(); }
  retry() { if (this.busy || this.stopped) return; clearTimeout(this.timer); void this.poll(); }
  private async poll() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    this.controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; this.controller?.abort(); }, this.timeoutMs);
    try {
      const response = await this.fetcher(STATUS_URL, { signal: this.controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('network');
      const measurement = parseStatus(await response.json(), Date.now());
      this.state = { measurement, fetchedAt: Date.now(), failures: 0 };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'network';
      this.state = { ...this.state, failures: this.state.failures + 1, problem: timedOut ? 'timeout' : reason === 'stale' || reason === 'invalid' ? reason : 'network' };
    } finally {
      clearTimeout(timeout);
      this.busy = false;
      if (!this.stopped) {
        const delay = retryDelay(this.state.failures);
        this.state.nextAt = Date.now() + delay;
        this.onChange(this.state);
        if (!this.stopped) this.timer = setTimeout(() => void this.poll(), delay);
      }
    }
  }
}
