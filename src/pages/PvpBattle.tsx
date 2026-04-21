import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarImageUrl } from "@/game/avatarImageUrl";
import { Crosshair, Flame, DiamondPlus, Menu, X, Volume2, Trophy, Skull, Coins } from "lucide-react";
import { weaponImages } from "@/game/weaponImages";
import GameImage from "@/components/GameImage";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BattleCanvas from "@/components/BattleCanvas";
import BattleHUD from "@/components/BattleHUD";
import StarField from "@/components/StarField";
import ShipDisplay from "@/components/ShipDisplay";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  GameState,
  InputState,
  WeaponSlot,
  FireMode,
  ActiveBeam,
  Shockwave,
} from "@/game/types";
import { updateGameState, tryFireWeapon, createProjectile, nextProjectileId, handlePerks } from "@/game/gameLoop";
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
  RADIX_SHOCKWAVE_MAX_RADIUS,
} from "@/game/constants";
import { audioManager } from "@/game/audioManager";
import { useMusic } from "@/contexts/MusicContext";
import MusicControls from "@/components/MusicControls";
import { musicManager } from "@/game/musicManager";
import { fetchUserStars, getCompositeMultipliers } from "@/game/starUtils";
import { createPeerConnection, PeerConnection, PeerSignal, PeerDiagnostics } from "@/game/peerConnection";
// upsertShipStats moved server-side
import LevelUpScreen from "@/components/LevelUpScreen";
import EmoteOverlay, { EmoteData } from "@/components/EmoteOverlay";


type PvpPhase = "searching" | "found" | "countdown" | "playing" | "result";
type ControlMode = "default" | "pro" | "pro_loose";

interface OpponentWeaponData {
  id: string;
  name: string;
  type: string;
  dmg: number;
  heat: number;
  cooldown: number;
  fire_rate: number;
  fire_mode: string;
  spd: number;
}

interface OpponentShipData {
  hp: number;
  fuel: number;
  heat_cap: number;
  speed: number;
  name: string;
}

interface MatchData {
  matchId: string;
  isHost: boolean;
  opponentId: string;
  opponentName: string;
  opponentShip: string;
  opponentWeapons: OpponentWeaponData[];
  opponentShipStats?: OpponentShipData;
}

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

const PvpBattle = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { startBattle: startBattleMusic, stopBattle: stopBattleMusic } = useMusic();

  const [pvpPhase, setPvpPhase] = useState<PvpPhase>("searching");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSelectTarget, setShowSelectTarget] = useState(false);
  const [triggerSide, setTriggerSide] = useState<"left" | "right">("left");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [controlMode, setControlMode] = useState<ControlMode>("default");
  const [trophiesEarned, setTrophiesEarned] = useState(0);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; newLevel: number; oldXp: number; newXp: number; bonusStar: StarRarity } | null>(null);
  const [showLevelUpScreen, setShowLevelUpScreen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [playerName, setPlayerName] = useState("Pilot");
  const [playerShipName, setPlayerShipName] = useState("AX15");
  const [playerWeaponNames, setPlayerWeaponNames] = useState<{ name: string; type: string }[]>([]);
  const [playerAvatarImg, setPlayerAvatarImg] = useState<string | null>(null);
  const [opponentAvatarImg, setOpponentAvatarImg] = useState<string | null>(null);
  const [foundAnimPhase, setFoundAnimPhase] = useState<"enter" | "vs" | "burst">("enter");
  const [matchGeneration, setMatchGeneration] = useState(0);
  const [emoteLoadout, setEmoteLoadout] = useState<EmoteData[]>([]);
  const [incomingEmote, setIncomingEmote] = useState<EmoteData | null>(null);
  const incomingEmoteCounterRef = useRef(0);

  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>(createInitialInput());
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const countdownRef = useRef<number>(0);
  const resultSavedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlModeRef = useRef<ControlMode>("default");
  const triggerHeldRef = useRef(false);
  const triggerFiredRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  const matchDataRef = useRef<MatchData | null>(null);
  const pvpPhaseRef = useRef<PvpPhase>("searching");
  const peerRef = useRef<PeerConnection | null>(null);
  const peerReadyRef = useRef(false);
  const foundAnimDoneRef = useRef(false);
  const countdownDoneLocalRef = useRef(false);
  const countdownDoneRemoteRef = useRef(false);
  const readyToTransitionRef = useRef(false);
  const localDcOpenRef = useRef(false);
  const remoteDcOpenRef = useRef(false);
  const localArenaReadyRef = useRef(false);
  const remoteArenaReadyRef = useRef(false);
  const countdownAtRef = useRef(0);
  const abortedRef = useRef(false);
  const milestonesRef = useRef<string[]>([]);
  const playerSkinRef = useRef<{ colours: Record<string, string>; id: string } | null>(null);
  const playerJetSkinRef = useRef<{ colours: Record<string, string>; id: string } | null>(null);
  const opponentSkinRef = useRef<{ colours: Record<string, string>; id: string } | null>(null);
  const opponentJetSkinRef = useRef<{ colours: Record<string, string>; id: string } | null>(null);
  const opponentWeaponsRef = useRef<OpponentWeaponData[]>([]);
  const opponentShipRef = useRef<OpponentShipData>({ hp: 100, fuel: 100, heat_cap: 100, speed: 50, name: "AX15" });
  const playerShipIdRef = useRef<string>("");

  const prevShieldActiveRef = useRef(false);
  const prevRicochetActiveRef = useRef(false);
  const prevPlayerHpRef = useRef<number | null>(null);
  const prevOpponentHpRef = useRef<number | null>(null);
  const prevShieldRecoilRef = useRef(0);
  const prevFlameRef = useRef(false);
  const prevProjectileCountRef = useRef(0);
  const prevBeamChargingRef = useRef(false);
  const prevBeamActiveRef = useRef(false);
  const prevOppBeamActiveRef = useRef(false);
  const prevMineExplosionCountRef = useRef(0);

  // Event-driven broadcasting refs
  const lastBroadcastRef = useRef({
    targetX: ARENA_WIDTH / 2,
    zLevel: "normal" as string,
    shieldActive: false,
    ricochetActive: false,
    beamActive: false,
    playerHp: 0,
    opponentHp: 0,
    holdFiring: false,
    holdWeaponIndex: -1,
    lastPositionBroadcast: 0,
    lastFuel: undefined as number | undefined,
  });
  const opponentHoldFiringRef = useRef<{ active: boolean; weaponIndex: number }>({ active: false, weaponIndex: -1 });

  // Keep refs in sync
  useEffect(() => { controlModeRef.current = controlMode; }, [controlMode]);
  useEffect(() => { matchDataRef.current = matchData; }, [matchData]);
  useEffect(() => { pvpPhaseRef.current = pvpPhase; }, [pvpPhase]);

  // Fetch opponent's avatar, ship stats, and weapon data
  const fetchOpponentData = async (opponentUserId: string) => {
    // Fetch profile → avatar
    const { data: oppProfile } = await supabase
      .from("profiles")
      .select("active_avatar_id")
      .eq("id", opponentUserId)
      .single();

    if (oppProfile?.active_avatar_id) {
      const { data: av } = await supabase.from("avatars").select("image_path, image_url").eq("id", oppProfile.active_avatar_id).single();
      if (av) setOpponentAvatarImg(getAvatarImageUrl(av as any) || null);
    }

    // Fetch opponent's active ship + stats
    const { data: oppPlayerShip } = await supabase
      .from("player_ships")
      .select("*, ships(*)")
      .eq("user_id", opponentUserId)
      .eq("is_active", true)
      .single();

    if (oppPlayerShip?.ships) {
      const s = oppPlayerShip.ships;

      // Fetch stars once, weapons in parallel
      const [oppStars, oppWeaponsResult] = await Promise.all([
        fetchUserStars(opponentUserId),
        supabase
          .from("player_weapons")
          .select("*, weapons(*)")
          .eq("player_ship_id", oppPlayerShip.id)
          .order("slot"),
      ]);

      const oppMultipliers = getCompositeMultipliers(oppStars, oppPlayerShip.id);

      opponentShipRef.current = {
        hp: Math.round(s.hp * oppMultipliers.hp),
        fuel: Math.round(s.fuel * oppMultipliers.fuel),
        heat_cap: Math.round(s.heat_cap * oppMultipliers.heat),
        speed: s.speed,
        name: s.name,
      };

      // Fetch skins in parallel
      const skinPromises: PromiseLike<any>[] = [];
      if ((oppPlayerShip as any).active_skin_id) {
        skinPromises.push(
          supabase.from("skins").select("id, colours").eq("id", (oppPlayerShip as any).active_skin_id).single()
            .then(({ data }) => { if (data) opponentSkinRef.current = { colours: data.colours as Record<string, string>, id: data.id }; })
        );
      } else {
        opponentSkinRef.current = null;
      }
      if ((oppPlayerShip as any).active_jet_skin_id) {
        skinPromises.push(
          supabase.from("skins").select("id, colours").eq("id", (oppPlayerShip as any).active_jet_skin_id).single()
            .then(({ data }) => { if (data) opponentJetSkinRef.current = { colours: data.colours as Record<string, string>, id: data.id }; })
        );
      } else {
        opponentJetSkinRef.current = null;
      }
      await Promise.all(skinPromises);

      // Build weapon data using the already-fetched multipliers
      if (oppWeaponsResult.data) {
        const weaponData: OpponentWeaponData[] = oppWeaponsResult.data.map((pw: any) => ({
          id: pw.weapons.id,
          name: pw.weapons.name,
          type: pw.weapons.type,
          dmg: Math.round(pw.weapons.dmg * oppMultipliers.dmg),
          heat: pw.weapons.heat,
          cooldown: pw.weapons.cooldown,
          fire_rate: pw.weapons.fire_rate,
          fire_mode: pw.weapons.fire_mode,
          spd: pw.weapons.spd ?? 100,
        }));
        opponentWeaponsRef.current = weaponData;
        return weaponData;
      }
    }

    return [];
  };

  // Helper: send gameplay event via P2P only (no Supabase fallback)
  const sendGameEvent = useCallback((event: string, payload: any) => {
    if (peerReadyRef.current && peerRef.current) {
      peerRef.current.send(event, payload);
    }
  }, []);

  const addMilestone = useCallback((milestone: string) => {
    const entry = `${Date.now()}:${milestone}`;
    milestonesRef.current.push(entry);
    console.log(`[PVP][MILESTONE] ${entry}`);
  }, []);

  // Central abort helper — single path for all failure/exit scenarios
  const abortMatch = useCallback((reason: string, diagnostics?: PeerDiagnostics) => {
    if (abortedRef.current) return;
    abortedRef.current = true;
    const milestoneStr = milestonesRef.current.join(", ");
    const peerState = peerRef.current?.getState?.() || "n/a";
    const fullReason = `PVP abort: ${reason} | milestones=[${milestoneStr}] | peerState=${peerState}`;
    console.warn(`[PVP] ${fullReason}`);
    if (diagnostics) {
      console.warn(`[PVP] ICE diagnostics:`, JSON.stringify({
        iceState: diagnostics.iceState,
        connState: diagnostics.connState,
        gatherState: diagnostics.gatherState,
        localCandidates: diagnostics.localCandidates,
        remoteCandidates: diagnostics.remoteCandidates,
        iceCandidateErrors: diagnostics.iceCandidateErrors,
        iceRestarted: diagnostics.iceRestarted,
        stats: diagnostics.stats,
      }));
    }
    cancelAnimationFrame(frameRef.current);
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; peerReadyRef.current = false; }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    // Mark match as failed in DB
    const md = matchDataRef.current;
    if (md) {
      supabase.from("pvp_matches").update({ status: "failed" } as any).eq("id", md.matchId).then(() => {});
    }
    // Log structured error with diagnostics
    const errorPayload: Record<string, any> = {
      reason,
      milestones: milestonesRef.current,
      peerState,
      matchId: md?.matchId,
      isHost: md?.isHost,
    };
    if (diagnostics) {
      errorPayload.iceState = diagnostics.iceState;
      errorPayload.connState = diagnostics.connState;
      errorPayload.localCandidateCount = diagnostics.localCandidates.length;
      errorPayload.remoteCandidateCount = diagnostics.remoteCandidates.length;
      errorPayload.localCandidates = diagnostics.localCandidates;
      errorPayload.remoteCandidates = diagnostics.remoteCandidates;
      errorPayload.iceCandidateErrors = diagnostics.iceCandidateErrors;
      errorPayload.iceRestarted = diagnostics.iceRestarted;
      errorPayload.stats = diagnostics.stats;
    }
    supabase.from("app_errors").insert({
      user_id: user?.id || null,
      error_type: "webrtc_failed",
      error_message: fullReason.slice(0, 2000),
      error_stack: JSON.stringify(errorPayload).slice(0, 4000),
      url: window.location.href,
    }).then(() => {});
    musicManager.hardResetToMenu();
    alert("Connection failed — returning to menu");
    navigate("/");
  }, [user, navigate]);

  // Start battle music + cleanup
  useEffect(() => {
    startBattleMusic();
    return () => {
      audioManager.dispose();
      if (peerRef.current) { peerRef.current.close(); peerRef.current = null; peerReadyRef.current = false; }
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      musicManager.hardResetToMenu();
      if (user) { supabase.from("pvp_queue").delete().eq("user_id", user.id).then(() => {}); }
    };
  }, [user]);

  // Search timer
  useEffect(() => {
    if (pvpPhase !== "searching") return;
    const interval = setInterval(() => setSearchTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [pvpPhase]);

  // Load player data & start matchmaking
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, control_mode, trophies, win_streak, loss_streak, active_avatar_id")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      if (profile) {
        setPlayerName(profile.display_name || "Pilot");
        if (profile.control_mode) {
          const mode = profile.control_mode as ControlMode;
          setControlMode(mode);
          controlModeRef.current = mode;
        }
        // Load player avatar
        if ((profile as any).active_avatar_id) {
          const { data: av } = await supabase.from("avatars").select("image_path, image_url").eq("id", (profile as any).active_avatar_id).single();
          if (av) setPlayerAvatarImg(getAvatarImageUrl(av as any) || null);
        }
      }

      // Load active ship
      const { data: playerShip } = await supabase
        .from("player_ships")
        .select("*, ships(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!playerShip || cancelled) return;
      playerShipIdRef.current = playerShip.id;

      const shipName = playerShip.ships?.name || "AX15";
      setPlayerShipName(shipName);

      // Load active skin colours for PVP
      if ((playerShip as any).active_skin_id) {
        const { data: skinData } = await supabase
          .from("skins")
          .select("id, colours")
          .eq("id", (playerShip as any).active_skin_id)
          .single();
        if (skinData) {
          playerSkinRef.current = { colours: skinData.colours as Record<string, string>, id: skinData.id };
        }
      }

      // Load active jet skin colours for PVP
      if ((playerShip as any).active_jet_skin_id) {
        const { data: jetSkinData } = await supabase
          .from("skins")
          .select("id, colours")
          .eq("id", (playerShip as any).active_jet_skin_id)
          .single();
        if (jetSkinData) {
          playerJetSkinRef.current = { colours: jetSkinData.colours as Record<string, string>, id: jetSkinData.id };
        }
      }

      // Load weapons
      const { data: playerWeapons } = await supabase
        .from("player_weapons")
        .select("*, weapons(*)")
        .eq("player_ship_id", playerShip.id)
        .order("slot");

      const weaponsList = (playerWeapons || []).map((pw: any) => ({
        name: pw.weapons.name,
        type: pw.weapons.type,
      }));
      setPlayerWeaponNames(weaponsList);

      // Load emote loadout
      const { data: loadoutRows } = await supabase
        .from("player_emote_loadout")
        .select("slot, emote_id, emotes(id, name, image_url)")
        .eq("user_id", user.id)
        .order("slot") as any;

      if (loadoutRows && loadoutRows.length > 0) {
        const loadout = loadoutRows.map((r: any) => ({
          id: r.emotes.id,
          name: r.emotes.name,
          image_url: r.emotes.image_url,
        }));
        setEmoteLoadout(loadout);
      } else {
        // Fall back to default emotes
        const { data: defaults } = await supabase
          .from("emotes")
          .select("id, name, image_url")
          .eq("is_default", true)
          .order("created_at");
        if (defaults) setEmoteLoadout(defaults);
      }

      // Clean up any previous queue entries
      await supabase.from("pvp_queue").delete().eq("user_id", user.id);
      if (cancelled) return;

      // Enter queue
      await supabase.from("pvp_queue").insert({
        user_id: user.id,
        ship_id: playerShip.ship_id,
        display_name: profile?.display_name || "Pilot",
      } as any);

      if (cancelled) return;

      const displayName = profile?.display_name || "Pilot";

      // Helper to handle a found match (as host via claim_opponent)
      const handleClaimResult = async (result: any) => {
        if (cancelled) return;
        const md: MatchData = {
          matchId: result.match_id,
          isHost: true,
          opponentId: result.opponent_id,
          opponentName: result.opponent_name || "Pilot",
          opponentShip: result.opponent_ship || "AX15",
          opponentWeapons: [],
          opponentShipStats: undefined,
        };
        setMatchData(md);
        setPvpPhase("found");
        console.log(`[PVP][${Date.now()}] Match found as HOST — subscribing immediately`);
        setupRealtimeChannel(md, playerShip.ships, playerWeapons || [], result.opponent_id);
      };

      // Helper to handle being claimed by another player (as guest)
      const handleFoundAsGuest = async (match: any) => {
        if (cancelled) return;
        const md: MatchData = {
          matchId: match.id,
          isHost: false,
          opponentId: match.player1_id,
          opponentName: match.player1_name || "Pilot",
          opponentShip: match.player1_ship || "AX15",
          opponentWeapons: [],
          opponentShipStats: undefined,
        };
        setMatchData(md);
        setPvpPhase("found");
        console.log(`[PVP][${Date.now()}] Match found as GUEST — subscribing immediately`);
        setupRealtimeChannel(md, playerShip.ships, playerWeapons || [], match.player1_id);
      };

      // Try to claim an opponent immediately
      const { data: claimResult } = await supabase.rpc("claim_opponent", {
        p_user_id: user.id,
        p_display_name: displayName,
        p_ship_name: shipName,
      });

      if (cancelled) return;

      if (claimResult) {
        await handleClaimResult(claimResult);
        return;
      }

      // No opponent yet — start polling every 2 seconds
      pollInterval = setInterval(async () => {
        if (cancelled || pvpPhaseRef.current !== "searching") {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        // Try to claim an opponent
        const { data: pollClaimResult } = await supabase.rpc("claim_opponent", {
          p_user_id: user.id,
          p_display_name: displayName,
          p_ship_name: shipName,
        });

        if (pollClaimResult) {
          if (pollInterval) clearInterval(pollInterval);
          await handleClaimResult(pollClaimResult);
          return;
        }

        // Check if someone else claimed us (we are player2)
        const { data: existingMatch } = await supabase
          .from("pvp_matches")
          .select("*")
          .eq("player2_id", user.id)
          .eq("status", "active")
          .gte("created_at", new Date(Date.now() - 30000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingMatch) {
          if (pollInterval) clearInterval(pollInterval);
          await handleFoundAsGuest(existingMatch);
        }
      }, 1000);
    };

    init();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user, matchGeneration]);

  const setupRealtimeChannel = (md: MatchData, shipData: any, weaponsData: any[], opponentUserId: string) => {
    // Subscribe to channel IMMEDIATELY — no async work before this
    const channel = supabase.channel(`pvp_match_${md.matchId}`, {
      config: { broadcast: { self: false } },
    });
    addMilestone("channel_created");

    // Kick off data fetching IN PARALLEL with channel subscription
    const dataReadyPromise = (async () => {
      console.log(`[PVP][${Date.now()}] Starting parallel data fetch`);

      // Fetch opponent data + player star boosts concurrently
      const [oppWeaponData, playerBoosts] = await Promise.all([
        fetchOpponentData(opponentUserId),
        (async () => {
          let multipliers = { hp: 1, dmg: 1, fuel: 1, heat: 1 };
          if (user) {
            try {
              const { data: activePlayerShip } = await supabase
                .from("player_ships")
                .select("id")
                .eq("user_id", user.id)
                .eq("is_active", true)
                .single();
              const userStars = await fetchUserStars(user.id);
              multipliers = getCompositeMultipliers(userStars, activePlayerShip?.id || "");
            } catch {}
          }
          return multipliers;
        })(),
      ]);

      console.log(`[PVP][${Date.now()}] Data fetch complete`);

      // Update match data with fetched opponent info
      const updatedMd: MatchData = {
        ...md,
        opponentWeapons: oppWeaponData,
        opponentShipStats: opponentShipRef.current,
        opponentShip: opponentShipRef.current?.name || md.opponentShip,
      };
      setMatchData(updatedMd);
      matchDataRef.current = updatedMd;

      return { multipliers: playerBoosts, opponentWeapons: oppWeaponData, updatedMd };
    })();

    // Build weapons/game state after data arrives (but don't block channel subscription)
    const initGameStateFromData = async () => {
      const { multipliers, opponentWeapons: oppWeaponData, updatedMd } = await dataReadyPromise;

      const weapons: WeaponSlot[] = weaponsData.map((pw: any) => ({
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

      const boostedShip = {
        hp: Math.round(shipData.hp * multipliers.hp),
        fuel: Math.round(shipData.fuel * multipliers.fuel),
        heat_cap: Math.round(shipData.heat_cap * multipliers.heat),
        speed: shipData.speed,
      };

      const oppShipStats = updatedMd.opponentShipStats || opponentShipRef.current;
      const oppWeaponSlots: WeaponSlot[] = (oppWeaponData || []).map((w: OpponentWeaponData, i: number) => ({
        id: w.id,
        name: w.name as any,
        type: w.type,
        dmg: w.dmg,
        heat: w.heat,
        cooldown: w.cooldown,
        fireRate: w.fire_rate,
        fireMode: w.fire_mode as FireMode,
        spd: w.spd ?? 100,
        slot: i + 1,
        currentCooldown: 0,
        lastFired: 0,
      }));

      return { weapons, boostedShip, oppShipStats, oppWeaponSlots, updatedMd };
    };

    // P2P-gated countdown helpers — only start countdown when both DataChannels are open
    const startSyncedCountdown = () => {
      if (!countdownAtRef.current) return;
      const waitMs = Math.max(0, countdownAtRef.current - Date.now());
      setTimeout(() => {
        if (abortedRef.current) return;
        if (foundAnimDoneRef.current) {
          setPvpPhase("countdown");
        } else {
          readyToTransitionRef.current = true;
        }
      }, waitMs);
      // Remove signaling channel once countdown is underway
      setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          console.log("[PVP] Signaling channel removed after countdown scheduled");
        }
      }, waitMs + 5000);
    };

    const maybeScheduleCountdown = () => {
      if (!localDcOpenRef.current || !remoteDcOpenRef.current) return;
      if (!localArenaReadyRef.current || !remoteArenaReadyRef.current) return;
      if (countdownAtRef.current) return;
      if (!md.isHost) return; // Only host schedules
      const at = Date.now() + 500;
      countdownAtRef.current = at;
      addMilestone("countdown_scheduled");
      console.log("[PVP] Host scheduling countdown at:", at);
      channelRef.current?.send({ type: "broadcast", event: "countdown_at", payload: { at } });
      peerRef.current?.send("countdown_at", { at });
      startSyncedCountdown();
    };

    // --- Gameplay message handler (shared by broadcast listeners AND P2P DataChannel) ---
    // Also handles dc_hello / arena_ready control messages over DataChannel
    const handleGameMessage = (event: string, payload: any) => {
      // DC hello handshake — proves remote DataChannel is open
      if (event === "dc_hello") {
        if (!remoteDcOpenRef.current) {
          remoteDcOpenRef.current = true;
          addMilestone("remote_dc_hello");
          console.log("[PVP] Remote DC confirmed via dc_hello");
          maybeScheduleCountdown();
        }
        return;
      }
      // Arena ready — remote side has game state built
      if (event === "arena_ready") {
        if (!remoteArenaReadyRef.current) {
          remoteArenaReadyRef.current = true;
          addMilestone("remote_arena_ready");
          console.log("[PVP] Remote arena ready confirmed");
          maybeScheduleCountdown();
        }
        return;
      }

      const gs = gameStateRef.current;
      if (!gs) return;

      switch (event) {
        case "position":
          gameStateRef.current = {
            ...gs,
            opponent: { ...gs.opponent, targetX: payload.x, zLevel: payload.zLevel || "normal" },
          };
          break;

        case "fire": {
          const { weaponIndex, targetX, targetY } = payload;
          const weapon = gs.opponentWeapons[weaponIndex];
          if (!weapon) return;
          // Mirror Y for opponent's perspective (their target near top = our ship near bottom)
          const mirroredY = targetY !== undefined ? ARENA_HEIGHT - targetY : undefined;
          const proj = createProjectile(weapon, gs.opponent, "opponent", targetX, mirroredY);
          if (proj) {
            const newProjs = Array.isArray(proj) ? proj : [proj];
            gameStateRef.current = {
              ...gs,
              projectiles: [...gs.projectiles, ...newProjs],
              opponent: { ...gs.opponent, heat: Math.min(gs.opponent.maxHeat, gs.opponent.heat + weapon.heat) },
            };
            if (weapon.name === "Cannon") audioManager.playCannon();
            else if (weapon.name === "Missile") audioManager.playMissileLaunch();
            else if (weapon.name === "Trident") audioManager.playTridentZap();
            else if (weapon.name === "Mine") audioManager.playMissileLaunch();
          }
          break;
        }

        case "fire_start":
          opponentHoldFiringRef.current = { active: true, weaponIndex: payload.weaponIndex };
          {
            const w = gs.opponentWeapons[payload.weaponIndex];
            if (w?.name === "Blaster") audioManager.playBlaster();
            else if (w?.name === "Machine Gun") audioManager.playMachineGun();
          }
          break;

        case "fire_stop":
          opponentHoldFiringRef.current = { active: false, weaponIndex: -1 };
          break;

        case "shield": {
          const wasShielding = gs.opponent.shieldActive || gs.opponent.ricochetActive || gs.opponent.isoSphereActive || gs.opponent.regenXActive;
          const nowShielding = payload.active || payload.ricochet || payload.isoSphere || payload.regenX;
          if (nowShielding && !wasShielding) audioManager.playShieldHum();
          else if (!nowShielding && wasShielding) audioManager.stopShieldHum();
          gameStateRef.current = {
            ...gs,
            opponent: { ...gs.opponent, shieldActive: payload.active, ricochetActive: payload.ricochet || false, isoSphereActive: payload.isoSphere || false, regenXActive: payload.regenX || false },
          };
          break;
        }

        case "hp_update":
          if (md.isHost) return;
          gameStateRef.current = {
            ...gs,
            player: { ...gs.player, hp: payload.player2Hp },
            opponent: { ...gs.opponent, hp: payload.player1Hp },
          };
          break;

        case "heartbeat": {
          const p = payload;
          let newTargetX = gs.opponent.targetX;
          if (Math.abs(gs.opponent.x - p.x) > 5) {
            newTargetX = p.targetX;
          }
          const updated = {
            ...gs,
            opponent: {
              ...gs.opponent,
              targetX: newTargetX,
              zLevel: p.zLevel || "normal",
              shieldActive: p.shieldActive,
              ricochetActive: p.ricochetActive,
              fuel: p.fuel !== undefined ? p.fuel : gs.opponent.fuel,
            },
          };
          // NOTE: HP is intentionally NOT written here — the host's `hp_update`
          // event is the sole authority for HP on the guest. Heartbeat carries
          // position/zLevel/shield/fuel only.
          gameStateRef.current = updated;
          break;
        }

        case "fuel_update": {
          // Fuel-only sync. HP is owned by the host and broadcast exclusively
          // via `hp_update` — never write HP from this handler.
          const updated2 = {
            ...gs,
            opponent: {
              ...gs.opponent,
              fuel: payload.fuel !== undefined ? payload.fuel : gs.opponent.fuel,
            },
          };
          gameStateRef.current = updated2;
          break;
        }

        case "game_over": {
          const winnerId = payload.winnerId;
          const isVictory = winnerId === user?.id;
          gameStateRef.current = {
            ...gs,
            phase: isVictory ? "victory" : "defeat",
          };
          cancelAnimationFrame(frameRef.current);
          setGameState({ ...gameStateRef.current! });
          setPvpPhase("result");
          break;
        }

        case "perk_spawn":
          if (md.isHost) return;
          gameStateRef.current = {
            ...gs,
            perks: [...gs.perks, { id: payload.id, x: payload.x, y: payload.y, type: payload.type, rarity: payload.rarity || "blue", spawnTime: gs.timer, hp: payload.hp || 10, maxHp: payload.maxHp || 10 }],
          };
          break;

        case "perk_collect":
          gameStateRef.current = {
            ...gs,
            perks: gs.perks.filter((p) => p.id !== payload.perkId),
          };
          break;

        case "beam_start": {
          audioManager.playPhaserCharge();
          const existingBeams = gs.activeBeams.filter(b => b.owner !== "opponent" || b.reflected);
          const opponentBeam: ActiveBeam = {
            owner: "opponent" as const,
            x: payload.x,
            startTime: gs.timer,
            progress: 0,
            duration: 5,
            active: false,
            charging: true,
            chargeStart: gs.timer,
            elapsed: 0,
            baseDmg: payload.baseDmg || 4,
          };
          gameStateRef.current = { ...gs, activeBeams: [...existingBeams, opponentBeam] };
          break;
        }

        case "countdown_at": {
          if (payload?.at && !countdownAtRef.current) {
            countdownAtRef.current = payload.at;
            startSyncedCountdown();
          }
          break;
        }

        case "beam_stop": {
          const updatedBeams = gs.activeBeams.map(b => {
            if (b.owner === "opponent" && !b.reflected && (b.active || b.charging)) {
              return { ...b, draining: true, active: false, charging: false, drainProgress: 0 };
            }
            return b;
          });
          const filtered = updatedBeams.filter(b => !(b.reflected && b.owner === "player"));
          gameStateRef.current = { ...gs, activeBeams: filtered };
          break;
        }

        case "beam_release": {
          // Opponent released trigger — transition their charging beam to active
          audioManager.playPhaserBeam();
          const releasedBeams = gs.activeBeams.map(b => {
            if (b.owner === "opponent" && b.charging && !b.reflected) {
              return { ...b, charging: false, active: true, startTime: gs.timer, elapsed: 0 };
            }
            return b;
          });
          gameStateRef.current = { ...gs, activeBeams: releasedBeams };
          break;
        }

        case "shockwave": {
          // Opponent fired RadixR4 — create shockwave in local state
          audioManager.playRadixFire(); audioManager.playRadixShockwave();
          const opponentShockwave: Shockwave = {
            id: `sw_opp_${Date.now()}`,
            owner: "opponent",
            x: payload.x,
            y: SHIP_Y_OPPONENT,
            startTime: gs.timer,
            dmg: payload.dmg,
            maxRadius: payload.maxRadius || RADIX_SHOCKWAVE_MAX_RADIUS,
            fadingOut: false,
            fadeStartTime: 0,
            hitShip: false,
            hitAsteroids: new Set<string>(),
          };
          gameStateRef.current = { ...gs, shockwaves: [...(gs.shockwaves || []), opponentShockwave] };
          break;
        }

        case "emote": {
          const emoteData: EmoteData = { id: payload.id, name: payload.name, image_url: payload.image_url };
          incomingEmoteCounterRef.current += 1;
          setIncomingEmote({ ...emoteData });
          break;
        }
      }
    };

    // Queue signals that arrive before peerRef is initialized
    const earlySignalQueue: PeerSignal[] = [];
    const routeSignal = (payload: any) => {
      if (peerRef.current) {
        peerRef.current.handleSignal(payload);
      } else {
        earlySignalQueue.push(payload);
      }
    };

    // Register signaling + P2P handshake events on Supabase channel
    channel
      .on("broadcast", { event: "rtc_offer" }, (p: any) => routeSignal(p.payload))
      .on("broadcast", { event: "rtc_answer" }, (p: any) => routeSignal(p.payload))
      .on("broadcast", { event: "rtc_ice" }, (p: any) => routeSignal(p.payload))
      .on("broadcast", { event: "rtc_ready" }, (p: any) => routeSignal(p.payload))
      .on("broadcast", { event: "countdown_at" }, (p: any) => {
        if (p.payload?.at && !countdownAtRef.current) {
          countdownAtRef.current = p.payload.at;
          console.log("[PVP] Received countdown_at:", p.payload.at);
          startSyncedCountdown();
        }
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          addMilestone("channel_subscribed");
          console.log("[PVP] Signaling channel subscribed");

          // Fetch TURN credentials before creating peer connection
          let iceServers: RTCIceServer[] | undefined;
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-turn-credentials`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  },
                }
              );
              if (res.ok) {
                const body = await res.json();
                iceServers = body.iceServers;
                console.log(`[PVP] Fetched ICE servers: ${iceServers?.length} entries (TURN=${iceServers?.some(s => {
                  const u = Array.isArray(s.urls) ? s.urls : [s.urls];
                  return u.some(url => url.startsWith("turn"));
                })})`);
                addMilestone("turn_credentials_fetched");
              } else {
                console.warn("[PVP] Failed to fetch TURN credentials, falling back to STUN-only");
              }
            }
          } catch (err) {
            console.warn("[PVP] Error fetching TURN credentials:", err);
          }

          // Initialize WebRTC P2P connection
          const peer = createPeerConnection({
            isHost: md.isHost,
            onMessage: handleGameMessage,
            onOpen: () => {
              peerReadyRef.current = true;
              localDcOpenRef.current = true;
              addMilestone("local_dc_open");
              console.log("[PVP] Local DataChannel open — sending dc_hello");
              // Send dc_hello over DataChannel (not signaling) to confirm transport
              setTimeout(() => {
                peerRef.current?.send("dc_hello", {});
              }, 50);
              // Also send arena_ready if arena is already built
              if (localArenaReadyRef.current) {
                setTimeout(() => peerRef.current?.send("arena_ready", {}), 100);
              }
              maybeScheduleCountdown();
            },
            onFailed: (diagnostics) => {
              if (peerReadyRef.current) return;
              addMilestone("webrtc_failed");
              abortMatch(`WebRTC failed for match ${md.matchId}`, diagnostics);
            },
            sendSignal: (signal: PeerSignal) => {
              if (signal.type === "rtc_ready") addMilestone("tx_rtc_ready");
              else if (signal.type === "rtc_offer") addMilestone("tx_offer");
              else if (signal.type === "rtc_answer") addMilestone("tx_answer");
              else if (signal.type === "rtc_ice") addMilestone("tx_ice");
              channelRef.current?.send({ type: "broadcast", event: signal.type, payload: signal });
            },
            iceServers,
          });
          peerRef.current = peer;

          // Flush any signals that arrived before peer was initialized
          earlySignalQueue.forEach(s => peer.handleSignal(s));
          earlySignalQueue.length = 0;

          // If P2P doesn't connect within 20s (extra time for ICE restart), abort with diagnostics
          setTimeout(async () => {
            if (!peerReadyRef.current && !abortedRef.current) {
              const diag = await peer.getDiagnostics();
              abortMatch(`WebRTC timeout 20s for match ${md.matchId}`, diag);
            }
          }, 20000);
        }
      });

    channelRef.current = channel;

    // Initialize game state AFTER data is fetched (runs in parallel with signaling)
    initGameStateFromData().then(({ weapons, boostedShip, oppShipStats, oppWeaponSlots, updatedMd }) => {
      const initial: GameState = {
        phase: "countdown",
        timer: 0,
        countdownValue: 3,
        player: {
          x: ARENA_WIDTH / 2,
          y: SHIP_Y_PLAYER,
          targetX: ARENA_WIDTH / 2,
          hp: boostedShip.hp,
          maxHp: boostedShip.hp,
          fuel: boostedShip.fuel,
          maxFuel: boostedShip.fuel,
          heat: 0,
          maxHeat: boostedShip.heat_cap,
          speed: boostedShip.speed,
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
        opponent: {
          x: ARENA_WIDTH / 2,
          y: SHIP_Y_OPPONENT,
          targetX: ARENA_WIDTH / 2,
          hp: oppShipStats.hp,
          maxHp: oppShipStats.hp,
          fuel: oppShipStats.fuel,
          maxFuel: oppShipStats.fuel,
          heat: 0,
          maxHeat: oppShipStats.heat_cap,
          speed: oppShipStats.speed,
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
        playerWeapons: weapons,
        opponentWeapons: oppWeaponSlots,
        selectedWeapon: -1,
        projectiles: [],
        perks: [],
        missileTarget: { x: 0, y: 0, active: false },
        nextPerkSpawn: PERK_SPAWN_MIN + Math.random() * (PERK_SPAWN_MAX - PERK_SPAWN_MIN),
        arenaWidth: ARENA_WIDTH,
        arenaHeight: ARENA_HEIGHT,
        xpEarned: 0,
        creditsEarned: 0,
        playerShipName: shipData.name || "AX15",
        opponentShipName: updatedMd.opponentShip,
        playerSkinColours: playerSkinRef.current?.colours,
        playerSkinId: playerSkinRef.current?.id,
        playerJetSkinColours: playerJetSkinRef.current?.colours,
        playerJetSkinId: playerJetSkinRef.current?.id,
        opponentSkinColours: opponentSkinRef.current?.colours,
        opponentSkinId: opponentSkinRef.current?.id,
        opponentJetSkinColours: opponentJetSkinRef.current?.colours,
        opponentJetSkinId: opponentJetSkinRef.current?.id,
        activeBeams: [],
        flyingPerkIcons: [],
        mineExplosions: [],
        shockwaves: [],
      };

      gameStateRef.current = initial;
      prevPlayerHpRef.current = initial.player.hp;
      prevOpponentHpRef.current = initial.opponent.hp;
      setGameState(initial);
      localArenaReadyRef.current = true;
      addMilestone("local_arena_ready");
      console.log(`[PVP][${Date.now()}] Game state initialized — arena ready`);
      // Notify remote side arena is ready (via DataChannel if open, otherwise will send on dc open)
      if (peerReadyRef.current && peerRef.current) {
        peerRef.current.send("arena_ready", {});
      }
      maybeScheduleCountdown();
    });
  };

  // Game loop
  useEffect(() => {
    if (pvpPhase !== "countdown" && pvpPhase !== "playing") return;
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

      // Countdown — both players started from the same shared timestamp, so transition deterministically
      if (gs.phase === "countdown") {
        countdownRef.current += dt / 1000;
        const val = COUNTDOWN_DURATION - Math.floor(countdownRef.current);
        gs = { ...gs, countdownValue: val };
        if (countdownRef.current >= COUNTDOWN_DURATION + 0.5) {
          gs = { ...gs, phase: "playing", countdownValue: 0 };
          setPvpPhase("playing");
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
        // Don't continue looping if game is over
        if (gs.phase === "victory" || gs.phase === "defeat") {
          setPvpPhase("result");
          return;
        }
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      // During ending phase, continue with gameplay simulation below

      const dtSec = dt / 1000;
      const input = inputRef.current;

      // Player movement
      if (!gs.player.isHeatPurging) {
        const beamLocking = gs.activeBeams.some(b => b.owner === "player" && b.active && !b.reflected);
        if (input.dragging && !beamLocking && gs.player.fuel > 0) {
          gs = { ...gs, player: { ...gs.player, targetX: input.currentX } };
        }

        const keys = keysRef.current;
        if ((keys.has("ArrowLeft") || keys.has("ArrowRight")) && !beamLocking && gs.player.fuel > 0) {
          const moveAmount = gs.player.speed * 3 * dtSec;
          let newX = gs.player.targetX;
          if (keys.has("ArrowLeft")) newX -= moveAmount;
          if (keys.has("ArrowRight")) newX += moveAmount;
          newX = Math.max(SHIP_WIDTH / 2 - 5, Math.min(ARENA_WIDTH - SHIP_WIDTH / 2 + 5, newX));
          gs = { ...gs, player: { ...gs.player, targetX: newX } };
        }

        if (keys.has("ArrowUp") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (keys.has("ArrowDown") && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        }

        if (input.swipeUpHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "dive", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (input.swipeDownHeld && gs.player.zLevel === "normal" && gs.player.fuel >= FUEL_TRIGGER_Z) {
          gs = { ...gs, player: { ...gs.player, zLevel: "soar", fuel: gs.player.fuel - FUEL_TRIGGER_Z } };
        } else if (!input.swipeUpHeld && !input.swipeDownHeld && !keys.has("ArrowUp") && !keys.has("ArrowDown") && gs.player.zLevel !== "normal") {
          gs = { ...gs, player: { ...gs.player, zLevel: "normal" } };
        }
      }

      // Shield / Ricochet — broadcast only on state change
      const selectedW = gs.playerWeapons[gs.selectedWeapon];
      const lb = lastBroadcastRef.current;

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

      // Broadcast shield state only on toggle
      const shieldChanged = gs.player.shieldActive !== lb.shieldActive || gs.player.ricochetActive !== lb.ricochetActive;
      if (shieldChanged) {
        sendGameEvent("shield", { active: gs.player.shieldActive, ricochet: gs.player.ricochetActive, isoSphere: gs.player.isoSphereActive, regenX: gs.player.regenXActive });
        lb.shieldActive = gs.player.shieldActive;
        lb.ricochetActive = gs.player.ricochetActive;
      }

      // Hold-fire — broadcast start/stop events instead of individual bullets
      const isHoldFiring = !!(selectedW && selectedW.name !== "Shield" && selectedW.name !== "Ricochet" && selectedW.name !== "IsoSphere" && selectedW.name !== "RegenX" && selectedW.name !== "Phaser"
        && selectedW.fireMode === "hold" && triggerHeldRef.current && gs.player.zLevel === "normal");

      if (isHoldFiring && !lb.holdFiring) {
        // Started hold-firing
        lb.holdFiring = true;
        lb.holdWeaponIndex = gs.selectedWeapon;
        sendGameEvent("fire_start", { weaponIndex: gs.selectedWeapon });
      } else if (!isHoldFiring && lb.holdFiring) {
        // Stopped hold-firing
        lb.holdFiring = false;
        sendGameEvent("fire_stop", {});
      }

      // Local hold-fire (still fire locally for the player)
      if (isHoldFiring) {
        const prevLen = gs.projectiles.length;
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player");
        if (gs.projectiles.length > prevLen) {
          if (selectedW!.name === "Blaster") {
            audioManager.playBlaster();
          } else {
            audioManager.playMachineGun();
          }
        }
      }

      // Simulate opponent hold-fire locally (from fire_start/fire_stop events)
      if (opponentHoldFiringRef.current.active) {
        const oppWeaponIdx = opponentHoldFiringRef.current.weaponIndex;
        const oppWeapon = gs.opponentWeapons[oppWeaponIdx];
        if (oppWeapon) {
          const prevProjLen = gs.projectiles.length;
          gs = tryFireWeapon(gs, oppWeaponIdx, "opponent");
          if (gs.projectiles.length > prevProjLen) {
            if (oppWeapon.name === "Blaster") audioManager.playBlaster();
            else if (oppWeapon.name === "Machine Gun") audioManager.playMachineGun();
          }
        }
      }

      // Broadcast position only on change (>2px delta or zLevel change) + 500ms heartbeat
      const now = performance.now();
      const posChanged = Math.abs(gs.player.targetX - lb.targetX) > 2 || gs.player.zLevel !== lb.zLevel;
      const posHeartbeatDue = now - lb.lastPositionBroadcast > 500;

      if (posChanged || posHeartbeatDue) {
        sendGameEvent("position", { x: gs.player.targetX, zLevel: gs.player.zLevel });
        lb.targetX = gs.player.targetX;
        lb.zLevel = gs.player.zLevel;
        lb.lastPositionBroadcast = now;
      }

      // Beam: broadcast start/stop only
      const playerBeam = gs.activeBeams.find(b => b.owner === "player" && !b.reflected);
      const beamNowActive = !!playerBeam;
      if (beamNowActive && !lb.beamActive) {
        sendGameEvent("beam_start", { x: playerBeam!.x, baseDmg: playerBeam!.baseDmg });
        lb.beamActive = true;
      } else if (!beamNowActive && lb.beamActive) {
        sendGameEvent("beam_stop", {});
        lb.beamActive = false;
      }

      // Update game
      const md = matchDataRef.current;
      const isHost = md?.isHost ?? false;
      const prevPerks = gs.perks;
      gs = updateGameState(gs, dt, !isHost, isHost);

      // Host: detect newly spawned perks and broadcast
      if (isHost && gs.perks.length > prevPerks.length) {
        const newPerks = gs.perks.filter((p) => !prevPerks.find((pp) => pp.id === p.id));
        for (const perk of newPerks) {
          sendGameEvent("perk_spawn", { id: perk.id, x: perk.x, y: perk.y, type: perk.type, rarity: perk.rarity });
        }
      }

      // Host: detect collected perks and broadcast
      if (isHost) {
        const collectedPerks = prevPerks.filter((p) => !gs.perks.find((pp) => pp.id === p.id));
        for (const perk of collectedPerks) {
          sendGameEvent("perk_collect", { perkId: perk.id });
        }
      }

      // Host: HP updates — only on change + 1s heartbeat
      if (isHost) {
        const hpChanged = gs.player.hp !== lb.playerHp || gs.opponent.hp !== lb.opponentHp;
        if (hpChanged) {
          sendGameEvent("hp_update", { player1Hp: gs.player.hp, player2Hp: gs.opponent.hp });
          lb.playerHp = gs.player.hp;
          lb.opponentHp = gs.opponent.hp;
        }

        if (gs.phase === "victory" || gs.phase === "defeat") {
          const winnerId = gs.phase === "victory" ? user?.id : md.opponentId;
          sendGameEvent("game_over", { winnerId });
          audioManager.stopShieldHum();
          audioManager.stopAfterburner();
          audioManager.stopPhaserBeam();
          gameStateRef.current = gs;
          setGameState({ ...gs });
          setPvpPhase("result");
          return;
        }
      }

      // Per-change fuel sync — send immediately when fuel changes by >0.5.
      // Fuel-only payload; HP is broadcast exclusively via `hp_update` above
      // to keep the host as the single source of truth for HP.
      const fuelDelta = Math.abs(gs.player.fuel - (lb.lastFuel ?? gs.player.fuel));
      if (fuelDelta > 0.5 || lb.lastFuel === undefined) {
        sendGameEvent("fuel_update", {
          fuel: gs.player.fuel,
        });
        lb.lastFuel = gs.player.fuel;
      }

      // Audio
      const anyShieldActive = gs.player.shieldActive || gs.player.ricochetActive || gs.player.isoSphereActive || gs.player.regenXActive;
      const prevAnyShield = prevShieldActiveRef.current || prevRicochetActiveRef.current;
      if (anyShieldActive && !prevAnyShield) audioManager.playShieldHum();
      else if (!anyShieldActive && prevAnyShield) audioManager.stopShieldHum();
      prevShieldActiveRef.current = gs.player.shieldActive;
      prevRicochetActiveRef.current = gs.player.ricochetActive;

      if (gs.player.shieldRecoil > prevShieldRecoilRef.current) audioManager.playRicochet();
      prevShieldRecoilRef.current = gs.player.shieldRecoil;

      if (prevPlayerHpRef.current !== null && gs.player.hp < prevPlayerHpRef.current) audioManager.playHitMarker();
      if (prevOpponentHpRef.current !== null && gs.opponent.hp < prevOpponentHpRef.current) audioManager.playHitMarker();
      prevPlayerHpRef.current = gs.player.hp;
      prevOpponentHpRef.current = gs.opponent.hp;

      const isFlaming = gs.player.flameOpacity > 0.3;
      if (isFlaming && !prevFlameRef.current) audioManager.playAfterburner();
      else if (!isFlaming && prevFlameRef.current) audioManager.stopAfterburner();
      prevFlameRef.current = isFlaming;

      // Phaser beam audio — player
      const beamCharging = gs.activeBeams.some(b => b.charging && b.owner === "player");
      if (beamCharging && !prevBeamChargingRef.current) audioManager.playPhaserCharge();
      prevBeamChargingRef.current = !!beamCharging;

      const beamActive = gs.activeBeams.some(b => b.active && b.owner === "player" && !b.reflected);
      if (beamActive && !prevBeamActiveRef.current) audioManager.playPhaserBeam();
      else if (!beamActive && prevBeamActiveRef.current) audioManager.stopPhaserBeam();
      prevBeamActiveRef.current = !!beamActive;

      // Opponent beam audio
      const oppBeamActive = gs.activeBeams.some(b => b.active && b.owner === "opponent" && !b.reflected);
      if (oppBeamActive && !prevOppBeamActiveRef.current) audioManager.playPhaserBeam();
      else if (!oppBeamActive && prevOppBeamActiveRef.current) audioManager.stopPhaserBeam();
      prevOppBeamActiveRef.current = !!oppBeamActive;

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
  }, [pvpPhase === "countdown" || pvpPhase === "playing"]);

  // Save result (server-side)
  useEffect(() => {
    if (!gameState || !user || pvpPhase !== "result") return;
    if (resultSavedRef.current) return;
    if (gameState.phase !== "victory" && gameState.phase !== "defeat") return;
    resultSavedRef.current = true;

    const saveResult = async () => {
      const isVictory = gameState.phase === "victory";

      const { data: response } = await supabase.functions.invoke("save-battle-result", {
        body: {
          battleType: "pvp",
          result: isVictory ? "victory" : "defeat",
          battleDuration: Math.round(gameState.timer),
          shipUsed: gameState.playerShipName,
          playerShipId: playerShipIdRef.current || undefined,
          matchId: matchData?.matchId,
        },
      });

      if (response) {
        setTrophiesEarned(response.trophiesEarned || 0);
        setCreditsEarned(response.creditsEarned || 0);
        if (response.levelUp) {
          setLevelUpInfo(response.levelUp);
        }
      }

      // Log PVP data usage
      if (peerRef.current && matchData?.matchId) {
        const usage = peerRef.current.getDataUsage();
        supabase.from("pvp_data_usage" as any).insert({
          match_id: matchData.matchId,
          user_id: user.id,
          bytes_sent: usage.bytesSent,
          bytes_received: usage.bytesReceived,
        }).then(({ error }) => { if (error) console.error("pvp_data_usage insert failed:", error); });
      }

      // Update quest progress (PVP-specific: wins and battles count)
      supabase.functions.invoke("update-quest-progress", {
        body: {
          win: isVictory ? 1 : 0,
          battles: 1,
          distance: Math.round(gameState.timer),
          damage: 0,
          credits: response?.creditsEarned || 0,
          xp: response?.xpEarned || 0,
        },
      });
    };

    saveResult();
  }, [pvpPhase, gameState?.phase, user]);

  // Fire weapon
  const fireWeapon = useCallback(() => {
    let gs = gameStateRef.current;
    if (!gs || gs.phase !== "playing") return;
    if (gs.player.zLevel !== "normal") return;

    const selectedW = gs.playerWeapons[gs.selectedWeapon];
    if (!selectedW) return;
    if (selectedW.name === "Shield" || selectedW.name === "Ricochet" || selectedW.name === "IsoSphere" || selectedW.name === "RegenX") return;

    if (selectedW.name === "Missile") {
      if (gs.missileTarget.active) {
        const savedTargetX = gs.missileTarget.x;
        const savedTargetY = gs.missileTarget.y;
        const prevLen = gs.projectiles.length;
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", savedTargetX, savedTargetY);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs;
        setShowSelectTarget(false);
        audioManager.playMissileLaunch();
        if (gs.projectiles.length > prevLen) {
          sendGameEvent("fire", { weaponIndex: gs.selectedWeapon, targetX: savedTargetX, targetY: savedTargetY });
        }
      } else {
        setShowSelectTarget(true);
        setTimeout(() => setShowSelectTarget(false), 2000);
      }
      return;
    }

    // Mine: needs a target (same as Missile)
    if (selectedW.name === "Mine") {
      if (gs.missileTarget.active) {
        const savedTargetX = gs.missileTarget.x;
        const savedTargetY = gs.missileTarget.y;
        const prevLen = gs.projectiles.length;
        gs = tryFireWeapon(gs, gs.selectedWeapon, "player", savedTargetX, savedTargetY);
        gs = { ...gs, missileTarget: { x: 0, y: 0, active: false } };
        gameStateRef.current = gs;
        setShowSelectTarget(false);
        audioManager.playMissileLaunch();
        if (gs.projectiles.length > prevLen) {
          sendGameEvent("fire", { weaponIndex: gs.selectedWeapon, targetX: savedTargetX, targetY: savedTargetY });
        }
      } else {
        setShowSelectTarget(true);
        setTimeout(() => setShowSelectTarget(false), 2000);
      }
      return;
    }

    // Phaser: tap to fire (creates beam)
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
      if ((gs.shockwaves || []).length > prevSw) {
        audioManager.playRadixFire(); audioManager.playRadixShockwave();
        sendGameEvent("shockwave", { x: gs.player.x, dmg: selectedW.dmg, maxRadius: RADIX_SHOCKWAVE_MAX_RADIUS });
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
        } else {
          audioManager.playCannon();
        }
        sendGameEvent("fire", { weaponIndex: gs.selectedWeapon });
      }
      gameStateRef.current = gs;
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key >= "1" && e.key <= "4") handleSelectWeapon(parseInt(e.key) - 1);
      if (e.key === " ") {
        e.preventDefault();
        triggerHeldRef.current = true;
        fireWeapon();
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
        // Target already set — fire if tapping near ship
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
    if (mode === "pro") {
      const dx = Math.abs(x - gs.player.x);
      const dy = Math.abs(y - gs.player.y);
      if (dx < 40 && dy < 50) {
        triggerHeldRef.current = true;
        fireWeapon();
        if (selectedW.fireMode === "tap") {
          triggerHeldRef.current = false;
          triggerFiredRef.current = false;
        }
      }
    }
    if (mode === "pro_loose") {
      if (y > ARENA_HEIGHT / 2) {
        triggerHeldRef.current = true;
        fireWeapon();
        if (selectedW.fireMode === "tap") {
          triggerHeldRef.current = false;
          triggerFiredRef.current = false;
        }
      }
    }
  }, [fireWeapon]);

  const handleCanvasPointerUp = useCallback(() => {
    const mode = controlModeRef.current;
    if (mode === "pro" || mode === "pro_loose") {
      triggerHeldRef.current = false;
      triggerFiredRef.current = false;
    }
  }, []);

  const handleSelectWeapon = useCallback((index: number) => {
    const gs = gameStateRef.current;
    if (!gs || index >= gs.playerWeapons.length) return;
    gameStateRef.current = {
      ...gs,
      selectedWeapon: index,
      missileTarget: { x: 0, y: 0, active: false },
      player: { ...gs.player, shieldActive: false, ricochetActive: false, isoSphereActive: false, regenXActive: false },
    };
    setGameState({ ...gameStateRef.current });
    setShowSelectTarget(false);
  }, []);

  // Reset found anim phase when entering "found"
  useEffect(() => {
    if (pvpPhase !== "found") {
      setFoundAnimPhase("enter");
      foundAnimDoneRef.current = false;
      readyToTransitionRef.current = false;
      return;
    }
    const vsTimer = setTimeout(() => setFoundAnimPhase("vs"), 700);
    const burstTimer = setTimeout(() => setFoundAnimPhase("burst"), 2200);
    const doneTimer = setTimeout(() => {
      foundAnimDoneRef.current = true;
      // If ready handshake already completed, transition now
      if (readyToTransitionRef.current) {
        setPvpPhase("countdown");
      }
    }, 2700);
    return () => { clearTimeout(vsTimer); clearTimeout(burstTimer); clearTimeout(doneTimer); };
  }, [pvpPhase]);

  // ─── SEARCHING SCREEN ───
  if (pvpPhase === "searching") {
    return (
      <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <StarField />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-2 border-primary/30 animate-ping absolute inset-0" />
            <div className="h-24 w-24 rounded-full border-2 border-primary/50 flex items-center justify-center">
              <Crosshair className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-display text-xl tracking-widest text-foreground">SEARCHING</h2>
            <p className="font-body text-sm text-muted-foreground">Looking for opponent...</p>
            <p className="font-display text-xs text-primary">{searchTime}s</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="font-display text-xs tracking-wider"
          >
            CANCEL
          </Button>
        </div>
      </div>
    );
  }

  // ─── FOUND / PRE-BATTLE ───
  if (pvpPhase === "found" && matchData) {
    const animPhase = foundAnimPhase;

    const slideStyle = (index: number, side: "left" | "right"): React.CSSProperties => {
      if (animPhase === "burst") {
        return { animation: "burstOut 0.5s ease-in forwards" };
      }
      const anim = side === "left" ? "slideInLeft" : "slideInRight";
      return {
        opacity: 0,
        animation: `${anim} 0.5s ease-out ${index * 0.15}s forwards`,
      };
    };

    const opponentWeapons = matchData.opponentWeapons.length > 0
      ? matchData.opponentWeapons
      : [{ name: "Shield" }, { name: "Shield" }, { name: "Shield" }, { name: "Shield" }];

    return (
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <StarField />
        <div className="relative z-10 flex items-center justify-center w-full px-4 gap-3 md:gap-8 max-w-screen">

          {/* Player side */}
          <div className="flex flex-col items-center gap-3 md:gap-4 flex-1 min-w-0">
            <div style={slideStyle(0, "left")}>
              <div className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center overflow-hidden shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                {playerAvatarImg ? (
                  <img src={playerAvatarImg} alt="You" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-2xl md:text-3xl text-primary">{playerName[0]?.toUpperCase()}</span>
                )}
              </div>
            </div>
            <div style={slideStyle(1, "left")}>
              <span className="font-display text-xs md:text-base tracking-widest text-foreground truncate max-w-[100px] md:max-w-[200px] block text-center">{playerName}</span>
            </div>
            <div style={slideStyle(2, "left")}>
              <ShipDisplay shipName={playerShipName} skinColours={playerSkinRef.current?.colours} jetSkinColours={playerJetSkinRef.current?.colours} className="h-16 w-16 md:h-24 md:w-24" />
            </div>
            <div className="flex gap-1.5 md:gap-2" style={slideStyle(3, "left")}>
              {playerWeaponNames.map((w, i) => (
                <div key={i} className="w-8 h-8 md:w-12 md:h-12 rounded-lg border border-border/40 bg-card/60 overflow-hidden shadow-md">
                  <GameImage src={weaponImages[w.name]} alt={w.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {/* VS */}
          <div className="shrink-0" style={animPhase === "burst" ? { animation: "burstOut 0.5s ease-in forwards" } : {}}>
            {animPhase !== "enter" && (
              <span className="font-display text-4xl md:text-7xl text-destructive glow-text"
                    style={{
                      animation: "vsAppear 0.4s ease-out forwards",
                      textShadow: "0 0 30px hsl(var(--destructive) / 0.6), 0 0 60px hsl(var(--destructive) / 0.3)",
                    }}>
                VS
              </span>
            )}
          </div>

          {/* Opponent side */}
          <div className="flex flex-col items-center gap-3 md:gap-4 flex-1 min-w-0">
            <div style={slideStyle(0, "right")}>
              <div className="h-16 w-16 md:h-24 md:w-24 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center overflow-hidden shadow-[0_0_20px_hsl(var(--destructive)/0.3)]">
                {opponentAvatarImg ? (
                  <GameImage src={opponentAvatarImg} alt="Opponent" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-2xl md:text-3xl text-destructive">{matchData.opponentName[0]?.toUpperCase()}</span>
                )}
              </div>
            </div>
            <div style={slideStyle(1, "right")}>
              <span className="font-display text-xs md:text-base tracking-widest text-foreground truncate max-w-[100px] md:max-w-[200px] block text-center">{matchData.opponentName}</span>
            </div>
            <div style={slideStyle(2, "right")}>
              <ShipDisplay shipName={matchData.opponentShip} skinColours={opponentSkinRef.current?.colours} jetSkinColours={opponentJetSkinRef.current?.colours} className="h-16 w-16 md:h-24 md:w-24" />
            </div>
            <div className="flex gap-1.5 md:gap-2" style={slideStyle(3, "right")}>
              {opponentWeapons.map((w: any, i: number) => (
                <div key={i} className="w-8 h-8 md:w-12 md:h-12 rounded-lg border border-border/40 bg-card/60 overflow-hidden shadow-md">
                  <GameImage src={weaponImages[w.name]} alt={w.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ───
  if (pvpPhase === "result" && gameState) {
    const isVictory = gameState.phase === "victory";
    return (
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <StarField />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-10 backdrop-blur-sm"
          style={{
            background: "linear-gradient(to bottom, hsla(222,47%,4%,0.65), hsla(199,89%,48%,0.65))",
          }}
        />

        <div className={`absolute inset-[30px] z-20 flex flex-col items-center justify-between rounded-xl border-2 bg-card/80 backdrop-blur-md p-6 text-center ${
          isVictory
            ? "border-primary/60 shadow-[0_0_40px_hsla(199,89%,48%,0.3),inset_0_0_40px_hsla(199,89%,48%,0.05)]"
            : "border-destructive/60 shadow-[0_0_40px_hsla(0,72%,51%,0.3),inset_0_0_40px_hsla(0,72%,51%,0.05)]"
        }`}>
          {/* Top spacer */}
          <div />

          {/* Center content */}
          <div className="flex flex-col items-center gap-6">
            {/* Icon with glow */}
            <div className="relative">
              <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
                isVictory ? "bg-primary/30" : "bg-destructive/30"
              }`} />
              {isVictory ? (
                <Trophy className="relative h-20 w-20 text-game-success drop-shadow-[0_0_20px_hsla(142,71%,45%,0.5)]" />
              ) : (
                <Skull className="relative h-20 w-20 text-game-hp drop-shadow-[0_0_20px_hsla(0,72%,51%,0.5)]" />
              )}
            </div>

            <h2 className="font-display text-4xl tracking-[0.2em] glow-text">
              {isVictory ? "VICTORY" : "DEFEAT"}
            </h2>

            <div className="space-y-3 font-body text-base text-muted-foreground">
              <p>Time: <span className="text-foreground font-display">{Math.floor(gameState.timer)}s</span></p>
              <p>XP Earned: <span className="text-primary font-display">{isVictory ? 50 : 10}</span></p>
              {creditsEarned > 0 && (
                <p className="flex items-center justify-center gap-2">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  <span className="text-yellow-400 font-display text-lg">+{creditsEarned} Credits</span>
                </p>
              )}
              <p className="flex items-center justify-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span className={`font-display text-lg ${trophiesEarned >= 0 ? "text-amber-400" : "text-destructive"}`}>
                  {trophiesEarned >= 0 ? `+${trophiesEarned}` : trophiesEarned} Trophies
                </span>
              </p>
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => {
                const action = async () => {
                  // Mark old match as completed to prevent stale re-matching
                  if (matchData) {
                    await supabase.from("pvp_matches")
                      .update({ status: "completed" } as any)
                      .eq("id", matchData.matchId);
                  }
                  setMatchData(null);
                  setGameState(null);
                  gameStateRef.current = null;
                  resultSavedRef.current = false;
                  setTrophiesEarned(0);
                  setCreditsEarned(0);
                  setSearchTime(0);
                  setOpponentAvatarImg(null);
                  lastTimeRef.current = 0;
                  countdownRef.current = 0;
                  countdownDoneLocalRef.current = false;
                  countdownDoneRemoteRef.current = false;
                  localDcOpenRef.current = false;
                  remoteDcOpenRef.current = false;
                  countdownAtRef.current = 0;
                  abortedRef.current = false;
                  if (peerRef.current) {
                    peerRef.current.close();
                    peerRef.current = null;
                    peerReadyRef.current = false;
                  }
                  if (channelRef.current) {
                    supabase.removeChannel(channelRef.current);
                    channelRef.current = null;
                  }
                  musicManager.switchBattle();
                  setMatchGeneration(g => g + 1);
                  setPvpPhase("searching");
                };
                if (levelUpInfo && !showLevelUpScreen) {
                  pendingActionRef.current = action;
                  setShowLevelUpScreen(true);
                } else {
                  action();
                }
              }}
              className="w-full font-display tracking-[0.15em] text-base py-6"
              size="lg"
            >
              PLAY AGAIN
            </Button>
            <Button variant="outline" onClick={() => {
              const action = () => navigate("/");
              if (levelUpInfo && !showLevelUpScreen) {
                pendingActionRef.current = action;
                setShowLevelUpScreen(true);
              } else {
                action();
              }
            }} className="w-full font-display tracking-[0.15em] text-base py-6" size="lg">
              EXIT
            </Button>
          </div>
        </div>
        {emoteLoadout.length > 0 && (
          <EmoteOverlay
            emoteLoadout={emoteLoadout}
            onSendEmote={(emote) => {
              sendGameEvent("emote", { id: emote.id, name: emote.name, image_url: emote.image_url });
            }}
            incomingEmote={incomingEmote}
          />
        )}
        {showLevelUpScreen && levelUpInfo && (
          <LevelUpScreen
            oldLevel={levelUpInfo.oldLevel}
            oldXp={levelUpInfo.oldXp}
            newLevel={levelUpInfo.newLevel}
            newXp={levelUpInfo.newXp}
            bonusStar={levelUpInfo.bonusStar}
            onContinue={() => {
              setShowLevelUpScreen(false);
              setLevelUpInfo(null);
              if (pendingActionRef.current) {
                pendingActionRef.current();
                pendingActionRef.current = null;
              }
            }}
          />
        )}
      </div>
    );
  }

  // ─── CONNECTING / LOADING OVERLAY ───
  if (!gameState || (pvpPhase !== "countdown" && pvpPhase !== "playing" && pvpPhase !== "result")) {
    return (
      <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <StarField />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="font-display text-sm tracking-[0.2em] text-primary animate-pulse">
            ESTABLISHING CONNECTION
          </p>
          <p className="font-body text-xs text-muted-foreground">
            Setting up direct link…
          </p>
        </div>
      </div>
    );
  }

  const heatPercent = gameState.player.isHeatPurging
    ? (gameState.player.heatPurgeTimer / HEAT_PURGE_DURATION) * 100
    : Math.max(0, (gameState.player.heat / gameState.player.maxHeat) * 100);

  const heatColor = heatPercent >= 90
    ? "hsl(0, 72%, 51%)"
    : heatPercent >= 50
      ? "hsl(30, 90%, 50%)"
      : "hsl(142, 71%, 45%)";

  const showTriggerButton = controlMode === "default";

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
              <span className="font-display text-[9px] text-primary">{playerName[0]?.toUpperCase()}</span>
            )}
          </div>
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">{playerName}</span>
        </div>
        {/* Center: Timer */}
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] text-muted-foreground">{Math.floor(gameState.timer)}s</span>
        </div>
        {/* Right: Opponent + Menu */}
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[9px] tracking-wider text-muted-foreground">{matchData?.opponentName || "OPP"}</span>
          <div className="h-7 w-7 rounded-full bg-destructive/30 flex items-center justify-center border border-destructive/40 overflow-hidden">
            {opponentAvatarImg ? (
              <img src={opponentAvatarImg} alt="Opponent" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-[9px] text-destructive">{(matchData?.opponentName || "O")[0]?.toUpperCase()}</span>
            )}
          </div>
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
        {["countdown", "playing", "ending"].includes(gameState.phase) && emoteLoadout.length > 0 && (
          <EmoteOverlay
            emoteLoadout={emoteLoadout}
            onSendEmote={(emote) => {
              sendGameEvent("emote", { id: emote.id, name: emote.name, image_url: emote.image_url });
            }}
            incomingEmote={incomingEmote}
          />
        )}
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
      </div>

      {/* Heat */}
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

      {/* Armoury — fills remaining space */}
      <div className="grid grid-cols-4 gap-1 px-2 pb-1 flex-1 min-h-0 items-center">
        {gameState.playerWeapons.map((w, i) => {
          const isSelected = gameState.selectedWeapon === i;
          const onCooldown = w.currentCooldown > 0;
          const isDisabled = gameState.player.zLevel !== "normal";
          return (
            <button
              key={w.slot}
              onClick={() => handleSelectWeapon(i)}
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
              <button onClick={() => setSettingsOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* SFX Volume */}
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-muted-foreground" /><span className="font-display text-[10px] tracking-wider text-muted-foreground">SFX VOLUME</span></div>
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(val) => { const v = val[0] / 100; setVolume(v); audioManager.setVolume(v); }} />
            </div>

            {/* Music */}
            <MusicControls />

            {/* Trigger Placement */}
            {controlMode === "default" && (
              <div className="space-y-2">
                <span className="font-display text-[10px] tracking-wider text-muted-foreground">TRIGGER PLACEMENT</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTriggerSide("left")}
                    className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                      triggerSide === "left"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 bg-card/50 text-muted-foreground"
                    }`}
                  >
                    LEFT
                  </button>
                  <button
                    onClick={() => setTriggerSide("right")}
                    className={`flex-1 rounded-lg border px-3 py-2 font-display text-[10px] tracking-wider transition-all ${
                      triggerSide === "right"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 bg-card/50 text-muted-foreground"
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
                  { value: "default" as ControlMode, label: "DEFAULT", desc: "Tap trigger button to fire" },
                  { value: "pro" as ControlMode, label: "PRO", desc: "Tap ship to fire" },
                  { value: "pro_loose" as ControlMode, label: "PRO LOOSE", desc: "Tap lower half to fire & move" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={async () => {
                      setControlMode(opt.value);
                      controlModeRef.current = opt.value;
                      if (user) {
                        await supabase.from("profiles").update({ control_mode: opt.value } as any).eq("id", user.id);
                      }
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      controlMode === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border/30 bg-card/50"
                    }`}
                  >
                    <span className={`font-display text-[10px] tracking-wider ${controlMode === opt.value ? "text-primary" : "text-muted-foreground"}`}>
                      {opt.label}
                    </span>
                    <p className="font-body text-[9px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Resign */}
            <button onClick={() => navigate("/")} className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 font-display text-[10px] tracking-wider text-destructive hover:bg-destructive/20 transition-all">
              RESIGN
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PvpBattle;
