/**
 * ProfileService - Basic profile management service
 * Provides methods for username setup and profile management
 */

import { supabase } from '../config/supabase';

class ProfileService {
  /**
   * Check if username setup is needed for the current user
   * @returns {Promise<boolean>} Whether username setup is needed
   */
  static async checkUsernameSetupNeeded() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return false; // Not authenticated, no setup needed
      }

      // Check if user has a profile with both name and username
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error checking profile:', error);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (error) throw error;

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      return profile;
    } catch (error) {
      console.error('Error getting current profile:', error);
      return null;
    }
  }
}

export default ProfileService;