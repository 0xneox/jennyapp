
import {
  generateTileClick,
  generatePuppyPlace,
  generateLevelClear,
  generateUndoErase,
  generateHintSparkle,
  generateBgm,
  generateCatPurr,
  generateCatHiss,
  generateComboChime,
  generateLinkedSparkle,
  generateWrongBoop,
  getSampleRate,
} from './audioSynthesis';
import { loadAudioPrefs, saveAudioPrefs } from './storage';

export type SoundType =
  | 'placePuppy'
  | 'markX'
  | 'complete'
  | 'wrong'
  | 'button'
  | 'hint'
  | 'undo'
  | 'erase'
  | 'catPurr'
  | 'catHiss'
  | 'combo'
  | 'linkedSparkle';

const getSoundAsset = (key: string): any => {
  try {
    switch (key) {
      case 'puppy_place':
        return require('../../assets/sounds/puppy_place.wav');
      case 'tile_click':
        return require('../../assets/sounds/tile_click.wav');
      case 'level_clear':
        return require('../../assets/sounds/level_clear.wav');
      case 'undo_erase':
        return require('../../assets/sounds/undo_erase.wav');
      case 'hint_sparkle':
        return require('../../assets/sounds/hint_sparkle.wav');
      case 'wrong_boop':
        return require('../../assets/sounds/wrong_boop.wav');
      case 'cat_purr':
        return require('../../assets/sounds/cat_purr.wav');
      case 'cat_hiss':
        return require('../../assets/sounds/cat_hiss.wav');
      case 'combo_chime':
        return require('../../assets/sounds/combo_chime.wav');
      case 'linked_sparkle':
        return require('../../assets/sounds/linked_sparkle.wav');
      case 'bgm_acoustic':
        return require('../../assets/sounds/bgm_acoustic.m4a');
      default:
        return null;
    }
  } catch {
    return null;
  }
};

// Native file-backed assets. Every SoundType has its own file so phones get
// the same palette the Web Audio synth path produces.
const SOUND_MAP: Record<SoundType, string> = {
  placePuppy: 'puppy_place',
  markX: 'tile_click',
  button: 'tile_click',
  wrong: 'wrong_boop',
  complete: 'level_clear',
  undo: 'undo_erase',
  erase: 'undo_erase',
  hint: 'hint_sparkle',
  catPurr: 'cat_purr',
  catHiss: 'cat_hiss',
  combo: 'combo_chime',
  linkedSparkle: 'linked_sparkle',
};

// Web Audio synthesized buffer per SoundType.
const WEB_BUFFER_MAP: Record<SoundType, string> = {
  placePuppy: 'puppyPlace',
  markX: 'tileClick',
  button: 'tileClick',
  wrong: 'wrongBoop',
  complete: 'levelClear',
  undo: 'undoErase',
  erase: 'undoErase',
  hint: 'hintSparkle',
  catPurr: 'catPurr',
  catHiss: 'catHiss',
  combo: 'comboChime',
  linkedSparkle: 'linkedSparkle',
};

type InitListener = () => void;

class SoundManager {
  private sfxEnabled: boolean = true;
  private bgmEnabled: boolean = true;
  private initialized: boolean = false;
  initPromise: Promise<void> | null = null;
  private defaultBgmVolume: number = 0.32;
  private duckedBgmVolume: number = 0.06;

  // Web Audio state
  private webAudioCtx: any = null;
  private sfxGain: any = null;
  private bgmGain: any = null;
  private webAudioBuffers: Record<string, any> = {};
  private bgmSource: any = null;
  private isBgmPlaying: boolean = false;
  private duckTimeout: ReturnType<typeof setTimeout> | null = null;
  private isUnlocked: boolean = false;

  // Native expo-audio state (modern Expo SDK 57 standard)
  private expoAudioModule: any = null;
  private expoAudioBgmPlayer: any = null;
  private expoAudioPlayers: Map<string, any> = new Map();

  // SettingsModal subscribers: notified AFTER storage prefs are loaded from AsyncStorage
  // so React state re-reads the real (possibly-different-from-defaults values.
  private initListeners: InitListener[] = [];

  constructor() {
    // --- Bug #1 #2: Kick off audio engine eagerly (buffer synth + storage read + native players)
    // EARLY. App boot is our best friend. The promise settles before the user taps the screen.
    void this.init();
  }

  onInitDone(cb: InitListener): () => void {
    if (this.initialized) {
      // Already ready — fire next tick so callers don't double-fire listeners mount race.
      const id = setTimeout(cb, 0);
      return () => clearTimeout(id);
    }
    this.initListeners.push(cb);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      const i = this.initListeners.indexOf(cb);
      if (i >= 0) this.initListeners.splice(i, 1);
    };
  }

  private fireInitListeners() {
    const copy = this.initListeners.slice();
    this.initListeners = [];
    for (const l of copy) {
      try { l(); } catch { /* swallow React lifecycle errors never break audio */ }
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Restore persisted audio prefs BEFORE any engine reads the toggles
      try {
        const prefs = await loadAudioPrefs();
        if (prefs) {
          this.sfxEnabled = prefs.sfxEnabled;
          this.bgmEnabled = prefs.bgmEnabled;
        }
      } catch {
        // Keep defaults (true/true) when storage is not ready or corrupt.
      }

      const isWeb =
        typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';

      if (isWeb) {
        this.initWebAudio();
      } else {
        await this.initNativeAudio();
      }
      this.initialized = true;

      // Apply gains to match now-loaded webAudioCtx (gain nodes not available during initWebAudio
      // before prefs loaded, so gains would be set 1.0 default, now correct now true).
      this.applyGainState();
      this.fireInitListeners();

      // If already unlocked (e.g. already user-tapped before init done) and BGM still on
      // — kick off 99% of cold start case here instead waiting a tap later.
      if (this.isUnlocked && this.bgmEnabled) {
        this.startBgm();
      }
    })();

    return this.initPromise;
  }

  private applyGainState() {
    // Idempotent: syncs gain nodes + native players to current sfxEnabled/bgmEnabled.
    if (this.webAudioCtx && this.sfxGain) {
      try {
        this.sfxGain.gain.cancelScheduledValues(this.webAudioCtx.currentTime);
        this.sfxGain.gain.setValueAtTime(
          this.sfxEnabled ? 1.0 : 0.0,
          this.webAudioCtx.currentTime
        );
      } catch {}
    }
    if (this.webAudioCtx && this.bgmGain) {
      try {
        this.bgmGain.gain.cancelScheduledValues(this.webAudioCtx.currentTime);
        this.bgmGain.gain.setValueAtTime(
          this.bgmEnabled ? this.defaultBgmVolume : 0.0,
          this.webAudioCtx.currentTime
        );
      } catch {}
    }
    if (this.expoAudioBgmPlayer) {
      try {
        this.expoAudioBgmPlayer.volume = this.bgmEnabled ? this.defaultBgmVolume : 0;
      } catch {}
    }
  }

  // --- Web Audio Engine (Browsers) ---
  private initWebAudio() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      this.webAudioCtx = ctx;

      // Master gain nodes. Gains may be re-applied after prefs load via applyGainState().
      this.sfxGain = ctx.createGain();
      this.sfxGain.connect(ctx.destination);

      this.bgmGain = ctx.createGain();
      this.bgmGain.connect(ctx.destination);

      // --- Bug #1: eagerly synthesize ALL 11 sound buffers up-front, not per play.
      // Playback after this is zero allocation + start(0)
      const sampleRate = getSampleRate();
      const soundGenerators: Record<string, () => Float32Array> = {
        tileClick: generateTileClick,
        puppyPlace: generatePuppyPlace,
        levelClear: generateLevelClear,
        undoErase: generateUndoErase,
        hintSparkle: generateHintSparkle,
        bgm: generateBgm,
        catPurr: generateCatPurr,
        catHiss: generateCatHiss,
        comboChime: generateComboChime,
        linkedSparkle: generateLinkedSparkle,
        wrongBoop: generateWrongBoop,
      };

      for (const [key, generator] of Object.entries(soundGenerators)) {
        const samples = generator();
        const buffer = ctx.createBuffer(1, samples.length, sampleRate);
        buffer.getChannelData(0).set(samples);
        this.webAudioBuffers[key] = buffer;
      }

      if (__DEV__) console.log('[SoundManager] Web Audio initialized with synthesized buffers');

      // User gesture unlock for web autoplay policies
      const unlockAudio = () => {
        if (!this.webAudioCtx) return;
        // resume() may be async — fire-and-forget so callers never await on every play.
        if (this.webAudioCtx.state === 'suspended') {
          this.webAudioCtx.resume().catch(() => {});
        }
        this.isUnlocked = true;
        if (this.bgmEnabled && !this.isBgmPlaying) {
          this.startBgm();
        }
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
          window.removeEventListener(evt, unlockAudio);
        });
      };

      ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { once: true, passive: true });
      });
    } catch (e) {
      console.warn('[SoundManager] Web Audio init error:', e);
    }
  }

  // --- Native Audio Engine (Android / iOS) ---
  private async initNativeAudio() {
    // 1. Try modern expo-audio first (Expo SDK 57 standard)
    try {
      const expoAudio = await import('expo-audio');
      if (expoAudio && typeof expoAudio.createAudioPlayer === 'function') {
        this.expoAudioModule = expoAudio;
        if (typeof expoAudio.setAudioModeAsync === 'function') {
          await expoAudio.setAudioModeAsync({
            playsInSilentMode: true,
          }).catch(() => {});
        }
        // --- Bug #1 #2: eagerly pre-create every expo-audio SFX player + BGM
        // player NOW (during init) instead of lazily on the FIRST play().
        // First tap plays instantly — no create player seek 50+ bridge delay.
        for (const soundKey of new Set(Object.values(SOUND_MAP))) {
          const asset = getSoundAsset(soundKey);
          if (!asset) continue;
          try {
            const p = expoAudio.createAudioPlayer(asset);
            if (p) {
              p.volume = 0.85;
              this.expoAudioPlayers.set(soundKey, p);
            }
          } catch {}
        }
        const bgmAsset = getSoundAsset('bgm_acoustic');
        if (bgmAsset) {
          try {
            const bgmPlayer = expoAudio.createAudioPlayer(bgmAsset);
            if (bgmPlayer) {
              bgmPlayer.loop = true;
              bgmPlayer.volume = this.bgmEnabled ? this.defaultBgmVolume : 0;
              this.expoAudioBgmPlayer = bgmPlayer;
            }
          } catch {}
        }
        if (__DEV__) console.log('[SoundManager] Native audio engine initialized via expo-audio (SDK 57)');
        return;
      }
    } catch {
      // expo-audio not available or not linked in current runtime
    }

    if (__DEV__) console.log('[SoundManager] Native sound module unavailable in current environment; haptics active');
  }

  // --- Sound Effects Playback ---
  // NOTE: callers fire their own haptics alongside play() — do NOT trigger
  // haptics here or every tap vibrates twice.
  //
  // Y1 CRITICAL: This method is called WITHOUT await on 67+ call sites.
  // Every path MUST be wrapped so an unhandled promise rejection can never
  // escape (e.g. LegalAcceptanceModal taps before init on slow Android).
  play(type: SoundType): Promise<void> {
    // Fast path: sfx off → exit instantly. Return resolved Promise so callers
    // that (optionally) await — e.g. Jest assertions — still get a thenable.
    if (!this.sfxEnabled) return Promise.resolve();

    // Kick the rest into a microtask with a TERMINAL .catch(). Normal UI
    // callers fire-and-forget. Testers may await the returned Promise safely.
    return Promise.resolve()
      .then(() => this._playInternal(type))
      .catch((err) => {
        if (__DEV__) console.warn('[SoundManager] play() swallowed (Y1 guard):', err);
      });
  }

  private async _playInternal(type: SoundType): Promise<void> {
    // If init still settling (storage read, buffer synth, or native player warmup),
    // don't block — kick init in fire/forget and try playback anyway. If buffers
    // aren't ready, the sound drops once; 50ms later on the next tap, ready.
    if (!this.initialized) {
      if (!this.initPromise) void this.init();
    }

    // Automatic volume ducking during completion celebration (3200ms).
    if (type === 'complete') {
      try { this.duckBgm(3200); } catch {}
    }

    const soundKey = SOUND_MAP[type] || 'tile_click';

    // 1. Web Audio playback — NEVER await resume. Fire and return instantly.
    if (this.webAudioCtx && this.sfxGain && this.initialized) {
      try {
        if (this.webAudioCtx.state === 'suspended') {
          this.webAudioCtx.resume().catch(() => {});
        }
        const buffer = this.webAudioBuffers[WEB_BUFFER_MAP[type] ?? 'tileClick'];
        if (buffer) {
          const source = this.webAudioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.sfxGain);
          try { source.start(0); } catch {}
        }
      } catch (err) {
        if (__DEV__) console.warn('[SoundManager] Web Audio play error:', err);
      }
      return;
    }

    // 2. Modern Native Playback via expo-audio
    if (this.expoAudioModule) {
      try {
        let player = this.expoAudioPlayers.get(soundKey);
        if (!player) {
          const asset = getSoundAsset(soundKey);
          if (!asset) return;
          player = this.expoAudioModule.createAudioPlayer(asset);
          if (!player) return;
          player.volume = 0.85;
          this.expoAudioPlayers.set(soundKey, player);
        }
        if (!player) return;
        if (typeof player.seekTo === 'function') {
          Promise.resolve(player.seekTo(0)).catch(() => {});
        }
        try { player.play(); } catch {}
        return;
      } catch (err) {
        if (__DEV__) console.warn('[SoundManager] expo-audio play error:', err);
      }
    }
  }

  // --- Background Music (BGM) ---
  // Y1: startBgm/stopBgm/duckBgm are fire-and-forget. Never let a rejected
  // promise bubble up into the React event loop.
  startBgm(): Promise<void> {
    if (!this.bgmEnabled || this.isBgmPlaying) return Promise.resolve();
    return Promise.resolve()
      .then(() => this._startBgmInternal())
      .catch((err) => {
        if (__DEV__) console.warn('[SoundManager] startBgm() swallowed (Y1):', err);
      });
  }

  private async _startBgmInternal(): Promise<void> {
    // Fire-and-forget init if first bgm kick before init finished.
    if (!this.initialized) {
      if (!this.initPromise) void this.init();
      this.onInitDone(() => this._startBgmInternal());
      return;
    }

    // 1. Web Audio BGM
    if (this.webAudioCtx && this.webAudioBuffers['bgm']) {
      try {
        if (this.webAudioCtx.state === 'suspended') {
          return;
        }
        if (this.bgmSource) {
          try { this.bgmSource.stop(); } catch {}
        }
        const source = this.webAudioCtx.createBufferSource();
        source.buffer = this.webAudioBuffers['bgm'];
        source.loop = true;
        if (this.bgmGain) {
          this.bgmGain.gain.cancelScheduledValues(this.webAudioCtx.currentTime);
          this.bgmGain.gain.setValueAtTime(
            this.bgmEnabled ? this.defaultBgmVolume : 0.0,
            this.webAudioCtx.currentTime
          );
          source.connect(this.bgmGain);
        }
        try { source.start(0); } catch {}
        this.bgmSource = source;
        this.isBgmPlaying = true;
        if (__DEV__) console.log('[SoundManager] Cozy acoustic BGM playing (Web)');
      } catch (err) {
        if (__DEV__) console.warn('[SoundManager] Web BGM start error:', err);
      }
      return;
    }

    // 2. Modern expo-audio BGM
    if (this.expoAudioModule && this.expoAudioBgmPlayer) {
      try {
        this.expoAudioBgmPlayer.play();
        this.isBgmPlaying = true;
        if (__DEV__) console.log('[SoundManager] Cozy acoustic BGM playing (expo-audio native)');
        return;
      } catch (err) {
        if (__DEV__) console.warn('[SoundManager] expo-audio BGM start error:', err);
      }
    }
  }

  stopBgm(): Promise<void> {
    return Promise.resolve()
      .then(() => this._stopBgmInternal())
      .catch((err) => {
        if (__DEV__) console.warn('[SoundManager] stopBgm() swallowed (Y1):', err);
      });
  }

  private _stopBgmInternal(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
      } catch {}
      this.bgmSource = null;
    }

    if (this.expoAudioBgmPlayer) {
      try {
        this.expoAudioBgmPlayer.pause();
      } catch {}
    }

    this.isBgmPlaying = false;
  }

  duckBgm(durationMs: number = 3200): Promise<void> {
    if (!this.bgmEnabled) return Promise.resolve();
    return Promise.resolve()
      .then(() => this._duckBgmInternal(durationMs))
      .catch((err) => {
        if (__DEV__) console.warn('[SoundManager] duckBgm() swallowed (Y1):', err);
      });
  }

  private _duckBgmInternal(durationMs: number): void {
    if (this.duckTimeout) clearTimeout(this.duckTimeout);

    // Duck Web Audio BGM
    if (this.webAudioCtx && this.bgmGain) {
      try {
        const now = this.webAudioCtx.currentTime;
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.linearRampToValueAtTime(this.duckedBgmVolume, now + 0.15);

        this.duckTimeout = setTimeout(() => {
          if (this.webAudioCtx && this.bgmGain && this.bgmEnabled) {
            const resumeTime = this.webAudioCtx.currentTime;
            this.bgmGain.gain.cancelScheduledValues(resumeTime);
            this.bgmGain.gain.linearRampToValueAtTime(this.defaultBgmVolume, resumeTime + 0.8);
          }
        }, durationMs);
      } catch {}
    }

    // Duck expo-audio BGM
    if (this.expoAudioBgmPlayer) {
      try {
        this.expoAudioBgmPlayer.volume = this.duckedBgmVolume;
        this.duckTimeout = setTimeout(() => {
          if (this.expoAudioBgmPlayer && this.bgmEnabled) {
            this.expoAudioBgmPlayer.volume = this.defaultBgmVolume;
          }
        }, durationMs);
      } catch {}
    }
  }

  // --- Toggles & State ---
  setEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    saveAudioPrefs({ sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }).catch(() => {});
    // If web audio gain applied to nodes (native players volume unaffected per play volume 0.85 fixed
    // for SFX; we short-circuit above at start of play() for native.
    this.applyGainState();
  }

  isEnabled(): boolean {
    return this.sfxEnabled;
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    saveAudioPrefs({ sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }).catch(() => {});

    // Sync gain + native volume first
    this.applyGainState();

    if (enabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }

  isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  async cleanup() {
    if (this.duckTimeout) clearTimeout(this.duckTimeout);
    await this.stopBgm();

    // Cleanup expo-audio players
    for (const player of this.expoAudioPlayers.values()) {
      try {
        if (typeof player.release === 'function') {
          player.release();
        }
      } catch {}
    }
    this.expoAudioPlayers.clear();

    if (this.expoAudioBgmPlayer) {
      try {
        if (typeof this.expoAudioBgmPlayer.release === 'function') {
          this.expoAudioBgmPlayer.release();
        }
      } catch {}
      this.expoAudioBgmPlayer = null;
    }
  }
}

export const soundManager = new SoundManager();
