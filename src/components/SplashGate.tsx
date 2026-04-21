import { useCallback } from "react";
import { useMusic } from "@/contexts/MusicContext";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Auth-agnostic splash gate. Mounts the loading screen until the user
 * taps START (which unlocks audio + starts music), then renders children.
 *
 * Used by both public (guest-accessible) and protected routes so that
 * EVERY first-time visitor — including Googlebot — sees the branded
 * loading screen with crawlable legal links.
 */
const SplashGate = ({ children }: { children: React.ReactNode }) => {
  const { isPreloaded, preload, startMusic, unlock, setIntroMode } = useMusic();

  const handleLoadingComplete = useCallback(() => {
    unlock();
    setIntroMode(true);
    startMusic();
  }, [unlock, startMusic, setIntroMode]);

  if (!isPreloaded) {
    return <LoadingScreen onComplete={handleLoadingComplete} preloadFn={preload} />;
  }

  return <>{children}</>;
};

export default SplashGate;
