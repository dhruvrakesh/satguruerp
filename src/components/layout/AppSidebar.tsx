import { useState } from "react";
import { usePathname } from "next/navigation";
import { Home, Package, LayoutDashboard, Settings, Users, ShoppingCart, File, History } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="w-full">
      {children}
    </li>
  );
}

function SidebarMenuButton({ children }: { children: React.ReactNode }) {
  return (
    <Button variant="ghost" className="justify-start px-4 py-2 w-full hover:bg-secondary/50">
      {children}
    </Button>
  );
}

export function AppSidebar({ className, ...props }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={cn(
      "flex flex-col space-y-4 w-64 border-right bg-secondary min-h-screen py-4",
      className
    )} {...props}>
      <ScrollArea className="flex-1 space-y-4">
        <div className="px-3 py-2">
          <Link to="/" className="flex items-center space-x-2">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>SC</AvatarFallback>
            </Avatar>
            <span className="font-bold">Satguru</span>
          </Link>
          <Separator className="my-2" />
        </div>

        <div className="space-y-1">
          <h4 className="mb-2 ml-4 text-sm font-semibold tracking-tight">
            Dashboard
          </h4>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard" className="flex items-center space-x-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/stock-summary" className="flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>Stock Summary</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>

        <div className="space-y-1">
          <h4 className="mb-2 ml-4 text-sm font-semibold tracking-tight">
            Stock Operations
          </h4>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/grn" className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>GRN</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/issue" className="flex items-center space-x-2">
                <File className="w-4 h-4" />
                <span>Issue</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/opening-stock" className="flex items-center space-x-2">
                <History className="w-4 h-4" />
                <span>Opening Stock</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Add this in the Stock Operations section after Stock Summary */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/legacy-data" className="flex items-center space-x-2">
                <History className="w-4 h-4" />
                <span>Legacy Data</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>

        <div className="space-y-1">
          <h4 className="mb-2 ml-4 text-sm font-semibold tracking-tight">
            Administration
          </h4>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/items" className="flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>Items</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/categories" className="flex items-center space-x-2">
                <ClipboardList className="w-4 h-4" />
                <span>Categories</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/users" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Users</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/settings" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>
      </ScrollArea>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="justify-start px-4 py-2 w-full hover:bg-secondary/50">
            <Avatar className="mr-2">
              <AvatarImage src={user?.image} alt={user?.name || "Avatar"} />
              <AvatarFallback>{user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span>{user?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="end" forceMount>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
