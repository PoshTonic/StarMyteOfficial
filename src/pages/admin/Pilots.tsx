import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const Pilots = () => {
  const navigate = useNavigate();
  const [pilots, setPilots] = useState<any[]>([]);
  const [battleStats, setBattleStats] = useState<Record<string, { wins: number; losses: number }>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: battles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("battle_results").select("user_id, result"),
      ]);
      setPilots(profiles || []);

      const stats: Record<string, { wins: number; losses: number }> = {};
      (battles || []).forEach((b: any) => {
        if (!stats[b.user_id]) stats[b.user_id] = { wins: 0, losses: 0 };
        if (b.result === "victory") stats[b.user_id].wins++;
        else stats[b.user_id].losses++;
      });
      setBattleStats(stats);
    };
    load();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <h1 className="font-display text-2xl tracking-wider text-primary glow-text">PILOTS</h1>

        <div className="glass-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-display tracking-wider text-xs">CALLSIGN</TableHead>
                <TableHead className="font-display tracking-wider text-xs">LEVEL</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">XP</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">CREDITS</TableHead>
                <TableHead className="font-display tracking-wider text-xs">W/L</TableHead>
                <TableHead className="font-display tracking-wider text-xs hidden md:table-cell">JOINED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots.map((p) => {
                const bs = battleStats[p.id] || { wins: 0, losses: 0 };
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/admin/pilots/${p.id}`)}>
                    <TableCell className="font-display tracking-wider">{p.display_name || "Pilot"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-display text-[10px]">Lv.{p.level}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{p.xp}</TableCell>
                    <TableCell className="text-yellow-400 hidden md:table-cell">{p.credits}</TableCell>
                    <TableCell>
                      <span className="text-green-400">{bs.wins}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-400">{bs.losses}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                      {format(new Date(p.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Pilots;
