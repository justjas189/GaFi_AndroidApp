/**
 * FriendService - Manages friend requests and friendships
 */

import { supabase } from '../config/supabase';

export class FriendService {
  /**
   * Get current user ID from Supabase auth
   */
  static async getCurrentUserId() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  /**
   * Search for users to add as friends
   */
  static async searchUsers(searchTerm) {
    try {
      // Check if current user has a username first
      const currentUser = await this.getCurrentUserId();
      if (!currentUser) {
        return [];
      }

      // Check if current user has username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUser)
        .single();

      if (!profile?.username) {
        console.warn('Current user does not have a username set');
        return [];
      }

      // Search profiles table directly by username or full_name
      const term = searchTerm.trim();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq('id', currentUser)
        .limit(20);

      if (error) {
        console.error('Database error searching users:', error);
        throw error;
      }

      // Map to the shape expected by the UI (user_id, username, full_name)
      return (data || []).filter(u => u.username).map(u => ({
        user_id: u.id,
        username: u.username,
        full_name: u.full_name || u.username,
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Send a friend request
   */
  static async sendFriendRequest(friendUsername) {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Look up the friend's profile by username
      const { data: friendProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', friendUsername)
        .single();

      if (profileError || !friendProfile) {
        return { success: false, error: 'User not found' };
      }

      const friendId = friendProfile.id;

      if (friendId === currentUserId) {
        return { success: false, error: 'You cannot add yourself as a friend' };
      }

      // Check if a friendship/request already exists in either direction
      const { data: existing } = await supabase
        .from('friends')
        .select('id, status')
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return { success: false, error: 'You are already friends with this user' };
        }
        if (existing.status === 'pending') {
          return { success: false, error: 'A friend request already exists' };
        }
      }

      // Insert the friend request with requested_by set to the current user
      const { error: insertError } = await supabase
        .from('friends')
        .insert({
          user_id: currentUserId,
          friend_id: friendId,
          status: 'pending',
          requested_by: currentUserId,
        });

      if (insertError) throw insertError;

      return { success: true, message: 'Friend request sent!' };
    } catch (error) {
      console.error('Error sending friend request:', error);
      return {
        success: false,
        error: error.message || 'Failed to send friend request'
      };
    }
  }

  /**
   * Get pending friend requests
   */
  static async getFriendRequests() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      // Get friend requests using simple query without foreign keys
      const { data: requestsData, error: requestsError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (requestsError) {
        console.error('Error fetching friend requests:', requestsError);
        return [];
      }

      if (!requestsData || requestsData.length === 0) {
        return [];
      }

      // Get profile data for requesters separately
      const requesterIds = requestsData.map(req => req.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', requesterIds);

      if (profilesError) {
        console.warn('Could not fetch requester profiles:', profilesError);
      }

      // Combine data
      return requestsData.map(request => {
        const profile = (profilesData || []).find(p => p.id === request.user_id);
        return {
          id: request.id,
          requester_id: request.user_id,
          requester_name: profile?.full_name || 'Unknown User',
          requester_username: profile?.username || profile?.full_name || 'unknown',
          created_at: new Date().toISOString(), // Use current date since we don't have created_at
          status: request.status
        };
      });
    } catch (error) {
      console.error('Error getting friend requests:', error);
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }
  }

  /**
   * Respond to a friend request (accept/reject)
   */
  static async respondToFriendRequest(requesterId, response) {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Find the pending friend request where requester is user_id and current user is friend_id
      const { data: request, error: fetchError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, requested_by')
        .eq('user_id', requesterId)
        .eq('friend_id', currentUserId)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!request) {
        return { success: false, error: 'Friend request not found' };
      }

      const newStatus = response === 'accept' ? 'accepted' : 'declined';

      // Update the existing row, preserving the requested_by field
      const { error: updateError } = await supabase
        .from('friends')
        .update({
          status: newStatus,
          requested_by: request.requested_by || requesterId,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      return {
        success: true,
        message: response === 'accept' ? 'Friend request accepted!' : 'Friend request declined.'
      };
    } catch (error) {
      console.error('Error responding to friend request:', error);
      return {
        success: false,
        error: error.message || 'Failed to respond to friend request'
      };
    }
  }

  /**
   * Get friends list
   */
  static async getFriendsList() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      // Get friends using simple query without foreign keys
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('id, user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('Error fetching friends:', friendsError);
        return [];
      }

      if (!friendsData || friendsData.length === 0) {
        return [];
      }

      // Get all friend user IDs
      const friendIds = friendsData.map(friend => 
        friend.user_id === userId ? friend.friend_id : friend.user_id
      );

      // Get profile data for friends separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', friendIds);

      if (profilesError) {
        console.warn('Could not fetch friend profiles:', profilesError);
      }

      // Get user levels data for friends separately
      const { data: levelsData, error: levelsError } = await supabase
        .from('user_levels')
        .select('user_id, current_level, total_saved')
        .in('user_id', friendIds);

      if (levelsError) {
        console.warn('Could not fetch friend levels:', levelsError);
      }

      // Combine data
      return friendsData.map(friend => {
        const friendId = friend.user_id === userId ? friend.friend_id : friend.user_id;
        const profile = (profilesData || []).find(p => p.id === friendId);
        const levels = (levelsData || []).find(l => l.user_id === friendId);
        
        return {
          id: friend.id,
          friend_id: friendId,
          friend_name: profile?.full_name || 'Unknown User',
          friend_username: profile?.username || profile?.full_name || 'unknown',
          current_level: levels?.current_level || 1,
          total_saved: parseFloat(levels?.total_saved || 0)
        };
      });
    } catch (error) {
      console.error('Error getting friends list:', error);
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }
  }

  /**
   * Get friends leaderboard
   */
  static async getFriendsLeaderboard() {
    try {
      const friends = await this.getFriendsList();
      const userId = await this.getCurrentUserId();

      if (!friends || friends.length === 0) {
        console.log('No friends found for leaderboard');
        return [];
      }

      // Try to get current user data to add to friends list
      try {
        // Get user levels data without foreign key relationship to avoid errors
        const { data: currentUserLevels, error: levelsError } = await supabase
          .from('user_levels')
          .select('user_id, current_level, total_saved')
          .eq('user_id', userId)
          .single();

        if (levelsError) throw levelsError;

        // Get profile data separately
        let currentUserProfile = null;
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', userId)
            .single();

          if (!profileError) {
            currentUserProfile = profile;
          }
        } catch (profileError) {
          console.warn('Could not fetch user profile:', profileError);
        }

        if (currentUserLevels) {
          friends.push({
            friend_id: currentUserLevels.user_id,
            friend_name: currentUserProfile?.full_name || currentUserProfile?.username || `User ${userId.slice(0, 8)}`,
            friend_username: currentUserProfile?.username || 'Unknown',
            current_level: currentUserLevels.current_level,
            total_saved: parseFloat(currentUserLevels.total_saved || 0)
          });
        }
      } catch (userError) {
        console.log('Could not add current user to friends leaderboard:', userError);
        // Add user with default values if user_levels table doesn't exist
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', userId)
          .single();

        if (userProfile) {
          friends.push({
            friend_id: userId,
            friend_name: userProfile.full_name,
            friend_username: userProfile.username,
            current_level: 1,
            total_saved: 0
          });
        }
      }

      // Sort by total saved
      friends.sort((a, b) => (b.total_saved || 0) - (a.total_saved || 0));

      // Add rankings
      return friends.map((friend, index) => ({
        ...friend,
        rank: index + 1,
        isCurrentUser: friend.friend_id === userId
      }));
    } catch (error) {
      console.error('Error getting friends leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user's position in overall leaderboard
   */
  static async getUserLeaderboardPosition() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return { overall: null, friends: null };

      // Get overall position
      const { data: overallData, error: overallError } = await supabase
        .from('user_levels')
        .select('user_id, total_saved')
        .order('total_saved', { ascending: false });

      let overallPosition = null;
      let totalUsers = 0;
      if (!overallError && overallData) {
        totalUsers = overallData.length;
        overallPosition = overallData.findIndex(user => user.user_id === userId) + 1;
      }

      // Get friends position
      const friendsLeaderboard = await this.getFriendsLeaderboard();
      const friendsPosition = friendsLeaderboard.findIndex(friend => friend.isCurrentUser) + 1;

      return {
        overall: overallPosition > 0 ? overallPosition : null,
        totalUsers,
        friends: friendsPosition > 0 ? friendsPosition : null,
        totalFriends: friendsLeaderboard.length
      };
    } catch (error) {
      console.error('Error getting user leaderboard position:', error);
      return { overall: null, friends: null };
    }
  }

  /**
   * Remove friend
   */
  static async removeFriend(friendId) {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (error) throw error;

      return {
        success: true,
        message: 'Friend removed successfully'
      };
    } catch (error) {
      console.error('Error removing friend:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove friend'
      };
    }
  }
}
