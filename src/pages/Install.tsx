import { Link } from "react-router-dom";
import CSSStarField from "@/components/CSSStarField";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useToast } from "@/hooks/use-toast";
import step1 from "@/assets/install/StarMyte-iPhone-Step-1.jpg";
import step2 from "@/assets/install/StarMyte-iPhone-Step-2.jpg";
import step3 from "@/assets/install/StarMyte-iPhone-Step-3.jpg";
import step4 from "@/assets/install/StarMyte-iPhone-Step-4.jpg";
import step5 from "@/assets/install/StarMyte-iPhone-Step-5.jpg";

const IOS_STEPS = [
  { title: "Click the Three Dots", image: step1 },
  { title: 'Tap "Share"', image: step2 },
  { title: 'Scroll down and tap "Add to Home Screen"', image: step3 },
  { title: 'Ensure "Open as Web App" is enabled. Then tap "Add."', image: step4 },
  { title: "Done! StarMyte will now appear on your home screen as a fully functional app!", image: step5 },
];

const Install = () => {
  const { canInstall, promptInstall, isStandalone } = useInstallPrompt();
  const { toast } = useToast();

  const handleAndroid = async () => {
    if (isStandalone) {
      toast({ title: "Already installed", description: "StarMyte is already running as an installed app." });
      return;
    }
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) {
        toast({ title: "Installed!", description: "StarMyte has been added to your home screen." });
      }
    } else {
      toast({
        title: "Install not available",
        description: "Open this site in Chrome on your Android device, then tap the menu → 'Install app'.",
      });
    }
  };

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
          HOW TO INSTALL
        </h1>

        {/* Android section */}
        <section className="bg-card/60 border border-primary/30 rounded-lg p-6 mb-6">
          <h2 className="font-display tracking-widest text-base text-primary mb-3">
            ANDROID
          </h2>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
            Visiting on an Android device? Tap the button below to install StarMyte directly to your home screen.
          </p>
          <Button
            onClick={handleAndroid}
            className="w-full h-14 font-display tracking-wider text-base bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Smartphone className="!w-5 !h-5" />
            INSTALL ON ANDROID
          </Button>
        </section>

        {/* iPhone section */}
        <section className="bg-card/60 border border-primary/30 rounded-lg p-6">
          <h2 className="font-display tracking-widest text-base text-primary mb-4">
            iPHONE (iOS)
          </h2>
          <div className="flex flex-col gap-5">
            {IOS_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="font-display text-primary glow-text text-sm tracking-wider shrink-0">
                    STEP {i + 1}:
                  </span>
                  <span className="font-body text-sm text-foreground leading-snug">
                    {step.title}
                  </span>
                </div>
                <img
                  src={step.image}
                  alt={`iPhone install step ${i + 1}`}
                  className="w-full rounded-lg border border-primary/20"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Install;
