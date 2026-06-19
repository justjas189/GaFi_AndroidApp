// src/screens/main/ManageFriendsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { FriendService } from '../../services/FriendService';
import { FONTS } from '../../theme/typography';
import { toast } from '../../utils/toast';
import { useConfirm } from '../../components/feedback/ConfirmProvider';

const { width } = Dimensions.get('window');

// One avatar for every row. Shows the user's profile picture (Google/OAuth
// avatar_url) when present, and falls back to the coloured initial circle so
// username-only accounts and stale rows still render cleanly. Hoisted to module
// scope so the <Image> keeps its identity across re-renders (a friends-list
// refresh shouldn't reload and flash every picture).
const Avatar = ({ uri, name, color, size = 46 }) => {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatarImage, dims]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={`${name || 'User'} profile picture`}
      />
    );
  }
  return (
    <View style={[styles.avatarCircle, dims, { backgroundColor: color }]}>
      <Text style={[styles.avatarText, size <= 40 && { fontSize: 16 }]}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

const ManageFriendsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const confirm = useConfirm();

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
        // The request lands on THEIR screen — nothing changes here to ghost
        // against. Close the search modal, then let the toast carry the win.
        setShowAddFriendModal(false);
        setSearchTerm('');
        setSearchResults([]);
        toast.success('Request sent', `@${username} will see it in their requests.`);
      } else {
        toast.error('Could not send request', result.error || 'Try again.');
      }
    } catch (error) {
      toast.error('Could not send request', 'Something went wrong. Try again.');
    }
  };

  const respondToRequest = async (requesterId, response) => {
    // Declining permanently drops the request, and the X sits right next to
    // Accept — guard the destructive path with a confirm. Accept needs none:
    // the card vanishing and the Friends count ticking up IS the reward.
    if (response === 'decline') {
      const ok = await confirm({
        title: 'Decline request?',
        message: 'This removes the request. They can send another later.',
        confirmLabel: 'Decline',
        cancelLabel: 'Keep',
        destructive: true,
        icon: 'person-remove-outline',
      });
      if (!ok) return;
    }
    try {
      const result = await FriendService.respondToFriendRequest(requesterId, response);
      if (result.success) {
        // Ghost: loadData() drops the request card (and on accept bumps the
        // Friends list + count) — that swap is the confirmation.
        await loadData();
      } else {
        toast.error('Could not respond', result.error || 'Try again.');
      }
    } catch (error) {
      toast.error('Something went wrong', 'Could not update the request. Try again.');
    }
  };

  const removeFriend = async (friendId, friendName) => {
    const ok = await confirm({
      title: 'Remove friend?',
      message: `${friendName} will be removed from your friends. You can add them back later.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      destructive: true,
      icon: 'person-remove-outline',
    });
    if (!ok) return;
    try {
      const result = await FriendService.removeFriend(friendId);
      if (result.success) {
        // Ghost: loadData() drops the friend card + the Friends count — the
        // card disappearing is the confirmation.
        await loadData();
      } else {
        toast.error('Remove failed', result.error || 'Could not remove this friend. Try again.');
      }
    } catch (error) {
      toast.error('Remove failed', 'Could not remove this friend. Try again.');
    }
  };

  // ── Render helpers ──

  const renderFriendItem = (friend, index) => (
    <View
      key={friend.friend_id || index}
      style={[styles.friendCard, { backgroundColor: theme.colors.card }]}
    >
      <Avatar uri={friend.friend_avatar} name={friend.friend_name} color={theme.colors.primary} />
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
      <Avatar uri={request.requester_avatar} name={request.requester_name} color="#FF9800" />
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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Friend</Text>
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
                  <Avatar
                    uri={resultUser.avatar_url}
                    name={resultUser.full_name || resultUser.username}
                    color={theme.colors.primary}
                    size={40}
                  />
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
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
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
    fontFamily: FONTS.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
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
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
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
    fontFamily: FONTS.numberBold,
    color: '#fff',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
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
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    // Faint placeholder tint while the remote picture streams in.
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  avatarText: {
    fontFamily: FONTS.headingBold,
    color: '#fff',
    fontSize: 20,
  },
  // Gap lives on the info column (not the avatar) so the picture and the
  // initials circle sit at the exact same offset.
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    marginBottom: 2,
  },
  friendUsername: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    marginBottom: 4,
  },
  friendMeta: {
    flexDirection: 'row',
    gap: 14,
  },
  friendLevel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  friendSaved: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
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
    fontFamily: FONTS.headingSemiBold,
    fontSize: 20,
    letterSpacing: -0.2,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: FONTS.bodyRegular,
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
    fontFamily: FONTS.bodySemiBold,
    color: '#fff',
    fontSize: 16,
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
    fontFamily: FONTS.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
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
    fontFamily: FONTS.bodyRegular,
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
    fontFamily: FONTS.bodyRegular,
    textAlign: 'center',
    fontSize: 15,
    paddingVertical: 24,
  },
});

export default ManageFriendsScreen;
