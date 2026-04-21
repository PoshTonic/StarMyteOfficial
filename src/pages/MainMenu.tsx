import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Swords, Map, Award, CalendarCheck, ScrollText } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import ShipDisplay from "@/components/ShipDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SkinColourMap } from "@/game/skinUtils";
import { requireAuth } from "@/lib/requireAuth";

interface OutletCtx {
  introMode?: boolean;
}

const EASTER_EGG_CLICKS = 13;

const MainMenu = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { introMode } = useOutletContext<OutletCtx>() || {};
  const [playerShips, setPlayerShips] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skinColourMap, setSkinColourMap] = useState<Record<string, SkinColourMap>>({});

  // Easter egg state
  const [eggClicks, setEggClicks] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [eggTriggered, setEggTriggered] = useState(false);
  const [ownsZZ11, setOwnsZZ11] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const shipAreaRef = useRef<HTMLDivElement>(null);

  const isGuest = !user;
  const currentPlayerShip = playerShips[currentIndex];
  // Guest mode shows a default AX15 with no skins
  const ship = isGuest ? { name: "AX15" } : currentPlayerShip?.ships;

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: ships } = await supabase
      .from("player_ships")
      .select("*, ships(*)")
      .eq("user_id", user.id)
      .order("created_at");

    if (ships && ships.length > 0) {
      setPlayerShips(ships);
      const activeIdx = ships.findIndex((s: any) => s.is_active);
      setCurrentIndex(activeIdx >= 0 ? activeIdx : 0);

      const activeSkinIds = [...new Set([
        ...ships.map((s: any) => s.active_skin_id),
        ...ships.map((s: any) => s.active_jet_skin_id),
      ].filter(Boolean))];
      if (activeSkinIds.length > 0) {
        const { data: skinData } = await supabase.from("skins").select("id, colours").in("id", activeSkinIds);
        const map: Record<string, SkinColourMap> = {};
        (skinData || []).forEach((s: any) => { map[s.id] = s.colours as SkinColourMap; });
        setSkinColourMap(map);
      }

      // Check if player already owns ZZ11
      const hasZZ11 = ships.some((s: any) => s.ships?.name === "ZZ11");
      setOwnsZZ11(hasZZ11);
      if (hasZZ11) setEggTriggered(true);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset clicks if user clicks anywhere that's NOT the ship area
  useEffect(() => {
    if (eggTriggered || ownsZZ11 || isGuest) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (shipAreaRef.current && !shipAreaRef.current.contains(e.target as Node)) {
        setEggClicks(0);
      }
    };
    document.addEventListener("click", handleGlobalClick, true);
    return () => document.removeEventListener("click", handleGlobalClick, true);
  }, [eggTriggered, ownsZZ11, isGuest]);

  const handleShipClick = useCallback(async () => {
    if (eggTriggered || ownsZZ11 || shaking || isGuest) return;

    const newCount = eggClicks + 1;
    setEggClicks(newCount);

    const isFinal = newCount >= EASTER_EGG_CLICKS;
    const radius = isFinal ? 250 : newCount * 10;
    const duration = isFinal ? 1.5 : 0.5;

    const el = shipAreaRef.current;
    if (el) {
      el.style.setProperty("--shake-radius", `${radius}px`);
      el.style.setProperty("--shake-duration", `${duration}s`);
    }

    setShaking(true);

    setTimeout(() => {
      setShaking(false);
      if (isFinal) {
        setShowReveal(true);
        if (user) {
          supabase.functions.invoke("grant-easter-egg", {
            body: { shipName: "ZZ11" },
          }).then(() => {
            setEggTriggered(true);
          });
        }

        setTimeout(() => {
          setShowReveal(false);
          const hangarEl = document.querySelector('[data-nav="HANGAR"]');
          if (hangarEl) {
            hangarEl.classList.add("nav-recoil");
            setTimeout(() => hangarEl.classList.remove("nav-recoil"), 500);
          }
        }, 2500);
      }
    }, duration * 1000);
  }, [eggClicks, eggTriggered, ownsZZ11, shaking, user, isGuest]);

  // Intro animation helper
  const intro = (cls: string) => introMode ? cls : "";

  const eggActive = !eggTriggered && !ownsZZ11 && !isGuest;

  const leftTray = [
    { label: "DAILY", icon: CalendarCheck, path: "/daily-login", color: "text-emerald-400" },
    { label: "QUESTS", icon: ScrollText, path: "/quests", color: "text-sky-400" },
  ];
  const rightTray = [
    { label: "TROPHIES", icon: Map, path: "/trophy-road", color: "text-amber-400" },
    { label: "PASS", icon: Award, path: "/battle-pass", color: "text-purple-400" },
  ];

  return (
    <div className="relative h-full w-full">
      {/* Engagement trays — visible to everyone; gated routes redirect guests to /auth */}
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 ${intro("intro-fade-in intro-delay-2250")}`}>
        {leftTray.map((item) => (
          <button
            key={item.path}
            onClick={() => requireAuth(user, navigate, item.path) && navigate(item.path)}
            className="glass-panel flex flex-col items-center justify-center gap-1 w-16 py-2 transition-all hover:border-primary/40"
          >
            <item.icon className={`h-6 w-6 ${item.color}`} />
            <span className="font-display text-[9px] tracking-wider text-foreground">{item.label}</span>
          </button>
        ))}
      </div>

      <div className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 ${intro("intro-fade-in intro-delay-2250")}`}>
        {rightTray.map((item) => (
          <button
            key={item.path}
            onClick={() => requireAuth(user, navigate, item.path) && navigate(item.path)}
            className="glass-panel flex flex-col items-center justify-center gap-1 w-16 py-2 transition-all hover:border-primary/40"
          >
            <item.icon className={`h-6 w-6 ${item.color}`} />
            <span className="font-display text-[9px] tracking-wider text-foreground">{item.label}</span>
          </button>
        ))}
      </div>


      {/* Logo + Subtitle */}
      <div className={`absolute top-[14vh] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center ${intro("intro-fade-in intro-delay-250")}`}>
        <h1 className="font-display text-4xl font-black tracking-widest text-primary glow-text md:text-6xl">
          STARMYTE
        </h1>
        <p className={`mt-1 font-body text-sm text-muted-foreground tracking-wide ${intro("intro-fade-in intro-delay-750")}`}>
          Space Combat Arena
        </p>
      </div>

      {/* Ship carousel (or guest preview) */}
      {ship && (
        <div className={`absolute top-1/2 left-1/2 ${introMode ? "intro-slide-up-ship" : "-translate-x-1/2 -translate-y-1/2"}`}>
          <div className="flex items-center gap-2">
            {!isGuest && (
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex <= 0}
                className={`p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all ${intro("intro-fade-in intro-delay-2250")}`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <div className="flex flex-col items-center">
              <div
                ref={shipAreaRef}
                onClick={eggActive ? handleShipClick : undefined}
                className={`relative flex h-36 w-36 items-center justify-center animate-float ${
                  eggActive ? "cursor-pointer" : ""
                } ${shaking ? "ship-shake" : ""}`}
              >
                <div className={`absolute inset-0 rounded-full bg-primary/10 animate-pulse-glow ${intro("intro-fade-in intro-delay-2250")}`} />
                <div className="relative z-10">
                  <ShipDisplay
                    shipName={ship.name}
                    className="h-28 w-28"
                    skinColours={!isGuest && currentPlayerShip?.active_skin_id ? skinColourMap[currentPlayerShip.active_skin_id] : undefined}
                    jetSkinColours={!isGuest && currentPlayerShip?.active_jet_skin_id ? skinColourMap[currentPlayerShip.active_jet_skin_id] : undefined}
                  />
                </div>
              </div>
              <span className="font-display text-sm tracking-wider text-foreground mt-1">{ship.name}</span>
              {!isGuest && (
                <p className="font-body text-[10px] text-muted-foreground">{currentIndex + 1} / {playerShips.length}</p>
              )}
              {isGuest && (
                <p className="font-body text-[10px] text-muted-foreground">Guest pilot</p>
              )}
            </div>
            {!isGuest && (
              <button
                onClick={() => setCurrentIndex(Math.min(playerShips.length - 1, currentIndex + 1))}
                disabled={currentIndex >= playerShips.length - 1}
                className={`p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all ${intro("intro-fade-in intro-delay-2250")}`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Battle button */}
      <div className={`absolute bottom-[17.5vh] left-1/2 ${introMode ? "intro-slide-up-battle" : "-translate-x-1/2 translate-y-1/2"}`}>
        <button
          onClick={() => navigate("/battle")}
          className="group relative flex items-center gap-3 px-10 py-4 rounded-full bg-primary font-display text-lg tracking-widest text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.7)] transition-all animate-pulse-glow"
        >
          <Swords className="h-6 w-6" />
          BATTLE
        </button>
      </div>

      {/* ZZ11 Reveal Overlay */}
      {showReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <div className="zz11-reveal flex flex-col items-center">
            <div className="h-40 w-40 rounded-full bg-background border-2 border-primary shadow-[0_0_60px_hsl(var(--primary)/0.8)] flex items-center justify-center">
              <ShipDisplay shipName="ZZ11" className="h-28 w-28" />
            </div>
            <span className="font-display text-lg tracking-wider text-primary mt-4 glow-text">ZZ11 UNLOCKED!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
