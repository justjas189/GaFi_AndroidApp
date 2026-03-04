// src/screens/main/ManageFriendsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FriendService } from '../../services/FriendService';

const { width } = Dimensions.get('window');

const ManageFriendsScreen = ({ navigation }) => {
  const { theme } = useTheme();

  // Friends list state
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Friend modal state
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Active tab: 'friends' | 'requests'
  const [activeTab, setActiveTab] = useState('friends');

  // ── Data loading ──

  const loadData = useCallback(async () => {
    try {
      const [friendsList, requests] = await Promise.all([
        FriendService.getFriendsList(),
        FriendService.getFriendRequests(),
      ]);
      setFriends(friendsList || []);
      setPendingRequests(requests || []);
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Search ──

  const searchUsers = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const results = await FriendService.searchUsers(term);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Actions ──

  const sendFriendRequest = async (username) => {
    try {
      const result = await FriendService.sendFriendRequest(username);
      if (result.success) {
        Alert.alert('Success', 'Friend request sent!');
        setShowAddFriendModal(false);
        setSearchTerm('');
        setSearchResults([]);
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const respondToRequest = async (requesterId, response) => {
    try {
      const result = await FriendService.respondToFriendRequest(requesterId, response);
      if (result.success) {
        Alert.alert('Success', result.message || `Request ${response}ed`);
        await loadData(); // Refresh lists
      } else {
        Alert.alert('Error', result.error || 'Failed to respond to friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const removeFriend = async (friendId, friendName) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await FriendService.removeFriend(friendId);
              if (result.success) {
                Alert.alert('Success', 'Friend removed');
                await loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to remove friend');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  // ── Render helpers ──

  const renderFriendItem = (friend, index) => (
    <View
      key={friend.friend_id || index}
      style={[styles.friendCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.avatarText}>
          {(friend.friend_name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: theme.colors.text }]} numberOfLines={1}>
          {friend.friend_name}
        </Text>
        <Text style={[styles.friendUsername, { color: theme.colors.textSecondary }]}>
          @{friend.friend_username}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeFriend(friend.friend_id, friend.friend_name)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={24} color={theme.colors.error || '#f44336'} />
      </TouchableOpacity>
    </View>
  );

  const renderRequestItem = (request, index) => (
    <View
      key={request.id || index}
      style={[styles.requestCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={[styles.avatarCircle, { backgroundColor: '#FF9800' }]}>
        <Text style={styles.avatarText}>
          {(request.requester_name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: theme.colors.text }]} numberOfLines={1}>
          {request.requester_name}
        </Text>
        <Text style={[styles.friendUsername, { color: theme.colors.textSecondary }]}>
          @{request.requester_username}
        </Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.acceptBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => respondToRequest(request.requester_id, 'accept')}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineBtn, { backgroundColor: theme.colors.error || '#f44336' }]}
          onPress={() => respondToRequest(request.requester_id, 'decline')}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Add Friend Modal ──

  const renderAddFriendModal = () => (
    <Modal
      visible={showAddFriendModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddFriendModal(false)}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>🤝 Add Friend</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddFriendModal(false);
                setSearchTerm('');
                setSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search by username or name..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchTerm}
              onChangeText={(text) => {
                setSearchTerm(text);
                searchUsers(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView style={styles.searchResultsList} keyboardShouldPersistTaps="handled">
            {searchLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
            ) : searchResults.length > 0 ? (
              searchResults.map((resultUser) => (
                <TouchableOpacity
                  key={resultUser.user_id}
                  style={[styles.searchResultItem, { backgroundColor: theme.colors.card }]}
                  onPress={() => sendFriendRequest(resultUser.username)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary, width: 40, height: 40 }]}>
                    <Text style={[styles.avatarText, { fontSize: 16 }]}>
                      {(resultUser.full_name || resultUser.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.friendName, { color: theme.colors.text }]}>
                      {resultUser.full_name}
                    </Text>
                    <Text style={[styles.friendUsername, { color: theme.colors.textSecondary }]}>
                      @{resultUser.username}
                    </Text>
                  </View>
                  <View style={[styles.addIconBtn, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="person-add" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))
            ) : searchTerm.trim() ? (
              <Text style={[styles.searchStatus, { color: theme.colors.textSecondary }]}>
                No users found
              </Text>
            ) : (
              <Text style={[styles.searchStatus, { color: theme.colors.textSecondary }]}>
                Enter a username to search
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ── Main render ──

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Friends</Text>
        <TouchableOpacity
          onPress={() => setShowAddFriendModal(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="person-add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons name="people" size={18} color={activeTab === 'friends' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'friends' ? theme.colors.primary : theme.colors.textSecondary }]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons name="mail" size={18} color={activeTab === 'requests' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'requests' ? theme.colors.primary : theme.colors.textSecondary }]}>
            Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'friends' ? (
          friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No friends yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Search for users and send them a friend request!
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowAddFriendModal(true)}
              >
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            friends.map((friend, i) => renderFriendItem(friend, i))
          )
        ) : pendingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No pending requests</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              When someone sends you a friend request, it will appear here.
            </Text>
          </View>
        ) : (
          pendingRequests.map((req, i) => renderRequestItem(req, i))
        )}
      </ScrollView>

      {renderAddFriendModal()}
    </SafeAreaView>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Friend Card
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 13,
    marginBottom: 4,
  },
  friendMeta: {
    flexDirection: 'row',
    gap: 14,
  },
  friendLevel: {
    fontSize: 13,
    fontWeight: '600',
  },
  friendSaved: {
    fontSize: 13,
  },
  removeBtn: {
    padding: 4,
  },

  // Request Card
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchStatus: {
    textAlign: 'center',
    fontSize: 15,
    paddingVertical: 24,
  },
});

export default ManageFriendsScreen;
