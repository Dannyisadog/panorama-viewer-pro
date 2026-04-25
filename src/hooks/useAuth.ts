import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

/**
 * useAuth — lightweight auth state hook
 *
 * Handles:
 * - Initial session restoration on mount
 * - Auth state change subscriptions
 * - Sign-in / sign-out
 *
 * Usage:
 *   const { user, session, signInWithGoogle, signOut, isLoading } = useAuth();
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true until we know if user is logged in

  // Restore session on mount
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));

    // Subscribe to future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Hardcode Vercel URL for production; localhost fallback for dev
    const isLocalhost =
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost';

    const redirectTo = isLocalhost
      ? 'http://localhost:5173'
      : 'https://panorama-viewer-pro.vercel.app';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      console.error('[Auth] signInWithGoogle error:', error.message);
    }
    // On success, Supabase redirects away; on error we stay on the page
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] signOut error:', error.message);
    }
    return { error };
  }, []);

  return { user, session, isLoading, signInWithGoogle, signOut };
}
