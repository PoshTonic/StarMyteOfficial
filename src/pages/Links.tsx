import { Link } from "react-router-dom";
import CSSStarField from "@/components/CSSStarField";
import { Button } from "@/components/ui/button";
import { Play, Download, HelpCircle, Target, Instagram } from "lucide-react";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com/starmyte", icon: Instagram },
];

const CONTENT_LINKS = [
  { label: "How to Install", to: "/install", icon: Download },
  { label: "FAQ", to: "/faq", icon: HelpCircle },
  { label: "Hints & Tips", to: "/tips", icon: Target },
];

const Links = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <CSSStarField />

      <div className="relative z-10 flex flex-col items-center px-6 py-10 max-w-md mx-auto">
        <h1 className="font-display tracking-widest text-4xl text-primary glow-text text-center">
          STARMYTE
        </h1>
        <p className="font-body text-sm text-muted-foreground tracking-wider mt-1 mb-8 text-center">
          2D space arena PVP
        </p>

        <Button
          asChild
          className="w-full h-16 font-display tracking-widest text-lg bg-primary text-primary-foreground hover:bg-primary/90 glow-text mb-8 shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
        >
          <Link to="/">
            <Play className="!w-6 !h-6" />
            PLAY NOW
          </Link>
        </Button>

        <div className="w-full flex flex-col gap-3 mb-10">
          {CONTENT_LINKS.map(({ label, to, icon: Icon }) => (
            <Button
              key={to}
              asChild
              variant="outline"
              className="w-full h-14 font-display tracking-wider text-base border-primary/40 hover:bg-primary/10 justify-start"
            >
              <Link to={to}>
                <Icon className="!w-5 !h-5 text-primary" />
                {label}
              </Link>
            </Button>
          ))}
        </div>

        <div className="w-full flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-primary/20" />
          <span className="font-display text-xs tracking-widest text-muted-foreground">
            FOLLOW US
          </span>
          <div className="flex-1 h-px bg-primary/20" />
        </div>

        <div className="flex items-center justify-center gap-3 mb-10">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-12 h-12 rounded-full border border-primary/40 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
            >
              <Icon className="!w-5 !h-5" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 font-body text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Links;
