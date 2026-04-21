import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import StarField from "@/components/StarField";
import InstallAppModal from "@/components/InstallAppModal";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { musicManager } from "@/game/musicManager";

const PRO_TIPS = [
  "Don't Overheat! Overheating immobilises your ship and gives your opponent a massive advantage!",
  "Never underestimate the RADIXR4",
  "You can customise the look of your ship through the store.",
  "You can change how to control your Ship through your profile at any time!",
  "All Ships and Weapons have unique characteristics!",
  "Can you find all the Easter Eggs? New Ships, Skins and Avatars await!",
];

function playFogHorn() {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

  // Sawtooth oscillator: 55Hz → 30Hz over 1s
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(55, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1);

  // Sub oscillator for body
  const subOsc = ctx.createOscillator();
  subOsc.type = "triangle";
  subOsc.frequency.setValueAtTime(40, ctx.currentTime);
  subOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1);

  // Brown noise via buffer
  const bufferSize = ctx.sampleRate * 1;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 100;

  // Gains
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.5, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.35, ctx.currentTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

  // Master gain
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.6, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

  osc.connect(oscGain).connect(master);
  subOsc.connect(subGain).connect(master);
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  master.connect(ctx.destination);

  osc.start();
  subOsc.start();
  noise.start();
  osc.stop(ctx.currentTime + 1.1);
  subOsc.stop(ctx.currentTime + 1.1);
  noise.stop(ctx.currentTime + 1.1);

  setTimeout(() => ctx.close().catch(() => {}), 2000);
}

interface Props {
  onComplete: () => void;
  preloadFn: () => Promise<void>;
}

const LoadingScreen = ({ onComplete, preloadFn }: Props) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const { isStandalone } = useInstallPrompt();
  const [shuffledTips] = useState(() => {
    const arr = [...PRO_TIPS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const doneRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % shuffledTips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [shuffledTips.length]);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90));
    }, 60);

    const minTimer = new Promise<void>(res => setTimeout(res, 3000));
    const preload = preloadFn().catch(() => {});

    Promise.all([minTimer, preload]).then(() => {
      clearInterval(progressInterval);
      setProgress(100);
      setReady(true);
    });

    return () => clearInterval(progressInterval);
  }, [preloadFn]);

  const handleStart = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    playFogHorn();
    setFading(true);
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[1fr_auto] bg-background pt-10 pb-[max(env(safe-area-inset-bottom),16px)]">
      <StarField />

      {/* MIDDLE: Logo + progress/start + tip — vertically centered around START */}
      <div
        className={`relative z-10 row-start-1 self-center justify-self-center flex flex-col items-center gap-6 px-8 max-w-md w-full transition-opacity duration-1000 ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {/* Logo */}
        <div className="text-center animate-float">
          <h1 className="font-display text-4xl font-black tracking-widest text-primary glow-text md:text-5xl">
            STARMYTE
          </h1>
          <p className="mt-1 font-body text-sm text-muted-foreground tracking-wide">
            Space Combat Arena
          </p>
        </div>

        {/* Progress Bar / Start Button */}
        <div className="w-full space-y-2">
          {!ready ? (
            <>
              <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center font-display text-[10px] tracking-wider text-muted-foreground">
                LOADING...
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
              <button
                onClick={handleStart}
                className="px-12 py-3 rounded-lg bg-primary text-primary-foreground font-display text-lg tracking-widest font-bold animate-pulse-glow transition-transform hover:scale-105 active:scale-95"
              >
                START
              </button>
            </div>
          )}
        </div>

        {/* Pro Tip */}
        <div className="text-center space-y-1 min-h-[60px] flex flex-col justify-center">
          <p className="font-display text-[9px] tracking-wider text-primary/70">PRO TIP</p>
          <p className="font-body text-xs text-muted-foreground leading-relaxed transition-opacity duration-500">
            {shuffledTips[tipIndex]}
          </p>
        </div>
      </div>

      {/* BOTTOM: Install button + legal footer (pinned) */}
      <div
        className={`relative z-10 row-start-2 flex flex-col items-center gap-4 px-8 max-w-md w-full justify-self-center transition-opacity duration-1000 ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {/* Install Web App Button — hidden on desktop and when already running as PWA */}
        {!isStandalone && (
          <button
            onClick={() => setInstallOpen(true)}
            className="md:hidden px-8 py-2.5 rounded-lg bg-transparent border border-primary/60 text-primary font-display text-xs tracking-widest font-bold animate-pulse-glow transition-transform hover:scale-105 active:scale-95 hover:bg-primary/10"
          >
            INSTALL WEB APP
          </button>
        )}

        {/* Legal links footer — always visible for Google reviewers + crawlers */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center flex-wrap justify-center gap-x-3 gap-y-1 font-display text-[11px] tracking-wider text-muted-foreground">
            <Link to="/terms" className="hover:text-primary transition-colors">TERMS</Link>
            <span className="opacity-40">·</span>
            <Link to="/privacy" className="hover:text-primary transition-colors">PRIVACY</Link>
            <span className="opacity-40">·</span>
            <a href="mailto:service@poshtonic.com" className="hover:text-primary transition-colors">SUPPORT</a>
            <span className="opacity-40">·</span>
            <Link to="/links" className="hover:text-primary transition-colors">LINKS</Link>
          </div>
          <p className="font-display text-[9px] tracking-wider text-muted-foreground/50">V0.13</p>
        </div>
      </div>

      <InstallAppModal open={installOpen} onOpenChange={setInstallOpen} />
    </div>
  );
};

export default LoadingScreen;
