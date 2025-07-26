
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  TrendingUp, 
  Settings,
  Factory,
  BarChart3,
  Package2,
  ArrowUpDown,
  ClipboardList,
  Workflow,
  Layers,
  Palette,
  Scissors,
  PackageCheck,
  FolderTree,
  Shield,
  Image,
  FileSpreadsheet,
  CircleDot,
  ShoppingCart,
  Users,
  RefreshCw,
  PieChart,
  TreePine,
  Brain,
  MessageSquare,
  Lightbulb,
  Zap,
  BookOpen
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainOperationsItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Item Master", url: "/item-master", icon: Package2 },
  { title: "Specification Master", url: "/specification-master", icon: FileSpreadsheet },
  { title: "Stock Operations", url: "/stock-operations", icon: ArrowUpDown },
  { title: "Stock Summary", url: "/stock-summary", icon: ClipboardList },
];

const aiAssistantItems = [
  { title: "AI Chat Hub", url: "/ai-chat", icon: MessageSquare },
  { title: "Smart Analytics", url: "/ai-analytics", icon: Brain },
  { title: "Process Optimizer", url: "/ai-optimizer", icon: Zap },
  { title: "Document Assistant", url: "/ai-documents", icon: FileText },
  { title: "Training Center", url: "/ai-training", icon: BookOpen },
];

const procurementItems = [
  { title: "Procurement Dashboard", url: "/procurement-dashboard", icon: PieChart },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Vendor Management", url: "/vendors", icon: Users },
  { title: "Reorder Management", url: "/reorder-management", icon: RefreshCw },
];

const manufacturingItems = [
  { title: "Manufacturing Workflow", url: "/manufacturing-workflow", icon: Workflow },
  { title: "Order Punching", url: "/order-punching", icon: FileText },
  { title: "BOM Management", url: "/bom-management", icon: TreePine },
  { title: "Artwork Management", url: "/artwork-management", icon: Image },
  { title: "Cylinder Management", url: "/cylinder-management", icon: CircleDot },
  { title: "Gravure Printing", url: "/gravure-printing", icon: Palette },
  { title: "Lamination & Coating", url: "/lamination-coating", icon: Layers },
  { title: "Slitting & Packaging", url: "/slitting-packaging", icon: Scissors },
];

const analyticsItems = [
  { title: "Stock Analytics", url: "/stock-analytics", icon: BarChart3 },
  { title: "Production Reports", url: "/production-reports", icon: TrendingUp },
  { title: "Workflow Analytics", url: "/workflow-analytics", icon: Factory },
];

const managementItems = [
  { title: "Categories Management", url: "/categories", icon: FolderTree },
  { title: "User Management", url: "/user-management", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavClasses = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm" 
      : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 pb-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Factory className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">Satguru</h2>
              <p className="text-xs text-sidebar-foreground/70">Engravures ERP</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2">
            Main Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainOperationsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            {!isCollapsed && "AI Assistant"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {aiAssistantItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2">
            Procurement
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {procurementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2">
            Manufacturing
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {manufacturingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {analyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider mb-2">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClasses}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
