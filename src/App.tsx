
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import Index from "./pages/Index";
import { AuthPage } from "./pages/AuthPage";
import ItemMaster from "./pages/ItemMaster";
import StockOperations from "./pages/StockOperations";
import StockSummary from "./pages/StockSummary";
import StockAnalytics from "./pages/StockAnalytics";
import CategoriesManagement from "./pages/CategoriesManagement";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ManufacturingWorkflow from "./pages/ManufacturingWorkflow";
import OrderPunching from "./pages/OrderPunching";
import ArtworkManagement from "./pages/ArtworkManagement";
import GravurePrinting from "./pages/GravurePrinting";
import LaminationCoating from "./pages/LaminationCoating";
import SlittingPackaging from "./pages/SlittingPackaging";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <SidebarProvider>
                      <div className="min-h-screen flex w-full">
                        <AppSidebar />
                        <main className="flex-1 flex flex-col">
                          <AppHeader />
                          <div className="flex-1 overflow-auto">
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/item-master" element={<ItemMaster />} />
                              <Route path="/stock-operations" element={<StockOperations />} />
                              <Route path="/stock-summary" element={<StockSummary />} />
                              <Route path="/stock-analytics" element={<StockAnalytics />} />
                              <Route path="/categories" element={<CategoriesManagement />} />
                              <Route path="/manufacturing-workflow" element={<ManufacturingWorkflow />} />
                              <Route path="/order-punching" element={<OrderPunching />} />
                              <Route path="/artwork-management" element={<ArtworkManagement />} />
                              <Route path="/gravure-printing" element={<GravurePrinting />} />
                              <Route path="/lamination-coating" element={<LaminationCoating />} />
                              <Route path="/slitting-packaging" element={<SlittingPackaging />} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </div>
                        </main>
                      </div>
                    </SidebarProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
