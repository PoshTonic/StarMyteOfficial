import { Link } from "react-router-dom";
import CSSStarField from "@/components/CSSStarField";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What is StarMyte?",
    a: "StarMyte is a 2D space-arena PVP game. Pilot a unique ship with its own stats, equip a weapon loadout, and battle other pilots 1v1 in real time.",
  },
  {
    q: "Do I need an account to play?",
    a: "No — you can try Practice mode as a guest. Sign in to save your progress, earn trophies, climb the ladder, buy items in the store, and play PVP.",
  },
  {
    q: "How do I control my ship?",
    a: "Drag your finger horizontally on touch devices, or use the Arrow keys on desktop. You can change your control style any time from your Profile.",
  },
  {
    q: "What are Heat and Fuel?",
    a: "Fuel powers your movement and drains at 2 units/second while flying. Heat builds up as you fire weapons — if it hits 100, your ship is immobilised until it purges. Don't overheat!",
  },
  {
    q: "How do I earn credits and XP?",
    a: "Win Practice or PVP battles, complete Daily and Weekly Quests, claim your Daily Login rewards, and progress through Trophy Road and the Battle Pass.",
  },
  {
    q: "What are Stars?",
    a: "Star orbs (rarities Yellow → Orange → Red → Blue → Purple) provide multiplicative stat boosts to HP, DMG, Fuel Cap, and Heat Cap. Equip them in your ship's slot row, and merge duplicates to upgrade their rarity.",
  },
  {
    q: "What is VIP?",
    a: "VIP is a monthly subscription that unlocks 50% off every store item, gold-bordered Daily Login bonuses, free Infinity Mode entries, and other exclusive perks.",
  },
  {
    q: "How does Infinity Mode work?",
    a: "Endless asteroid survival. Your SCORE equals the total HP of every asteroid you destroy. Hitting score thresholds awards XP, credits, and stars. Entry costs 200 credits — free for VIP.",
  },
  {
    q: "Can I install StarMyte as an app?",
    a: "Yes — head to How to Install for instructions. Android installs in one tap; iPhone uses Safari's Add to Home Screen flow.",
  },
  {
    q: "How do I report a bug or get help?",
    a: "Email service@poshtonic.com and we'll get back to you.",
  },
];

const Faq = () => {
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
          FAQ
        </h1>

        <div className="bg-card/60 border border-primary/30 rounded-lg px-5 py-2">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-primary/20">
                <AccordionTrigger className="font-display tracking-wider text-sm text-primary text-left hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default Faq;
