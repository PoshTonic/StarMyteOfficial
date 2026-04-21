/**
 * Web Audio API synthesized sound effects manager.
 * All sounds are generated programmatically — no external files needed.
 * Looping sounds use persistent nodes; one-shot sounds create disposable nodes (layered).
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private decodedBuffers = new Map<string, AudioBuffer>();

  // Persistent loop nodes
  private shieldHumOsc: OscillatorNode | null = null;
  private shieldHumGain: GainNode | null = null;
  private afterburnerOsc: OscillatorNode | null = null;
  private afterburnerNoise: AudioBufferSourceNode | null = null;
  private afterburnerGain: GainNode | null = null;

  // Phaser beam persistent nodes
  private phaserBeamOsc: OscillatorNode | null = null;
  private phaserBeamNoise: AudioBufferSourceNode | null = null;
  private phaserBeamGain: GainNode | null = null;

  // RadixR4 shockwave persistent nodes
  private radixOsc: OscillatorNode | null = null;
  private radixNoise: AudioBufferSourceNode | null = null;
  private radixGain: GainNode | null = null;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private get master(): GainNode {
    this.ensureContext();
    return this.masterGain!;
  }

  private createNoiseBuffer(duration: number, type: "white" | "brown" = "white"): AudioBuffer {
    const ctx = this.ensureContext();
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "brown") {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  // ─── Shield Hum (continuous loop) ──────────────────────────
  playShieldHum() {
    if (this.shieldHumOsc) return; // already playing
    const ctx = this.ensureContext();

    this.shieldHumGain = ctx.createGain();
    this.shieldHumGain.gain.value = 0;
    this.shieldHumGain.connect(this.master);

    // Low hum with harmonics
    this.shieldHumOsc = ctx.createOscillator();
    this.shieldHumOsc.type = "sawtooth";
    this.shieldHumOsc.frequency.value = 80;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    filter.Q.value = 5;

    this.shieldHumOsc.connect(filter);
    filter.connect(this.shieldHumGain);
    this.shieldHumOsc.start();

    // Fade in
    this.shieldHumGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.2);
  }

  stopShieldHum() {
    if (!this.shieldHumOsc || !this.shieldHumGain) return;
    const ctx = this.ensureContext();
    this.shieldHumGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    const osc = this.shieldHumOsc;
    const gain = this.shieldHumGain;
    setTimeout(() => {
      try { osc.stop(); } catch {}
      try { osc.disconnect(); gain.disconnect(); } catch {}
    }, 200);
    this.shieldHumOsc = null;
    this.shieldHumGain = null;
  }

  // ─── Shield Ricochet ───────────────────────────────────────
  playRicochet() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(3000, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ─── Machine Gun Shot ──────────────────────────────────────
  playMachineGun() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const buffer = this.createNoiseBuffer(0.06);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  // ─── Cannon Shot ───────────────────────────────────────────
  playCannon() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Low thud
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);

    // Noise burst
    const buffer = this.createNoiseBuffer(0.12);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);
  }

  // ─── Missile Target Beep (double beep) ─────────────────────
  playMissileBeep() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 1200;

      const gain = ctx.createGain();
      const offset = i * 0.12;
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.02);
      gain.gain.setValueAtTime(0.2, t + offset + 0.06);
      gain.gain.linearRampToValueAtTime(0, t + offset + 0.08);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.1);
    }
  }

  // ─── Missile Launch (afterburner whoosh) ───────────────────
  playMissileLaunch() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Rising oscillator
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);

    // Noise layer
    const buffer = this.createNoiseBuffer(0.4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    source.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);
  }

  // ─── Explosion ─────────────────────────────────────────────
  playExplosion() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const buffer = this.createNoiseBuffer(0.5, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  // ─── Ship Afterburner (continuous loop) ────────────────────
  playAfterburner() {
    if (this.afterburnerOsc) return;
    const ctx = this.ensureContext();

    this.afterburnerGain = ctx.createGain();
    this.afterburnerGain.gain.value = 0;
    this.afterburnerGain.connect(this.master);

    // Low rumble oscillator
    this.afterburnerOsc = ctx.createOscillator();
    this.afterburnerOsc.type = "sawtooth";
    this.afterburnerOsc.frequency.value = 45;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 150;
    filter.Q.value = 3;

    this.afterburnerOsc.connect(filter);
    filter.connect(this.afterburnerGain);
    this.afterburnerOsc.start();

    // Noise layer
    const noiseBuffer = this.createNoiseBuffer(2);
    this.afterburnerNoise = ctx.createBufferSource();
    this.afterburnerNoise.buffer = noiseBuffer;
    this.afterburnerNoise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;

    this.afterburnerNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.afterburnerGain);
    this.afterburnerNoise.start();

    // Fade in
    this.afterburnerGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3);
  }

  stopAfterburner() {
    if (!this.afterburnerOsc || !this.afterburnerGain) return;
    const ctx = this.ensureContext();
    this.afterburnerGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    const osc = this.afterburnerOsc;
    const noise = this.afterburnerNoise;
    const gain = this.afterburnerGain;
    setTimeout(() => {
      try { osc.stop(); } catch {}
      try { noise?.stop(); } catch {}
      try { osc.disconnect(); noise?.disconnect(); gain.disconnect(); } catch {}
    }, 400);
    this.afterburnerOsc = null;
    this.afterburnerNoise = null;
    this.afterburnerGain = null;
  }

  // ─── Hit Marker ────────────────────────────────────────────
  playHitMarker() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // ─── Blaster "Pew" ────────────────────────────────────────
  playBlaster() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // High-pitched sine sweep for "pew" laser
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);

    // Slight metallic ring layer
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(3500, t);
    osc2.frequency.exponentialRampToValueAtTime(1500, t + 0.06);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.08, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc2.connect(gain2);
    gain2.connect(this.master);
    osc2.start(t);
    osc2.stop(t + 0.1);
  }

  // ─── Phaser Charge (whining electric) ──────────────────────
  playPhaserCharge() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Rising sine sweep
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);

    // Electric noise texture
    const buffer = this.createNoiseBuffer(0.5);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    filter.Q.value = 3;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.02, t);
    noiseGain.gain.linearRampToValueAtTime(0.1, t + 0.45);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);
  }

  // ─── Phaser Beam (continuous deep loop) ────────────────────
  playPhaserBeam() {
    if (this.phaserBeamOsc) return;
    const ctx = this.ensureContext();

    this.phaserBeamGain = ctx.createGain();
    this.phaserBeamGain.gain.value = 0;
    this.phaserBeamGain.connect(this.master);

    // Low sawtooth for deep dark tone
    this.phaserBeamOsc = ctx.createOscillator();
    this.phaserBeamOsc.type = "sawtooth";
    this.phaserBeamOsc.frequency.value = 120;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 200;
    filter.Q.value = 4;

    this.phaserBeamOsc.connect(filter);
    filter.connect(this.phaserBeamGain);
    this.phaserBeamOsc.start();

    // Noise layer for texture
    const noiseBuffer = this.createNoiseBuffer(2, "brown");
    this.phaserBeamNoise = ctx.createBufferSource();
    this.phaserBeamNoise.buffer = noiseBuffer;
    this.phaserBeamNoise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 300;
    noiseFilter.Q.value = 2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;

    this.phaserBeamNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.phaserBeamGain);
    this.phaserBeamNoise.start();

    // Fade in
    this.phaserBeamGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
  }

  stopPhaserBeam() {
    if (!this.phaserBeamOsc || !this.phaserBeamGain) return;
    const ctx = this.ensureContext();
    this.phaserBeamGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    const osc = this.phaserBeamOsc;
    const noise = this.phaserBeamNoise;
    const gain = this.phaserBeamGain;
    setTimeout(() => {
      try { osc.stop(); } catch {}
      try { noise?.stop(); } catch {}
      try { osc.disconnect(); noise?.disconnect(); gain.disconnect(); } catch {}
    }, 300);
    this.phaserBeamOsc = null;
    this.phaserBeamNoise = null;
    this.phaserBeamGain = null;
  }

  // ─── Asteroid Destruction (rocky crumble) ────────────────
  playAsteroidDestroy() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const buffer = this.createNoiseBuffer(0.3, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  // ─── Asteroid Impact (heavy thud) ──────────────────────
  playAsteroidImpact() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // ─── Trident Zap (sizzle + high-freq zap) ─────────────────
  playTridentZap() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Noise burst (sizzle)
    const buffer = this.createNoiseBuffer(0.04);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 4000;
    filter.Q.value = 3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);

    // Sine sweep (zap)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(6000, t + 0.06);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // ─── Mine Explosion (deep boom) ───────────────────────────
  playMineExplosion() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Brown noise burst
    const buffer = this.createNoiseBuffer(0.6, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);

    // Sub-bass sine sweep
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(30, t);
    osc.frequency.exponentialRampToValueAtTime(15, t + 0.5);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  // ─── RadixR4 Fire (echoing sweeping sonic boom) ──────────
  playRadixFire() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Main bass sweep (150→60 Hz)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);

    // Mid-frequency harmonic layer (300→120 Hz) for body
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(300, t);
    harm.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.3, t);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    harm.connect(harmGain);
    harmGain.connect(this.master);
    harm.start(t);
    harm.stop(t + 0.5);

    // Brown noise sweep texture (400→1600 Hz bandpass)
    const buffer = this.createNoiseBuffer(0.5, "brown");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
    filter.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);

    // Delayed echo (400→150 Hz)
    const echo = ctx.createOscillator();
    echo.type = "sine";
    echo.frequency.setValueAtTime(400, t + 0.3);
    echo.frequency.exponentialRampToValueAtTime(150, t + 0.7);
    const echoGain = ctx.createGain();
    echoGain.gain.setValueAtTime(0, t);
    echoGain.gain.setValueAtTime(0.2, t + 0.3);
    echoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    echo.connect(echoGain);
    echoGain.connect(this.master);
    echo.start(t + 0.3);
    echo.stop(t + 0.85);
  }

  // ─── RadixR4 Shockwave (looping hollow bassy sizzle) ─────
  playRadixShockwave() {
    if (this.radixOsc) return; // already playing
    const ctx = this.ensureContext();

    this.radixGain = ctx.createGain();
    this.radixGain.gain.value = 0;
    this.radixGain.connect(this.master);

    // Sawtooth oscillator (80Hz) through resonant lowpass for hollow bass
    this.radixOsc = ctx.createOscillator();
    this.radixOsc.type = "sawtooth";
    this.radixOsc.frequency.value = 80;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = "lowpass";
    lowFilter.frequency.value = 250;
    lowFilter.Q.value = 8;

    this.radixOsc.connect(lowFilter);
    lowFilter.connect(this.radixGain);
    this.radixOsc.start();

    // Brown noise through bandpass (800Hz center) for sizzle texture
    const noiseBuffer = this.createNoiseBuffer(2, "brown");
    this.radixNoise = ctx.createBufferSource();
    this.radixNoise.buffer = noiseBuffer;
    this.radixNoise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.2;

    this.radixNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.radixGain);
    this.radixNoise.start();

    // Fade in quickly
    this.radixGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.1);
  }

  stopRadixShockwave() {
    if (!this.radixOsc || !this.radixGain) return;
    const ctx = this.ensureContext();
    // Fade out over 0.5s
    this.radixGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    const osc = this.radixOsc;
    const noise = this.radixNoise;
    const gain = this.radixGain;
    setTimeout(() => {
      try { osc.stop(); } catch {}
      try { noise?.stop(); } catch {}
      try { osc.disconnect(); noise?.disconnect(); gain.disconnect(); } catch {}
    }, 600);
    this.radixOsc = null;
    this.radixNoise = null;
    this.radixGain = null;
  }

  // ─── Ship Explosion (MP3 file) ──────────────────────────────
  playShipExplosion() {
    try {
      const ctx = this.ensureContext();
      const audio = new Audio("/sfx/ship-explosion.mp3");
      // Route through Web Audio for master volume control
      const source = ctx.createMediaElementSource(audio);
      source.connect(this.master);
      audio.play().catch(() => {});
    } catch {}
  }

  // ─── Decoded buffer SFX (preloaded MP3, replayable, pitchable) ─────
  async preloadSfx(url: string): Promise<void> {
    if (this.decodedBuffers.has(url)) return;
    try {
      const ctx = this.ensureContext();
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.decodedBuffers.set(url, buf);
    } catch {
      // Silent failure — call sites will no-op if buffer missing
    }
  }

  private playBuffered(url: string, opts?: { playbackRate?: number; volume?: number }) {
    const buf = this.decodedBuffers.get(url);
    if (!buf) return;
    try {
      const ctx = this.ensureContext();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts?.playbackRate ?? 1;
      const gain = ctx.createGain();
      gain.gain.value = opts?.volume ?? 1;
      src.connect(gain).connect(this.master);
      src.start();
    } catch {}
  }

  // ─── Asteroid Explosion (pitch by radius) ──────────────────
  playAsteroidExplosion(radius: number) {
    // 10px → 1.6× (high/snappy), 50px → 1.0×, 100px → 0.65× (deep/heavy)
    const rate = Math.max(0.65, Math.min(1.6, 1.6 - ((radius - 10) / 90) * 0.95));
    this.playBuffered("/sfx/asteroid-explosion.mp3", { playbackRate: rate, volume: 1 });
  }

  // ─── Victory / Defeat Chime ───────────────────────────────
  playVictoryChime(isVictory: boolean) {
    // Defeat re-pitched 2 octaves down (each octave = 0.5×)
    const rate = isVictory ? 1.0 : 0.25;
    this.playBuffered("/sfx/victory-chime.mp3", { playbackRate: rate, volume: 1 });
  }

  // ─── Sizzling Zap (star merge creation) ──────────────────────
  playSizzlingZap() {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // High-to-low frequency sweep (zap)
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(4000, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);

    // White noise burst (sizzle)
    const buffer = this.createNoiseBuffer(0.15);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 5000;
    filter.Q.value = 2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    source.start(t);

    // Subtle tail tone
    const tail = ctx.createOscillator();
    tail.type = "sine";
    tail.frequency.setValueAtTime(800, t + 0.05);
    tail.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.15, t + 0.05);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    tail.connect(tailGain);
    tailGain.connect(this.master);
    tail.start(t + 0.05);
    tail.stop(t + 0.3);
  }

  setVolume(value: number) {
    this.ensureContext();
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  getVolume(): number {
    return this.masterGain?.gain.value ?? 0.3;
  }

  dispose() {
    this.stopShieldHum();
    this.stopAfterburner();
    this.stopPhaserBeam();
    this.stopRadixShockwave();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const audioManager = new AudioManager();
