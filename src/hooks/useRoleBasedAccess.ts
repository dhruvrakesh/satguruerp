import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserPermissions {
  canViewPricing: boolean;
  canEditPricing: boolean;
  canApprovePricing: boolean;
  canBulkImport: boolean;
  canExportData: boolean;
  canManageCategories: boolean;
  maxPriceChangeAmount?: number;
  requiresApproval: boolean;
}

export const useRoleBasedAccess = () => {
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, organization_id, is_approved")
        .eq("id", user.user.id)
        .single();

      return profile;
    }
  });

  const permissions: UserPermissions = (() => {
    if (!userProfile || !userProfile.is_approved) {
      return {
        canViewPricing: false,
        canEditPricing: false,
        canApprovePricing: false,
        canBulkImport: false,
        canExportData: false,
        canManageCategories: false,
        requiresApproval: true
      };
    }

    switch (userProfile.role) {
      case 'admin':
        return {
          canViewPricing: true,
          canEditPricing: true,
          canApprovePricing: true,
          canBulkImport: true,
          canExportData: true,
          canManageCategories: true,
          requiresApproval: false
        };
      
      case 'pricing_manager':
        return {
          canViewPricing: true,
          canEditPricing: true,
          canApprovePricing: true,
          canBulkImport: true,
          canExportData: true,
          canManageCategories: false,
          maxPriceChangeAmount: 100000,
          requiresApproval: false
        };
      
      case 'pricing_user':
        return {
          canViewPricing: true,
          canEditPricing: true,
          canApprovePricing: false,
          canBulkImport: false,
          canExportData: true,
          canManageCategories: false,
          maxPriceChangeAmount: 10000,
          requiresApproval: true
        };
      
      case 'viewer':
        return {
          canViewPricing: true,
          canEditPricing: false,
          canApprovePricing: false,
          canBulkImport: false,
          canExportData: true,
          canManageCategories: false,
          requiresApproval: true
        };
      
      default:
        return {
          canViewPricing: true,
          canEditPricing: false,
          canApprovePricing: false,
          canBulkImport: false,
          canExportData: false,
          canManageCategories: false,
          requiresApproval: true
        };
    }
  })();

  const checkPermission = (action: keyof UserPermissions): boolean => {
    return Boolean(permissions[action]);
  };

  const requiresApprovalForAmount = (amount: number): boolean => {
    if (!permissions.maxPriceChangeAmount) return permissions.requiresApproval;
    return amount > permissions.maxPriceChangeAmount || permissions.requiresApproval;
  };

  return {
    permissions,
    checkPermission,
    requiresApprovalForAmount,
    userProfile,
    isLoading: !userProfile
  };
};