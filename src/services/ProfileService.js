/**
 * ProfileService - Basic profile management service
 * Provides methods for username setup and profile management
 */

import { supabase } from '../config/supabase';
import { getUserIdSafe } from './AuthSessionHelper';

class ProfileService {
  /**
   * Check if username setup is needed for the current user
   * @returns {Promise<boolean>} Whether username setup is needed
   */
  static async checkUsernameSetupNeeded() {
    try {
      const { userId, rateLimited, error } = await getUserIdSafe();
      if (rateLimited) {
        console.warn('ProfileService: rate limited while checking username setup');
        return false;
      }
      if (error || !userId) {
        return false; // Not authenticated
        // , no setup needed
      }

      // Check if user has a profile with both name and username.
      // select('*') + maybeSingle() tolerates schema drift (no 400 on a
      // missing column) and a not-yet-created row (no PGRST116 throw).
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking profile:', profileError);
        return false;
      }

      // Username setup needed if no username exists (for Friends feature)
      return !profile?.username;
    } catch (error) {
      console.error('Error checking username setup:', error);
      return false;
    }
  }

  /**
   * Set up username for the current user
   * @param {string} username - The username to set
   * @returns {Promise<{success: boolean, error?: string}>} Setup result
   */
  static async setupUsername(username) {
    try {
      const { userId, rateLimited, error } = await getUserIdSafe();
      if (rateLimited) {
        return { success: false, error: 'Network busy. Please try again.' };
      }
      if (error || !userId) {
        throw new Error('User not authenticated');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Error setting up username:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to setup username'
      };
    }
  }

  /**
   * Validate a username's format (synchronous, no network).
   * Mirrors the DB constraints: 3-30 chars, letters/numbers/underscore only.
   * @param {string} username
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateUsername(username) {
    const value = (username || '').trim();

    if (value.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (value.length > 30) {
      return { valid: false, error: 'Username must be 30 characters or fewer' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return { valid: false, error: 'Use only letters, numbers, and underscores' };
    }

    return { valid: true };
  }

  /**
   * Check whether a username is free. Runs at signup time when the user is
   * UNAUTHENTICATED, so it goes through the `is_username_available` RPC
   * (SECURITY DEFINER) rather than a direct `profiles` SELECT, which RLS
   * would hide from the anon role. Same pattern as `check_email_exists`.
   * @param {string} username
   * @returns {Promise<boolean>} true if available
   */
  static async isUsernameAvailable(username) {
    const normalized = (username || '').trim();
    if (!normalized) return false;

    try {
      const { data, error } = await supabase.rpc('is_username_available', {
        check_username: normalized,
      });

      if (error) {
        console.error('Error checking username availability:', error);
        // Fail open: a transient/RPC error shouldn't paint every username as
        // taken. The DB unique index on username is the real guard at insert.
        return true;
      }

      return data === true;
    } catch (err) {
      console.error('Error in isUsernameAvailable:', err);
      return true;
    }
  }

  /**
   * Get current user profile
   * @returns {Promise<object|null>} User profile or null
   */
  static async getCurrentProfile() {
    try {
      const { userId, rateLimited, error } = await getUserIdSafe();
      if (rateLimited) {
        console.warn('ProfileService: rate limited while getting profile');
        return null;
      }
      if (error || !userId) {
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      return profile;
    } catch (error) {
      console.error('Error getting current profile:', error);
      return null;
    }
  }
}

export default ProfileService;