import { Music, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useMusic } from "@/contexts/MusicContext";

const MusicControls = () => {
  const { volume, setVolume, muted, setMuted } = useMusic();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-[10px] tracking-wider text-muted-foreground">MUSIC</span>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          className={`rounded px-2 py-0.5 font-display text-[9px] tracking-wider transition-all ${
            muted
              ? 'border border-destructive/50 bg-destructive/10 text-destructive'
              : 'border border-border/30 bg-card/50 text-muted-foreground'
          }`}
        >
          {muted ? 'MUTED' : 'ON'}
        </button>
      </div>
      {!muted && (
        <div onTouchStart={(e) => e.stopPropagation()}>
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={(val) => setVolume(val[0] / 100)}
          />
        </div>
      )}
    </div>
  );
};

export default MusicControls;
