const FADE_DURATION = 2000; // ms

interface TrackWithGain {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
}

class MusicManager {
  private audioContext: AudioContext | null = null;
  private mainTrack: TrackWithGain | null = null;
  private battleTracks: TrackWithGain[] = [];
  private activeBattleTrack: TrackWithGain | null = null;
  private _volume = 0.5;
  private _muted = false;
  private preloaded = false;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private currentMode: 'main' | 'battle' | 'none' = 'none';
  private audioUnlocked = false;

  constructor() {
    const stored = localStorage.getItem('music_volume');
    if (stored !== null) this._volume = parseFloat(stored);
    const storedMuted = localStorage.getItem('music_muted');
    if (storedMuted !== null) this._muted = storedMuted === 'true';

    const autoUnlock = () => {
      this.unlock();
      document.removeEventListener('touchstart', autoUnlock, true);
      document.removeEventListener('click', autoUnlock, true);
    };
    document.addEventListener('touchstart', autoUnlock, true);
    document.addEventListener('click', autoUnlock, true);
  }

  unlock() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext.resume().catch(() => {});
    } catch (_) { /* ignore */ }

    // Play a silent snippet to unlock HTML audio on iOS
    try {
      const silent = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwSHAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwSHAAAAAAAAAAAAAAAAAAAA');
      silent.volume = 0;
      silent.play().catch(() => {});
    } catch (_) { /* ignore */ }

    // Reconnect any tracks that were preloaded before AudioContext was available
    this.connectPendingTracks();
  }

  get volume() { return this._volume; }
  get muted() { return this._muted; }

  private getEffectiveGain(): number {
    return this._muted ? 0 : this._volume;
  }

  private connectTrack(audio: HTMLAudioElement): TrackWithGain {
    if (!this.audioContext) {
      return { audio, source: null, gain: null };
    }
    try {
      const source = this.audioContext.createMediaElementSource(audio);
      const gain = this.audioContext.createGain();
      gain.gain.value = this.getEffectiveGain();
      source.connect(gain);
      gain.connect(this.audioContext.destination);
      // Set HTMLAudioElement volume to 1 — GainNode controls actual volume
      audio.volume = 1;
      return { audio, source, gain };
    } catch (_) {
      // Fallback if Web Audio connection fails
      return { audio, source: null, gain: null };
    }
  }

  private setTrackGain(track: TrackWithGain, value: number) {
    if (track.gain) {
      track.gain.gain.value = value;
    } else {
      // Fallback for non-Web Audio (desktop)
      track.audio.volume = value;
    }
  }

  private getTrackGain(track: TrackWithGain): number {
    if (track.gain) {
      return track.gain.gain.value;
    }
    return track.audio.volume;
  }

  /** Reconnect tracks that were loaded before AudioContext existed */
  private connectPendingTracks() {
    if (!this.audioContext) return;

    const reconnect = (track: TrackWithGain): TrackWithGain => {
      if (track.source !== null) return track; // already connected
      try {
        const source = this.audioContext!.createMediaElementSource(track.audio);
        const gain = this.audioContext!.createGain();
        gain.gain.value = this.getEffectiveGain();
        source.connect(gain);
        gain.connect(this.audioContext!.destination);
        track.audio.volume = 1;
        return { audio: track.audio, source, gain };
      } catch (_) {
        return track;
      }
    };

    if (this.mainTrack && this.mainTrack.source === null) {
      this.mainTrack = reconnect(this.mainTrack);
    }
    this.battleTracks = this.battleTracks.map(t => t.source === null ? reconnect(t) : t);
    // Update activeBattleTrack reference if it was reconnected
    if (this.activeBattleTrack) {
      const idx = this.battleTracks.findIndex(t => t.audio === this.activeBattleTrack!.audio);
      if (idx >= 0) this.activeBattleTrack = this.battleTracks[idx];
    }
  }

  async preload(): Promise<void> {
    if (this.preloaded) return;

    // Ensure AudioContext exists before connecting tracks (critical for iOS)
    this.unlock();

    const loadAudio = (src: string): Promise<HTMLAudioElement> => {
      return new Promise((resolve, reject) => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 1; // Will be controlled by GainNode
        const onReady = () => { cleanup(); resolve(audio); };
        const onError = () => { cleanup(); reject(new Error(`Failed to load ${src}`)); };
        const cleanup = () => { audio.removeEventListener('canplaythrough', onReady); audio.removeEventListener('error', onError); };
        audio.addEventListener('canplaythrough', onReady);
        audio.addEventListener('error', onError);
        audio.load();
      });
    };

    const [main, d1, d2, d3] = await Promise.all([
      loadAudio('/audio/main-solo-loop.mp3'),
      loadAudio('/audio/division-1.mp3'),
      loadAudio('/audio/division-2.mp3'),
      loadAudio('/audio/division-3.mp3'),
    ]);

    // Connect all tracks through Web Audio API GainNodes
    this.mainTrack = this.connectTrack(main);
    this.battleTracks = [d1, d2, d3].map(t => this.connectTrack(t));

    this.mainTrack.audio.loop = false;
    this.mainTrack.audio.addEventListener('timeupdate', () => {
      if (!this.mainTrack) return;
      const remaining = this.mainTrack.audio.duration - this.mainTrack.audio.currentTime;
      if (remaining <= 2 && remaining > 0 && this.currentMode === 'main') {
        const fadeGain = (remaining / 2) * this.getEffectiveGain();
        this.setTrackGain(this.mainTrack, Math.max(0, fadeGain));
      }
    });
    this.mainTrack.audio.addEventListener('ended', () => {
      if (this.currentMode === 'main' && this.mainTrack) {
        this.mainTrack.audio.currentTime = 0;
        this.setTrackGain(this.mainTrack, this.getEffectiveGain());
        this.mainTrack.audio.play().catch(() => {});
      }
    });

    this.battleTracks.forEach(track => {
      track.audio.loop = true;
    });

    this.preloaded = true;
  }

  private ensureResumed() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  playMain() {
    if (!this.mainTrack) return;
    // If main track is already playing (e.g. during a fade transition), just claim mode
    if (!this.mainTrack.audio.paused) {
      this.currentMode = 'main';
      this.setTrackGain(this.mainTrack, this.getEffectiveGain());
      return;
    }
    if (this.currentMode === 'main') return;
    this.ensureResumed();
    this.stopAllTracks();
    this.currentMode = 'main';
    this.mainTrack.audio.currentTime = 0;
    this.setTrackGain(this.mainTrack, this.getEffectiveGain());
    this.mainTrack.audio.play().catch(() => {});
  }

  startBattle() {
    if (!this.battleTracks.length) return;
    this.ensureResumed();

    // Cancel any in-progress fade so its callback never fires
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    this.currentMode = 'battle';
    // Stop main track immediately
    if (this.mainTrack && !this.mainTrack.audio.paused) {
      this.mainTrack.audio.pause();
      this.setTrackGain(this.mainTrack, this.getEffectiveGain());
    }
    // Stop any previous battle track
    if (this.activeBattleTrack && !this.activeBattleTrack.audio.paused) {
      this.activeBattleTrack.audio.pause();
    }

    const idx = Math.floor(Math.random() * this.battleTracks.length);
    this.activeBattleTrack = this.battleTracks[idx];
    this.activeBattleTrack.audio.currentTime = 0;
    this.setTrackGain(this.activeBattleTrack, this.getEffectiveGain());
    this.activeBattleTrack.audio.play().catch(() => {});
  }

  /** Switch to a new random battle track (for level transitions / play again) */
  switchBattle() {
    if (!this.battleTracks.length) return;
    this.ensureResumed();

    // Cancel any in-progress fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    // If not already in battle mode, just start battle
    if (this.currentMode !== 'battle') {
      this.startBattle();
      return;
    }

    // Fade out current battle track, then play a new one
    this.fadeOut(this.activeBattleTrack, () => {
      // Pick a different track if possible
      let idx = Math.floor(Math.random() * this.battleTracks.length);
      if (this.battleTracks.length > 1 && this.activeBattleTrack === this.battleTracks[idx]) {
        idx = (idx + 1) % this.battleTracks.length;
      }
      this.activeBattleTrack = this.battleTracks[idx];
      this.activeBattleTrack.audio.currentTime = 0;
      this.setTrackGain(this.activeBattleTrack, this.getEffectiveGain());
      this.activeBattleTrack.audio.play().catch(() => {});
    });
  }

  stopBattle() {
    if (this.currentMode !== 'battle') return;
    this.currentMode = 'none';
    this.fadeOut(this.activeBattleTrack, () => {
      this.activeBattleTrack = null;
      if (this.currentMode === 'none') {
        this.playMain();
      }
    });
  }

  /** Hard-stop all battle audio immediately (no fade) and resume main menu music.
   *  Used for exceptional exits (connection failure, abort) to prevent audio artefacts. */
  hardResetToMenu() {
    if (this.fadeInterval) { clearInterval(this.fadeInterval); this.fadeInterval = null; }
    this.battleTracks.forEach(t => {
      if (!t.audio.paused) {
        if (t.gain && this.audioContext) {
          t.gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
        t.audio.pause();
        t.audio.currentTime = 0;
      }
      this.setTrackGain(t, this.getEffectiveGain());
    });
    if (this.mainTrack && !this.mainTrack.audio.paused) {
      this.mainTrack.audio.pause();
    }
    this.activeBattleTrack = null;
    this.currentMode = 'none';
    this.playMain();
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('music_volume', String(this._volume));
    this.applyVolume();
  }

  setMuted(m: boolean) {
    this._muted = m;
    localStorage.setItem('music_muted', String(m));
    this.applyVolume();
  }

  private applyVolume() {
    const gain = this.getEffectiveGain();
    if (this.currentMode === 'main' && this.mainTrack) {
      this.setTrackGain(this.mainTrack, gain);
    }
    if (this.currentMode === 'battle' && this.activeBattleTrack) {
      this.setTrackGain(this.activeBattleTrack, gain);
    }
  }

  private fadeOut(track: TrackWithGain | null, onDone: () => void) {
    if (!track || track.audio.paused) { onDone(); return; }
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    const startGain = this.getTrackGain(track);
    const steps = 20;
    const stepTime = FADE_DURATION / steps;
    let step = 0;
    this.fadeInterval = setInterval(() => {
      step++;
      this.setTrackGain(track, Math.max(0, startGain * (1 - step / steps)));
      if (step >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        track.audio.pause();
        this.setTrackGain(track, this.getEffectiveGain());
        onDone();
      }
    }, stepTime);
  }

  private stopAllTracks() {
    if (this.fadeInterval) { clearInterval(this.fadeInterval); this.fadeInterval = null; }
    // Ramp gain to 0 over 50ms to prevent audible pop/crackle
    const rampDown = (track: TrackWithGain) => {
      if (track.audio.paused) return;
      if (track.gain && this.audioContext) {
        track.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
        setTimeout(() => {
          track.audio.pause();
          this.setTrackGain(track, this.getEffectiveGain());
        }, 60);
      } else {
        track.audio.pause();
      }
    };
    if (this.mainTrack) rampDown(this.mainTrack);
    if (this.activeBattleTrack) rampDown(this.activeBattleTrack);
  }

  dispose() {
    this.stopAllTracks();
    this.currentMode = 'none';
  }
}

export const musicManager = new MusicManager();
