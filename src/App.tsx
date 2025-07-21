
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <Index />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <Index />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/items" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <ItemMaster />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/categories" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <CategoriesManagement />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/stock" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockOperations />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/grn" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockOperations />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/issue" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockOperations />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/opening-stock" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockOperations />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockAnalytics />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <Settings />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/stock-summary" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <StockSummary />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/legacy-data" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <LegacyDataManagement />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
