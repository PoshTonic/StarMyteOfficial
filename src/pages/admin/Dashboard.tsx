import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Swords, Clock, Rocket, Crosshair, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pilots: 0, battles: 0, totalTime: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ count: pilotCount }, { data: battleData }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("battle_results").select("battle_duration"),
      ]);
      const battles = battleData || [];
      const totalTime = battles.reduce((sum: number, b: any) => sum + Number(b.battle_duration || 0), 0);
      setStats({
        pilots: pilotCount || 0,
        battles: battles.length,
        totalTime: Math.round(totalTime / 60),
      });
    };
    load();
  }, []);

  const statCards = [
    { label: "Total Pilots", value: stats.pilots, icon: Users, color: "text-primary" },
    { label: "Total Battles", value: stats.battles, icon: Swords, color: "text-game-hp" },
    { label: "Play Time (min)", value: stats.totalTime, icon: Clock, color: "text-game-fuel" },
  ];

  const quickLinks = [
    { label: "Ships", icon: Rocket, path: "/admin/ships" },
    { label: "Weapons", icon: Crosshair, path: "/admin/weapons" },
    { label: "Pilots", icon: Users, path: "/admin/pilots" },
    { label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="font-display text-2xl tracking-wider text-primary glow-text">DASHBOARD</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="bg-card/60 border-border/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-body text-sm text-muted-foreground">{s.label}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl tracking-wider text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-sm tracking-wider text-muted-foreground">QUICK LINKS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <Button
                key={link.path}
                variant="outline"
                onClick={() => navigate(link.path)}
                className="h-20 flex flex-col gap-2 font-display tracking-wider text-xs"
              >
                <link.icon className="h-6 w-6 text-primary" />
                {link.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
