import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STAGE_DEFS, LEVEL_DEFS } from "@/game/campaignData";
import { AlertTriangle, Star, Trophy, Wifi } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Analytics = () => {
  const [battlesPerDay, setBattlesPerDay] = useState<any[]>([]);
  const [pvpBattlesPerDay, setPvpBattlesPerDay] = useState<any[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [playersOverTime, setPlayersOverTime] = useState<any[]>([]);
  const [errorsPerDay, setErrorsPerDay] = useState<any[]>([]);
  const [errorLog, setErrorLog] = useState<any[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [topPilotsByStage, setTopPilotsByStage] = useState<any[]>([]);
  const [stageCompletionMap, setStageCompletionMap] = useState<Record<string, number>>({});
  const [pvpTransportData, setPvpTransportData] = useState<any[]>([]);
  const [monthlyDataUsage, setMonthlyDataUsage] = useState<{ totalBytes: number; matchCount: number }>({ totalBytes: 0, matchCount: 0 });
  const [latestMatchUsage, setLatestMatchUsage] = useState<{ bytesSent: number; bytesReceived: number; matchId: string; createdAt: string } | null>(null);

  useEffect(() => {
    const load = async () => {
    const [{ data: battles }, { data: profiles }, { data: errors }, { data: campaignProgress }, { data: pvpMatches }] = await Promise.all([
        supabase.from("battle_results").select("*"),
        supabase.from("profiles").select("id, display_name, avatar_url, created_at"),
        supabase.from("app_errors").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("campaign_progress").select("*"),
        supabase.from("pvp_matches").select("id, created_at"),
      ]);

      // --- Battles per day (last 14 days) ---
      const dayMap: Record<string, number> = {};
      const pvpDayMap: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        dayMap[d] = 0;
        pvpDayMap[d] = 0;
      }
      (battles || []).forEach((b: any) => {
        const d = format(new Date(b.created_at), "MMM d");
        if (d in dayMap) dayMap[d]++;
        if (b.battle_type === "pvp" && d in pvpDayMap) pvpDayMap[d]++;
      });
      setBattlesPerDay(Object.entries(dayMap).map(([date, count]) => ({ date, battles: count })));
      setPvpBattlesPerDay(Object.entries(pvpDayMap).map(([date, count]) => ({ date, battles: count })));

      // --- Top players by wins ---
      const winMap: Record<string, { name: string; wins: number }> = {};
      (battles || []).forEach((b: any) => {
        if (b.result === "victory") {
          if (!winMap[b.user_id]) {
            const p = (profiles || []).find((pp: any) => pp.id === b.user_id);
            winMap[b.user_id] = { name: p?.display_name || "Pilot", wins: 0 };
          }
          winMap[b.user_id].wins++;
        }
      });
      setTopPlayers(
        Object.values(winMap)
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 10)
      );

      // --- Players over time ---
      const sortedProfiles = [...(profiles || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const playerDays: any[] = [];
      for (let i = 13; i >= 0; i--) {
        const day = startOfDay(subDays(new Date(), i));
        const count = sortedProfiles.filter(
          (p) => new Date(p.created_at) <= new Date(day.getTime() + 86400000)
        ).length;
        playerDays.push({ date: format(day, "MMM d"), players: count });
      }
      setPlayersOverTime(playerDays);

      // --- Errors per day ---
      const errDayMap: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        errDayMap[d] = 0;
      }
      (errors || []).forEach((e: any) => {
        const d = format(new Date(e.created_at), "MMM d");
        if (d in errDayMap) errDayMap[d]++;
      });
      setErrorsPerDay(Object.entries(errDayMap).map(([date, count]) => ({ date, errors: count })));
      setErrorLog(errors || []);

      // --- Stage Completion ---
      const fiveStarProgress = (campaignProgress || []).filter((cp: any) => cp.stars === 5);

      // Top 10 pilots by 5-star completions
      const pilotStarCount: Record<string, { count: number; maxStage: number; maxLevel: number }> = {};
      fiveStarProgress.forEach((cp: any) => {
        if (!pilotStarCount[cp.user_id]) {
          pilotStarCount[cp.user_id] = { count: 0, maxStage: 0, maxLevel: 0 };
        }
        pilotStarCount[cp.user_id].count++;
        if (cp.stage > pilotStarCount[cp.user_id].maxStage ||
          (cp.stage === pilotStarCount[cp.user_id].maxStage && cp.level > pilotStarCount[cp.user_id].maxLevel)) {
          pilotStarCount[cp.user_id].maxStage = cp.stage;
          pilotStarCount[cp.user_id].maxLevel = cp.level;
        }
      });
      const topPilots = Object.entries(pilotStarCount)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([userId, data]) => {
          const profile = (profiles || []).find((p: any) => p.id === userId);
          return {
            userId,
            name: profile?.display_name || "Pilot",
            avatar: profile?.avatar_url,
            fiveStarCount: data.count,
            maxStage: data.maxStage,
            maxLevel: data.maxLevel,
          };
        });
      setTopPilotsByStage(topPilots);

      // Stage completion map: unique user_ids per (stage, level) with 5 stars
      const compMap: Record<string, Set<string>> = {};
      fiveStarProgress.forEach((cp: any) => {
        const key = `${cp.stage}-${cp.level}`;
        if (!compMap[key]) compMap[key] = new Set();
        compMap[key].add(cp.user_id);
      });
      const countMap: Record<string, number> = {};
      Object.entries(compMap).forEach(([key, set]) => {
        countMap[key] = set.size;
      });
      setStageCompletionMap(countMap);

      // --- PVP Transport: WebRTC P2P vs Failed (last 14 days) ---
      const transportMap: Record<string, { webrtc: number; failed: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        transportMap[d] = { webrtc: 0, failed: 0 };
      }
      // Count total PVP matches per day (all assumed WebRTC P2P)
      (pvpMatches || []).forEach((m: any) => {
        const d = format(new Date(m.created_at), "MMM d");
        if (d in transportMap) transportMap[d].webrtc++;
      });
      // Deduplicate failed connections by match ID (both players may log one)
      const failedByDay: Record<string, Set<string>> = {};
      (errors || []).filter((e: any) => e.error_type === "webrtc_fallback" || e.error_type === "webrtc_failed").forEach((e: any) => {
        const d = format(new Date(e.created_at), "MMM d");
        if (d in transportMap) {
          const matchId = e.error_message?.match(/match ([a-f0-9-]+)/)?.[1] || e.id;
          if (!failedByDay[d]) failedByDay[d] = new Set();
          failedByDay[d].add(matchId);
        }
      });
      Object.entries(failedByDay).forEach(([d, matchIds]) => {
        transportMap[d].failed = matchIds.size;
        transportMap[d].webrtc = Math.max(0, transportMap[d].webrtc - matchIds.size);
      });
      setPvpTransportData(Object.entries(transportMap).map(([date, v]) => ({ date, ...v })));

      // --- PVP Data Usage (current month) ---
      const monthStart = startOfMonth(new Date()).toISOString();
      const { data: usageRows } = await supabase
        .from("pvp_data_usage" as any)
        .select("*")
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false });

      if (usageRows && usageRows.length > 0) {
        // Aggregate by match_id to avoid double-counting (both players log)
        const matchTotals = new Map<string, number>();
        (usageRows as any[]).forEach((r: any) => {
          const existing = matchTotals.get(r.match_id) || 0;
          matchTotals.set(r.match_id, existing + (r.bytes_sent || 0) + (r.bytes_received || 0));
        });
        const totalBytes = Array.from(matchTotals.values()).reduce((a, b) => a + b, 0);
        setMonthlyDataUsage({ totalBytes, matchCount: matchTotals.size });

        // Latest match
        const latest = usageRows[0] as any;
        setLatestMatchUsage({
          bytesSent: latest.bytes_sent || 0,
          bytesReceived: latest.bytes_received || 0,
          matchId: latest.match_id,
          createdAt: latest.created_at,
        });
      }
    };
    load();
  }, []);

  const totalErrors = errorsPerDay.reduce((sum, d) => sum + d.errors, 0);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-full lg:max-w-5xl">
        <h1 className="font-display text-2xl tracking-wider text-primary glow-text">ANALYTICS</h1>

        {/* Row 1: Battles + Players */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">BATTLES PER DAY</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={battlesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                  <Bar dataKey="battles" fill="hsl(199 89% 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">TOTAL PLAYERS</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={playersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="players" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: PVP Battles + PVP Transport */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">PVP BATTLES PER DAY</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pvpBattlesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                  <Bar dataKey="battles" fill="hsl(260 60% 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">PVP TRANSPORT — P2P CONNECTION</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pvpTransportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                  <Bar dataKey="webrtc" stackId="transport" fill="hsl(142 71% 45%)" name="WebRTC P2P" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="transport" fill="hsl(0 84% 60%)" name="Failed (Aborted)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2.5: PVP Data Usage */}
        {(() => {
          const QUOTA_MB = 500;
          const usedMB = monthlyDataUsage.totalBytes / (1024 * 1024);
          const pct = Math.min((usedMB / QUOTA_MB) * 100, 100);
          const barColor = pct >= 80 ? "bg-destructive" : pct >= 50 ? "bg-yellow-500" : "bg-primary";
          return (
            <Card className="bg-card/60 border-border/30">
              <CardHeader>
                <CardTitle className="font-display text-sm tracking-wider text-muted-foreground flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  PVP DATA USAGE (TURN RELAY)
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {monthlyDataUsage.matchCount} matches this month
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Monthly Total</span>
                    <span className="text-sm font-mono">{usedMB.toFixed(2)} MB / {QUOTA_MB} MB</span>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all rounded-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% of free tier used</p>
                </div>

                {latestMatchUsage ? (
                  <div className="p-3 rounded-md bg-muted/20 border border-border/20">
                    <p className="text-xs text-muted-foreground mb-1">Latest Match</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span>↑ <span className="font-mono">{(latestMatchUsage.bytesSent / 1024).toFixed(1)} KB</span> sent</span>
                      <span>↓ <span className="font-mono">{(latestMatchUsage.bytesReceived / 1024).toFixed(1)} KB</span> received</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(latestMatchUsage.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{latestMatchUsage.matchId}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No PVP data usage recorded yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Row 3: Errors */}
        <Card
          className="bg-card/60 border-border/30 cursor-pointer hover:border-destructive/50 transition-colors"
          onClick={() => setShowErrorDialog(true)}
        >
          <CardHeader>
            <CardTitle className="font-display text-sm tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              TOTAL ERRORS
              {totalErrors > 0 && (
                <span className="ml-auto text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
                  {totalErrors} last 14d
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={errorsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="errors" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">Click to view error log</p>
          </CardContent>
        </Card>

        {/* Top Pilots by Wins */}
        <Card className="bg-card/60 border-border/30">
          <CardHeader>
            <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">TOP PILOTS BY WINS</CardTitle>
          </CardHeader>
          <CardContent>
            {topPlayers.length === 0 ? (
              <p className="text-muted-foreground text-sm font-body">No battle data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topPlayers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 20%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(215 20% 55%)" width={80} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 20%)", borderRadius: 8 }} />
                  <Bar dataKey="wins" fill="hsl(260 60% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stage Completion Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Pilots by 5-Star Completions */}
          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                TOP 10 PILOTS — STAGE PROGRESS
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topPilotsByStage.length === 0 ? (
                <p className="text-muted-foreground text-sm font-body">No 5-star completions yet.</p>
              ) : (
                <div className="space-y-2">
                  {topPilotsByStage.map((pilot, i) => (
                    <div key={pilot.userId} className="flex items-center gap-3 p-2 rounded-md bg-muted/20">
                      <span className="text-xs text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={pilot.avatar ?? undefined} />
                        <AvatarFallback className="text-xs bg-primary/20">{pilot.name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pilot.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stage {pilot.maxStage} · Level {pilot.maxLevel}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Star className="h-3 w-3 fill-primary" />
                        {pilot.fiveStarCount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stage Completion Overview */}
          <Card className="bg-card/60 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-sm tracking-wider text-muted-foreground">STAGE COMPLETION OVERVIEW</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {STAGE_DEFS.map((stage, stageIdx) => (
                  <AccordionItem key={stageIdx} value={`stage-${stageIdx}`} className="border-border/30">
                    <AccordionTrigger className="text-sm font-display tracking-wider hover:no-underline py-3">
                      <span>Stage {stageIdx + 1}: {stage.name}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {LEVEL_DEFS.map((_, levelIdx) => {
                          const count = stageCompletionMap[`${stageIdx + 1}-${levelIdx + 1}`] || 0;
                          return (
                            <div key={levelIdx} className="flex items-center justify-between py-1 px-2 rounded bg-muted/10">
                              <span className="text-xs text-muted-foreground">Level {levelIdx + 1}</span>
                              <div className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-primary fill-primary" />
                                <span className="text-xs font-mono font-medium min-w-[2ch] text-right">{count}</span>
                                <span className="text-xs text-muted-foreground">pilots</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error Log Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ERROR LOG
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {errorLog.length === 0 ? (
              <p className="text-muted-foreground text-sm p-4">No errors recorded.</p>
            ) : (
              <div className="space-y-2 pr-4">
                {errorLog.map((err) => (
                  <div key={err.id} className="p-3 rounded-md bg-muted/20 border border-border/20 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        err.error_type === "network_timeout" ? "bg-orange-500/20 text-orange-400" :
                        err.error_type === "routing" ? "bg-blue-500/20 text-blue-400" :
                        "bg-destructive/20 text-destructive"
                      }`}>
                        {err.error_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(err.created_at), "MMM d, HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-sm break-all">{err.error_message}</p>
                    {err.url && (
                      <p className="text-xs text-muted-foreground truncate">URL: {err.url}</p>
                    )}
                    {err.error_stack && (
                      <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Stack trace</summary>
                        <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto">
                          {err.error_stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Analytics;
