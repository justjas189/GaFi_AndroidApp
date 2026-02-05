import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FriendService } from '../../services/FriendService';

const FriendsListScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const friendsList = await FriendService.getFriendsList();
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
      
      // Show more specific error messages
      let errorMessage = 'Failed to load friends list';
      if (error.message?.includes('function') || error.code === '42804') {
        errorMessage = 'Database needs to be updated. Please contact support.';
      } else if (error.message?.includes('authentication')) {
        errorMessage = 'Please log in again to view friends.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  const removeFriend = async (friendId, friendName) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await FriendService.removeFriend(friendId);
              if (result.success) {
                Alert.alert('Success', 'Friend removed successfully');
                await loadFriends(); // Refresh the list
              } else {
                Alert.alert('Error', result.error || 'Failed to remove friend');
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const renderFriend = (friend, index) => {
    return (
      <View 
        key={friend.friend_id || index}
        style={[styles.friendItem, { backgroundColor: theme.colors.card }]}
      >
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: theme.colors.text }]}>
            {friend.friend_name}
          </Text>
          <Text style={[styles.friendUsername, { color: theme.colors.text + 'CC' }]}>
            @{friend.friend_username}
          </Text>
          <View style={styles.friendStats}>
            <Text style={[styles.friendLevel, { color: theme.colors.primary }]}>
              Level {friend.current_level || 1}
            </Text>
            <Text style={[styles.friendSavings, { color: theme.colors.text + '80' }]}>
              ₱{(friend.total_saved || 0).toLocaleString()} saved
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFriend(friend.friend_id, friend.friend_name)}
        >
          <Ionicons name="remove-circle-outline" size={24} color="#f44336" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading friends...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Friends ({friends.length})
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <Ionicons name="mail-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {friends.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.colors.text + '40'} />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>
              No friends yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.text + 'CC' }]}>
              Add friends to compete with them and track your progress together!
            </Text>
            <TouchableOpacity
              style={[styles.addFriendsButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.addFriendsButtonText}>Add Friends</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.friendsList}>
            {friends.map((friend, index) => renderFriend(friend, index))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  friendsList: {
    paddingVertical: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    marginBottom: 8,
  },
  friendStats: {
    flexDirection: 'row',
    gap: 16,
  },
  friendLevel: {
    fontSize: 14,
    fontWeight: '600',
  },
  friendSavings: {
    fontSize: 14,
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addFriendsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FriendsListScreen;
