import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, DiamondPlus, Menu, X, Volume2, Coins, Infinity, Clock, Star } from "lucide-react";
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
  AsteroidType,
} from "@/game/types";
import { updateGameState, tryFireWeapon, enterEndingPhase } from "@/game/gameLoop";
import { updateCampaignAsteroids } from "@/game/campaignLoop";
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
  STAR_CONFIG,
  StarRarity,
  FUEL_TRIGGER_Z,
  // rollLevelUpStar moved server-side
} from "@/game/constants";
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

// Rewards are fetched from the database (infinity_rewards table)
interface RewardTier {
  score_threshold: number;
  xp: number;
  credits: number;
  stars: StarRarity[];
}

function getRewards(score: number, tiers: RewardTier[]) {
  let best = { xp: 0, credits: 0, stars: [] as StarRarity[] };
  for (const r of tiers) {
    if (score >= r.score_threshold) best = r;
  }
  return best;
}

function formatTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Infinity-specific asteroid spawning
function getInfinitySpawnInterval(minutesElapsed: number): number {
  // 2.5s at minute 0 → 0.25s at minute 16
  return Math.max(0.25, 2.5 - minutesElapsed * 0.14);
}

function getInfinitySpeedMultiplier(minutesElapsed: number): number {
  // 0.5 at minute 0 → 8.0 at minute 16
  return 0.5 + minutesElapsed * 0.47;
}

function getInfinityHpMultiplier(minutesElapsed: number): number {
  // 1x at minute 0 → 8x at minute 16
  return 1 + minutesElapsed * 0.44;
}

function getInfinityPerkInterval(minutesElapsed: number): [number, number] {
  if (minutesElapsed >= 10) return [4, 8];
  if (minutesElapsed >= 5) return [8, 15];
  return [15, 25];
}

function pickAsteroidType(minutesElapsed: number): AsteroidType {
  const roll = Math.random();
  if (minutesElapsed < 2) {
    if (roll < 0.7) return "blue";
    if (roll < 0.9) return "orange";
    return "purple";
  }
  if (minutesElapsed < 5) {
    if (roll < 0.4) return "blue";
    if (roll < 0.7) return "orange";
    if (roll < 0.9) return "purple";
    return "red";
  }
  if (minutesElapsed < 8) {
    if (roll < 0.2) return "blue";
    if (roll < 0.4) return "orange";
    if (roll < 0.7) return "purple";
    return "red";
  }
  // 8+ minutes: mostly red/purple
  if (roll < 0.1) return "blue";
  if (roll < 0.25) return "orange";
  if (roll < 0.55) return "purple";
  return "red";
}

const InfinityBattle = () => {
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
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; oldXp: number; newLevel: number; newXp: number; bonusStar: StarRarity } | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>(createInitialInput());
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const countdownRef = useRef<number>(0);
  const savedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlModeRef = useRef<ControlMode>("default");
  const triggerHeldRef = useRef(false);
  const triggerFiredRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const nextAsteroidSpawnRef = useRef(4); // first asteroid at 4s
  const nextPerkTimeRef = useRef(PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN));
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

  // Fetch reward tiers from DB
  useEffect(() => {
    supabase.from("infinity_rewards" as any).select("*").order("score_threshold", { ascending: true }).then(({ data }) => {
      if (data) setRewardTiers((data as any[]).map((d: any) => ({ score_threshold: d.score_threshold, xp: d.xp, credits: d.credits, stars: Array.isArray(d.stars) ? d.stars : [] })));
    });
  }, []);

  useEffect(() => {
    startBattleMusic();
    return () => { audioManager.dispose(); stopBattleMusic(); };
  }, []);

  // Load player data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
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

      // Load skins
      let skinColours: Record<string, string> | undefined;
      let skinId: string | undefined;
      if ((playerShip as any).active_skin_id) {
        const { data: skinData } = await supabase.from("skins").select("id, colours").eq("id", (playerShip as any).active_skin_id).single();
        if (skinData) { skinColours = skinData.colours as Record<string, string>; skinId = skinData.id; }
      }
      let jetSkinColours: Record<string, string> | undefined;
      let jetSkinId: string | undefined;
      if ((playerShip as any).active_jet_skin_id) {
        const { data: jetSkinData } = await supabase.from("skins").select("id, colours").eq("id", (playerShip as any).active_jet_skin_id).single();
        if (jetSkinData) { jetSkinColours = jetSkinData.colours as Record<string, string>; jetSkinId = jetSkinData.id; }
      }

      // Campaign state used for asteroid system — infinite mode
      const campaignState: CampaignState = {
        stage: 1, level: 1, asteroids: [], asteroidsDestroyed: 0,
        totalAsteroids: 999999, damageTaken: 0, spawnQueue: [], nextSpawnTime: 4,
        speedMultiplier: 0.5, infinityScore: 0,
      };

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
          hp: 9999, maxHp: 9999,
          fuel: 100, maxFuel: 100, heat: 0, maxHeat: 100, speed: 0,
          zLevel: "normal", isHeatPurging: false, heatPurgeTimer: 0,
          shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false, shieldRecoil: 0, shieldHeatFactor: 0,
          width: 0, height: 0, flameOpacity: 0,
        },
        playerWeapons: weapons,
        opponentWeapons: [],
        selectedWeapon: -1, projectiles: [], perks: [],
        activeBeams: [], flyingPerkIcons: [], mineExplosions: [],
        shockwaves: [],
        missileTarget: { x: 0, y: 0, active: false },
        nextPerkSpawn: PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN),
        arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT,
        xpEarned: 0, creditsEarned: 0,
        playerShipName: shipName, opponentShipName: "AX15",
        playerSkinColours: skinColours, playerSkinId: skinId,
        playerJetSkinColours: jetSkinColours, playerJetSkinId: jetSkinId,
        campaignState,
      };

      gameStateRef.current = initial;
      prevPlayerHpRef.current = initial.player.hp;
      setGameState(initial);
      setLoading(false);
    };
    load();
  }, [user]);

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
      if (e.key === " ") { handleTriggerUp(); }
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
      const minutesElapsed = gs.timer / 60;

      // Movement
      if (!gs.player.isHeatPurging) {
        const beamLocking = gs.activeBeams.some(b => b.owner === "player" && b.active && !b.reflected);
        if (input.dragging && !beamLocking && gs.player.fuel > 0) gs = { ...gs, player: { ...gs.player, targetX: input.currentX } };
        const keys = keysRef.current;
        if ((keys.has("ArrowLeft") || keys.has("ArrowRight")) && !beamLocking && gs.player.fuel > 0) {
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

      // Update game state (ship physics, projectiles, perks)
      gs = updateGameState(gs, dt);

      // INFINITY: Spawn asteroids continuously
      if (gs.campaignState) {
        const cs = gs.campaignState;
        const spawnInterval = getInfinitySpawnInterval(minutesElapsed);
        const speedMult = getInfinitySpeedMultiplier(minutesElapsed);
        const hpMult = getInfinityHpMultiplier(minutesElapsed);

        if (gs.timer >= nextAsteroidSpawnRef.current) {
          const type = pickAsteroidType(minutesElapsed);
          // We add to spawnQueue + let campaignLoop handle it, but since queue is always empty,
          // let's directly add the asteroid type and set nextSpawnTime
          const updatedCs = {
            ...cs,
            spawnQueue: [type],
            nextSpawnTime: gs.timer,
            speedMultiplier: speedMult,
          };
          gs = { ...gs, campaignState: updatedCs };
          nextAsteroidSpawnRef.current = gs.timer + spawnInterval;
        }

        // Update campaign asteroids (movement, collisions, etc.)
        const prevAsteroidCount = gs.campaignState?.asteroids.length || 0;
        gs = updateCampaignAsteroids(gs, dtSec);

        // Scale HP of NEWLY spawned asteroids only (apply once at spawn, not every frame)
        if (gs.campaignState && gs.campaignState.asteroids.length > prevAsteroidCount) {
          const asteroids = gs.campaignState.asteroids.map((a, idx) => {
            if (idx >= prevAsteroidCount) {
              const scaledHp = Math.round(a.maxHp * hpMult);
              return { ...a, hp: scaledHp, maxHp: scaledHp };
            }
            return a;
          });
          gs = { ...gs, campaignState: { ...gs.campaignState, asteroids } };
        }

        // Dynamic perk spawn intervals
        const [perkMin, perkMax] = getInfinityPerkInterval(minutesElapsed);
        if (gs.timer >= nextPerkTimeRef.current) {
          gs = { ...gs, nextPerkSpawn: gs.timer };
          nextPerkTimeRef.current = gs.timer + perkMin + Math.random() * (perkMax - perkMin);
        }

        // Death check
        if (gs.player.hp <= 0 && gs.phase === "playing") {
          gs = enterEndingPhase({ ...gs, xpEarned: 0, creditsEarned: 0 }, "defeat", false);
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

  // Save results on defeat (server-side)
  useEffect(() => {
    if (!gameState || !user) return;
    if (gameState.phase === "defeat" && !savedRef.current) {
      savedRef.current = true;
      const score = gameState.campaignState?.infinityScore || 0;
      const rewards = getRewards(score, rewardTiers);

      const saveAll = async () => {
        const { data: response } = await supabase.functions.invoke("save-battle-result", {
          body: {
            battleType: "infinity",
            result: "defeat",
            battleDuration: Math.round(gameState.timer),
            shipUsed: gameState.playerShipName,
            playerShipId: playerShipIdRef.current || undefined,
            score,
            asteroidsDestroyed: gameState.campaignState?.asteroidsDestroyed || 0,
          },
        });

        if (response?.levelUp) {
          setLevelUpInfo(response.levelUp);
        }
        if (response?.isNewRecord) {
          setIsNewRecord(true);
        }

        // Update quest progress
        supabase.functions.invoke("update-quest-progress", {
          body: {
            asteroids: gameState.campaignState?.asteroidsDestroyed || 0,
            distance: Math.round(gameState.timer),
            damage: 0,
            credits: rewards.credits,
            xp: rewards.xp,
          },
        });
      };
      saveAll();
    }
  }, [gameState?.phase, user]);

  const fireWeapon = useCallback(() => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    if (gs.player.zLevel !== "normal") return;
    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;
    if (selectedW.name === "Shield" || selectedW.name === "Ricochet" || selectedW.name === "IsoSphere" || selectedW.name === "RegenX") return;
    if (selectedW.name === "Missile" || selectedW.name === "Mine") {
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
    if (selectedW.name === "RadixR4") {
      if (triggerFiredRef.current) return;
      triggerFiredRef.current = true;
      const prevShockwaves = (gs.shockwaves || []).length;
      gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
      if ((gs.shockwaves || []).length > prevShockwaves) {
        audioManager.playRadixFire(); audioManager.playRadixShockwave();
      }
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
        } else audioManager.playCannon();
      }
      gameStateRef.current = gs;
    }
  }, []);

  const handleTriggerDown = useCallback(() => { fireWeapon(); }, [fireWeapon]);
  const handleTriggerUp = useCallback(() => {
    triggerHeldRef.current = false;
    triggerFiredRef.current = false;
  }, []);

  const handleCanvasTap = useCallback((x: number, y: number) => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;
    if (selectedW.name === "Missile" || selectedW.name === "Mine") {
      if (gs.missileTarget.active) {
        const dx = Math.abs(x - gs.player.x), dy = Math.abs(y - SHIP_Y_PLAYER);
        if (dx < 40 && dy < 50) {
          triggerHeldRef.current = true; fireWeapon();
          triggerHeldRef.current = false; triggerFiredRef.current = false;
          return;
        }
      }
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
    if (user) await supabase.from("profiles").update({ control_mode: mode } as any).eq("id", user.id);
  }, [user]);

  if (loading || !gameState) {
    return (
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <StarField />
        <p className="relative z-10 font-display text-purple-400 animate-pulse">LOADING...</p>
      </div>
    );
  }

  const isFinished = gameState.phase === "defeat";
  const heatPercent = gameState.player.isHeatPurging
    ? (gameState.player.heatPurgeTimer / HEAT_PURGE_DURATION) * 100
    : Math.max(0, (gameState.player.heat / gameState.player.maxHeat) * 100);
  const heatColor = heatPercent >= 90 ? "hsl(0, 72%, 51%)" : heatPercent >= 50 ? "hsl(30, 90%, 50%)" : "hsl(142, 71%, 45%)";
  const showTriggerButton = controlMode === "default";
  const currentScore = gameState.campaignState?.infinityScore || 0;
  const rewards = getRewards(currentScore, rewardTiers);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background max-w-[430px] mx-auto">
      {/* Header — 7vh */}
      <div className="shrink-0 overflow-visible flex items-center justify-between px-3" style={{ height: "7vh", paddingTop: "5px" }}>
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-full bg-purple-500/30 flex items-center justify-center border border-purple-500/40 overflow-hidden">
            {playerAvatarImg ? (
              <GameImage src={playerAvatarImg} alt="You" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-[9px] text-purple-400">P</span>
            )}
          </div>
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">YOU</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] text-muted-foreground">{Math.floor(gameState.timer)}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Infinity className="h-4 w-4 text-purple-400" />
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">MODE</span>
          <button onClick={() => setSettingsOpen(true)} className="text-primary hover:text-primary/80 transition-colors ml-1">
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

        {/* Score + Timer overlay */}
        {gameState.phase === "playing" && (
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1">
            <span
              className="font-display text-3xl tracking-wider text-purple-400"
              style={{ filter: "drop-shadow(0 0 12px hsl(270, 80%, 60%))" }}
            >
              {currentScore.toLocaleString()}
            </span>
            <span className="font-display text-[10px] tracking-wider text-muted-foreground">
              {formatTime(gameState.timer)}
            </span>
          </div>
        )}

        {showTriggerButton && (
          <button
            className={`absolute bottom-[8%] ${triggerSide === "left" ? "left-3" : "right-3"} z-20 touch-none select-none`}
            style={{ pointerEvents: "auto" }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); triggerHeldRef.current = true; handleTriggerDown(); }}
            onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); handleTriggerUp(); }}
            onPointerLeave={() => handleTriggerUp()}
          >
            <DiamondPlus className="h-10 w-10 text-purple-400 drop-shadow-[0_0_8px_hsl(270,80%,60%)]" strokeWidth={1.5} />
          </button>
        )}

        {/* Result Modal */}
        {isFinished && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "linear-gradient(to bottom, hsla(222,47%,4%,0.65), hsla(270,80%,60%,0.65))" }} />
            <div className="absolute inset-[30px] z-10 flex flex-col items-center justify-between rounded-xl border-2 border-purple-500/60 bg-card/80 backdrop-blur-md p-6 text-center shadow-[0_0_40px_hsla(270,80%,60%,0.3),inset_0_0_40px_hsla(270,80%,60%,0.05)]">
              <div />
              <div className="flex flex-col items-center gap-5">
                {/* Title */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-2xl animate-pulse bg-purple-500/30" />
                  <Infinity className="relative h-16 w-16 text-purple-400" style={{ filter: "drop-shadow(0 0 20px hsl(270, 80%, 60%))" }} />
                </div>

                <h2 className="font-display text-3xl tracking-[0.2em] text-purple-400" style={{ filter: "drop-shadow(0 0 8px hsl(270, 80%, 60%))" }}>
                  INFINITY
                </h2>

                {isNewRecord && (
                  <span className="font-display text-sm tracking-wider text-yellow-400 animate-pulse" style={{ filter: "drop-shadow(0 0 8px hsl(45, 100%, 50%))" }}>
                    ★ NEW RECORD ★
                  </span>
                )}

                {/* Score */}
                <div className="space-y-1">
                  <p className="font-body text-sm text-muted-foreground">Score</p>
                  <p className="font-display text-3xl text-purple-400" style={{ filter: "drop-shadow(0 0 8px hsl(270, 80%, 60%))" }}>{currentScore.toLocaleString()}</p>
                </div>

                {/* Survival time */}
                <div className="space-y-1">
                  <p className="font-body text-xs text-muted-foreground">Survival Time</p>
                  <p className="font-display text-sm text-muted-foreground">{formatTime(gameState.timer)}</p>
                </div>

                {/* Rewards */}
                <div className="flex gap-3 justify-center flex-wrap">
                  {rewards.xp > 0 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col items-center gap-1">
                      <span className="font-display text-sm text-primary">+{rewards.xp} XP</span>
                    </div>
                  )}
                  {rewards.credits > 0 && (
                    <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 flex flex-col items-center gap-1">
                      <Coins className="h-4 w-4 text-yellow-400" />
                      <span className="font-display text-sm text-yellow-400">+{rewards.credits}</span>
                    </div>
                  )}
                  {rewards.stars.length > 0 && (
                    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3 flex flex-col items-center gap-1">
                      {rewards.stars.map((s, i) => (
                        <StarOrb key={i} rarity={s} size={20} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    const action = () => navigate("/", { replace: true });
                    if (levelUpInfo && !showLevelUp) { pendingActionRef.current = action; setShowLevelUp(true); } else action();
                  }}
                  className="flex-1 rounded-lg border border-border/30 bg-card/50 px-3 py-3 font-display text-xs tracking-wider text-muted-foreground hover:text-foreground transition-all"
                >
                  MENU
                </button>
                <button
                  onClick={() => {
                    const action = () => navigate("/battle", { replace: true });
                    if (levelUpInfo && !showLevelUp) { pendingActionRef.current = action; setShowLevelUp(true); } else action();
                  }}
                  className="flex-1 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-3 font-display text-xs tracking-wider text-purple-400 hover:bg-purple-500/20 transition-all"
                >
                  PLAY AGAIN
                </button>
              </div>
            </div>
          </div>
        )}
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
                isSelected ? "border-purple-500 bg-purple-500/10 shadow-[0_0_8px_hsl(270_80%_60%/0.3)]" : "border-border/30 bg-card/50"
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
          onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="w-[90%] max-w-[360px] rounded-xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm tracking-wider text-foreground">SETTINGS</span>
              <button onClick={() => setSettingsOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">SFX VOLUME</span>
              </div>
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(val) => { const v = val[0] / 100; setVolume(v); audioManager.setVolume(v); }} />
            </div>
            <MusicControls />
            {controlMode === "default" && (
              <div className="space-y-2">
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">TRIGGER PLACEMENT</span>
                <div className="flex gap-2">
                  {(["left", "right"] as const).map(side => (
                    <button key={side} onClick={() => setTriggerSide(side)}
                      className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                        triggerSide === side ? "border-purple-500 bg-purple-500/10 text-purple-400" : "border-border/30 bg-card/50 text-muted-foreground"
                      }`}
                    >
                      {side.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <span className="font-display text-[10px] tracking-wider text-muted-foreground">CONTROL MODE</span>
              <div className="flex flex-col gap-2">
                {([
                  { value: "default" as ControlMode, label: "DEFAULT", desc: "Tap trigger button to fire" },
                  { value: "pro" as ControlMode, label: "PRO", desc: "Tap ship to fire" },
                  { value: "pro_loose" as ControlMode, label: "PRO LOOSE", desc: "Tap lower half to fire & move" },
                ]).map((opt) => (
                  <button key={opt.value} onClick={() => handleControlModeChange(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      controlMode === opt.value ? "border-purple-500 bg-purple-500/10" : "border-border/30 bg-card/50"
                    }`}
                  >
                    <span className={`font-display text-[10px] tracking-wider ${controlMode === opt.value ? "text-purple-400" : "text-muted-foreground"}`}>{opt.label}</span>
                    <p className="font-body text-[9px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => navigate("/", { replace: true })}
              className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 font-display text-[10px] tracking-wider text-destructive hover:bg-destructive/20 transition-all"
            >
              RESIGN
            </button>
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

export default InfinityBattle;
