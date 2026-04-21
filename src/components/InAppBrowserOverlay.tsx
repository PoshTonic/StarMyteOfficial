import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { detectInAppBrowser } from "@/lib/inAppBrowser";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Chrome, Copy, ArrowUpRight, MoreHorizontal } from "lucide-react";

// Routes where overlay is skipped entirely (safe in-app content)
const SKIP_ROUTES = new Set<string>([
  "/links",
  "/install",
  "/faq",
  "/tips",
  "/terms",
  "/privacy",
  "/unsubscribe",
]);

// Routes where overlay is non-dismissible (auth/PWA/OAuth required)
const HARD_GATE_ROUTES = new Set<string>([
  "/auth",
  "/verify-email",
  "/reset-password",
  "/",
  "/store",
  "/hangar",
  "/battle",
  "/profile",
  "/ladder",
  "/infinity-ladder",
  "/trophy-road",
  "/battle-pass",
  "/daily-login",
  "/quests",
]);

const DISMISS_KEY = "starmyte:inapp-dismissed";
const SITE_URL = "https://starmyte.com";

const InAppBrowserOverlay = () => {
  const location = useLocation();
  const { toast } = useToast();
  const info = useMemo(() => detectInAppBrowser(), []);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  // Lock body scroll when overlay is shown
  useEffect(() => {
    const path = location.pathname;
    const skip = SKIP_ROUTES.has(path);
    const showing = info.isInApp && !skip && !(dismissed && !HARD_GATE_ROUTES.has(path));
    if (!showing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [info.isInApp, dismissed, location.pathname]);

  if (!info.isInApp) return null;

  const path = location.pathname;
  if (SKIP_ROUTES.has(path)) return null;

  const isHardGate = HARD_GATE_ROUTES.has(path);
  const dismissible = !isHardGate;

  if (dismissed && dismissible) return null;

  const handleOpenChrome = () => {
    // Strip protocol for intent URL
    window.location.href =
      "intent://starmyte.com/#Intent;scheme=https;package=com.android.chrome;end";
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast({ title: "Link copied", description: "Paste it into your browser." });
    } catch {
      toast({ title: "Couldn't copy", description: "Long-press the link to copy." });
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const appLabel = info.appName ?? "this app";

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm overflow-y-auto">
      {/* iOS arrow pointing to top-right menu */}
      {info.platform === "ios" && (
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 animate-pulse pointer-events-none">
          <ArrowUpRight className="!w-8 !h-8 text-primary glow-text" />
          <span className="font-display text-xs tracking-widest text-primary">MENU</span>
        </div>
      )}

      <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto">
        <h1 className="font-display tracking-widest text-3xl text-primary glow-text text-center mb-2">
          STARMYTE
        </h1>
        <p className="font-display tracking-wider text-foreground text-center text-lg mb-6">
          Open in your browser
        </p>

        <div className="w-full bg-card/60 border border-primary/30 rounded-lg p-5 mb-6">
          <p className="font-body text-sm text-foreground/90 leading-relaxed text-center">
            Installing the app and signing in won't work inside{" "}
            <span className="text-primary font-semibold">{appLabel}</span>'s browser.
          </p>
        </div>

        {info.platform === "android" ? (
          <Button
            onClick={handleOpenChrome}
            className="w-full h-14 font-display tracking-wider text-base bg-primary text-primary-foreground hover:bg-primary/90 mb-3"
          >
            <Chrome className="!w-5 !h-5" />
            OPEN IN CHROME
          </Button>
        ) : (
          <div className="w-full bg-primary/10 border border-primary/40 rounded-lg p-4 mb-3">
            <div className="flex items-start gap-3">
              <MoreHorizontal className="!w-5 !h-5 text-primary shrink-0 mt-0.5" />
              <div className="font-body text-sm text-foreground leading-snug">
                <p className="mb-1">
                  Tap <span className="font-semibold text-primary">⋯</span> in the top-right
                  corner.
                </p>
                <p>
                  Then choose{" "}
                  <span className="font-semibold text-primary">
                    "Open in external browser"
                  </span>{" "}
                  or <span className="font-semibold text-primary">"Open in Safari"</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleCopy}
          variant="outline"
          className="w-full h-12 font-display tracking-wider border-primary/50 hover:bg-primary/10 mb-4"
        >
          <Copy className="!w-4 !h-4" />
          COPY LINK
        </Button>

        <p className="font-body text-xs text-muted-foreground text-center mb-4">
          {SITE_URL.replace("https://", "")}
        </p>

        {dismissible && (
          <button
            onClick={handleDismiss}
            className="font-body text-xs text-muted-foreground/70 underline hover:text-foreground transition-colors"
          >
            Continue anyway
          </button>
        )}
      </div>
    </div>
  );
};

export default InAppBrowserOverlay;
