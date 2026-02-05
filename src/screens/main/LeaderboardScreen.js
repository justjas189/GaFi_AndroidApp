import React, { useState, useEffect } from 'react';
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
  Dimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { AchievementService } from '../../services/AchievementService';
import { FriendService } from '../../services/FriendService';

const { width } = Dimensions.get('window');

// Player rank titles based on XP
const RANK_TITLES = [
  { minXP: 0, title: 'Rookie Tracker', icon: '🌱', color: '#4CAF50' },
  { minXP: 100, title: 'Budget Apprentice', icon: '📝', color: '#8BC34A' },
  { minXP: 250, title: 'Money Scout', icon: '🔍', color: '#CDDC39' },
  { minXP: 500, title: 'Savings Warrior', icon: '⚔️', color: '#FFEB3B' },
  { minXP: 1000, title: 'Finance Knight', icon: '🛡️', color: '#FFC107' },
  { minXP: 2000, title: 'Budget Master', icon: '🎯', color: '#FF9800' },
  { minXP: 3500, title: 'Wealth Guardian', icon: '🏰', color: '#FF5722' },
  { minXP: 5000, title: 'Money Legend', icon: '👑', color: '#E91E63' },
  { minXP: 7500, title: 'Financial Sage', icon: '🧙', color: '#9C27B0' },
  { minXP: 10000, title: 'Economy God', icon: '⭐', color: '#673AB7' },
];

// Story Mode Level Configurations
const STORY_LEVELS = {
  1: {
    name: 'Budget Basics',
    description: 'Learn the 50/30/20 rule',
    icon: '📊',
    color: '#4CAF50',
  },
  2: {
    name: 'Goal Setter',
    description: 'Set and reach savings goals',
    icon: '🎯',
    color: '#FF9800',
  },
  3: {
    name: 'Super Saver',
    description: 'Save 30% of your budget',
    icon: '👑',
    color: '#9C27B0',
  },
};

const LeaderboardScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overall');
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [currentUserStats, setCurrentUserStats] = useState({
    totalXP: 0,
    achievementsUnlocked: 0,
    totalAchievements: 24,
    rank: null,
    rankTitle: RANK_TITLES[0]
  });
  const [storyProgress, setStoryProgress] = useState({
    level1: { completed: false, progress: 0, attempts: 0 },
    level2: { completed: false, progress: 0, attempts: 0 },
    level3: { completed: false, progress: 0, attempts: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Create dynamic styles based on theme
  const styles = createStyles(colors, isDarkMode);

  useEffect(() => {
    loadLeaderboardData();
    loadStoryProgress();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const getRankTitle = (xp) => {
    for (let i = RANK_TITLES.length - 1; i >= 0; i--) {
      if (xp >= RANK_TITLES[i].minXP) {
        return RANK_TITLES[i];
      }
    }
    return RANK_TITLES[0];
  };

  const getNextRank = (xp) => {
    for (let i = 0; i < RANK_TITLES.length; i++) {
      if (xp < RANK_TITLES[i].minXP) {
        return RANK_TITLES[i];
      }
    }
    return null; // Max rank reached
  };

  // Load Story Mode Progress from Supabase
  const loadStoryProgress = async () => {
    if (!user?.id) return;

    try {
      // Check for story level completion achievements
      const { data: achievements, error } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked_at, metadata')
        .eq('user_id', user.id)
        .in('achievement_id', ['story_level_1', 'story_level_2', 'story_level_3', 'budget_basics', 'goal_setter', 'super_saver']);

      if (error) {
        console.log('Error fetching story progress:', error);
      }

      // Also check user_levels for additional progress data
      const { data: userLevels, error: levelsError } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const completedLevels = new Set();
      (achievements || []).forEach(a => {
        if (a.achievement_id.includes('level_1') || a.achievement_id === 'budget_basics') {
          completedLevels.add(1);
        }
        if (a.achievement_id.includes('level_2') || a.achievement_id === 'goal_setter') {
          completedLevels.add(2);
        }
        if (a.achievement_id.includes('level_3') || a.achievement_id === 'super_saver') {
          completedLevels.add(3);
        }
      });

      // Calculate progress based on current level from user_levels
      const currentLevel = userLevels?.current_level || 0;

      setStoryProgress({
        level1: {
          completed: completedLevels.has(1) || currentLevel >= 2,
          progress: completedLevels.has(1) || currentLevel >= 2 ? 100 : (currentLevel === 1 ? 50 : 0),
          attempts: userLevels?.goals_completed || 0,
        },
        level2: {
          completed: completedLevels.has(2) || currentLevel >= 3,
          progress: completedLevels.has(2) || currentLevel >= 3 ? 100 : (currentLevel === 2 ? 50 : 0),
          attempts: 0,
        },
        level3: {
          completed: completedLevels.has(3) || currentLevel >= 4,
          progress: completedLevels.has(3) || currentLevel >= 4 ? 100 : (currentLevel === 3 ? 50 : 0),
          attempts: 0,
        },
      });

    } catch (error) {
      console.error('Error loading story progress:', error);
    }
  };

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);

      // Get all users' achievement points from user_achievements table
      const { data: allUserAchievements, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('user_id, points, achievement_id');

      if (achievementsError) {
        console.error('Error fetching achievements:', achievementsError);
      }

      // Aggregate points by user
      const userPointsMap = {};
      const userAchievementCountMap = {};
      
      (allUserAchievements || []).forEach(achievement => {
        const oduserId = achievement.user_id;
        if (!userPointsMap[oduserId]) {
          userPointsMap[oduserId] = 0;
          userAchievementCountMap[oduserId] = 0;
        }
        userPointsMap[oduserId] += achievement.points || 0;
        userAchievementCountMap[oduserId] += 1;
      });

      // Get user profiles
      const userIds = Object.keys(userPointsMap);
      let profilesData = [];

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        if (!profilesError) {
          profilesData = profiles || [];
        }
      }

      // Build leaderboard
      const leaderboardData = userIds
        .map(oduserId => {
          const profile = profilesData.find(p => p.id === oduserId);
          const totalXP = userPointsMap[oduserId];
          const rankTitle = getRankTitle(totalXP);
          
          return {
            rank: 0,
            oduserId,
            name: profile?.full_name || profile?.username || `Player ${oduserId.slice(0, 6)}`,
            totalXP,
            achievementsUnlocked: userAchievementCountMap[oduserId] || 0,
            rankTitle,
            isCurrentUser: oduserId === user?.id
          };
        })
        .sort((a, b) => b.totalXP - a.totalXP)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      // If no data, create sample leaderboard
      if (leaderboardData.length === 0) {
        const sampleLeaderboard = [
          { rank: 1, oduserId: 'sample-1', name: 'ProSaver99', totalXP: 1250, achievementsUnlocked: 12, rankTitle: getRankTitle(1250), isCurrentUser: false },
          { rank: 2, oduserId: 'sample-2', name: 'BudgetKing', totalXP: 890, achievementsUnlocked: 9, rankTitle: getRankTitle(890), isCurrentUser: false },
          { rank: 3, oduserId: 'sample-3', name: 'MoneyMaster', totalXP: 650, achievementsUnlocked: 7, rankTitle: getRankTitle(650), isCurrentUser: false },
          { rank: 4, oduserId: 'sample-4', name: 'SmartSpender', totalXP: 420, achievementsUnlocked: 5, rankTitle: getRankTitle(420), isCurrentUser: false },
          { rank: 5, oduserId: 'sample-5', name: 'ThriftyTom', totalXP: 280, achievementsUnlocked: 4, rankTitle: getRankTitle(280), isCurrentUser: false },
        ];
        setLeaderboard(sampleLeaderboard);
      } else {
        setLeaderboard(leaderboardData);
      }

      // Get current user's stats
      if (user?.id) {
        const userTotalXP = userPointsMap[user.id] || 0;
        const userAchievements = userAchievementCountMap[user.id] || 0;
        const userRank = leaderboardData.find(entry => entry.oduserId === user.id)?.rank || null;
        const totalAchievements = AchievementService.getAchievementDefinitionsArray().length;

        setCurrentUserStats({
          totalXP: userTotalXP,
          achievementsUnlocked: userAchievements,
          totalAchievements,
          rank: userRank,
          rankTitle: getRankTitle(userTotalXP)
        });
      }

      // Load friends leaderboard
      try {
        const friendsData = await FriendService.getFriendsLeaderboard();
        if (Array.isArray(friendsData) && friendsData.length > 0) {
          // Transform friends data to match our format
          const friendsWithXP = friendsData.map((friend, index) => ({
            rank: index + 1,
            oduserId: friend.friend_id,
            name: friend.friend_name || 'Friend',
            totalXP: friend.total_xp || friend.total_saved || 0,
            achievementsUnlocked: friend.achievements_count || 0,
            rankTitle: getRankTitle(friend.total_xp || 0),
            isCurrentUser: friend.isCurrentUser
          })).sort((a, b) => b.totalXP - a.totalXP);
          
          setFriendsLeaderboard(friendsWithXP);
        }
      } catch (error) {
        console.log('Friends leaderboard not available:', error);
        setFriendsLeaderboard([]);
      }

    } catch (error) {
      console.error('Error loading leaderboard:', error);
      Alert.alert('Error', 'Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboardData();
    await loadStoryProgress();
    setRefreshing(false);
  };

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

  const getProgressToNextRank = () => {
    const nextRank = getNextRank(currentUserStats.totalXP);
    if (!nextRank) return 100; // Max rank
    
    const currentRank = currentUserStats.rankTitle;
    const currentMin = currentRank.minXP;
    const nextMin = nextRank.minXP;
    
    const progress = ((currentUserStats.totalXP - currentMin) / (nextMin - currentMin)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const renderUserStatsCard = () => {
    const nextRank = getNextRank(currentUserStats.totalXP);
    const progress = getProgressToNextRank();

    return (
      <Animated.View style={[styles.userStatsCard, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.userStatsGradient}>
          {/* Rank Badge */}
          <View style={styles.rankBadgeContainer}>
            <View style={[styles.rankBadge, { backgroundColor: currentUserStats.rankTitle.color }]}>
              <Text style={styles.rankBadgeIcon}>{currentUserStats.rankTitle.icon}</Text>
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.rankTitle}>{currentUserStats.rankTitle.title}</Text>
              {currentUserStats.rank && (
                <Text style={styles.globalRank}>Global Rank: #{currentUserStats.rank}</Text>
              )}
            </View>
          </View>

          {/* XP Display */}
          <View style={styles.xpContainer}>
            <View style={styles.xpMain}>
              <Ionicons name="star" size={28} color={colors.primary} />
              <Text style={styles.xpValue}>{currentUserStats.totalXP.toLocaleString()}</Text>
              <Text style={styles.xpLabel}>XP</Text>
            </View>
            <View style={styles.achievementCount}>
              <Ionicons name="trophy" size={20} color={colors.warning} />
              <Text style={styles.achievementText}>
                {currentUserStats.achievementsUnlocked}/{currentUserStats.totalAchievements}
              </Text>
              <Text style={styles.achievementLabel}>Achievements</Text>
            </View>
          </View>

          {/* Progress to Next Rank */}
          {nextRank && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Next: {nextRank.title}</Text>
                <Text style={styles.progressXP}>
                  {currentUserStats.totalXP} / {nextRank.minXP} XP
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progress}%`, backgroundColor: nextRank.color }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => navigation.navigate('Achievements')}
            >
              <Ionicons name="ribbon" size={18} color={colors.primary} />
              <Text style={styles.quickStatText}>View Achievements</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Render Story Mode Progress Section
  const renderStoryProgress = () => {
    const levels = [
      { key: 'level1', num: 1, ...STORY_LEVELS[1], ...storyProgress.level1 },
      { key: 'level2', num: 2, ...STORY_LEVELS[2], ...storyProgress.level2 },
      { key: 'level3', num: 3, ...STORY_LEVELS[3], ...storyProgress.level3 },
    ];

    return (
      <View style={styles.storyProgressSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📖 Story Mode Progress</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Build')}>
            <Text style={styles.playNowText}>Play Now →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.storyLevelsContainer}>
          {levels.map((level, index) => (
            <View key={level.key} style={styles.storyLevelCard}>
              <View style={styles.storyLevelHeader}>
                <View style={[styles.storyLevelIcon, { backgroundColor: level.color }]}>
                  <Text style={styles.storyLevelEmoji}>{level.icon}</Text>
                </View>
                <View style={styles.storyLevelInfo}>
                  <Text style={styles.storyLevelName}>Level {level.num}: {level.name}</Text>
                  <Text style={styles.storyLevelDesc}>{level.description}</Text>
                </View>
                {level.completed && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              <View style={styles.storyProgressBarContainer}>
                <View style={styles.storyProgressBarBg}>
                  <View 
                    style={[
                      styles.storyProgressBarFill, 
                      { 
                        width: `${level.progress}%`, 
                        backgroundColor: level.completed ? colors.success : level.color 
                      }
                    ]} 
                  />
                </View>
                <Text style={[
                  styles.storyProgressPercent,
                  level.completed && { color: colors.success }
                ]}>
                  {level.progress}%
                </Text>
              </View>

              {/* Status Text */}
              <Text style={styles.storyStatusText}>
                {level.completed 
                  ? '✅ Completed!' 
                  : level.progress > 0 
                    ? '🔄 In Progress...' 
                    : index === 0 
                      ? '🔓 Ready to start' 
                      : '🔒 Complete previous level'}
              </Text>
            </View>
          ))}
        </View>

        {/* Overall Story Progress */}
        <View style={styles.overallProgress}>
          <Text style={styles.overallProgressText}>
            Overall: {Math.round((storyProgress.level1.progress + storyProgress.level2.progress + storyProgress.level3.progress) / 3)}% Complete
          </Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3].map((num) => (
              <Ionicons 
                key={num}
                name={storyProgress[`level${num}`].completed ? 'star' : 'star-outline'} 
                size={24} 
                color={storyProgress[`level${num}`].completed ? colors.warning : colors.textSecondary} 
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'overall' && styles.activeTab]}
        onPress={() => setActiveTab('overall')}
      >
        <Ionicons 
          name="globe" 
          size={20} 
          color={activeTab === 'overall' ? colors.primary : colors.textSecondary} 
        />
        <Text style={[
          styles.tabText,
          activeTab === 'overall' && styles.activeTabText
        ]}>
          Global
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
        onPress={() => setActiveTab('friends')}
      >
        <Ionicons 
          name="people" 
          size={20} 
          color={activeTab === 'friends' ? colors.primary : colors.textSecondary} 
        />
        <Text style={[
          styles.tabText,
          activeTab === 'friends' && styles.activeTabText
        ]}>
          Friends
        </Text>
        {friendsLeaderboard.length > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{friendsLeaderboard.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderLeaderboardItem = (player, index) => {
    const isTopThree = player.rank <= 3;
    const medalIcons = ['🥇', '🥈', '🥉'];

    return (
      <View 
        key={player.oduserId}
        style={[
          styles.leaderboardItem,
          player.isCurrentUser && styles.currentUserItem,
          isTopThree && styles.topThreeItem
        ]}
      >
        {/* Rank */}
        <View style={styles.rankColumn}>
          {isTopThree ? (
            <Text style={styles.medalEmoji}>{medalIcons[player.rank - 1]}</Text>
          ) : (
            <Text style={styles.rankNumber}>#{player.rank}</Text>
          )}
        </View>

        {/* Player Info */}
        <View style={styles.playerInfo}>
          <View style={[styles.playerAvatar, { backgroundColor: player.rankTitle.color }]}>
            <Text style={styles.avatarEmoji}>{player.rankTitle.icon}</Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={[styles.playerName, player.isCurrentUser && styles.currentUserName]}>
              {player.name} {player.isCurrentUser && '(You)'}
            </Text>
            <Text style={styles.playerRankTitle}>{player.rankTitle.title}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.playerStats}>
          <View style={styles.xpBadge}>
            <Ionicons name="star" size={14} color={colors.primary} />
            <Text style={styles.xpBadgeText}>{player.totalXP.toLocaleString()}</Text>
          </View>
          <Text style={styles.achievementCountSmall}>
            🏆 {player.achievementsUnlocked}
          </Text>
        </View>
      </View>
    );
  };

  const renderAddFriendModal = () => (
    <Modal
      visible={showAddFriendModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAddFriendModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🤝 Add Friend</Text>
            <TouchableOpacity
              onPress={() => setShowAddFriendModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username..."
              placeholderTextColor={colors.textSecondary}
              value={searchTerm}
              onChangeText={(text) => {
                setSearchTerm(text);
                searchUsers(text);
              }}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={styles.searchResults}>
            {searchLoading ? (
              <Text style={styles.searchStatus}>Searching...</Text>
            ) : searchResults.length > 0 ? (
              searchResults.map((resultUser) => (
                <TouchableOpacity
                  key={resultUser.user_id}
                  style={styles.searchResultItem}
                  onPress={() => sendFriendRequest(resultUser.username)}
                >
                  <View style={styles.searchUserInfo}>
                    <Text style={styles.searchUserName}>{resultUser.full_name}</Text>
                    <Text style={styles.searchUsername}>@{resultUser.username}</Text>
                  </View>
                  <View style={styles.addButton}>
                    <Ionicons name="person-add" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ))
            ) : searchTerm.trim() ? (
              <Text style={styles.searchStatus}>No users found</Text>
            ) : (
              <Text style={styles.searchStatus}>Enter a username to search</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="trophy" size={48} color={colors.primary} />
          <Text style={styles.loadingText}>Loading Leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentLeaderboard = activeTab === 'overall' ? leaderboard : friendsLeaderboard;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('FriendsList')}
          >
            <Ionicons name="people" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowAddFriendModal(true)}
          >
            <Ionicons name="person-add" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {renderTabs()}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderUserStatsCard()}

        {/* Story Mode Progress Section */}
        {renderStoryProgress()}

        {/* Leaderboard Section */}
        <View style={styles.leaderboardSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'overall' ? '🌍 Global Rankings' : '👥 Friends Rankings'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {currentLeaderboard.length} players
            </Text>
          </View>

          {currentLeaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'overall' ? 'globe-outline' : 'people-outline'} 
                size={64} 
                color={colors.textSecondary} 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'overall' ? 'No rankings yet' : 'No friends yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'overall' 
                  ? 'Start earning achievements to appear on the leaderboard!' 
                  : 'Add friends to compete with them!'}
              </Text>
              {activeTab === 'friends' && (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => setShowAddFriendModal(true)}
                >
                  <Ionicons name="person-add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Add Friends</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.leaderboardList}>
              {currentLeaderboard.map((player, index) => renderLeaderboardItem(player, index))}
            </View>
          )}
        </View>

        {/* Rank Tiers Info */}
        <View style={styles.rankTiersSection}>
          <Text style={styles.sectionTitle}>🎖️ Rank Tiers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiersScroll}>
            {RANK_TITLES.map((rank, index) => (
              <View 
                key={index} 
                style={[
                  styles.tierCard,
                  currentUserStats.totalXP >= rank.minXP && styles.tierCardUnlocked
                ]}
              >
                <Text style={styles.tierIcon}>{rank.icon}</Text>
                <Text style={styles.tierTitle}>{rank.title}</Text>
                <Text style={[styles.tierXP, { color: rank.color }]}>{rank.minXP}+ XP</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {renderAddFriendModal()}
    </SafeAreaView>
  );
};

// Dynamic styles based on theme
const createStyles = (colors, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  tabBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userStatsCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  userStatsGradient: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  rankBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rankBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rankBadgeIcon: {
    fontSize: 30,
  },
  rankInfo: {
    flex: 1,
  },
  rankTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  globalRank: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  xpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  xpMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  xpValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  xpLabel: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  achievementCount: {
    alignItems: 'center',
  },
  achievementText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  achievementLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  progressXP: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  quickStats: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  quickStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  // Story Mode Progress Styles
  storyProgressSection: {
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storyLevelsContainer: {
    gap: 12,
  },
  storyLevelCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storyLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storyLevelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storyLevelEmoji: {
    fontSize: 22,
  },
  storyLevelInfo: {
    flex: 1,
  },
  storyLevelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  storyLevelDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  completedBadge: {
    marginLeft: 8,
  },
  storyProgressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  storyProgressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  storyProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  storyProgressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    minWidth: 45,
    textAlign: 'right',
  },
  storyStatusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  overallProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  overallProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  playNowText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Leaderboard Section
  leaderboardSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  leaderboardList: {
    gap: 10,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentUserItem: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: isDarkMode ? 'rgba(255, 107, 0, 0.1)' : 'rgba(255, 107, 0, 0.05)',
  },
  topThreeItem: {
    borderColor: colors.warning,
  },
  rankColumn: {
    width: 40,
    alignItems: 'center',
  },
  medalEmoji: {
    fontSize: 24,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  currentUserName: {
    color: colors.primary,
  },
  playerRankTitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  playerStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  xpBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  achievementCountSmall: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rankTiersSection: {
    marginBottom: 20,
  },
  tiersScroll: {
    marginTop: 12,
  },
  tierCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  tierCardUnlocked: {
    opacity: 1,
    borderColor: colors.success,
  },
  tierIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  tierTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  tierXP: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  searchResults: {
    maxHeight: 300,
  },
  searchStatus: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 16,
    paddingVertical: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  searchUserInfo: {
    flex: 1,
  },
  searchUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  searchUsername: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LeaderboardScreen;
