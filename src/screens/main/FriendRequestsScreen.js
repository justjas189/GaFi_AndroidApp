import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FriendService } from '../../services/FriendService';

const FriendRequestsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFriendRequests();
  }, []);

  const loadFriendRequests = async () => {
    try {
      setLoading(true);
      const requests = await FriendService.getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      
      // Show more specific error messages
      let errorMessage = 'Failed to load friend requests';
      if (error.message?.includes('function') || error.code === '42804') {
        errorMessage = 'Database needs to be updated. Please contact support.';
      } else if (error.message?.includes('authentication')) {
        errorMessage = 'Please log in again to view friend requests.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriendRequests();
    setRefreshing(false);
  };

  const handleFriendRequest = async (requesterId, response) => {
    try {
      const result = await FriendService.respondToFriendRequest(requesterId, response);
      
      if (result.success) {
        Alert.alert(
          'Success',
          response === 'accepted' ? 'Friend request accepted!' : 'Friend request declined.'
        );
        // Reload the requests
        await loadFriendRequests();
      } else {
        Alert.alert('Error', result.error || 'Failed to respond to friend request');
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      Alert.alert('Error', 'Failed to respond to friend request');
    }
  };

  const renderFriendRequest = (request, index) => {
    return (
      <View 
        key={request.requester_id || index}
        style={[styles.requestItem, { backgroundColor: theme.colors.card }]}
      >
        <View style={styles.requestInfo}>
          <Text style={[styles.requestName, { color: theme.colors.text }]}>
            {request.requester_name}
          </Text>
          <Text style={[styles.requestUsername, { color: theme.colors.text + 'CC' }]}>
            @{request.requester_username}
          </Text>
          <Text style={[styles.requestDate, { color: theme.colors.text + '80' }]}>
            {new Date(request.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleFriendRequest(request.requester_id, 'accepted')}
          >
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineButton, { backgroundColor: '#f44336' }]}
            onPress={() => handleFriendRequest(request.requester_id, 'declined')}
          >
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading friend requests...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Friend Requests
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {friendRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={64} color={theme.colors.text + '40'} />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>
              No friend requests
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.text + 'CC' }]}>
              When someone sends you a friend request, it will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {friendRequests.map((request, index) => renderFriendRequest(request, index))}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  headerSpacer: {
    width: 44, // Same width as back button for centering
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  requestsList: {
    paddingVertical: 10,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  requestUsername: {
    fontSize: 14,
    marginBottom: 2,
  },
  requestDate: {
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});

export default FriendRequestsScreen;
