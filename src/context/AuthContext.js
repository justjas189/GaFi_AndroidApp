// context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, formatSupabaseError } from '../config/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkLoginStatus();
    
    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUserToken(session.access_token);
        setUserInfo(session.user);
        await AsyncStorage.setItem('userToken', session.access_token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(session.user));
      } else if (event === 'SIGNED_OUT') {
        setUserToken(null);
        setUserInfo(null);
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userInfo');
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const checkLoginStatus = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session) {
        setUserToken(session.access_token);
        setUserInfo(session.user);
        await AsyncStorage.setItem('userToken', session.access_token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(session.user));
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setError(formatSupabaseError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      // First check if the user exists
      const { data: existingUser, error: userCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        throw userCheckError;
      }

      if (existingUser) {
        return {
          success: false,
          error: 'An account with this email already exists'
        };
      }

      // Attempt to sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data?.user) {
        throw new Error('Registration failed - no user data returned');
      }

      // If email is not confirmed, prompt user to check email
      if (!data.user.email_confirmed_at) {
        return {
          success: true,
          user: data.user,
          needsVerification: true
        };
      }

      // If email is already confirmed (rare), proceed to login
      return {
        success: true,
        user: data.user,
        needsVerification: false
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If error message indicates email not confirmed, show custom message
        if (error.message && error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('confirm')) {
          return {
            success: false,
            error: 'Please verify your email before logging in. Check your inbox for a verification link.',
            needsVerification: true
          };
        }
        throw error;
      }

      if (data?.session) {
        // Check if user has confirmed their email
        const user = data.session.user;
        if (!user.email_confirmed_at && !user.confirmed_at) {
          return {
            success: false,
            error: 'Please verify your email before logging in. Check your inbox for a verification link.',
            needsVerification: true
          };
        }
        // Check if user has completed onboarding
        const { data: profileData } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        return { 
          success: true, 
          session: data.session,
          needsOnboarding: !profileData?.onboarding_completed
        };
      }

      return { 
        success: false, 
        error: 'Login failed - no session data' 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear all auth-related storage
      await AsyncStorage.multiRemove([
        'userToken',
        'userInfo',
        'onboardingComplete',
        'isFirstLogin'
      ]);

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    }
  };

  const sendPasswordResetEmail = async (email) => {
    try {
      setError(null);
      setIsLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Send reset email error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (code, newPassword, email) => {
    try {
      setError(null);
      setIsLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue = {
    isLoading,
    userToken,
    userInfo,
    error,
    login,
    logout,
    register,
    checkLoginStatus,
    sendPasswordResetEmail,
    resetPassword,
    isAuthenticated: !!userToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};