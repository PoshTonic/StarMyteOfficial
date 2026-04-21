import { useEffect, useState, useRef } from "react";
import { StarRarity, STAR_CONFIG } from "@/game/constants";
import { xpForLevel, formatNumber } from "@/game/xpHelper";
import StarOrb from "@/components/StarOrb";
import { Button } from "@/components/ui/button";

interface LevelUpScreenProps {
  oldLevel: number;
  oldXp: number;
  newLevel: number;
  newXp: number;
  bonusStar: StarRarity;
  onContinue: () => void;
}

/**
 * Full-screen animated level-up overlay.
 * 
 * Animation sequence:
 * 1. Show old level + bar at oldXp position
 * 2. Fill bar to 100% (1s)
 * 3. For each level gained: pulse level number, increment, reset bar, fill to next level's progress
 * 4. Show reward card
 * 5. Show CONTINUE button
 */
const LevelUpScreen = ({ oldLevel, oldXp, newLevel, newXp, bonusStar, onContinue }: LevelUpScreenProps) => {
  const levelsGained = newLevel - oldLevel;
  const [displayLevel, setDisplayLevel] = useState(oldLevel);
  const [barPercent, setBarPercent] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const animating = useRef(true);

  useEffect(() => {
    // Initial XP bar position
    const initialPercent = (oldXp / xpForLevel(oldLevel)) * 100;
    setBarPercent(initialPercent);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const animate = async () => {
      await delay(300);
      setShowTitle(true);
      await delay(400);

      // For each level gained, animate fill → pulse → reset
      for (let i = 0; i < levelsGained; i++) {
        const currentLvl = oldLevel + i;

        // If this is the first iteration, bar is already at oldXp position
        // Otherwise it's at 0 from the previous reset

        // Fill to 100%
        setBarPercent(100);
        await delay(1000);

        // Pulse and increment level
        setIsPulsing(true);
        await delay(300);
        setDisplayLevel(currentLvl + 1);
        await delay(500);
        setIsPulsing(false);
        await delay(200);

        // If there are more levels to go, reset to 0
        if (i < levelsGained - 1) {
          setBarPercent(0);
          await delay(200);
        }
      }

      // Final bar: fill to newXp position of newLevel
      const finalPercent = (newXp / xpForLevel(newLevel)) * 100;
      setBarPercent(0);
      await delay(200);
      setBarPercent(finalPercent);
      await delay(600);

      // Show reward
      setShowReward(true);
      await delay(500);
      setShowButton(true);
    };

    animate();

    return () => { animating.current = false; };
  }, []);

  const starConfig = STAR_CONFIG[bonusStar];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background: "linear-gradient(to bottom, hsla(222,47%,4%,0.75), hsla(199,89%,48%,0.75))",
        }}
      />

      {/* Content */}
      <div className="absolute inset-[30px] z-10 flex flex-col items-center justify-between rounded-xl border-2 border-primary/60 bg-card/80 backdrop-blur-md p-6 text-center shadow-[0_0_40px_hsla(199,89%,48%,0.3),inset_0_0_40px_hsla(199,89%,48%,0.05)]">
        {/* Top spacer */}
        <div />

        {/* Center content */}
        <div className="flex flex-col items-center gap-6 w-full max-w-[300px]">
          {/* Title */}
          <div
            className={`transition-all duration-500 ${showTitle ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <h2 className="font-display text-4xl tracking-[0.2em] glow-text animate-pulse">
              LEVEL UP!
            </h2>
          </div>

          {/* Level number */}
          <div
            className={`font-display text-6xl tracking-wider transition-transform duration-300 ${
              isPulsing ? "scale-130 text-primary" : "text-foreground"
            }`}
            style={{
              filter: isPulsing ? "drop-shadow(0 0 20px hsl(199, 89%, 48%))" : "none",
              transition: "transform 0.3s, color 0.3s, filter 0.3s",
              transform: isPulsing ? "scale(1.3)" : "scale(1)",
            }}
          >
            {displayLevel}
          </div>

          {/* XP Progress bar */}
          <div className="w-full space-y-2">
            <div className="flex justify-between text-[10px] font-display tracking-wider text-muted-foreground">
              <span>LEVEL {displayLevel}</span>
              <span>{formatNumber(xpForLevel(displayLevel))} XP</span>
            </div>
            <div className="w-full h-4 rounded-full bg-muted/50 overflow-hidden border border-border/30">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${barPercent}%`,
                  transition: "width 0.8s ease-in-out",
                  boxShadow: "0 0 10px hsl(199 89% 48% / 0.5), 0 0 20px hsl(199 89% 48% / 0.2)",
                }}
              />
            </div>
          </div>

          {/* Reward card */}
          <div
            className={`transition-all duration-500 ${showReward ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div
              className="rounded-xl border-2 px-6 py-4 flex flex-col items-center gap-3"
              style={{
                borderColor: `${starConfig.color}60`,
                background: `linear-gradient(135deg, ${starConfig.color}10, transparent)`,
              }}
            >
              <span className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
                LEVEL-UP REWARD
              </span>
              <StarOrb rarity={bonusStar} size={48} />
              <span
                className="font-display text-sm tracking-wider"
                style={{ color: starConfig.color }}
              >
                {starConfig.label.toUpperCase()} STAR
              </span>
            </div>
          </div>
        </div>

        {/* Bottom button */}
        <div
          className={`w-full transition-all duration-500 ${showButton ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <Button
            onClick={onContinue}
            className="w-full font-display tracking-[0.15em] text-base py-6"
            size="lg"
          >
            CONTINUE
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LevelUpScreen;
