import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, DiamondPlus, Menu, X, Volume2 } from "lucide-react";
import { weaponImages } from "@/game/weaponImages";
import GameImage from "@/components/GameImage";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { fetchUserStars, getCompositeMultipliers } from "@/game/starUtils";
import BattleModeModal from "@/components/BattleModeModal";
import PracticeDifficultyModal from "@/components/PracticeDifficultyModal";
import PvpBattle from "@/pages/PvpBattle";
import CampaignSelect from "@/pages/CampaignSelect";
import CampaignBattle from "@/pages/CampaignBattle";
import InfinityBattle from "@/pages/InfinityBattle";
import { BotDifficulty, BOT_DIFFICULTY_PRESETS, getImpossibleWeapons } from "@/game/botDifficulty";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BattleCanvas from "@/components/BattleCanvas";
import BattleHUD from "@/components/BattleHUD";
import BattleResultModal from "@/components/BattleResultModal";
import LevelUpScreen from "@/components/LevelUpScreen";
// StarField removed - provided by GameLayout
import { useIsMobile } from "@/hooks/use-mobile";
import {
  GameState,
  InputState,
  WeaponSlot,
  FireMode,
} from "@/game/types";
import { updateGameState, tryFireWeapon } from "@/game/gameLoop";
// checkLevelUp moved server-side
import { createBotState, updateBotAI } from "@/game/botAI";
import {
  ARENA_WIDTH,
  SHIP_WIDTH,
  ARENA_HEIGHT,
  SHIP_Y_PLAYER,
  SHIP_Y_OPPONENT,
  COUNTDOWN_DURATION,
  HEAT_PURGE_DURATION,
  PERK_SPAWN_MIN,
  PERK_SPAWN_MAX,
  FUEL_TRIGGER_Z,
  // rollLevelUpStar moved server-side
  StarRarity,
} from "@/game/constants";
// insertStar moved server-side
import { audioManager } from "@/game/audioManager";
import { useMusic } from "@/contexts/MusicContext";
import MusicControls from "@/components/MusicControls";
// upsertShipStats moved server-side


function createInitialInput(): InputState {
  return {
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    currentX: 0,
    currentY: 0,
    shipTapped: false,
    canvasTapped: false,
    tapX: 0,
    tapY: 0,
    swipeUpHeld: false,
    swipeDownHeld: false,
    holdingFire: false,
  };
}

function createInitialGameState(
  shipData: any,
  weaponData: WeaponSlot[],
  playerShipName: string,
  opponentShipName: string,
  opponentWeapons?: WeaponSlot[]
): GameState {
  return {
    phase: "countdown",
    timer: 0,
    countdownValue: 3,
    player: {
      x: ARENA_WIDTH / 2,
      y: SHIP_Y_PLAYER,
      targetX: ARENA_WIDTH / 2,
      hp: shipData.hp,
      maxHp: shipData.hp,
      fuel: shipData.fuel,
      maxFuel: shipData.fuel,
      heat: 0,
      maxHeat: shipData.heat_cap,
      speed: shipData.speed,
      zLevel: "normal",
      isHeatPurging: false,
      heatPurgeTimer: 0,
      shieldActive: false,
      ricochetActive: false,
      isoSphereActive: false,
      regenXActive: false,
      shieldRecoil: 0,
      shieldHeatFactor: 0, // legacy — constants used instead
      width: 40,
      height: 50,
      flameOpacity: 0,
    },
    opponent: {
      x: ARENA_WIDTH / 2,
      y: SHIP_Y_OPPONENT,
      targetX: ARENA_WIDTH / 2,
      hp: shipData.hp,
      maxHp: shipData.hp,
      fuel: shipData.fuel,
      maxFuel: shipData.fuel,
      heat: 0,
      maxHeat: shipData.heat_cap,
      speed: shipData.speed,
      zLevel: "normal",
      isHeatPurging: false,
      heatPurgeTimer: 0,
      shieldActive: false,
      ricochetActive: false,
      isoSphereActive: false,
      regenXActive: false,
      shieldRecoil: 0,
      shieldHeatFactor: 0,
      width: 40,
      height: 50,
      flameOpacity: 0,
    },
    playerWeapons: weaponData,
    opponentWeapons: (opponentWeapons || weaponData).map((w) => ({ ...w, currentCooldown: 0, lastFired: 0 })),
    selectedWeapon: -1,
    projectiles: [],
    perks: [],
    missileTarget: { x: 0, y: 0, active: false },
    nextPerkSpawn: PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN),
    arenaWidth: ARENA_WIDTH,
    arenaHeight: ARENA_HEIGHT,
    xpEarned: 0,
    creditsEarned: 0,
    playerShipName,
    opponentShipName,
    activeBeams: [],
    flyingPerkIcons: [],
    mineExplosions: [],
    shockwaves: [],
  };
}

type ControlMode = 'default' | 'pro' | 'pro_loose';

const BattleRouter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const { user } = useAuth();
  const [showInfinityConfirm, setShowInfinityConfirm] = useState(false);
  const [playerCredits, setPlayerCredits] = useState<number | null>(null);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [completedStages, setCompletedStages] = useState(0);

  if (!mode) {
    return (
      <>
        {showDifficultyModal ? (
          <PracticeDifficultyModal
            completedStages={completedStages}
            onSelect={(difficulty) => {
              setShowDifficultyModal(false);
              navigate(`/battle?mode=practice&difficulty=${difficulty}`, { replace: true });
            }}
            onBack={() => setShowDifficultyModal(false)}
          />
        ) : (
          <BattleModeModal
            onSelectMode={(m) => {
              if (m === "infinity") {
                if (!user) {
                  navigate("/auth?redirect=/battle");
                  return;
                }
                supabase.from("profiles").select("credits").eq("id", user.id).single().then(({ data }) => {
                  setPlayerCredits(data?.credits ?? 0);
                  setShowInfinityConfirm(true);
                });
              } else if (m === "pvp") {
                if (!user) {
                  navigate("/auth?redirect=/battle");
                  return;
                }
                navigate(`/battle?mode=${m}`, { replace: true });
              } else if (m === "campaign") {
                if (!user) {
                  navigate("/auth?redirect=/battle");
                  return;
                }
                navigate(`/battle?mode=${m}`, { replace: true });
              } else if (m === "practice") {
                if (user) {
                  // Compute number of fully-completed stages (all 10 levels per stage)
                  supabase
                    .from("campaign_progress")
                    .select("stage, level, completed")
                    .eq("user_id", user.id)
                    .eq("completed", true)
                    .then(({ data }) => {
                      let count = 0;
                      for (let s = 1; s <= 6; s++) {
                        const stageLevels = (data || []).filter((r: any) => r.stage === s).length;
                        if (stageLevels >= 10) count++;
                      }
                      setCompletedStages(count);
                      setShowDifficultyModal(true);
                    });
                } else {
                  setShowDifficultyModal(true);
                }
              } else {
                navigate(`/battle?mode=${m}`, { replace: true });
              }
            }}
            onClose={() => navigate("/")}
          />
        )}
        {showInfinityConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md">
            <div className="w-[90%] max-w-[340px] rounded-xl border border-purple-500/40 bg-card p-6 space-y-4 text-center">
              <h3 className="font-display text-lg tracking-wider text-purple-400">INFINITY MODE</h3>
              <p className="font-body text-sm text-muted-foreground">
                Entry costs <span className="text-yellow-400 font-display">200 Credits</span>. High risk, high reward.
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Your balance: <span className="text-yellow-400 font-display">{playerCredits ?? 0}</span>
              </p>
              {(playerCredits ?? 0) < 200 && (
                <p className="font-display text-xs text-destructive">INSUFFICIENT CREDITS</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInfinityConfirm(false)}
                  className="flex-1 rounded-lg border border-border/30 bg-card/50 px-3 py-2.5 font-display text-xs tracking-wider text-muted-foreground hover:text-foreground transition-all"
                >
                  CANCEL
                </button>
                <button
                  disabled={(playerCredits ?? 0) < 200}
                  onClick={async () => {
                    if (!user) return;
                    await supabase.from("profiles").update({ credits: (playerCredits ?? 0) - 200 }).eq("id", user.id);
                    setShowInfinityConfirm(false);
                    navigate("/battle?mode=infinity", { replace: true });
                  }}
                  className="flex-1 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2.5 font-display text-xs tracking-wider text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ENTER
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (mode === "pvp") return <PvpBattle />;

  if (mode === "campaign") {
    const stageParam = searchParams.get("stage");
    const levelParam = searchParams.get("level");
    if (stageParam && levelParam) {
      return <CampaignBattle key={`${stageParam}-${levelParam}`} stage={parseInt(stageParam)} level={parseInt(levelParam)} />;
    }
    return <CampaignSelect />;
  }

  if (mode === "infinity") return <InfinityBattle />;

  return <PracticeBattle />;
};

const PracticeBattle = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { startBattle: startBattleMusic, stopBattle: stopBattleMusic } = useMusic();
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSelectTarget, setShowSelectTarget] = useState(false);
  const [triggerSide, setTriggerSide] = useState<'left' | 'right'>('left');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [controlMode, setControlMode] = useState<ControlMode>('default');
  const [playerAvatarImg, setPlayerAvatarImg] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; oldXp: number; newLevel: number; newXp: number; bonusStar: StarRarity } | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>(createInitialInput());

  // Get difficulty from URL params and create bot state with config
  const difficultyParam = (searchParams.get("difficulty") || "medium") as BotDifficulty;
  const difficultyConfig = BOT_DIFFICULTY_PRESETS[difficultyParam] || BOT_DIFFICULTY_PRESETS.medium;
  const botStateRef = useRef(createBotState(difficultyConfig));
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const countdownRef = useRef<number>(0);
  const xpSavedRef = useRef(false);
  const playerShipIdRef = useRef<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlModeRef = useRef<ControlMode>('default');

  // Trigger button state
  const triggerHeldRef = useRef(false);
  const triggerFiredRef = useRef(false);

  // Keyboard state
  const keysRef = useRef<Set<string>>(new Set());

  // Audio state tracking refs
  const prevShieldActiveRef = useRef(false);
  const prevRicochetActiveRef = useRef(false);
  const prevPlayerHpRef = useRef<number | null>(null);
  const prevOpponentHpRef = useRef<number | null>(null);
  const prevShieldRecoilRef = useRef(0);
  const prevFlameRef = useRef(false);
  const prevProjectileCountRef = useRef(0);
  const prevBeamChargingRef = useRef(false);
  const prevBeamActiveRef = useRef(false);
  const prevMineExplosionCountRef = useRef(0);

  // Start battle music + cleanup audio on unmount
  useEffect(() => {
    startBattleMusic();
    return () => {
      audioManager.dispose();
      stopBattleMusic();
    };
  }, []);

  // Load player data (or guest defaults)
  useEffect(() => {
    const load = async () => {
      let shipData: any;
      let weapons: WeaponSlot[] = [];
      let skinColours: Record<string, string> | undefined;
      let skinId: string | undefined;
      let jetSkinColours: Record<string, string> | undefined;
      let jetSkinId: string | undefined;
      let multipliers = { hp: 1, fuel: 1, heat: 1, dmg: 1 };

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("control_mode, active_avatar_id")
          .eq("id", user.id)
          .single();

        if (profileData?.control_mode) {
          const mode = profileData.control_mode as ControlMode;
          setControlMode(mode);
          controlModeRef.current = mode;
        }

        // Load player avatar
        if ((profileData as any)?.active_avatar_id) {
          const { data: av } = await supabase.from("avatars").select("image_path, image_url").eq("id", (profileData as any).active_avatar_id).single();
          if (av) setPlayerAvatarImg(getAvatarImageUrl(av as any) || null);
        }

        const { data: playerShip } = await supabase
          .from("player_ships")
          .select("*, ships(*)")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (!playerShip) return;
        playerShipIdRef.current = playerShip.id;

        const [{ data: playerWeapons }, userStars] = await Promise.all([
          supabase.from("player_weapons").select("*, weapons(*)").eq("player_ship_id", playerShip.id).order("slot"),
          fetchUserStars(user.id),
        ]);

        multipliers = getCompositeMultipliers(userStars, playerShip.id);

        weapons = (playerWeapons || []).map((pw: any) => ({
          id: pw.weapons.id,
          name: pw.weapons.name,
          type: pw.weapons.type,
          dmg: Math.round(pw.weapons.dmg * multipliers.dmg),
          heat: pw.weapons.heat,
          cooldown: pw.weapons.cooldown,
          fireRate: pw.weapons.fire_rate,
          fireMode: pw.weapons.fire_mode as FireMode,
          spd: pw.weapons.spd ?? 100,
          slot: pw.slot,
          currentCooldown: 0,
          lastFired: 0,
        }));

        shipData = playerShip.ships;

        // Load active skin colours
        if (playerShip.active_skin_id) {
          const { data: skin } = await supabase
            .from("skins")
            .select("id, colours")
            .eq("id", playerShip.active_skin_id)
            .single();
          if (skin) {
            skinColours = skin.colours as Record<string, string>;
            skinId = skin.id;
          }
        }

        if ((playerShip as any).active_jet_skin_id) {
          const { data: jetSkin } = await supabase
            .from("skins")
            .select("id, colours")
            .eq("id", (playerShip as any).active_jet_skin_id)
            .single();
          if (jetSkin) {
            jetSkinColours = jetSkin.colours as Record<string, string>;
            jetSkinId = jetSkin.id;
          }
        }
      } else {
        // ── Guest mode: hardcoded AX15 + starter weapons (public catalog reads) ──
        const { data: shipRow } = await supabase
          .from("ships")
          .select("*")
          .eq("name", "AX15")
          .single();
        if (!shipRow) return;
        shipData = shipRow;

        const starterNames = ["Cannon", "Machine Gun", "Missile", "Shield"];
        const { data: weaponRows } = await supabase
          .from("weapons")
          .select("*")
          .in("name", starterNames);

        // Order weapons to match starterNames order
        const ordered = starterNames
          .map((n) => (weaponRows || []).find((w: any) => w.name === n))
          .filter(Boolean);

        weapons = ordered.map((w: any, idx: number) => ({
          id: w.id,
          name: w.name,
          type: w.type,
          dmg: w.dmg,
          heat: w.heat,
          cooldown: w.cooldown,
          fireRate: w.fire_rate,
          fireMode: w.fire_mode as FireMode,
          spd: w.spd ?? 100,
          slot: idx + 1,
          currentCooldown: 0,
          lastFired: 0,
        }));
      }

      const boostedShip = {
        ...shipData,
        hp: Math.round(shipData.hp * multipliers.hp),
        fuel: Math.round(shipData.fuel * multipliers.fuel),
        heat_cap: Math.round(shipData.heat_cap * multipliers.heat),
      };
      const shipName = shipData?.name || "AX15";

      // --- Load bot weapons from DB based on difficulty ---
      const botWeaponNames = difficultyParam === "impossible"
        ? getImpossibleWeapons()
        : difficultyConfig.weaponNames;

      const { data: botWeaponRows } = await supabase
        .from("weapons")
        .select("*")
        .in("name", botWeaponNames);

      const botWeapons: WeaponSlot[] = (botWeaponRows || []).map((w: any, idx: number) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        dmg: w.dmg,
        heat: w.heat,
        cooldown: w.cooldown,
        fireRate: w.fire_rate,
        fireMode: w.fire_mode as FireMode,
        spd: w.spd ?? 100,
        slot: idx,
        currentCooldown: 0,
        lastFired: 0,
      }));

      const initial = createInitialGameState(boostedShip, weapons, shipName, "AX15", botWeapons);
      if (skinColours) {
        initial.playerSkinColours = skinColours;
        initial.playerSkinId = skinId;
      }
      if (jetSkinColours) {
        initial.playerJetSkinColours = jetSkinColours;
        initial.playerJetSkinId = jetSkinId;
      }
      gameStateRef.current = initial;
      prevPlayerHpRef.current = initial.player.hp;
      prevOpponentHpRef.current = initial.opponent.hp;
      setGameState(initial);
      setLoading(false);
    };
    load();
  }, [user]);

  // Sync controlMode state to ref
  useEffect(() => {
    controlModeRef.current = controlMode;
  }, [controlMode]);

  // Keyboard controls (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      keysRef.current.add(key);

      // Weapon selection: 1-4
      if (key >= "1" && key <= "4") {
        const index = parseInt(key) - 1;
        handleSelectWeapon(index);
      }

      // Space: fire trigger
      if (key === " ") {
        e.preventDefault();
        triggerHeldRef.current = true;
        handleTriggerDown();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      if (e.key === " ") {
        handleTriggerUp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (!gameState) return;

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      let gs = gameStateRef.current;
      if (!gs) {
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Countdown phase
      if (gs.phase === "countdown") {
        countdownRef.current += dt / 1000;
        const val = COUNTDOWN_DURATION - Math.floor(countdownRef.current);
        gs = { ...gs, countdownValue: val };
        if (countdownRef.current >= COUNTDOWN_DURATION + 0.5) {
          gs = { ...gs, phase: "playing", countdownValue: 0 };
        }
        gameStateRef.current = gs;
        setGameState({ ...gs });
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      if (gs.phase !== "playing" && gs.phase !== "ending") {
        audioManager.stopShieldHum();
        audioManager.stopAfterburner();
        audioManager.stopPhaserBeam();
        gameStateRef.current = gs;
        setGameState({ ...gs });
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      // During ending phase, continue with gameplay simulation below

      const dtSec = dt / 1000;
      const input = inputRef.current;

      // Skip all player movement/evasion input when overheated
      if (!gs.player.isHeatPurging) {
        // Ship movement from canvas drag (skip if beam is active and locking movement)
        const beamLocking = gs.activeBeams.some(b => b.owner === "player" && b.active && !b.reflected);
        if (input.dragging && !beamLocking && gs.player.fuel > 0) {
          gs = { ...gs, player: { ...gs.player, targetX: input.currentX } };
        }

        // Keyboard arrow movement
        const keys = keysRef.current;
        if ((keys.has("ArrowLeft") || keys.has("ArrowRight")) && !beamLocking && gs.player.fuel > 0) {
          const moveAmount = gs.player.speed * 3 * dtSec;
          let newX = gs.player.targetX;
          if (keys.has("ArrowLeft")) newX -= moveAmount;
          if (keys.has("ArrowRight")) newX += moveAmount;
          newX = Math.max(SHIP_WIDTH / 2 - 5, Math.min(ARENA_WIDTH - SHIP_WIDTH / 2 + 5, newX));
          gs = { ...gs, player: { ...gs.player, targetX: newX } };
        }

        // Keyboard arrow evasion (Up = dive, Down = soar)
        if (keys.has("ArrowUp") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (keys.has("ArrowDown") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        }

        // Z-level from swipe
        if (input.swipeUpHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (input.swipeDownHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (!input.swipeUpHeld && !input.swipeDownHeld && !keys.has("ArrowUp") && !keys.has("ArrowDown") && gs.player.zLevel !== "normal") {
          gs = { ...gs, player: { ...gs.player, zLevel: "normal" } };
        }
      }

      // Shield / Ricochet / IsoSphere / RegenX hold-to-activate via trigger (no heat per second)
      const selectedW = gs.playerWeapons[gs.selectedWeapon];
      if (selectedW?.name === "Shield") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, shieldActive: true, ricochetActive: false, isoSphereActive: false, regenXActive: false } };
        } else {
          if (gs.player.shieldActive) {
            gs = { ...gs, player: { ...gs.player, shieldActive: false } };
          }
        }
      } else if (selectedW?.name === "Ricochet") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, ricochetActive: true, shieldActive: false, isoSphereActive: false, regenXActive: false } };
        } else {
          if (gs.player.ricochetActive) {
            gs = { ...gs, player: { ...gs.player, ricochetActive: false } };
          }
        }
      } else if (selectedW?.name === "IsoSphere") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, isoSphereActive: true, shieldActive: false, ricochetActive: false, regenXActive: false } };
        } else {
          if (gs.player.isoSphereActive) {
            gs = { ...gs, player: { ...gs.player, isoSphereActive: false } };
          }
        }
      } else if (selectedW?.name === "RegenX") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, regenXActive: true, shieldActive: false, ricochetActive: false, isoSphereActive: false } };
        } else {
          if (gs.player.regenXActive) {
            gs = { ...gs, player: { ...gs.player, regenXActive: false } };
          }
        }
      } else {
        if (gs.player.shieldActive) {
          gs = { ...gs, player: { ...gs.player, shieldActive: false } };
        }
        if (gs.player.ricochetActive) {
          gs = { ...gs, player: { ...gs.player, ricochetActive: false } };
        }
        if (gs.player.isoSphereActive) {
          gs = { ...gs, player: { ...gs.player, isoSphereActive: false } };
        }
        if (gs.player.regenXActive) {
          gs = { ...gs, player: { ...gs.player, regenXActive: false } };
        }
      }

      // Auto-fire for hold weapons (machine gun, blaster) via trigger
      if (selectedW && selectedW.name !== "Shield" && selectedW.name !== "Ricochet" && selectedW.name !== "IsoSphere" && selectedW.name !== "RegenX" && selectedW.name !== "Phaser" && triggerHeldRef.current) {
        if (selectedW.fireMode === "hold" && gs.player.zLevel === "normal") {
          const prevProjectiles = gs.projectiles.length;
          gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
          if (gs.projectiles.length > prevProjectiles) {
            if (selectedW.name === "Blaster") {
              audioManager.playBlaster();
            } else {
              audioManager.playMachineGun();
            }
          }
        }
      }

      // Bot AI
      const { newState, newBotState } = updateBotAI(gs, botStateRef.current, dt);
      gs = newState;
      botStateRef.current = newBotState;

      // Game loop update
      gs = updateGameState(gs, dt);

      // ─── Audio triggers ───────────────────────────────────
      // Shield hum (for both Shield and Ricochet)
      const anyShieldActive = gs.player.shieldActive || gs.player.ricochetActive || gs.player.isoSphereActive || gs.player.regenXActive;
      const prevAnyShield = prevShieldActiveRef.current || prevRicochetActiveRef.current;
      if (anyShieldActive && !prevAnyShield) {
        audioManager.playShieldHum();
      } else if (!anyShieldActive && prevAnyShield) {
        audioManager.stopShieldHum();
      }
      prevShieldActiveRef.current = gs.player.shieldActive;
      prevRicochetActiveRef.current = gs.player.ricochetActive;

      if (gs.player.shieldRecoil > prevShieldRecoilRef.current) {
        audioManager.playRicochet();
      }
      prevShieldRecoilRef.current = gs.player.shieldRecoil;

      if (prevPlayerHpRef.current !== null && gs.player.hp < prevPlayerHpRef.current) {
        audioManager.playHitMarker();
      }
      if (prevOpponentHpRef.current !== null && gs.opponent.hp < prevOpponentHpRef.current) {
        audioManager.playHitMarker();
      }
      prevPlayerHpRef.current = gs.player.hp;
      prevOpponentHpRef.current = gs.opponent.hp;

      const currentMissileCount = gs.projectiles.filter(p => p.type === "Missile").length;
      const prevCount = prevProjectileCountRef.current;
      if (gs.projectiles.length < prevCount) {
        const removedCount = prevCount - gs.projectiles.length;
        if (removedCount > 0 && currentMissileCount < prevCount) {
          audioManager.playExplosion();
        }
      }
      prevProjectileCountRef.current = gs.projectiles.length;

      const isFlaming = gs.player.flameOpacity > 0.3;
      if (isFlaming && !prevFlameRef.current) {
        audioManager.playAfterburner();
      } else if (!isFlaming && prevFlameRef.current) {
        audioManager.stopAfterburner();
      }
      prevFlameRef.current = isFlaming;

      // Phaser beam audio
      const beamCharging = gs.activeBeams.some(b => b.charging && b.owner === "player");
      if (beamCharging && !prevBeamChargingRef.current) {
        audioManager.playPhaserCharge();
      }
      prevBeamChargingRef.current = !!beamCharging;

      const beamActive = gs.activeBeams.some(b => b.active && b.owner === "player" && !b.reflected);
      if (beamActive && !prevBeamActiveRef.current) {
        audioManager.playPhaserBeam();
      } else if (!beamActive && prevBeamActiveRef.current) {
        audioManager.stopPhaserBeam();
      }
      prevBeamActiveRef.current = !!beamActive;

      // Mine explosion audio
      const mineExpCount = (gs.mineExplosions || []).length;
      if (mineExpCount > prevMineExplosionCountRef.current) {
        audioManager.playMineExplosion();
      }
      prevMineExplosionCountRef.current = mineExpCount;

      gameStateRef.current = gs;
      setGameState({ ...gs });
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [!!gameState]);

  // Save XP, credits, and battle result on game end (server-side)
  useEffect(() => {
    if (!gameState) return;
    if (!user) return; // guests: no DB persistence, BattleResultModal shows sign-in CTA
    if ((gameState.phase === "victory" || gameState.phase === "defeat") && !xpSavedRef.current) {
      xpSavedRef.current = true;

      const saveRewards = async () => {
        const { data: response } = await supabase.functions.invoke("save-battle-result", {
          body: {
            battleType: "practice",
            result: gameState.phase === "victory" ? "victory" : "defeat",
            battleDuration: Math.round(gameState.timer),
            shipUsed: gameState.playerShipName,
            playerShipId: playerShipIdRef.current || undefined,
          },
        });

        if (response?.levelUp) {
          setLevelUpInfo(response.levelUp);
        }
      };
      saveRewards();

      // Update quest progress
      supabase.functions.invoke("update-quest-progress", {
        body: {
          asteroids: 0,
          distance: Math.round(gameState.timer),
          damage: 0,
          credits: gameState.creditsEarned,
          xp: gameState.xpEarned,
        },
      });
    }
  }, [gameState?.phase, user]);

  // Fire weapon logic (shared by trigger button & canvas-based controls)
  const fireWeapon = useCallback(() => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    if (gs.player.zLevel !== "normal") return;

    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;

    // Shield and Ricochet are handled continuously in game loop
    if (selectedW.name === "Shield" || selectedW.name === "Ricochet" || selectedW.name === "IsoSphere" || selectedW.name === "RegenX") return;

    // Missile: needs a target first
    if (selectedW.name === "Missile") {
      if (gs.missileTarget.active) {
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", gs.missileTarget.x, gs.missileTarget.y);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs;
        setShowSelectTarget(false);
        audioManager.playMissileLaunch();
      } else {
        setShowSelectTarget(true);
        setTimeout(() => setShowSelectTarget(false), 2000);
      }
      return;
    }

    // Mine: needs a target (same as Missile)
    if (selectedW.name === "Mine") {
      if (gs.missileTarget.active) {
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", gs.missileTarget.x, gs.missileTarget.y);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs;
        setShowSelectTarget(false);
        audioManager.playMissileLaunch();
      } else {
        setShowSelectTarget(true);
        setTimeout(() => setShowSelectTarget(false), 2000);
      }
      return;
    }

    // Phaser: hold to charge — fire happens on trigger release
    if (selectedW.name === "Phaser") {
      if (triggerFiredRef.current) return;
      triggerFiredRef.current = true;
      gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
      gameStateRef.current = gs;
      return;
    }

    // RadixR4 — shockwave weapon
    if (selectedW.name === "RadixR4") {
      if (triggerFiredRef.current) return;
      triggerFiredRef.current = true;
      const prevSw = (gs.shockwaves || []).length;
      gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
      if ((gs.shockwaves || []).length > prevSw) { audioManager.playRadixFire(); audioManager.playRadixShockwave(); }
      gameStateRef.current = gs; return;
    }

    // Tap-fire weapons (Cannon, Trident) — guard against hold-to-repeat
    if (selectedW.fireMode === "tap") {
      if (triggerFiredRef.current) return;
      triggerFiredRef.current = true;
      const prevLen = gs.projectiles.length;
      gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
      if (gs.projectiles.length > prevLen) {
        if (selectedW.name === "Trident") {
          audioManager.playTridentZap();
          setTimeout(() => audioManager.playTridentZap(), 150);
          setTimeout(() => audioManager.playTridentZap(), 300);
        } else {
          audioManager.playCannon();
        }
      }
      gameStateRef.current = gs;
    }
  }, []);

  // Trigger button handlers
  const handleTriggerDown = useCallback(() => {
    fireWeapon();
  }, [fireWeapon]);

  const handleTriggerUp = useCallback(() => {
    triggerHeldRef.current = false;
    triggerFiredRef.current = false;
  }, []);

  // Canvas tap → set missile target OR fire in pro/pro_loose modes
  const handleCanvasTap = useCallback((x: number, y: number) => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;

    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;

    // Missile/Mine target setting (all modes)
    if (selectedW.name === "Missile" || selectedW.name === "Mine") {
      if (gs.missileTarget.active) {
        // Target already set — fire if tapping near ship or lower half
        const dx = Math.abs(x - gs.player.x);
        const dy = Math.abs(y - SHIP_Y_PLAYER);
        if (dx < 40 && dy < 50) {
          fireWeapon();
        }
        return;
      }
      gs = { ...gs, missileTarget: { x, y, active: true } };
      gameStateRef.current = gs;
      setShowSelectTarget(false);
      audioManager.playMissileBeep();
      return;
    }

    const mode = controlModeRef.current;

    // Pro mode: fire when tapping near the ship
    if (mode === 'pro') {
      const shipX = gs.player.x;
      const shipY = gs.player.y;
      const dx = Math.abs(x - shipX);
      const dy = Math.abs(y - shipY);
      if (dx < 40 && dy < 50) {
        triggerHeldRef.current = true;
        fireWeapon();
        // For hold weapons, keep held until pointer up
        if (selectedW.fireMode === 'tap') {
          triggerHeldRef.current = false;
          triggerFiredRef.current = false;
        }
      }
    }

    // Pro Loose: fire on any tap in the lower half of canvas
    if (mode === 'pro_loose') {
      if (y > ARENA_HEIGHT / 2) {
        triggerHeldRef.current = true;
        fireWeapon();
        if (selectedW.fireMode === 'tap') {
          triggerHeldRef.current = false;
          triggerFiredRef.current = false;
        }
      }
    }
  }, [fireWeapon]);

  // Canvas pointer up handler for pro/pro_loose modes
  const handleCanvasPointerUp = useCallback(() => {
    const mode = controlModeRef.current;
    if (mode === 'pro' || mode === 'pro_loose') {
      triggerHeldRef.current = false;
      triggerFiredRef.current = false;
    }
  }, []);

  const handleSelectWeapon = useCallback((index: number) => {
    const gs = gameStateRef.current;
    if (!gs) return;
    if (index >= gs.playerWeapons.length) return;
    gameStateRef.current = {
      ...gs,
      selectedWeapon: index,
      missileTarget: { x: 0, y: 0, active: false },
      player: { ...gs.player, shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false },
    };
    setGameState({ ...gameStateRef.current });
    setShowSelectTarget(false);
  }, []);

  const handleControlModeChange = useCallback(async (mode: ControlMode) => {
    setControlMode(mode);
    controlModeRef.current = mode;
    if (user) {
      await supabase.from("profiles").update({ control_mode: mode } as any).eq("id", user.id);
    }
  }, [user]);

  if (loading || !gameState) {
    return (
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <p className="relative z-10 font-display text-primary animate-pulse">LOADING...</p>
      </div>
    );
  }

  const isFinished = gameState.phase === "victory" || gameState.phase === "defeat";
  const heatPercent = gameState.player.isHeatPurging
    ? (gameState.player.heatPurgeTimer / HEAT_PURGE_DURATION) * 100
    : Math.max(0, (gameState.player.heat / gameState.player.maxHeat) * 100);

  const heatColor = heatPercent >= 90
    ? 'hsl(0, 72%, 51%)'
    : heatPercent >= 50
      ? 'hsl(30, 90%, 50%)'
      : 'hsl(142, 71%, 45%)';

  const showTriggerButton = controlMode === 'default';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background max-w-[430px] mx-auto">
      {/* Header — 7vh */}
      <div className="shrink-0 overflow-visible flex items-center justify-between px-3" style={{ height: "7vh", paddingTop: "5px" }}>
        {/* Left: Player */}
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-full bg-primary/30 flex items-center justify-center border border-primary/40 overflow-hidden">
            {playerAvatarImg ? (
              <img src={playerAvatarImg} alt="You" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-[9px] text-primary">P</span>
            )}
          </div>
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">YOU</span>
        </div>
        {/* Center: Timer */}
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] text-muted-foreground">{Math.floor(gameState.timer)}s</span>
        </div>
        {/* Right: Opponent + Menu */}
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">OPP</span>
          <div className="h-7 w-7 rounded-full bg-destructive/30 flex items-center justify-center border border-destructive/40">
            <span className="font-display text-[9px] text-destructive">B</span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-primary hover:text-primary/80 transition-colors ml-1"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas area — aspect-ratio locked */}
      <div className="relative shrink-0 overflow-visible w-full" style={{ aspectRatio: '510/750', maxHeight: '78vh' }}>
        <BattleCanvas
          gameState={gameState}
          inputRef={inputRef}
          onCanvasTap={handleCanvasTap}
          onPointerUp={handleCanvasPointerUp}
          controlMode={controlMode}
          canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        />
        <BattleHUD
          gameState={gameState}
          missileTargetActive={gameState.missileTarget.active}
          showSelectTarget={showSelectTarget}
          canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        />

        {/* Fire trigger button — only in default mode */}
        {showTriggerButton && (
          <button
            className={`absolute bottom-[8%] ${triggerSide === 'left' ? 'left-3' : 'right-3'} z-20 touch-none select-none`}
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHeldRef.current = true;
              handleTriggerDown();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTriggerUp();
            }}
            onPointerLeave={() => {
              handleTriggerUp();
            }}
          >
            <DiamondPlus
              className="h-10 w-10 text-primary drop-shadow-[0_0_8px_hsl(199,89%,48%)]"
              strokeWidth={1.5}
            />
          </button>
        )}

        {/* Result modal moved to end of component */}
      </div>

      {/* Heat Cap — 3vh */}
      <div className="flex items-center px-4 gap-2 shrink-0" style={{ height: '3vh' }}>
        <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full ${gameState.player.isHeatPurging ? 'animate-pulse' : ''}`}
            style={{
              width: `${heatPercent}%`,
              backgroundColor: heatColor,
              transition: 'none',
            }}
          />
        </div>
        <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: heatColor }} />
        {gameState.player.isHeatPurging && (
          <span className="font-display text-[8px] text-destructive animate-pulse">PURGE</span>
        )}
      </div>

      {/* Armoury — fills remaining space */}
      <div className="grid grid-cols-4 gap-1 px-2 pb-1 flex-1 min-h-0 items-center">
        {gameState.playerWeapons.map((w, i) => {
          const isSelected = gameState.selectedWeapon === i;
          const onCooldown = w.currentCooldown > 0;
          const isDisabled = gameState.player.zLevel !== "normal";
          const img = weaponImages[w.name];

          return (
            <button
              key={w.slot}
              onClick={() => handleSelectWeapon(i)}
              className={`relative rounded-lg border overflow-hidden flex items-center justify-center transition-all ${
                isSelected
                  ? "border-primary shadow-[0_0_8px_hsl(199_89%_48%/0.3)]"
                  : "border-border/30"
              } ${onCooldown || isDisabled ? "opacity-40" : ""}`}
              style={{ height: '100%' }}
            >
              {img && <GameImage src={img} alt={w.name} className="w-full h-full object-cover" />}
              {onCooldown && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                  <span className="font-display text-[9px] text-muted-foreground">
                    {w.currentCooldown.toFixed(1)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings Menu Overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="w-[90%] max-w-[360px] rounded-xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm tracking-wider text-foreground">SETTINGS</span>
              <button onClick={() => setSettingsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SFX Volume */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">SFX VOLUME</span>
              </div>
              <Slider
                value={[volume * 100]}
                max={100}
                step={1}
                onValueChange={(val) => {
                  const v = val[0] / 100;
                  setVolume(v);
                  audioManager.setVolume(v);
                }}
              />
            </div>

            {/* Music */}
            <MusicControls />

            {/* Trigger Placement — only relevant in default mode */}
            {controlMode === 'default' && (
              <div className="space-y-2">
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">TRIGGER PLACEMENT</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTriggerSide('left')}
                    className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                      triggerSide === 'left'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/30 bg-card/50 text-muted-foreground'
                    }`}
                  >
                    LEFT
                  </button>
                  <button
                    onClick={() => setTriggerSide('right')}
                    className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                      triggerSide === 'right'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/30 bg-card/50 text-muted-foreground'
                    }`}
                  >
                    RIGHT
                  </button>
                </div>
              </div>
            )}

            {/* Control Mode */}
            <div className="space-y-2">
              <span className="font-display text-[10px] tracking-wider text-muted-foreground">CONTROL MODE</span>
              <div className="flex flex-col gap-2">
                {([
                  { value: 'default' as ControlMode, label: 'DEFAULT', desc: 'Tap trigger button to fire' },
                  { value: 'pro' as ControlMode, label: 'PRO', desc: 'Tap ship to fire' },
                  { value: 'pro_loose' as ControlMode, label: 'PRO LOOSE', desc: 'Tap lower half to fire & move' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleControlModeChange(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      controlMode === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border/30 bg-card/50'
                    }`}
                  >
                    <span className={`font-display text-[10px] tracking-wider ${controlMode === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>
                      {opt.label}
                    </span>
                    <p className="font-body text-[9px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Resign */}
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 font-display text-[10px] tracking-wider text-destructive hover:bg-destructive/20 transition-all"
            >
              RESIGN
            </button>
          </div>
        </div>
      )}
      {isFinished && (
        <BattleResultModal
          gameState={gameState}
          onAction={(action) => {
            if (levelUpInfo && !showLevelUp) {
              pendingActionRef.current = action;
              setShowLevelUp(true);
            } else {
              action();
            }
          }}
        />
      )}
      {showLevelUp && levelUpInfo && (
        <LevelUpScreen
          oldLevel={levelUpInfo.oldLevel}
          oldXp={levelUpInfo.oldXp}
          newLevel={levelUpInfo.newLevel}
          newXp={levelUpInfo.newXp}
          bonusStar={levelUpInfo.bonusStar}
          onContinue={() => {
            setShowLevelUp(false);
            if (pendingActionRef.current) {
              pendingActionRef.current();
              pendingActionRef.current = null;
            }
          }}
        />
      )}
    </div>
  );
};

export default BattleRouter;
