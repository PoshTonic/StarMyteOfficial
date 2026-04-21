import { LayoutDashboard, Rocket, Crosshair, Users, BarChart3, Home, UserCircle, Palette, Infinity, Award, MessageSquareMore } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Ships", url: "/admin/ships", icon: Rocket },
  { title: "Weapons", url: "/admin/weapons", icon: Crosshair },
  { title: "Pilots", url: "/admin/pilots", icon: Users },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Avatars", url: "/admin/avatars", icon: UserCircle },
  { title: "Skins", url: "/admin/skins", icon: Palette },
  { title: "Infinity", url: "/admin/infinity-rewards", icon: Infinity },
  { title: "Prizing", url: "/admin/prizing", icon: Award },
  { title: "Emotes", url: "/admin/emotes", icon: MessageSquareMore },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-display tracking-wider text-primary">STARMYTE ADMIN</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/" className="hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                <Home className="mr-2 h-4 w-4" />
                {!collapsed && <span>Back to Game</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden min-w-0">
          <header className="h-12 flex items-center border-b border-border/30 px-4">
            <SidebarTrigger className="ml-0" />
            <span className="ml-3 font-display text-sm tracking-wider text-muted-foreground">ADMIN PORTAL</span>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-full">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
