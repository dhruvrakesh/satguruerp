import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Categories from './pages/Categories';
import UOMs from './pages/UOMs';
import Stock from './pages/Stock';
import GRN from './pages/GRN';
import Issues from './pages/Issues';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppSidebar from './components/layout/AppSidebar';
import AppHeader from './components/layout/AppHeader';
import { Toaster } from "@/components/ui/toaster"
import StockSummary from './pages/StockSummary';
import OpeningStock from './pages/OpeningStock';
import LegacyDataManagement from './pages/LegacyDataManagement';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
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
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <Dashboard />
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
                        <Items />
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
                        <Categories />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/uoms" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <UOMs />
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
                        <Stock />
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
                        <GRN />
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/issues" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <Issues />
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
                        <Reports />
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
              <Route path="/opening-stock" element={
                <ProtectedRoute>
                  <div className="flex h-screen">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <AppHeader />
                      <main className="flex-1 overflow-auto">
                        <OpeningStock />
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
