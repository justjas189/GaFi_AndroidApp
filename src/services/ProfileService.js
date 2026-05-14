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
        return false; // Not authenticated, no setup needed
      }

      // Check if user has a profile with both name and username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', userId)
        .single();

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
        .single();

      if (profileError) throw profileError;
      return profile;
    } catch (error) {
      console.error('Error getting current profile:', error);
      return null;
    }
  }
}

export default ProfileService;