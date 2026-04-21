import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquareMore } from "lucide-react";

export interface EmoteData {
  id: string;
  name: string;
  image_url: string;
}

interface Props {
  emoteLoadout: EmoteData[];
  onSendEmote: (emote: EmoteData) => void;
  incomingEmote: EmoteData | null;
}

const COOLDOWN_MS = 5000;
const DISPLAY_MS = 2000;
const FADE_MS = 500;

const EmoteOverlay = ({ emoteLoadout, onSendEmote, incomingEmote }: Props) => {
  const [radialOpen, setRadialOpen] = useState(false);
  const [playerEmote, setPlayerEmote] = useState<EmoteData | null>(null);
  const [playerPhase, setPlayerPhase] = useState<"pop" | "show" | "fade">("pop");
  const [opponentEmote, setOpponentEmote] = useState<EmoteData | null>(null);
  const [opponentPhase, setOpponentPhase] = useState<"pop" | "show" | "fade">("pop");
  const [cooldownActive, setCooldownActive] = useState(false);
  const playerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPlayerTimers = () => {
    if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
  };
  const clearOpponentTimers = () => {
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
  };

  const handleSelectEmote = useCallback((emote: EmoteData) => {
    if (cooldownActive) return;
    setRadialOpen(false);
    onSendEmote(emote);

    // Show player emote
    clearPlayerTimers();
    setPlayerEmote(emote);
    setPlayerPhase("pop");
    setTimeout(() => setPlayerPhase("show"), 50);

    playerTimerRef.current = setTimeout(() => {
      setPlayerPhase("fade");
      playerTimerRef.current = setTimeout(() => setPlayerEmote(null), FADE_MS);
    }, DISPLAY_MS);

    // Start cooldown
    setCooldownActive(true);
    setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
  }, [cooldownActive, onSendEmote]);

  // Handle incoming opponent emote
  useEffect(() => {
    if (!incomingEmote) return;
    clearOpponentTimers();
    setOpponentEmote(incomingEmote);
    setOpponentPhase("pop");
    setTimeout(() => setOpponentPhase("show"), 50);

    opponentTimerRef.current = setTimeout(() => {
      setOpponentPhase("fade");
      opponentTimerRef.current = setTimeout(() => setOpponentEmote(null), FADE_MS);
    }, DISPLAY_MS);
  }, [incomingEmote]);

  // Close radial on outside click
  useEffect(() => {
    if (!radialOpen) return;
    const handleClick = () => setRadialOpen(false);
    const timer = setTimeout(() => document.addEventListener("pointerdown", handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handleClick);
    };
  }, [radialOpen]);

  const getEmoteStyle = (phase: "pop" | "show" | "fade") => {
    switch (phase) {
      case "pop":
        return { transform: "scale(0)", opacity: 1, transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s" };
      case "show":
        return { transform: "scale(1)", opacity: 1, transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s" };
      case "fade":
        return { transform: "scale(1)", opacity: 0, transition: `opacity ${FADE_MS}ms ease-out` };
    }
  };

  // Vertical menu positions — stack upward from the icon
  const verticalPositions = [
    { x: 0, y: -240 },
    { x: 0, y: -180 },
    { x: 0, y: -120 },
    { x: 0, y: -60 },
  ];

  return (
    <>
      {/* Emote trigger icon — left side, vertically centered in flight path */}
      <div
        className="absolute z-30 pointer-events-auto"
        style={{ left: 1, bottom: "7%" }}
      >
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setRadialOpen(prev => !prev);
          }}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
            cooldownActive ? "opacity-30" : "opacity-70 hover:opacity-100"
          }`}
        >
          <MessageSquareMore className="h-6 w-6 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
        </button>

        {/* Radial menu */}
        {radialOpen && (
          <div className="absolute inset-0">
             {emoteLoadout.slice(0, 4).map((emote, i) => (
              <button
                key={emote.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelectEmote(emote);
                }}
                className="absolute w-[52px] h-[52px] rounded-lg overflow-hidden border-2 border-white/60 shadow-lg bg-background/80 transition-all hover:scale-110"
                style={{
                  left: verticalPositions[i].x,
                  top: verticalPositions[i].y,
                  animation: `emote-radial-in 0.2s ease-out ${i * 0.04}s both`,
                }}
              >
                <img src={emote.image_url} alt={emote.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Player emote display — bottom-right of HP bar (left side, below center) */}
      {playerEmote && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            left: 22,
            bottom: "18%",
            ...getEmoteStyle(playerPhase),
          }}
        >
          <div className="w-[90px] h-[68px] rounded-xl overflow-hidden border-2 border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.3)] bg-white">
            <img src={playerEmote.image_url} alt={playerEmote.name} className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {/* Opponent emote display — top-left of opponent's fuel bar (right side, above center) */}
      {opponentEmote && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            right: 22,
            top: "13%",
            ...getEmoteStyle(opponentPhase),
          }}
        >
          <div className="w-[90px] h-[68px] rounded-xl overflow-hidden border-2 border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.3)] bg-white">
            <img src={opponentEmote.image_url} alt={opponentEmote.name} className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
};

export default EmoteOverlay;
