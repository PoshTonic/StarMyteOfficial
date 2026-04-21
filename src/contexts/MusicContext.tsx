import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { musicManager } from "@/game/musicManager";
import { audioManager } from "@/game/audioManager";

interface MusicContextType {
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  preload: () => Promise<void>;
  startMusic: () => void;
  startBattle: () => void;
  stopBattle: () => void;
  switchBattle: () => void;
  hardResetToMenu: () => void;
  isPreloaded: boolean;
  unlock: () => void;
  introMode: boolean;
  setIntroMode: (m: boolean) => void;
}

const MusicContext = createContext<MusicContextType>({
  volume: 0.5,
  setVolume: () => {},
  muted: false,
  setMuted: () => {},
  preload: async () => {},
  startMusic: () => {},
  startBattle: () => {},
  stopBattle: () => {},
  switchBattle: () => {},
  hardResetToMenu: () => {},
  isPreloaded: false,
  unlock: () => {},
  introMode: false,
  setIntroMode: () => {},
});

export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const [volume, setVolumeState] = useState(musicManager.volume);
  const [muted, setMutedState] = useState(musicManager.muted);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [introMode, setIntroMode] = useState(false);

  const setVolume = useCallback((v: number) => {
    musicManager.setVolume(v);
    setVolumeState(v);
  }, []);

  const setMuted = useCallback((m: boolean) => {
    musicManager.setMuted(m);
    setMutedState(m);
  }, []);

  const preload = useCallback(async () => {
    await Promise.all([
      musicManager.preload(),
      audioManager.preloadSfx("/sfx/asteroid-explosion.mp3"),
      audioManager.preloadSfx("/sfx/victory-chime.mp3"),
    ]);
  }, []);

  const startMusic = useCallback(() => {
    setIsPreloaded(true);
    musicManager.playMain();
  }, []);

  const startBattle = useCallback(() => {
    musicManager.startBattle();
  }, []);

  const stopBattle = useCallback(() => {
    musicManager.stopBattle();
  }, []);

  const switchBattle = useCallback(() => {
    musicManager.switchBattle();
  }, []);

  const hardResetToMenu = useCallback(() => {
    musicManager.hardResetToMenu();
  }, []);

  const unlock = useCallback(() => {
    musicManager.unlock();
  }, []);

  return (
    <MusicContext.Provider value={{ volume, setVolume, muted, setMuted, preload, startMusic, startBattle, stopBattle, switchBattle, hardResetToMenu, isPreloaded, unlock, introMode, setIntroMode }}>
      {children}
    </MusicContext.Provider>
  );
};
