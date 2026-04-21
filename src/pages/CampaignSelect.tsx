import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StarField from "@/components/StarField";
import LevelPreviewCanvas from "@/components/LevelPreviewCanvas";
import type { SkinColourMap } from "@/game/skinUtils";
import { STAGE_DEFS, LEVEL_DEFS } from "@/game/campaignData";
// (top imports unchanged below)
import stage1 from "@/assets/campaign/stage-1.jpg";
import stage2 from "@/assets/campaign/stage-2.jpg";
import stage3 from "@/assets/campaign/stage-3.jpg";
import stage4 from "@/assets/campaign/stage-4.jpg";
import stage5 from "@/assets/campaign/stage-5.jpg";
import stage6 from "@/assets/campaign/stage-6.jpg";

const STAGE_IMAGES = [stage1, stage2, stage3, stage4, stage5, stage6];

interface Progress {
  stage: number;
  level: number;
  stars: number;
  completed: boolean;
}

const CampaignSelect = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [progress, setProgress] = useState<Progress[]>([]);
  const [view, setView] = useState<"stages" | "levels">("stages");
  const [selectedStage, setSelectedStage] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flareColours, setFlareColours] = useState<SkinColourMap | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("campaign_progress")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setProgress(data as Progress[]);
      });
  }, [user]);

  // Fetch the Flare skin once for use in boss-level previews
  useEffect(() => {
    supabase
      .from("skins")
      .select("colours")
      .eq("name", "Flare")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.colours) setFlareColours(data.colours as SkinColourMap);
      });
  }, []);

  // Handle stage query param to auto-open level view
  useEffect(() => {
    const stageParam = searchParams.get("stage");
    if (stageParam) {
      const stageNum = parseInt(stageParam);
      if (!isNaN(stageNum) && stageNum >= 1 && stageNum <= STAGE_DEFS.length) {
        setSelectedStage(stageNum - 1);
        setView("levels");
        setActiveIndex(0);
      }
    }
  }, [searchParams]);

  const getProgress = (stage: number, level: number) =>
    progress.find((p) => p.stage === stage && p.level === level);

  const isStageUnlocked = (stageIdx: number) => {
    if (stageIdx === 0) return true;
    for (let l = 1; l <= 10; l++) {
      const p = getProgress(stageIdx, l);
      if (!p?.completed) return false;
    }
    return true;
  };

  const isLevelUnlocked = (stageIdx: number, levelIdx: number) => {
    if (levelIdx === 0) return true;
    const p = getProgress(stageIdx + 1, levelIdx);
    return !!p?.completed;
  };

  const items = view === "stages" ? STAGE_DEFS : LEVEL_DEFS;
  const count = items.length;

  const scrollToIndex = useCallback((idx: number) => {
    if (!scrollRef.current || idx < 0 || idx >= count) return;
    const el = scrollRef.current;
    const cardWidth = el.scrollWidth / count;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
    setActiveIndex(idx);
  }, [count]);

  const handleStageSelect = (idx: number) => {
    if (!isStageUnlocked(idx)) return;
    setSelectedStage(idx);
    setActiveIndex(0);
    setView("levels");
    setTimeout(() => scrollToIndex(0), 50);
  };

  const handleLevelSelect = (levelIdx: number) => {
    if (!isLevelUnlocked(selectedStage, levelIdx)) return;
    navigate(
      `/battle?mode=campaign&stage=${selectedStage + 1}&level=${levelIdx + 1}`,
      { replace: true }
    );
  };

  const renderStars = (count: number) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= count ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const cardWidth = el.scrollWidth / count;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(count - 1, idx)));
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background max-w-[430px] mx-auto relative">
      <StarField />

      {/* Header */}
      <div className="relative z-10 flex items-center px-4 pt-4 pb-2 gap-3">
        <button
          onClick={() => {
            if (view === "levels") {
              setView("stages");
              setActiveIndex(selectedStage);
            } else {
              navigate("/battle", { replace: true });
            }
          }}
          className="h-10 w-10 rounded-full bg-orange-500/15 border border-orange-500/50 flex items-center justify-center text-orange-400 hover:bg-orange-500/25 transition-colors shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center font-display text-2xl font-bold tracking-wider text-primary glow-text">
          {view === "stages" ? "CAMPAIGN" : `STAGE ${selectedStage + 1}`}
        </h1>
        <div className="w-10 shrink-0" />
      </div>

      {/* Card area with nav arrows */}
      <div className="flex-1 flex items-center relative z-10">
        {/* Left arrow */}
        <button
          onClick={() => scrollToIndex(activeIndex - 1)}
          className={`absolute left-1 z-20 p-1 rounded-full bg-card/60 border border-border/30 transition-opacity ${activeIndex <= 0 ? "opacity-0 pointer-events-none" : "opacity-70 hover:opacity-100"}`}
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scrollToIndex(activeIndex + 1)}
          className={`absolute right-1 z-20 p-1 rounded-full bg-card/60 border border-border/30 transition-opacity ${activeIndex >= count - 1 ? "opacity-0 pointer-events-none" : "opacity-70 hover:opacity-100"}`}
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="w-full flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: "none",
            paddingLeft: view === "stages" ? "0" : "calc(50% - 140px)",
            paddingRight: view === "stages" ? "0" : "calc(50% - 140px)",
          }}
        >
          {view === "stages"
            ? STAGE_DEFS.map((stage, i) => {
                const unlocked = isStageUnlocked(i);
                let totalStars = 0;
                for (let l = 1; l <= 10; l++) {
                  const p = getProgress(i + 1, l);
                  if (p) totalStars += p.stars;
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleStageSelect(i)}
                    className="snap-center shrink-0 w-full px-4 flex justify-center transition-all duration-300"
                    disabled={!unlocked}
                  >
                    <div className="w-full max-w-[340px] rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col">
                      {/* Part A — hero image */}
                      <div className="relative w-full aspect-square">
                        <img
                          src={STAGE_IMAGES[i]}
                          alt={`Stage ${i + 1} — ${stage.name}`}
                          className={`w-full h-full object-cover ${!unlocked ? "grayscale brightness-50" : ""}`}
                        />
                        {!unlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Lock className="h-14 w-14 text-muted-foreground/80" />
                          </div>
                        )}
                      </div>
                      {/* Part B — info */}
                      <div className="w-full p-6 flex flex-col items-center gap-2">
                        <span className="font-display text-base tracking-wider text-foreground">
                          STAGE {i + 1}
                        </span>
                        <span className="font-body text-sm text-muted-foreground">
                          {stage.name}
                        </span>
                        <span className="font-body text-xs text-muted-foreground">
                          {stage.speedMultiplier}x Speed
                        </span>
                        {unlocked && (
                          <div className="flex items-center gap-1.5">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            <span className="font-display text-sm text-muted-foreground">
                              {totalStars}/50
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            : LEVEL_DEFS.map((level, i) => {
                const unlocked = isLevelUnlocked(selectedStage, i);
                const p = getProgress(selectedStage + 1, i + 1);

                return (
                  <button
                    key={i}
                    onClick={() => handleLevelSelect(i)}
                    className="snap-center shrink-0 w-[280px] rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 flex flex-col items-center gap-3 transition-all duration-300"
                    disabled={!unlocked}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden relative bg-[hsl(222,47%,6%)]">
                      <LevelPreviewCanvas
                        stage={selectedStage + 1}
                        level={i + 1}
                        levelDef={level}
                        hasBoss={level.hasBoss}
                        bossSkinColours={level.hasBoss ? flareColours : undefined}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Lock className="h-12 w-12 text-muted-foreground/60" />
                        </div>
                      )}
                    </div>
                    <span className="font-display text-sm tracking-wider text-foreground mt-1">
                      LEVEL {i + 1}
                    </span>
                    {level.hasBoss && (
                      <span className="font-display text-xs text-destructive tracking-wider">
                        + BOSS
                      </span>
                    )}
                    {unlocked && renderStars(p?.stars || 0)}
                  </button>
                );
              })}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="relative z-10 flex justify-center gap-1.5 pb-6">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default CampaignSelect;
