
import { useLocation, NavLink } from "react-router-dom";
import { Home, Package, LayoutDashboard, Settings, Users, ShoppingCart, File, History, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const dashboardItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Stock Summary", url: "/stock-summary", icon: Package }
];

const stockOperationItems = [
  { title: "GRN", url: "/grn", icon: ShoppingCart },
  { title: "Issue", url: "/issue", icon: File },
  { title: "Opening Stock", url: "/opening-stock", icon: History },
  { title: "Legacy Data", url: "/legacy-data", icon: History }
];

const administrationItems = [
  { title: "Items", url: "/items", icon: Package },
  { title: "Categories", url: "/categories", icon: ClipboardList },
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings }
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/dashboard" && location.pathname === "/") return true;
    return location.pathname === path;
  };

  const getNavClassName = (path: string) => {
    return isActive(path) 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://github.com/shadcn.png" alt="Satguru" />
            <AvatarFallback>SG</AvatarFallback>
          </Avatar>
          {!isCollapsed && <span className="font-bold text-lg">Satguru</span>}
        </NavLink>
        {!isCollapsed && <Separator className="mt-2" />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className={getNavClassName(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Stock Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stockOperationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className={getNavClassName(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {administrationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className={getNavClassName(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-2 h-auto">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={user?.user_metadata?.image} alt={user?.user_metadata?.full_name || "Avatar"} />
                <AvatarFallback className="text-xs">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <span className="truncate text-sm">
                  {user?.user_metadata?.full_name || user?.email}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
