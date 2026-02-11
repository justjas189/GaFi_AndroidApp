// context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, formatSupabaseError } from '../config/supabase';

export const AuthContext = createContext();

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const isResettingPasswordRef = React.useRef(false);

  useEffect(() => {
    checkLoginStatus();
    
    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      // Ignore PASSWORD_RECOVERY events — these fire during the password
      // reset OTP flow and must NOT set userToken, otherwise the navigator
      // would swap from AuthNavigator to MainNavigator mid-reset.
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event — ignoring to stay on auth screens');
        return;
      }

      // Ignore SIGNED_IN events that fire as a side effect of verifyOtp
      // during an active password reset flow
      if (event === 'SIGNED_IN' && isResettingPasswordRef.current) {
        console.log('SIGNED_IN during password reset — ignoring transient session');
        return;
      }
      
      if (event === 'SIGNED_IN' && session) {
        // Get user profile data from database to get the full name and username
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', session.user.id)
          .single();

        // Create enhanced user info object with name from profile or metadata
        const enhancedUserInfo = {
          ...session.user,
          name: profileData?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          username: profileData?.username || null,
          email: session.user.email
        };

        setUserToken(session.access_token);
        setUserInfo(enhancedUserInfo);
        await AsyncStorage.setItem('userToken', session.access_token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(enhancedUserInfo));
      } else if (event === 'SIGNED_OUT') {
        setUserToken(null);
        setUserInfo(null);
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userInfo');
        // Clear any cached data
        await AsyncStorage.removeItem('onboardingComplete');
        await AsyncStorage.removeItem('isFirstLogin');
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
        // Get user profile data from database to get the full name and username
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', session.user.id)
          .single();

        // Create enhanced user info object with name from profile or metadata
        const enhancedUserInfo = {
          ...session.user,
          name: profileData?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          username: profileData?.username || null,
          email: session.user.email
        };

        setUserToken(session.access_token);
        setUserInfo(enhancedUserInfo);
        await AsyncStorage.setItem('userToken', session.access_token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(enhancedUserInfo));
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

      // Attempt to sign up directly - let Supabase handle duplicate email checking
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
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

        // Check if user profile exists and determine if onboarding is needed
        let needsOnboarding = false;
        try {
          // First check AsyncStorage for onboarding completion
          const hasOnboarded = await AsyncStorage.getItem(`hasOnboarded_${user.id}`);
          if (hasOnboarded === 'true') {
            needsOnboarding = false;
          } else {
            // Check database profile as fallback
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('full_name, created_at, onboarding_completed')
              .eq('id', user.id)
              .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
              console.warn('Error checking profile:', profileError);
            }

            // If database says onboarding is complete, sync with AsyncStorage
            if (profileData?.onboarding_completed) {
              await AsyncStorage.setItem(`hasOnboarded_${user.id}`, 'true');
              needsOnboarding = false;
            } else if (!profileData) {
              // No profile exists, this is likely a new user who needs onboarding
              needsOnboarding = true;
            } else {
              // Check if this is a very recent account (created within last 10 minutes)
              const profileCreated = new Date(profileData.created_at);
              const now = new Date();
              const diffMinutes = (now - profileCreated) / (1000 * 60);
              
              // If profile was created recently, likely needs onboarding
              needsOnboarding = diffMinutes < 10;
            }
          }
        } catch (error) {
          console.warn('Could not check profile for onboarding:', error);
          // If we can't check, assume existing user (safer default)
          needsOnboarding = false;
        }

        return { 
          success: true, 
          session: data.session,
          needsOnboarding
        };
      }

      return { 
        success: false, 
        error: 'Login failed - no session data' 
      };
    } catch (error) {
      // Log simplified message without exposing error details
      console.log('Login attempt failed');
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
      // NOTE: Do NOT set global isLoading here — AppNavigator uses it to
      // swap to <LoadingScreen>, which unmounts the auth navigator and
      // destroys the navigation stack.  Screens use local loading state.

      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Send reset email error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    }
  };

  const resetPassword = async (code, newPassword, email) => {
    try {
      setError(null);
      // NOTE: Do NOT set global isLoading here — same reason as above.
      isResettingPasswordRef.current = true; // Prevent auth listener from processing transient session

      // Step 1: Verify the OTP code to establish a recovery session
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      // Step 2: Now that we have an authenticated session, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Step 3: Sign out so the user can log in fresh with the new password
      await supabase.auth.signOut();

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      isResettingPasswordRef.current = false;
    }
  };

  const markOnboardingComplete = async (userId) => {
    try {
      // Mark onboarding as complete in AsyncStorage
      await AsyncStorage.setItem(`hasOnboarded_${userId}`, 'true');
      await AsyncStorage.setItem('onboardingComplete', 'true');
      
      // Update profile in database if possible
      try {
        await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (dbError) {
        console.warn('Could not update onboarding status in database:', dbError);
        // Continue anyway - AsyncStorage is sufficient
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!userInfo?.id) {
        throw new Error('User not logged in');
      }

      // Prepare update data
      const updateData = {
        full_name: profileData.name,
        updated_at: new Date().toISOString()
      };

      // Add username if provided
      if (profileData.username) {
        updateData.username = profileData.username;
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userInfo.id);

      if (updateError) {
        // Handle unique constraint violation for username
        if (updateError.code === '23505' && updateError.message.includes('username')) {
          throw new Error('Username already taken. Please choose a different one.');
        }
        throw updateError;
      }

      // Update local user info
      const updatedUserInfo = {
        ...userInfo,
        name: profileData.name,
        ...(profileData.username && { username: profileData.username })
      };

      setUserInfo(updatedUserInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));

      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(formatSupabaseError(error));
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
    user: userInfo, // Add user property for compatibility
    error,
    login,
    logout,
    register,
    checkLoginStatus,
    sendPasswordResetEmail,
    resetPassword,
    markOnboardingComplete,
    updateProfile,
    isAuthenticated: !!userToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};