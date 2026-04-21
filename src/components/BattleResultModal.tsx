import { useNavigate } from "react-router-dom";
import { Trophy, Skull, Coins, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameState } from "@/game/types";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  gameState: GameState;
  onAction?: (action: () => void) => void;
}

const BattleResultModal = ({ gameState, onAction }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVictory = gameState.phase === "victory";
  const isGuest = !user;

  const handleReturn = () => {
    const action = () => navigate("/");
    if (onAction) {
      onAction(action);
    } else {
      action();
    }
  };

  const handleSignIn = () => {
    navigate("/auth?redirect=/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          background: "linear-gradient(to bottom, hsla(222,47%,4%,0.65), hsla(199,89%,48%,0.65))",
        }}
      />

      {/* Modal */}
      <div
        className={`absolute inset-[30px] z-10 flex flex-col items-center justify-between rounded-xl border-2 bg-card/80 backdrop-blur-md p-6 text-center ${
          isVictory
            ? "border-primary/60 shadow-[0_0_40px_hsla(199,89%,48%,0.3),inset_0_0_40px_hsla(199,89%,48%,0.05)]"
            : "border-destructive/60 shadow-[0_0_40px_hsla(0,72%,51%,0.3),inset_0_0_40px_hsla(0,72%,51%,0.05)]"
        }`}
      >
        {/* Top spacer */}
        <div />

        {/* Center content */}
        <div className="flex flex-col items-center gap-6">
          {/* Icon with glow */}
          <div className="relative">
            <div
              className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
                isVictory ? "bg-primary/30" : "bg-destructive/30"
              }`}
            />
            {isVictory ? (
              <Trophy className="relative h-20 w-20 text-game-success drop-shadow-[0_0_20px_hsla(142,71%,45%,0.5)]" />
            ) : (
              <Skull className="relative h-20 w-20 text-game-hp drop-shadow-[0_0_20px_hsla(0,72%,51%,0.5)]" />
            )}
          </div>

          <h2 className="font-display text-4xl tracking-[0.2em] glow-text">
            {isVictory ? "VICTORY" : "DEFEAT"}
          </h2>

          <div className="space-y-3 font-body text-base text-muted-foreground">
            <p>Time: <span className="text-foreground font-display">{Math.floor(gameState.timer)}s</span></p>
            {isGuest ? (
              <p className="font-body text-sm text-muted-foreground max-w-[260px]">
                Sign in to save your progress, earn XP & credits, and unlock new ships.
              </p>
            ) : (
              <>
                <p>XP Earned: <span className="text-primary font-display">{gameState.xpEarned}</span></p>
                {gameState.creditsEarned > 0 && (
                  <p className="flex items-center justify-center gap-2">
                    <Coins className="h-5 w-5 text-yellow-400" />
                    <span className="text-yellow-400 font-display text-lg">+{gameState.creditsEarned} Credits</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="w-full flex flex-col gap-2">
          {isGuest && (
            <Button
              onClick={handleSignIn}
              className="w-full font-display tracking-[0.15em] text-base py-6 gap-2"
              size="lg"
            >
              <LogIn className="h-5 w-5" />
              SIGN IN TO SAVE
            </Button>
          )}
          <Button
            onClick={handleReturn}
            variant={isGuest ? "outline" : "default"}
            className="w-full font-display tracking-[0.15em] text-base py-6"
            size="lg"
          >
            RETURN TO MENU
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BattleResultModal;
