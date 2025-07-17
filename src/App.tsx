import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthPage } from "@/pages/AuthPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ItemMaster from "./pages/ItemMaster";
import StockOperations from "./pages/StockOperations";
import StockSummary from "./pages/StockSummary";
import StockAnalytics from "./pages/StockAnalytics";
import ManufacturingWorkflow from "./pages/ManufacturingWorkflow";
import CategoriesManagement from "./pages/CategoriesManagement";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <Index />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/item-master" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <ItemMaster />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/stock-operations" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <StockOperations />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/stock-summary" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <StockSummary />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/stock-analytics" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <StockAnalytics />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manufacturing-workflow" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <ManufacturingWorkflow />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/categories" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <CategoriesManagement />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-gradient-subtle">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <AppHeader />
                        <main className="flex-1 overflow-auto">
                          <Settings />
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } 
            />
            {/* Placeholder routes for remaining pages */}
            <Route path="/order-punching" element={<ProtectedRoute><div className="p-6">Order Punching - Coming Soon</div></ProtectedRoute>} />
            <Route path="/gravure-printing" element={<ProtectedRoute><div className="p-6">Gravure Printing - Coming Soon</div></ProtectedRoute>} />
            <Route path="/lamination-coating" element={<ProtectedRoute><div className="p-6">Lamination & Coating - Coming Soon</div></ProtectedRoute>} />
            <Route path="/slitting-packaging" element={<ProtectedRoute><div className="p-6">Slitting & Packaging - Coming Soon</div></ProtectedRoute>} />
            <Route path="/production-reports" element={<ProtectedRoute><div className="p-6">Production Reports - Coming Soon</div></ProtectedRoute>} />
            <Route path="/workflow-analytics" element={<ProtectedRoute><div className="p-6">Workflow Analytics - Coming Soon</div></ProtectedRoute>} />
            <Route path="/user-management" element={<ProtectedRoute><div className="p-6">User Management - Coming Soon</div></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
