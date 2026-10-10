/**
 * JennyDoko Telemetry Singleton.
 *
 * ZERO-EXTERNAL-DEPENDENCY shim with three pluggable backends:
 *   1. console      — always on, free, logs to Metro/Chrome devtools
 *   2. ringBuffer   — always on, last 200 events (for tester bug reports
 *                     via `__jenny_telemetry.dumpRingBuffer()`)
 *   3. external adapters — SWAP ME IN ON DAY 2 POST-LAUNCH (Firebase Crashlytics,
 *      Amplitude, Sentry, etc.). See `registerAdapter()` below.
 *
 * Call sites are intentionally synchronous so they never block hot UI paths
 * (placePuppy, cell taps). Async backend writes happen through fire-and-forget.
 *
 * Design invariant: if `setThrowOnError(false)` → every method returns truthy
 * on success, silently swallows errors on failure. JennyDoko never crashes
 * because of a telemetry bug.
 */

export type TelemetryEventName =
  | 'ftue_start'
  | 'legal_accept'
  | 'tutorial_step'
  | 'level_start'
  | 'level_clear'
  | 'level_fail'
  | 'hint_requested'
  | 'hint_pool_dry'
  | 'ad_watched'
  | 'ad_failed'
  | 'ad_reward_loaded'
  | 'streak_shop_redeem_hint'
  | 'streak_shop_redeem_undo'
  | 'streak_shop_redeem_skip'
  | 'streak_shop_redeem_repair'
  | 'streak_shop_redeem_failed'
  | 'daily_challenge_start'
  | 'daily_challenge_clear'
  | 'daily_challenge_streak_broken'
  | 'keep_looking_used'
  | 'easier_puzzle_rewind'
  | 'easier_puzzle_zen'
  | 'storage_error'
  | 'app_exception';

export interface TelemetryEvent {
  readonly name: TelemetryEventName;
  readonly params: Record<string, string | number | boolean | undefined | null>;
  readonly ts: number;
}

export type TelemetryAdapter = (ev: TelemetryEvent) => void;

const RING_BUFFER_MAX = 200;

class TelemetryService {
  private readonly ringBuffer: TelemetryEvent[] = [];
  private readonly adapters: TelemetryAdapter[] = [];
  private throwOnError = false;
  private enabled = true;

  /** Register an external adapter (Crashlytics/Amplitude/Sentry). Safe to call
   *  lazily after init — events captured before adapter registration are NOT
   *  replayed (to avoid double-counting). */
  registerAdapter(adapter: TelemetryAdapter): void {
    this.adapters.push(adapter);
  }

  /** Toggle for release builds that want to disable console noise. */
  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  /** DEVELOPMENT ONLY: default `false`. If true, programming errors in an
   *  adapter throw instead of being silently swallowed. */
  setThrowOnError(v: boolean): void {
    this.throwOnError = v;
  }

  /** Core synchronous track entry point. Never throws unless throwOnError=true. */
  track(name: TelemetryEventName, params: TelemetryEvent['params'] = {}): boolean {
    if (!this.enabled) return false;
    const ev: TelemetryEvent = { name, params, ts: Date.now() };
    try {
      // 1) Ring buffer (FIFO, bounded).
      if (this.ringBuffer.length >= RING_BUFFER_MAX) this.ringBuffer.shift();
      this.ringBuffer.push(ev);

      // 2) Console (dev-friendly — structured but readable).
      // tslint:disable-next-line:no-console
      console.info(`[telemetry:${name}]`, params);

      // 3) External adapters (fire-and-forget, per-adapter isolation so a
      //    broken Crashlytics SDK can't drop our whole telemetry pipe).
      for (let i = 0; i < this.adapters.length; i++) {
        try {
          this.adapters[i](ev);
        } catch (adapterErr) {
          console.error('[telemetry:adapter] adapter failed:', adapterErr);
          if (this.throwOnError) throw adapterErr;
        }
      }
      return true;
    } catch (topErr) {
      console.error('[telemetry] track() failed:', topErr);
      if (this.throwOnError) throw topErr;
      return false;
    }
  }

  /** Convenience wrapper: record an unhandled exception for crash reporting.
   *  Only call this once per exception (de-dupe upstream if needed). */
  recordException(error: Error, extra: TelemetryEvent['params'] = {}): void {
    const params: TelemetryEvent['params'] = {
      message: error.message,
      name: error.name,
      stack: error.stack ? String(error.stack).slice(0, 4000) : undefined,
      ...extra,
    };
    this.track('app_exception', params);
  }

  /** Expose ring buffer dump for tester / QA bug reports. In production this
   *  can be wired to a "Send Diagnostics" Settings button that builds a JSON
   *  attachment + emails it to support. */
  dumpRingBuffer(): TelemetryEvent[] {
    return this.ringBuffer.slice();
  }

  /** Dev escape hatch: clear all events (for unit tests). */
  _resetForTests(): void {
    this.ringBuffer.length = 0;
    this.adapters.length = 0;
  }
}

/** Singleton instance. Call sites import this directly. */
export const telemetry = new TelemetryService();

/** Dev / QA hook: attach to globalThis so testers can dump state via
 *  Chrome/React Native Debugger console. Safe on web + JSC + Hermes. */
if (typeof globalThis !== 'undefined') {
  (globalThis as typeof globalThis & { __jenny_telemetry?: TelemetryService }).__jenny_telemetry =
    telemetry;
}

/* -------------------------------------------------------------------------- */
/*                                 ADAPTER SHIMS                              */
/* -------------------------------------------------------------------------- */
/*
 * DAY 2 POST-LAUNCH — drop in ONE (or more) of these blocks and add matching
 * package.json deps. The public API never changes.
 *
 * --- Firebase Crashlytics + Analytics (React Native Firebase) ---
 *   import crashlytics from '@react-native-firebase/crashlytics';
 *   import analytics from '@react-native-firebase/analytics';
 *   telemetry.registerAdapter((ev) => {
 *     if (ev.name === 'app_exception') {
 *       const err = new Error(String(ev.params.message) ?? 'unknown');
 *       crashlytics().recordError(err);
 *     } else {
 *       analytics().logEvent(ev.name, ev.params as any).catch(() => {});
 *     }
 *   });
 *
 * --- Sentry (react-native-sentry / sentry-expo) ---
 *   import * as Sentry from '@sentry/react-native';
 *   telemetry.registerAdapter((ev) => {
 *     if (ev.name === 'app_exception') {
 *       Sentry.captureException(new Error(String(ev.params.message)));
 *     } else {
 *       Sentry.addBreadcrumb({ category: 'event', message: ev.name, data: ev.params });
 *     }
 *   });
 *
 * --- Amplitude ---
 *   import { Amplitude } from '@amplitude/analytics-react-native';
 *   telemetry.registerAdapter((ev) => Amplitude.track(ev.name, ev.params));
 */
