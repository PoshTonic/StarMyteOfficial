import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Smartphone, Apple } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useToast } from "@/hooks/use-toast";
import step1 from "@/assets/install/StarMyte-iPhone-Step-1.jpg";
import step2 from "@/assets/install/StarMyte-iPhone-Step-2.jpg";
import step3 from "@/assets/install/StarMyte-iPhone-Step-3.jpg";
import step4 from "@/assets/install/StarMyte-iPhone-Step-4.jpg";
import step5 from "@/assets/install/StarMyte-iPhone-Step-5.jpg";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IOS_STEPS = [
  { title: "Click the Three Dots", image: step1 },
  { title: 'Tap "Share"', image: step2 },
  { title: 'Scroll down and tap "Add to Home Screen"', image: step3 },
  { title: 'Ensure "Open as Web App" is enabled. Then tap "Add."', image: step4 },
  { title: "Done! StarMyte will now appear on your home screen as a fully functional app!", image: step5 },
];

const InstallAppModal = ({ open, onOpenChange }: Props) => {
  const [view, setView] = useState<"choice" | "ios">("choice");
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
        onOpenChange(false);
      }
    } else {
      toast({
        title: "Install not available",
        description: "Open this site in Chrome on your Android device, then tap the menu → 'Install app'.",
      });
    }
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(() => setView("choice"), 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest text-primary glow-text text-center">
            {view === "choice" ? "INSTALL STARMYTE" : "iPHONE INSTALL GUIDE"}
          </DialogTitle>
        </DialogHeader>

        {view === "choice" ? (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-center text-sm text-muted-foreground font-body">
              Choose your device to install StarMyte as a web app
            </p>
            <Button
              onClick={handleAndroid}
              className="h-16 font-display tracking-wider text-base bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Smartphone className="!w-5 !h-5" />
              ANDROID
            </Button>
            <Button
              onClick={() => setView("ios")}
              variant="outline"
              className="h-16 font-display tracking-wider text-base border-primary/50 hover:bg-primary/10"
            >
              <Apple className="!w-5 !h-5" />
              iPHONE (iOS)
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("choice")}
              className="self-start text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="!w-4 !h-4" />
              Back
            </Button>
            <ScrollArea className="max-h-[60vh] pr-3">
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
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InstallAppModal;
