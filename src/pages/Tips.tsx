import { Link } from "react-router-dom";
import CSSStarField from "@/components/CSSStarField";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TIPS = [
  {
    title: "Manage your Heat",
    body: "Overheating freezes your ship — a death sentence in PVP. Pulse-fire heavy weapons and let them cool between bursts.",
  },
  {
    title: "Fuel is finite",
    body: "Every move costs fuel, draining at 2 units/second while flying. Conserve it for the moments evasion really matters.",
  },
  {
    title: "Pick the right loadout",
    body: "Every weapon has unique mechanics — charge times, projectile speeds, heat profiles. Try them in Practice before spending credits in PVP.",
  },
  {
    title: "Star synergy",
    body: "Stack Star orbs that complement your ship's strengths. A high-HP brawler gets more from Red HP boosts; a glass cannon may prefer DMG.",
  },
  {
    title: "Streaks pay",
    body: "Consecutive PVP wins award scaling trophies — 1st win +2, 2nd +3, and so on. Losses bite, so know when to take a break.",
  },
  {
    title: "Daily Login + Quests",
    body: "The easiest credits in the game. Don't skip a day — streaks compound, and missed quests are missed XP.",
  },
  {
    title: "Don't underestimate the underdogs",
    body: "The starter AX15 and free weapons can still win matches in skilled hands. Mastery beats price tag.",
  },
  {
    title: "Hidden content",
    body: "There are easter eggs scattered throughout the game. Try interacting with elements you don't normally tap, and look out for hint patterns. Persistence unlocks exclusive ships, skins, and avatars.",
  },
  {
    title: "Practice the Phaser timing",
    body: "The Phaser auto-fires after a 0.5s charge and locks you in place while firing. Make the lock count — line up the shot before you commit.",
  },
  {
    title: "Watch the asteroids",
    body: "Red asteroids home in on you. In PVP, you can use them to bait opponents into bad positions — let the arena fight for you.",
  },
];

const Tips = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <CSSStarField />

      <div className="relative z-10 flex flex-col px-6 py-8 max-w-md mx-auto">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground hover:text-foreground mb-4"
        >
          <Link to="/links">
            <ArrowLeft className="!w-4 !h-4" />
            Back
          </Link>
        </Button>

        <h1 className="font-display tracking-widest text-2xl text-primary glow-text mb-6 text-center">
          HINTS & TIPS
        </h1>

        <div className="flex flex-col gap-3">
          {TIPS.map((tip, i) => (
            <div
              key={i}
              className="bg-card/60 border border-primary/30 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <span className="font-display text-primary glow-text text-sm tracking-wider shrink-0 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-display tracking-wider text-sm text-primary">
                    {tip.title}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    {tip.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tips;
