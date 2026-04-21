import { ArrowLeft, Lock } from "lucide-react";
import { BotDifficulty, DIFFICULTY_META } from "@/game/botDifficulty";

interface Props {
  onSelect: (difficulty: BotDifficulty) => void;
  onBack: () => void;
  completedStages?: number; // count of fully-completed stages (0-6)
}

const difficulties: BotDifficulty[] = ["very_easy", "easy", "medium", "hard", "very_hard", "impossible"];

// Each difficulty unlocks once the matching stage is completed.
// very_easy → always; easy → after stage 1; medium → 2; hard → 3; very_hard → 4; impossible → 5.
const UNLOCK_REQUIREMENT: Record<BotDifficulty, number> = {
  very_easy: 0,
  easy: 1,
  medium: 2,
  hard: 3,
  very_hard: 4,
  impossible: 5,
};

const PracticeDifficultyModal = ({ onSelect, onBack, completedStages = 0 }: Props) => {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-[90%] max-w-[340px] space-y-5">
        <h2 className="text-center font-display text-xl tracking-widest text-foreground">
          SELECT DIFFICULTY
        </h2>

        <div className="flex flex-col gap-3">
          {difficulties.map((d) => {
            const meta = DIFFICULTY_META[d];
            const required = UNLOCK_REQUIREMENT[d];
            const unlocked = completedStages >= required;
            return (
              <button
                key={d}
                onClick={() => unlocked && onSelect(d)}
                disabled={!unlocked}
                className={`rounded-xl border ${unlocked ? `${meta.border} ${meta.bg}` : "border-border/30 bg-card/40"} p-4 flex items-center gap-4 text-left transition-all ${unlocked ? "active:scale-[0.98]" : "opacity-50 cursor-not-allowed"}`}
              >
                {!unlocked && (
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1">
                  <span className={`font-display text-sm tracking-wider ${unlocked ? meta.color : "text-muted-foreground"}`}>
                    {meta.label}
                  </span>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    {unlocked ? meta.desc : `Complete Stage ${required} to unlock`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onBack}
          className="w-full rounded-lg border border-border/30 bg-card/50 px-3 py-2.5 font-display text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-3 w-3" />
          BACK
        </button>
      </div>
    </div>
  );
};

export default PracticeDifficultyModal;
