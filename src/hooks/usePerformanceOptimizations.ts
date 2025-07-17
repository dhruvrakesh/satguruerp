import React, { useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Debounced search hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

// Enhanced search with server-side filtering - simplified version
export function useEnhancedSearch(
  searchTerm: string,
  options: {
    enabled?: boolean;
    minSearchLength?: number;
    debounceMs?: number;
  } = {}
) {
  const {
    enabled = true,
    minSearchLength = 2,
    debounceMs = 300
  } = options;

  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  return {
    debouncedSearchTerm,
    isSearching: enabled && debouncedSearchTerm.length >= minSearchLength
  };
}

// Simple pagination state management
export function useOptimizedPagination(
  pageSize: number = 50,
  filters: Record<string, any> = {}
) {
  const [currentPage, setCurrentPage] = React.useState(1);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => prev - 1);
  }, []);

  return {
    currentPage,
    goToPage,
    nextPage,
    prevPage
  };
}

// Optimized filter state management
export function useFilterState<T extends Record<string, any>>(
  initialFilters: T,
  onFiltersChange?: (filters: T) => void
) {
  const [filters, setFiltersState] = React.useState<T>(initialFilters);

  const setFilters = useCallback((newFilters: Partial<T> | ((prev: T) => T)) => {
    setFiltersState(prev => {
      const updated = typeof newFilters === 'function' 
        ? newFilters(prev)
        : { ...prev, ...newFilters };
      
      onFiltersChange?.(updated);
      return updated;
    });
  }, [onFiltersChange]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters, setFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => 
      value !== undefined && 
      value !== null && 
      value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    );
  }, [filters]);

  return {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters
  };
}

// Cache-aware query options
export function getCacheAwareOptions(options: {
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
  backgroundRefetch?: boolean;
} = {}) {
  const {
    staleTime = 300000, // 5 minutes
    gcTime = 600000, // 10 minutes
    refetchInterval = false,
    backgroundRefetch = true
  } = options;

  return {
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus: backgroundRefetch,
    refetchOnReconnect: backgroundRefetch,
    retry: (failureCount: number, error: any) => {
      // Retry up to 3 times for network errors
      if (failureCount < 3 && error?.message?.includes('network')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
}