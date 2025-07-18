
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle, User } from 'lucide-react';

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
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="max-w-md mx-auto text-center p-6 bg-background rounded-lg border shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Profile Setup Required</h2>
          <p className="text-muted-foreground mb-4">
            Your profile is being created. Please refresh the page in a moment.
          </p>
          <div className="bg-muted p-3 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span>Logged in as: <span className="font-medium">{user.email}</span></span>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (requireApproval && !profile?.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="max-w-md mx-auto text-center p-6 bg-background rounded-lg border shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Account Pending Approval</h2>
          <p className="text-muted-foreground mb-4">
            Your account is currently pending approval. Please wait for an administrator to approve your access.
          </p>
          <div className="bg-muted p-3 rounded-lg">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Organization:</span>
                <span className="font-medium">DKEGL</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-amber-600 font-medium">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="max-w-md mx-auto text-center p-6 bg-background rounded-lg border shadow-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page. Admin privileges are required.
          </p>
          <div className="bg-muted p-3 rounded-lg">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Current role:</span>
                <span className="font-medium">{profile?.role || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span>Required:</span>
                <span className="font-medium text-red-600">Admin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication success indicator
  console.log('✅ Authentication successful:', {
    userId: user.id,
    email: user.email,
    profileRole: profile.role,
    isApproved: profile.is_approved,
    organization: profile.organization_id
  });

  return <>{children}</>;
};
