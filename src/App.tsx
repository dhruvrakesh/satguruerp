
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import Index from "./pages/Index";
import ItemMaster from "./pages/ItemMaster";
import SpecificationMaster from "./pages/SpecificationMaster";
import StockOperations from "./pages/StockOperations";
import StockSummary from "./pages/StockSummary";
import CategoriesManagement from "./pages/CategoriesManagement";
import Settings from "./pages/Settings";
import ProductionReports from "./pages/ProductionReports";
import WorkflowAnalytics from "./pages/WorkflowAnalytics";
import UserManagement from "./pages/UserManagement";
import ManufacturingWorkflow from "./pages/ManufacturingWorkflow";
import OrderPunching from "./pages/OrderPunching";
import ArtworkManagement from "./pages/ArtworkManagement";
import CylinderManagement from "./pages/CylinderManagement";
import GravurePrinting from "./pages/GravurePrinting";
import LaminationCoating from "./pages/LaminationCoating";
import SlittingPackaging from "./pages/SlittingPackaging";
import StockAnalytics from "./pages/StockAnalytics";
import ProcurementDashboard from "./pages/ProcurementDashboard";
import PurchaseOrders from "./pages/PurchaseOrders";
import VendorManagement from "./pages/VendorManagement";
import ReorderManagement from "./pages/ReorderManagement";
import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./pages/AuthPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <BrowserRouter>
            <SidebarProvider>
              <div className="min-h-screen flex w-full">
                <AppSidebar />
                <div className="flex-1 flex flex-col">
                  <AppHeader />
                  <main className="flex-1 overflow-auto">
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route
                        path="/item-master"
                        element={
                          <ProtectedRoute>
                            <ItemMaster />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/specification-master"
                        element={
                          <ProtectedRoute>
                            <SpecificationMaster />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/stock-operations"
                        element={
                          <ProtectedRoute>
                            <StockOperations />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/stock-summary"
                        element={
                          <ProtectedRoute>
                            <StockSummary />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/categories"
                        element={
                          <ProtectedRoute>
                            <CategoriesManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/procurement-dashboard"
                        element={
                          <ProtectedRoute>
                            <ProcurementDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/purchase-orders"
                        element={
                          <ProtectedRoute>
                            <PurchaseOrders />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/vendors"
                        element={
                          <ProtectedRoute>
                            <VendorManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reorder-management"
                        element={
                          <ProtectedRoute>
                            <ReorderManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/manufacturing-workflow"
                        element={
                          <ProtectedRoute>
                            <ManufacturingWorkflow />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/order-punching"
                        element={
                          <ProtectedRoute>
                            <OrderPunching />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/artwork-management"
                        element={
                          <ProtectedRoute>
                            <ArtworkManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/cylinder-management"
                        element={
                          <ProtectedRoute>
                            <CylinderManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/gravure-printing"
                        element={
                          <ProtectedRoute>
                            <GravurePrinting />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/lamination-coating"
                        element={
                          <ProtectedRoute>
                            <LaminationCoating />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/slitting-packaging"
                        element={
                          <ProtectedRoute>
                            <SlittingPackaging />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/stock-analytics"
                        element={
                          <ProtectedRoute>
                            <StockAnalytics />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/production-reports"
                        element={
                          <ProtectedRoute>
                            <ProductionReports />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/workflow-analytics"
                        element={
                          <ProtectedRoute>
                            <WorkflowAnalytics />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/user-management"
                        element={
                          <ProtectedRoute>
                            <UserManagement />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/auth" element={<AuthPage />} />
                      <Route
                        path="*"
                        element={<Navigate to="/" replace />}
                      />
                    </Routes>
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
