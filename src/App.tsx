
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import Index from './pages/Index';
import ItemMaster from './pages/ItemMaster';
import CategoriesManagement from './pages/CategoriesManagement';
import StockOperations from './pages/StockOperations';
import StockAnalytics from './pages/StockAnalytics';
import Settings from './pages/Settings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import StockSummary from './pages/StockSummary';
import LegacyDataManagement from './pages/LegacyDataManagement';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout>
                  <Index />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout>
                  <Index />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/items" element={
              <ProtectedRoute>
                <AppLayout>
                  <ItemMaster />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/categories" element={
              <ProtectedRoute>
                <AppLayout>
                  <CategoriesManagement />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/stock" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockOperations />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/grn" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockOperations />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/issue" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockOperations />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/opening-stock" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockOperations />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockAnalytics />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/stock-summary" element={
              <ProtectedRoute>
                <AppLayout>
                  <StockSummary />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/legacy-data" element={
              <ProtectedRoute>
                <AppLayout>
                  <LegacyDataManagement />
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
