import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproval?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireApproval = true,
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireApproval && !profile?.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="max-w-md mx-auto text-center p-6 bg-background rounded-lg border shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-4">Account Pending Approval</h2>
          <p className="text-muted-foreground mb-4">
            Your account is currently pending approval. Please wait for an administrator to approve your access.
          </p>
          <p className="text-sm text-muted-foreground">
            Logged in as: <span className="font-medium">{user.email}</span>
          </p>
        </div>
      </div>
    );
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="max-w-md mx-auto text-center p-6 bg-background rounded-lg border shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page. Admin privileges are required.
          </p>
          <p className="text-sm text-muted-foreground">
            Current role: <span className="font-medium">{profile?.role || 'Unknown'}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};