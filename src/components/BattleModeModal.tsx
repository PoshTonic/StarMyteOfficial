import { useState } from "react";
import { Swords, Milestone, Bot, Infinity, HelpCircle } from "lucide-react";
import HowToPlayDialog from "./HowToPlayDialog";

interface Props {
  onSelectMode: (mode: "pvp" | "practice" | "campaign" | "infinity") => void;
  onClose: () => void;
}

type ModeId = "pvp" | "campaign" | "practice" | "infinity" | "howto";

interface ModeEntry {
  id: ModeId;
  label: string;
  desc: string;
  icon: typeof Swords;
  disabled: boolean;
  className: string;
  textClass: string;
}

const modes: ModeEntry[] = [
  {
    id: "pvp",
    label: "PVP",
    desc: "Fight real players",
    icon: Swords,
    disabled: false,
    className: "bg-transparent border-primary/60 hover:bg-primary/10 animate-pulse-glow",
    textClass: "text-primary",
  },
  {
    id: "campaign",
    label: "CAMPAIGN",
    desc: "Asteroid Survival",
    icon: Milestone,
    disabled: false,
    className: "border-orange-500/40 hover:border-orange-500/70 bg-orange-500/10",
    textClass: "text-orange-400",
  },
  {
    id: "practice",
    label: "PRACTICE",
    desc: "Fight AI opponent",
    icon: Bot,
    disabled: false,
    className: "border-primary/40 hover:border-primary/70 bg-primary/10",
    textClass: "text-primary",
  },
  {
    id: "infinity",
    label: "INFINITY",
    desc: "Survive the onslaught",
    icon: Infinity,
    disabled: false,
    className: "border-purple-500/40 hover:border-purple-500/70 bg-purple-500/10",
    textClass: "text-purple-400",
  },
  {
    id: "howto",
    label: "HOW TO PLAY",
    desc: "Controls & combat basics",
    icon: HelpCircle,
    disabled: false,
    className: "border-emerald-500/40 hover:border-emerald-500/70 bg-emerald-500/10",
    textClass: "text-emerald-400",
  },
];

const BattleModeModal = ({ onSelectMode, onClose }: Props) => {
  const [howToOpen, setHowToOpen] = useState(false);

  const handleClick = (id: ModeId) => {
    if (id === "howto") {
      setHowToOpen(true);
      return;
    }
    onSelectMode(id);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-[90%] max-w-[340px] space-y-5">
        <h2 className="text-center font-display text-xl tracking-widest text-foreground">
          SELECT MODE
        </h2>

        <div className="flex flex-col gap-3">
          {modes.map((m) => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => handleClick(m.id)}
              className={`rounded-xl border ${m.className} p-5 flex items-center gap-4 text-left transition-all ${
                m.disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              <m.icon className={`h-8 w-8 ${m.textClass} shrink-0`} />
              <div>
                <span className={`font-display text-sm tracking-wider ${m.textClass}`}>
                  {m.label}
                </span>
                <p className="font-body text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg border border-border/30 bg-card/50 px-3 py-2.5 font-display text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-all"
        >
          BACK TO MENU
        </button>
      </div>

      <HowToPlayDialog open={howToOpen} onOpenChange={setHowToOpen} />
    </div>
  );
};

export default BattleModeModal;
