
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuthResponse, AuthError } from '@/types';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
  is_approved: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
  isApproved: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          organizations!inner(code, name)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          await createUserProfile(userId);
          return;
        }
        throw error;
      }

      console.log('Profile fetched successfully:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      toast({
        title: "Profile Error",
        description: "Failed to load user profile. Creating new profile...",
        variant: "destructive"
      });
      
      // Try to create profile if it doesn't exist
      await createUserProfile(userId);
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      console.log('Creating user profile for:', userId);
      
      // Get user email from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('No authenticated user found');

      // Get DKEGL organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('code', 'DKEGL')
        .single();

      if (orgError) {
        console.error('Organization fetch error:', orgError);
        throw orgError;
      }

      // Create profile
      const profileData = {
        id: userId,
        email: authUser.email!,
        full_name: authUser.user_metadata?.full_name || 'New User',
        organization_id: org.id,
        role: 'user',
        is_approved: true // Auto-approve for DKEGL users
      };

      console.log('Creating profile with data:', profileData);

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select(`
          *,
          organizations!inner(code, name)
        `)
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        throw createError;
      }

      console.log('Profile created successfully:', newProfile);
      setProfile(newProfile);
      
      toast({
        title: "Welcome!",
        description: "Your profile has been created successfully.",
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
      toast({
        title: "Profile Creation Error",
        description: "Failed to create user profile. Please contact support.",
        variant: "destructive"
      });
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetching to avoid auth deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 100);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 100);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      console.log('Signing up user:', email);
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || 'New User'
          }
        }
      });
      
      if (error) {
        console.error('Sign up error:', error);
      }
      
      return { error };
    } catch (error) {
      console.error('Sign up catch error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in user:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('Sign in error:', error);
      }
      
      return { error };
    } catch (error) {
      console.error('Sign in catch error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user');
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: "There was an issue signing out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  const isApproved = () => {
    return profile?.is_approved === true;
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    isApproved,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
