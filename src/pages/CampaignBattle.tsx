import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Flame, DiamondPlus, Menu, X, Volume2, Star, Coins } from "lucide-react";
import { weaponImages } from "@/game/weaponImages";
import GameImage from "@/components/GameImage";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BattleCanvas from "@/components/BattleCanvas";
import BattleHUD from "@/components/BattleHUD";
import StarField from "@/components/StarField";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  GameState,
  InputState,
  WeaponSlot,
  FireMode,
  CampaignState,
} from "@/game/types";
import { updateGameState, tryFireWeapon, enterEndingPhase } from "@/game/gameLoop";
import { createBotState, updateBotAI } from "@/game/botAI";
import { BOT_DIFFICULTY_PRESETS, BotDifficulty, getImpossibleWeapons } from "@/game/botDifficulty";
import { updateCampaignAsteroids, calculateStars } from "@/game/campaignLoop";
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
  CAMPAIGN_REWARDS,
  STAR_CONFIG,
  // rollStarDrop, rollLevelUpStar moved server-side
  StarRarity,
  FUEL_TRIGGER_Z,
} from "@/game/constants";
import { STAGE_DEFS, LEVEL_DEFS, buildSpawnQueue, getTotalAsteroids } from "@/game/campaignData";
import { audioManager } from "@/game/audioManager";
import { useMusic } from "@/contexts/MusicContext";
import MusicControls from "@/components/MusicControls";
import { fetchUserStars, getCompositeMultipliers } from "@/game/starUtils";
import StarOrb from "@/components/StarOrb";
// upsertShipStats moved server-side
import LevelUpScreen from "@/components/LevelUpScreen";


function createInitialInput(): InputState {
  return {
    dragging: false, dragStartX: 0, dragStartY: 0, currentX: 0, currentY: 0,
    shipTapped: false, canvasTapped: false, tapX: 0, tapY: 0,
    swipeUpHeld: false, swipeDownHeld: false, holdingFire: false,
  };
}

type ControlMode = "default" | "pro" | "pro_loose";

interface Props {
  stage: number; // 1-indexed
  level: number; // 1-indexed
}

const CampaignBattle = ({ stage, level }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { startBattle: startBattleMusic, stopBattle: stopBattleMusic } = useMusic();
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSelectTarget, setShowSelectTarget] = useState(false);
  const [triggerSide, setTriggerSide] = useState<"left" | "right">("left");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [controlMode, setControlMode] = useState<ControlMode>("default");
  const [playerAvatarImg, setPlayerAvatarImg] = useState<string | null>(null);
  const [resultStars, setResultStars] = useState(0);
  const [droppedStar, setDroppedStar] = useState<StarRarity | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; oldXp: number; newLevel: number; newXp: number; bonusStar: StarRarity } | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>(createInitialInput());
  const botStateRef = useRef(createBotState());
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const countdownRef = useRef<number>(0);
  const savedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlModeRef = useRef<ControlMode>("default");
  const triggerHeldRef = useRef(false);
  const triggerFiredRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const playerShipIdRef = useRef<string>("");

  // Audio refs
  const prevShieldActiveRef = useRef(false);
  const prevRicochetActiveRef = useRef(false);
  const prevPlayerHpRef = useRef<number | null>(null);
  const prevShieldRecoilRef = useRef(0);
  const prevFlameRef = useRef(false);
  const prevProjectileCountRef = useRef(0);
  const prevBeamChargingRef = useRef(false);
  const prevBeamActiveRef = useRef(false);
  const prevMineExplosionCountRef = useRef(0);

  const stageDef = STAGE_DEFS[stage - 1];
  const levelDef = LEVEL_DEFS[level - 1];

  useEffect(() => {
    startBattleMusic();
    return () => { audioManager.dispose(); stopBattleMusic(); };
  }, []);

  // Load player data
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    savedRef.current = false;
    setAlreadyClaimed(false);
    setResultStars(0);
    setDroppedStar(null);
    setLevelUpInfo(null);
    countdownRef.current = 0;
    lastTimeRef.current = 0;

    const load = async () => {
      // Validate stage/level is unlocked before allowing play
      if (stage > 1 || level > 1) {
        const { data: progressData } = await supabase
          .from("campaign_progress")
          .select("stage, level, completed")
          .eq("user_id", user.id);

        const getP = (s: number, l: number) => progressData?.find(p => p.stage === s && p.level === l);

        // Check stage is unlocked (all 10 levels of previous stage completed)
        if (stage > 1) {
          for (let l = 1; l <= 10; l++) {
            if (!getP(stage - 1, l)?.completed) {
              navigate("/campaign", { replace: true });
              return;
            }
          }
        }

        // Check level is unlocked (previous level in same stage completed)
        if (level > 1 && !getP(stage, level - 1)?.completed) {
          navigate("/campaign", { replace: true });
          return;
        }
      }
      const { data: profileData } = await supabase.from("profiles").select("control_mode, active_avatar_id").eq("id", user.id).single();
      if (profileData?.control_mode) {
        const mode = profileData.control_mode as ControlMode;
        setControlMode(mode);
        controlModeRef.current = mode;
      }
      if ((profileData as any)?.active_avatar_id) {
        const { data: av } = await supabase.from("avatars").select("image_path, image_url").eq("id", (profileData as any).active_avatar_id).single();
        if (av) setPlayerAvatarImg(getAvatarImageUrl(av as any) || null);
      }

      const { data: playerShip } = await supabase
        .from("player_ships").select("*, ships(*)").eq("user_id", user.id).eq("is_active", true).single();
      if (!playerShip) return;
      playerShipIdRef.current = playerShip.id;

      const [{ data: playerWeapons }, userStars] = await Promise.all([
        supabase.from("player_weapons").select("*, weapons(*)").eq("player_ship_id", playerShip.id).order("slot"),
        fetchUserStars(user.id),
      ]);

      // Check if this level was already completed
      const { data: existingProgress } = await supabase
        .from("campaign_progress")
        .select("completed")
        .eq("user_id", user.id)
        .eq("stage", stage)
        .eq("level", level)
        .maybeSingle();
      if (existingProgress?.completed) setAlreadyClaimed(true);

      const multipliers = getCompositeMultipliers(userStars, playerShip.id);

      const weapons: WeaponSlot[] = (playerWeapons || []).map((pw: any) => ({
        id: pw.weapons.id, name: pw.weapons.name, type: pw.weapons.type,
        dmg: Math.round(pw.weapons.dmg * multipliers.dmg), heat: pw.weapons.heat, cooldown: pw.weapons.cooldown,
        fireRate: pw.weapons.fire_rate, fireMode: pw.weapons.fire_mode as FireMode,
        spd: pw.weapons.spd ?? 100, slot: pw.slot, currentCooldown: 0, lastFired: 0,
      }));

      const s = playerShip.ships;
      const boostedHp = Math.round(s.hp * multipliers.hp);
      const boostedFuel = Math.round(s.fuel * multipliers.fuel);
      const boostedHeat = Math.round(s.heat_cap * multipliers.heat);
      const shipName = s.name || "AX15";
      const spawnQueue = buildSpawnQueue(levelDef, stage);
      const totalAsteroids = getTotalAsteroids(levelDef);

      // Load active skin colours
      let skinColours: Record<string, string> | undefined;
      let skinId: string | undefined;
      if ((playerShip as any).active_skin_id) {
        const { data: skinData } = await supabase
          .from("skins")
          .select("id, colours")
          .eq("id", (playerShip as any).active_skin_id)
          .single();
        if (skinData) {
          skinColours = skinData.colours as Record<string, string>;
          skinId = skinData.id;
        }
      }

      // Load active jet skin colours
      let jetSkinColours: Record<string, string> | undefined;
      let jetSkinId: string | undefined;
      if ((playerShip as any).active_jet_skin_id) {
        const { data: jetSkinData } = await supabase
          .from("skins")
          .select("id, colours")
          .eq("id", (playerShip as any).active_jet_skin_id)
          .single();
        if (jetSkinData) {
          jetSkinColours = jetSkinData.colours as Record<string, string>;
          jetSkinId = jetSkinData.id;
        }
      }

      const campaignState: CampaignState = {
        stage, level, asteroids: [], asteroidsDestroyed: 0,
        totalAsteroids, damageTaken: 0, spawnQueue, nextSpawnTime: 4,
        speedMultiplier: stageDef.speedMultiplier, bossPhase: levelDef.hasBoss ? "asteroids" : undefined,
      };

      // Boss difficulty per stage — drives skill, HP, and DMG via shared presets
      const STAGE_BOSS_DIFFICULTY: BotDifficulty[] = [
        "very_easy", "easy", "medium", "hard", "very_hard", "impossible",
      ];
      const bossDifficulty = STAGE_BOSS_DIFFICULTY[Math.min(stage - 1, 5)];
      const bossDifficultyPreset = BOT_DIFFICULTY_PRESETS[bossDifficulty];
      const bossWeaponNames = bossDifficulty === "impossible"
        ? getImpossibleWeapons()
        : bossDifficultyPreset.weaponNames;

      // Load boss weapons from DB
      let opponentWeapons: WeaponSlot[] = weapons.map((w) => ({ ...w, currentCooldown: 0, lastFired: 0 }));
      let bossHp = s.hp;
      let bossSkinColours: Record<string, string> | undefined;
      if (levelDef.hasBoss) {
        const { data: bossWeaponData } = await supabase
          .from("weapons")
          .select("*")
          .in("name", bossWeaponNames);
        if (bossWeaponData && bossWeaponData.length > 0) {
          opponentWeapons = bossWeaponData.map((w: any, idx: number) => ({
            id: w.id, name: w.name, type: w.type,
            dmg: Math.round(w.dmg * bossDifficultyPreset.statMultipliers.dmg),
            heat: w.heat, cooldown: w.cooldown,
            fireRate: w.fire_rate, fireMode: w.fire_mode as FireMode,
            spd: w.spd ?? 100, slot: idx, currentCooldown: 0, lastFired: 0,
          }));
        }
        bossHp = Math.round(s.hp * bossDifficultyPreset.statMultipliers.hp);
        botStateRef.current = createBotState(bossDifficultyPreset);

        // Boss always wears the Flare skin
        const { data: flareSkin } = await supabase
          .from("skins")
          .select("colours")
          .eq("name", "Flare")
          .maybeSingle();
        if (flareSkin?.colours) {
          bossSkinColours = flareSkin.colours as Record<string, string>;
        }
      }

      const initial: GameState = {
        phase: "countdown", timer: 0, countdownValue: 3,
        player: {
          x: ARENA_WIDTH / 2, y: SHIP_Y_PLAYER, targetX: ARENA_WIDTH / 2,
          hp: boostedHp, maxHp: boostedHp,
          fuel: boostedFuel, maxFuel: boostedFuel,
          heat: 0, maxHeat: boostedHeat, speed: s.speed,
          zLevel: "normal", isHeatPurging: false, heatPurgeTimer: 0,
          shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false, shieldRecoil: 0, shieldHeatFactor: 0,
          width: 40, height: 50, flameOpacity: 0,
        },
        opponent: {
          x: ARENA_WIDTH / 2, y: SHIP_Y_OPPONENT, targetX: ARENA_WIDTH / 2,
          hp: bossHp, maxHp: bossHp,
          fuel: 100, maxFuel: 100, heat: 0, maxHeat: 100, speed: 50,
          zLevel: "normal", isHeatPurging: false, heatPurgeTimer: 0,
          shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false, shieldRecoil: 0, shieldHeatFactor: 0,
          width: 40, height: 50, flameOpacity: 0,
        },
        playerWeapons: weapons,
        opponentWeapons,
        selectedWeapon: -1, projectiles: [], perks: [],
        activeBeams: [],
        flyingPerkIcons: [],
        mineExplosions: [],
        missileTarget: { x: 0, y: 0, active: false },
        nextPerkSpawn: PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN),
        arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT,
        xpEarned: 0, creditsEarned: 0,
        playerShipName: shipName, opponentShipName: "AX15",
        playerSkinColours: skinColours,
        playerSkinId: skinId,
        playerJetSkinColours: jetSkinColours,
        playerJetSkinId: jetSkinId,
        opponentSkinColours: bossSkinColours,
        opponentJetSkinColours: bossSkinColours,
        campaignState,
        shockwaves: [],
      };

      gameStateRef.current = initial;
      prevPlayerHpRef.current = initial.player.hp;
      setGameState(initial);
      setLoading(false);
    };
    load();
  }, [user, stage, level]);

  useEffect(() => { controlModeRef.current = controlMode; }, [controlMode]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key >= "1" && e.key <= "4") handleSelectWeapon(parseInt(e.key) - 1);
      if (e.key === " ") { e.preventDefault(); triggerHeldRef.current = true; handleTriggerDown(); }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      if (e.key === " ") { triggerHeldRef.current = false; triggerFiredRef.current = false; handleTriggerUp(); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Game loop
  useEffect(() => {
    if (!gameState) return;
    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;
      let gs = gameStateRef.current;
      if (!gs) { frameRef.current = requestAnimationFrame(loop); return; }

      if (gs.phase === "countdown") {
        countdownRef.current += dt / 1000;
        const val = COUNTDOWN_DURATION - Math.floor(countdownRef.current);
        gs = { ...gs, countdownValue: val };
        if (countdownRef.current >= COUNTDOWN_DURATION + 0.5) gs = { ...gs, phase: "playing", countdownValue: 0 };
        gameStateRef.current = gs; setGameState({ ...gs });
        frameRef.current = requestAnimationFrame(loop); return;
      }
      if (gs.phase !== "playing" && gs.phase !== "ending") {
        audioManager.stopShieldHum(); audioManager.stopAfterburner(); audioManager.stopPhaserBeam();
        gameStateRef.current = gs; setGameState({ ...gs });
        frameRef.current = requestAnimationFrame(loop); return;
      }
      // During ending phase, continue with gameplay simulation below

      const dtSec = dt / 1000;
      const input = inputRef.current;

      // Movement
      if (!gs.player.isHeatPurging) {
        const beamLocking = gs.activeBeams.some(b => b.owner === "player" && b.active && !b.reflected);
        if (input.dragging && !beamLocking) gs = { ...gs, player: { ...gs.player, targetX: input.currentX } };
        const keys = keysRef.current;
        if ((keys.has("ArrowLeft") || keys.has("ArrowRight")) && !beamLocking) {
          const moveAmount = gs.player.speed * 3 * dtSec;
          let newX = gs.player.targetX;
          if (keys.has("ArrowLeft")) newX -= moveAmount;
          if (keys.has("ArrowRight")) newX += moveAmount;
          newX = Math.max(SHIP_WIDTH / 2 - 5, Math.min(ARENA_WIDTH - SHIP_WIDTH / 2 + 5, newX));
          gs = { ...gs, player: { ...gs.player, targetX: newX } };
        }
        if (keys.has("ArrowUp") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        else if (keys.has("ArrowDown") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        if (input.swipeUpHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        else if (input.swipeDownHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        else if (!input.swipeUpHeld && !input.swipeDownHeld && !keys.has("ArrowUp") && !keys.has("ArrowDown") && gs.player.zLevel !== "normal")
          gs = { ...gs, player: { ...gs.player, zLevel: "normal" } };
      }

      // Shield/Ricochet/IsoSphere/RegenX (no heat per second)
      const selectedW = gs.playerWeapons[gs.selectedWeapon];
      if (selectedW?.name === "Shield") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, shieldActive: true, ricochetActive: false, isoSphereActive: false, regenXActive: false } };
        } else if (gs.player.shieldActive) gs = { ...gs, player: { ...gs.player, shieldActive: false } };
      } else if (selectedW?.name === "Ricochet") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, ricochetActive: true, shieldActive: false, isoSphereActive: false, regenXActive: false } };
        } else if (gs.player.ricochetActive) gs = { ...gs, player: { ...gs.player, ricochetActive: false } };
      } else if (selectedW?.name === "IsoSphere") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, isoSphereActive: true, shieldActive: false, ricochetActive: false, regenXActive: false } };
        } else if (gs.player.isoSphereActive) gs = { ...gs, player: { ...gs.player, isoSphereActive: false } };
      } else if (selectedW?.name === "RegenX") {
        if (triggerHeldRef.current && gs.player.zLevel === "normal" && !gs.player.isHeatPurging) {
          gs = { ...gs, player: { ...gs.player, regenXActive: true, shieldActive: false, ricochetActive: false, isoSphereActive: false } };
        } else if (gs.player.regenXActive) gs = { ...gs, player: { ...gs.player, regenXActive: false } };
      } else {
        if (gs.player.shieldActive) gs = { ...gs, player: { ...gs.player, shieldActive: false } };
        if (gs.player.ricochetActive) gs = { ...gs, player: { ...gs.player, ricochetActive: false } };
        if (gs.player.isoSphereActive) gs = { ...gs, player: { ...gs.player, isoSphereActive: false } };
        if (gs.player.regenXActive) gs = { ...gs, player: { ...gs.player, regenXActive: false } };
      }

      // Auto-fire hold weapons
      if (selectedW && selectedW.name !== "Shield" && selectedW.name !== "Ricochet" && selectedW.name !== "IsoSphere" && selectedW.name !== "RegenX" && selectedW.name !== "Phaser" && triggerHeldRef.current) {
        if (selectedW.fireMode === "hold" && gs.player.zLevel === "normal") {
          const prevProj = gs.projectiles.length;
          gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
          if (gs.projectiles.length > prevProj) {
            if (selectedW.name === "Blaster") audioManager.playBlaster();
            else audioManager.playMachineGun();
          }
        }
      }

      // Bot AI only for boss phase
      const cs = gs.campaignState;
      if (cs?.bossPhase === "opponent") {
        const { newState, newBotState } = updateBotAI(gs, botStateRef.current, dt);
        gs = newState;
        botStateRef.current = newBotState;
      }

      // Update game state (ship physics, projectiles, perks) — skip bot victory/defeat check
      gs = updateGameState(gs, dt);

      // Campaign asteroid update
      gs = updateCampaignAsteroids(gs, dtSec);

      // Campaign win/loss checks
      if (gs.campaignState) {
        const c = gs.campaignState;
        const allSpawned = c.spawnQueue.length === 0;
        const allDestroyed = c.asteroidsDestroyed >= c.totalAsteroids;
        const noAsteroidsLeft = c.asteroids.length === 0;

        if (allSpawned && noAsteroidsLeft) {
          if (c.bossPhase === "asteroids" && allDestroyed) {
            // Transition to boss phase — clear battlefield and reset boss HP
            gs = {
              ...gs,
              projectiles: [],
              activeBeams: [],
              mineExplosions: [],
              shockwaves: [],
              opponent: { ...gs.opponent, hp: gs.opponent.maxHp, heat: 0 },
              campaignState: { ...c, bossPhase: "opponent" },
            };
          } else if (c.bossPhase === "opponent") {
            if (gs.opponent.hp <= 0 && gs.phase === "playing") {
              const stars = calculateStars(c.asteroidsDestroyed, c.totalAsteroids, c.damageTaken);
              setResultStars(stars);
              const rewards = CAMPAIGN_REWARDS[stars] || CAMPAIGN_REWARDS[1];
              const xp = alreadyClaimed ? Math.floor(rewards.xp / 2) : rewards.xp;
              const cr = alreadyClaimed ? 0 : rewards.credits;
              gs = enterEndingPhase({ ...gs, xpEarned: xp, creditsEarned: cr }, "victory", true);
            }
          } else if (!c.bossPhase && gs.phase === "playing") {
            const stars = calculateStars(c.asteroidsDestroyed, c.totalAsteroids, c.damageTaken);
            setResultStars(stars);
            const rewards = CAMPAIGN_REWARDS[stars] || CAMPAIGN_REWARDS[1];
            const xp = alreadyClaimed ? Math.floor(rewards.xp / 2) : rewards.xp;
            const cr = alreadyClaimed ? 0 : rewards.credits;
            gs = enterEndingPhase({ ...gs, xpEarned: xp, creditsEarned: cr }, "victory", false);
          }
        }

        if (gs.player.hp <= 0 && gs.phase === "playing") {
          const stars = calculateStars(c.asteroidsDestroyed, c.totalAsteroids, c.damageTaken);
          setResultStars(stars);
          gs = enterEndingPhase({ ...gs, xpEarned: 0, creditsEarned: 0 }, "defeat", !!c.bossPhase);
        }
      }

      // Audio triggers
      const anyShield = gs.player.shieldActive || gs.player.ricochetActive || gs.player.isoSphereActive || gs.player.regenXActive;
      const prevAny = prevShieldActiveRef.current || prevRicochetActiveRef.current;
      if (anyShield && !prevAny) audioManager.playShieldHum();
      else if (!anyShield && prevAny) audioManager.stopShieldHum();
      prevShieldActiveRef.current = gs.player.shieldActive;
      prevRicochetActiveRef.current = gs.player.ricochetActive;
      if (gs.player.shieldRecoil > prevShieldRecoilRef.current) audioManager.playRicochet();
      prevShieldRecoilRef.current = gs.player.shieldRecoil;
      if (prevPlayerHpRef.current !== null && gs.player.hp < prevPlayerHpRef.current) audioManager.playHitMarker();
      prevPlayerHpRef.current = gs.player.hp;
      const isFlaming = gs.player.flameOpacity > 0.3;
      if (isFlaming && !prevFlameRef.current) audioManager.playAfterburner();
      else if (!isFlaming && prevFlameRef.current) audioManager.stopAfterburner();
      prevFlameRef.current = isFlaming;
      const beamCharging = gs.activeBeams.some(b => b.charging && b.owner === "player");
      if (beamCharging && !prevBeamChargingRef.current) audioManager.playPhaserCharge();
      prevBeamChargingRef.current = !!beamCharging;
      const beamActive = gs.activeBeams.some(b => b.active && b.owner === "player" && !b.reflected);
      if (beamActive && !prevBeamActiveRef.current) audioManager.playPhaserBeam();
      else if (!beamActive && prevBeamActiveRef.current) audioManager.stopPhaserBeam();
      prevBeamActiveRef.current = !!beamActive;

      // Mine explosion audio
      const mineExpCount = (gs.mineExplosions || []).length;
      if (mineExpCount > prevMineExplosionCountRef.current) audioManager.playMineExplosion();
      prevMineExplosionCountRef.current = mineExpCount;

      gameStateRef.current = gs;
      setGameState({ ...gs });
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [!!gameState]);

  // Save progress on end (server-side)
  useEffect(() => {
    if (!gameState || !user) return;
    if ((gameState.phase === "victory" || gameState.phase === "defeat") && !savedRef.current) {
      savedRef.current = true;
      const stars = resultStars;

      const saveRewards = async () => {
        const { data: response } = await supabase.functions.invoke("save-battle-result", {
          body: {
            battleType: "campaign",
            result: gameState.phase === "victory" ? "victory" : "defeat",
            battleDuration: Math.round(gameState.timer),
            shipUsed: gameState.playerShipName,
            playerShipId: playerShipIdRef.current || undefined,
            stage,
            level,
            stars,
            alreadyClaimed,
            asteroidsDestroyed: gameState.campaignState?.asteroidsDestroyed || 0,
            isBossLevel: level === 10,
          },
        });

        if (response?.levelUp) {
          setLevelUpInfo(response.levelUp);
        }
        if (response?.droppedStar) {
          setDroppedStar(response.droppedStar);
        }
      };
      saveRewards();

      // Update quest progress
      supabase.functions.invoke("update-quest-progress", {
        body: {
          asteroids: gameState.campaignState?.asteroidsDestroyed || 0,
          distance: Math.round(gameState.timer),
          damage: 0,
          credits: gameState.creditsEarned,
          xp: gameState.xpEarned,
        },
      });
    }
  }, [gameState?.phase, user, resultStars]);

  const fireWeapon = useCallback(() => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    if (gs.player.zLevel !== "normal") return;
    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;
    if (selectedW.name === "Shield" || selectedW.name === "Ricochet" || selectedW.name === "IsoSphere" || selectedW.name === "RegenX") return;
    if (selectedW.name === "Missile") {
      if (gs.missileTarget.active) {
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", gs.missileTarget.x, gs.missileTarget.y);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs; setShowSelectTarget(false); audioManager.playMissileLaunch();
      } else { setShowSelectTarget(true); setTimeout(() => setShowSelectTarget(false), 2000); }
      return;
    }
    if (selectedW.name === "Mine") {
      if (gs.missileTarget.active) {
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", gs.missileTarget.x, gs.missileTarget.y);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs; setShowSelectTarget(false); audioManager.playMissileLaunch();
      } else { setShowSelectTarget(true); setTimeout(() => setShowSelectTarget(false), 2000); }
      return;
    }
    if (selectedW.name === "Phaser") {
      if (triggerFiredRef.current) return;
      triggerFiredRef.current = true;
      gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
      gameStateRef.current = gs; return;
    }
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

  const handleTriggerDown = useCallback(() => { fireWeapon(); }, [fireWeapon]);
  const handleTriggerUp = useCallback(() => { triggerHeldRef.current = false; triggerFiredRef.current = false; }, []);

  const handleCanvasTap = useCallback((x: number, y: number) => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;
    if (selectedW.name === "Missile" || selectedW.name === "Mine") {
      // If target is already set, check if tapping near player ship to fire
      if (gs.missileTarget.active) {
        const dx = Math.abs(x - gs.player.x), dy = Math.abs(y - SHIP_Y_PLAYER);
        if (dx < 40 && dy < 50) {
          // Tap on ship = fire
          triggerHeldRef.current = true; fireWeapon();
          triggerHeldRef.current = false; triggerFiredRef.current = false;
          return;
        }
      }
      // Set or update target
      gs = { ...gs, missileTarget: { x, y, active: true } };
      gameStateRef.current = gs; setShowSelectTarget(false); audioManager.playMissileBeep(); return;
    }
    const mode = controlModeRef.current;
    if (mode === "pro") {
      const dx = Math.abs(x - gs.player.x), dy = Math.abs(y - gs.player.y);
      if (dx < 40 && dy < 50) {
        triggerHeldRef.current = true; fireWeapon();
        if (selectedW.fireMode === "tap") { triggerHeldRef.current = false; triggerFiredRef.current = false; }
      }
    }
    if (mode === "pro_loose" && y > ARENA_HEIGHT / 2) {
      triggerHeldRef.current = true; fireWeapon();
      if (selectedW.fireMode === "tap") { triggerHeldRef.current = false; triggerFiredRef.current = false; }
    }
  }, [fireWeapon]);

  const handleCanvasPointerUp = useCallback(() => {
    const mode = controlModeRef.current;
    if (mode === "pro" || mode === "pro_loose") { triggerHeldRef.current = false; triggerFiredRef.current = false; }
  }, []);

  const handleSelectWeapon = useCallback((index: number) => {
    const gs = gameStateRef.current;
    if (!gs || index >= gs.playerWeapons.length) return;
    gameStateRef.current = {
      ...gs, selectedWeapon: index, missileTarget: { x: 0, y: 0, active: false },
      player: { ...gs.player, shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false },
    };
    setGameState({ ...gameStateRef.current }); setShowSelectTarget(false);
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
        <StarField />
        <p className="relative z-10 font-display text-primary animate-pulse">LOADING...</p>
      </div>
    );
  }

  const isFinished = gameState.phase === "victory" || gameState.phase === "defeat";
  const heatPercent = gameState.player.isHeatPurging
    ? (gameState.player.heatPurgeTimer / HEAT_PURGE_DURATION) * 100
    : Math.max(0, (gameState.player.heat / gameState.player.maxHeat) * 100);
  const heatColor = heatPercent >= 90 ? "hsl(0, 72%, 51%)" : heatPercent >= 50 ? "hsl(30, 90%, 50%)" : "hsl(142, 71%, 45%)";
  const showTriggerButton = controlMode === "default";
  const cs = gameState.campaignState;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background max-w-[430px] mx-auto">
      {/* Header — 7vh */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: "7vh" }}>
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 rounded-full bg-primary/30 flex items-center justify-center border border-primary/40 overflow-hidden">
            {playerAvatarImg ? (
              <GameImage src={playerAvatarImg} alt="You" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-[10px] text-primary">P</span>
            )}
          </div>
          <span className="font-display text-[10px] tracking-wider text-muted-foreground">YOU</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display text-[8px] text-muted-foreground tracking-wider">
            S{stage} L{level}
          </span>
          <span className="font-display text-xs text-muted-foreground">{Math.floor(gameState.timer)}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[10px] tracking-wider text-muted-foreground">
            {cs ? `${cs.asteroidsDestroyed}/${cs.totalAsteroids}` : ""}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-primary hover:text-primary/80 transition-colors ml-1"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas — aspect-ratio locked */}
      <div className="relative shrink-0 overflow-visible w-full" style={{ aspectRatio: "510/750", maxHeight: "78vh" }}>
        <BattleCanvas
          gameState={gameState} inputRef={inputRef} onCanvasTap={handleCanvasTap}
          onPointerUp={handleCanvasPointerUp} controlMode={controlMode}
          canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        />
        <BattleHUD
          gameState={gameState} missileTargetActive={gameState.missileTarget.active}
          showSelectTarget={showSelectTarget} canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        />

        {showTriggerButton && (
          <button
            className={`absolute bottom-[8%] ${triggerSide === "left" ? "left-3" : "right-3"} z-20 touch-none select-none`}
            style={{ pointerEvents: "auto" }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); triggerHeldRef.current = true; handleTriggerDown(); }}
            onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); handleTriggerUp(); }}
            onPointerLeave={() => handleTriggerUp()}
          >
            <DiamondPlus className="h-10 w-10 text-primary drop-shadow-[0_0_8px_hsl(199,89%,48%)]" strokeWidth={1.5} />
          </button>
        )}

        {/* Result modal moved to end of component */}
      </div>

      {/* Heat bar */}
      <div className="flex items-center px-4 gap-2 shrink-0" style={{ height: "3vh" }}>
        <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full ${gameState.player.isHeatPurging ? "animate-pulse" : ""}`}
            style={{ width: `${heatPercent}%`, backgroundColor: heatColor, transition: "none" }}
          />
        </div>
        <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: heatColor }} />
        {gameState.player.isHeatPurging && <span className="font-display text-[8px] text-destructive animate-pulse">PURGE</span>}
      </div>

      {/* Weapons — fills remaining space */}
      <div className="grid grid-cols-4 gap-1 px-2 pb-1 flex-1 min-h-0 items-center">
        {gameState.playerWeapons.map((w, i) => {
          const isSelected = gameState.selectedWeapon === i;
          const onCooldown = w.currentCooldown > 0;
          const isDisabled = gameState.player.zLevel !== "normal";
          return (
            <button key={w.slot} onClick={() => handleSelectWeapon(i)}
              className={`relative rounded-lg border overflow-hidden flex items-center justify-center transition-all ${
                isSelected ? "border-primary bg-primary/10 shadow-[0_0_8px_hsl(199_89%_48%/0.3)]" : "border-border/30 bg-card/50"
              } ${onCooldown || isDisabled ? "opacity-40" : ""}`}
              style={{ height: "100%" }}
            >
              <GameImage src={weaponImages[w.name]} alt={w.name} className="w-full h-full object-cover" />
              {onCooldown && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                  <span className="font-display text-[9px] text-muted-foreground">{w.currentCooldown.toFixed(1)}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings */}
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">SFX VOLUME</span>
              </div>
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(val) => { const v = val[0] / 100; setVolume(v); audioManager.setVolume(v); }} />
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

            <button onClick={() => navigate("/battle?mode=campaign", { replace: true })}
              className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 font-display text-[10px] tracking-wider text-destructive hover:bg-destructive/20 transition-all"
            >
              RESIGN
            </button>
          </div>
        </div>
      )}
      {/* Campaign Result Modal */}
      {isFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{
              background: "linear-gradient(to bottom, hsla(222,47%,4%,0.65), hsla(199,89%,48%,0.65))",
            }}
          />

          <div className={`absolute inset-[30px] z-10 flex flex-col items-center justify-between rounded-xl border-2 bg-card/80 backdrop-blur-md p-6 text-center ${
            gameState.phase === "victory"
              ? "border-primary/60 shadow-[0_0_40px_hsla(199,89%,48%,0.3),inset_0_0_40px_hsla(199,89%,48%,0.05)]"
              : "border-destructive/60 shadow-[0_0_40px_hsla(0,72%,51%,0.3),inset_0_0_40px_hsla(0,72%,51%,0.05)]"
          }`}>
            {/* Top spacer */}
            <div />

            {/* Center content */}
            <div className="flex flex-col items-center gap-5">
              {/* Title with glow */}
              <div className="relative">
                <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
                  gameState.phase === "victory" ? "bg-primary/30" : "bg-destructive/30"
                }`} />
                <h2 className="relative font-display text-3xl tracking-[0.2em] glow-text">
                  {gameState.phase === "victory" ? (
                    <span className="text-primary">VICTORY!</span>
                  ) : (
                    <span className="text-destructive">DEFEATED</span>
                  )}
                </h2>
              </div>

              {/* Stars */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-8 w-8 ${s <= resultStars ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_hsla(45,100%,50%,0.5)]" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>

              {cs && (
                <div className="space-y-2 text-base">
                  <p className="text-muted-foreground font-body">
                    Asteroids: <span className="text-foreground font-display">{cs.asteroidsDestroyed}/{cs.totalAsteroids}</span>
                  </p>
                  <p className="text-muted-foreground font-body">
                    Damage Taken: <span className="text-foreground font-display">{Math.round(cs.damageTaken)}</span>
                  </p>
                </div>
              )}

              {/* Reward Cards */}
              <div className="flex gap-3 justify-center flex-wrap">
                {gameState.xpEarned > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col items-center gap-1">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="font-display text-sm text-primary">+{gameState.xpEarned} XP</span>
                    {alreadyClaimed && (
                      <span className="font-display text-[9px] text-muted-foreground tracking-wider">½ REPLAY</span>
                    )}
                  </div>
                )}

                {/* Credits card */}
                <div className={`rounded-lg border px-4 py-3 flex flex-col items-center gap-1 ${
                  alreadyClaimed ? "border-muted-foreground/20 bg-muted/5 opacity-40" : "border-yellow-400/30 bg-yellow-400/5"
                }`}>
                  <Coins className={`h-5 w-5 ${alreadyClaimed ? "text-muted-foreground" : "text-yellow-400"}`} />
                  {alreadyClaimed ? (
                    <span className="font-display text-[10px] text-muted-foreground tracking-wider">CLAIMED</span>
                  ) : (
                    gameState.creditsEarned > 0 && (
                      <span className="font-display text-sm text-yellow-400">+{gameState.creditsEarned}</span>
                    )
                  )}
                </div>

                {/* Star orb card */}
                {(droppedStar || (alreadyClaimed && gameState.phase === "victory" && resultStars >= 4)) && (
                  <div className={`rounded-lg border px-4 py-3 flex flex-col items-center gap-1 ${
                    alreadyClaimed ? "border-muted-foreground/20 bg-muted/5 opacity-40" : ""
                  }`} style={!alreadyClaimed && droppedStar ? { borderColor: `${STAR_CONFIG[droppedStar].color}50` } : {}}>
                    {alreadyClaimed ? (
                      <>
                        <Star className="h-5 w-5 text-muted-foreground" />
                        <span className="font-display text-[10px] text-muted-foreground tracking-wider">CLAIMED</span>
                      </>
                    ) : droppedStar ? (
                      <>
                        <StarOrb rarity={droppedStar} size={28} />
                        <span className="font-display text-[10px] tracking-wider" style={{ color: STAR_CONFIG[droppedStar].color }}>
                          {STAR_CONFIG[droppedStar].label.toUpperCase()}
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom buttons */}
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  const action = () => navigate(`/battle?mode=campaign&stage=${stage}`, { replace: true });
                  if (levelUpInfo && !showLevelUp) { pendingActionRef.current = action; setShowLevelUp(true); } else action();
                }}
                className="flex-1 rounded-lg border border-border/30 bg-card/50 px-3 py-3 font-display text-xs tracking-wider text-muted-foreground hover:text-foreground transition-all"
              >
                BACK
              </button>
              <button
                onClick={() => {
                  const action = () => window.location.reload();
                  if (levelUpInfo && !showLevelUp) { pendingActionRef.current = action; setShowLevelUp(true); } else action();
                }}
                className="flex-1 rounded-lg border border-border/30 bg-card/50 px-3 py-3 font-display text-xs tracking-wider text-muted-foreground hover:text-foreground transition-all"
              >
                RETRY
              </button>
              {gameState.phase === "victory" && !(stage >= STAGE_DEFS.length && level >= 10) && (
                <button
                  onClick={() => {
                    const nextLevel = level < 10 ? level + 1 : 1;
                    const nextStage = level < 10 ? stage : stage + 1;
                    const action = () => navigate(`/battle?mode=campaign&stage=${nextStage}&level=${nextLevel}`, { replace: true });
                    if (levelUpInfo && !showLevelUp) { pendingActionRef.current = action; setShowLevelUp(true); } else action();
                  }}
                  className="flex-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 font-display text-xs tracking-wider text-primary hover:bg-primary/20 transition-all"
                >
                  NEXT
                </button>
              )}
            </div>
          </div>
        </div>
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

export default CampaignBattle;
