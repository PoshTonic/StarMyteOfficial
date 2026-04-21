import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Smartphone, Monitor } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function detectDefaultTab(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const isTouch = "ontouchstart" in window || (navigator as any).maxTouchPoints > 0;
  const isNarrow = window.innerWidth < 768;
  return isTouch || isNarrow ? "mobile" : "desktop";
}

const MOBILE_TIPS = [
  <>Drag your ship to move left and right, or tap where you want your ship to go on the horizontal flight path to let the ship fly to your finger.</>,
  <>Drag your ship <strong className="text-primary">upwards</strong> to <em>dive</em> below incoming projectiles.</>,
  <>Drag your ship <strong className="text-primary">downwards</strong> to <em>soar</em> above incoming projectiles.</>,
  <>Tap on a weapon in your loadout, then tap on your ship to fire it.</>,
  <>Some weapons allow you to <strong className="text-primary">hold down</strong> on your ship for continuous fire.</>,
];

const DESKTOP_TIPS = [
  <>Use the <strong className="text-primary">left/right arrow keys</strong> to move on the horizontal flight path.</>,
  <>Press the <strong className="text-primary">up arrow key</strong> to <em>dive</em> below incoming projectiles.</>,
  <>Press the <strong className="text-primary">down arrow key</strong> to <em>soar</em> above incoming projectiles.</>,
  <>Use the <strong className="text-primary">number keys (1, 2, 3, 4)</strong> to equip a weapon to your ship.</>,
  <>Use the <strong className="text-primary">Space bar</strong> to fire the equipped weapon.</>,
];

const HowToPlayDialog = ({ open, onOpenChange }: Props) => {
  const [tab, setTab] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    if (open) setTab(detectDefaultTab());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-emerald-500/40">
        <DialogHeader>
          <DialogTitle className="font-display tracking-widest text-emerald-400 text-center">
            HOW TO PLAY
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "mobile" | "desktop")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="mobile" className="font-display text-xs tracking-wider gap-2">
              <Smartphone className="h-4 w-4" /> MOBILE
            </TabsTrigger>
            <TabsTrigger value="desktop" className="font-display text-xs tracking-wider gap-2">
              <Monitor className="h-4 w-4" /> DESKTOP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mobile" className="mt-4">
            <ul className="space-y-3">
              {MOBILE_TIPS.map((tip, i) => (
                <li key={i} className="flex gap-3 font-body text-sm text-muted-foreground leading-relaxed">
                  <span className="font-display text-xs text-emerald-400 shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="desktop" className="mt-4">
            <ul className="space-y-3">
              {DESKTOP_TIPS.map((tip, i) => (
                <li key={i} className="flex gap-3 font-body text-sm text-muted-foreground leading-relaxed">
                  <span className="font-display text-xs text-emerald-400 shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default HowToPlayDialog;
