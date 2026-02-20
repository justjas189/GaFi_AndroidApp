import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import LeaderboardService from '../../services/LeaderboardService';
import MascotImage from '../../components/MascotImage';

const ProfileScreen = ({ navigation }) => {
  const { userInfo, updateProfile } = useContext(AuthContext);
  const { budget, updateBudget, expenses } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);

  // Edit Profile modal state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [name, setName] = useState(userInfo?.name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [username, setUsername] = useState(userInfo?.username || '');

  // Edit Budget modal state
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState((budget?.monthly ?? 0).toString());

  // Quick stats state
  const [stats, setStats] = useState({
    memberSince: null,
    currentLevel: 0,
    totalXp: 0,
    totalExpenses: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync local state when context data changes
  useEffect(() => {
    if (userInfo?.name) setName(userInfo.name);
    if (userInfo?.username) setUsername(userInfo.username);
  }, [userInfo]);

  useEffect(() => {
    setMonthlyBudget((budget?.monthly ?? 0).toString());
  }, [budget]);

  // Load quick stats
  const loadStats = useCallback(async () => {
    try {
      // Get member-since date from profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', session.user.id)
        .single();

      // Get highest completed level from story_mode_sessions
      let maxLevel = 0;
      try {
        const { data: levelData, error: levelError } = await supabase
          .from('story_mode_sessions')
          .select('level')
          .eq('user_id', session.user.id)
          .order('level', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!levelError && levelData) {
          maxLevel = levelData.level;
        }
      } catch (e) {
        console.warn('Could not load story mode level:', e);
      }

      // Get XP from gamification stats
      let totalXp = 0;
      try {
        const gamificationStats = await LeaderboardService.getSavingsStats();
        totalXp = gamificationStats.totalXp || 0;
      } catch (e) {
        console.warn('Could not load gamification stats:', e);
      }

      // Count total expenses this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthlyExpenses = expenses?.filter(
        (e) => new Date(e.date || e.created_at) >= new Date(monthStart)
      ) || [];
      const totalThisMonth = monthlyExpenses.reduce(
        (sum, e) => sum + (parseFloat(e.amount) || 0),
        0
      );

      setStats({
        memberSince: profile?.created_at || session.user.created_at,
        currentLevel: maxLevel,
        totalXp,
        totalExpenses: totalThisMonth,
      });
    } catch (error) {
      console.warn('Error loading profile stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [expenses]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  // ── Handlers ──

  const handleUpdateProfile = async () => {
    try {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }
      if (username.trim() && username.trim().length < 3) {
        Alert.alert('Error', 'Username must be at least 3 characters long');
        return;
      }
      if (username.trim() && !/^[a-zA-Z0-9_]+$/.test(username.trim())) {
        Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
        return;
      }

      const profileData = {
        name: name.trim(),
        ...(username.trim() && { username: username.trim() }),
      };

      const result = await updateProfile(profileData);
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully');
        setShowEditProfile(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleUpdateBudget = () => {
    const newBudget = {
      ...budget,
      monthly: parseFloat(monthlyBudget) || 0,
    };
    updateBudget(newBudget);
    setShowEditBudget(false);
    Alert.alert('Success', 'Monthly budget updated');
  };

  // ── Helpers ──

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getInitials = () => {
    const n = userInfo?.name || 'User';
    return n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ── Render ──

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with settings gear */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={26} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* ── Avatar & Name Card ── */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={[styles.profileName, { color: theme.colors.text }]}>
            {userInfo?.name || 'Set your name'}
          </Text>
          {userInfo?.username ? (
            <Text style={[styles.profileUsername, { color: theme.colors.primary }]}>
              @{userInfo.username}
            </Text>
          ) : null}
          <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
            {userInfo?.email}
          </Text>

          <TouchableOpacity
            style={[styles.editProfileBtn, { borderColor: theme.colors.primary }]}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.editProfileBtnText, { color: theme.colors.primary }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Stats Dashboard ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Stats</Text>

          {loadingStats ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="calendar-outline" size={22} color="#4CAF50" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {formatDate(stats.memberSince)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Member Since</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="star-outline" size={22} color="#FFD700" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  Lvl {stats.currentLevel}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Current Level</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="cash-outline" size={22} color="#E91E63" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  ₱{stats.totalExpenses.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>This Month</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Budget Section ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget</Text>

          <TouchableOpacity
            onPress={() => setShowEditBudget(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.budgetCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.budgetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.budgetLabel, { color: theme.colors.textSecondary }]}>Monthly Budget</Text>
                  <Text style={[styles.budgetAmount, { color: theme.colors.text }]}>
                    ₱{(budget?.monthly ?? 0).toLocaleString()}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text} style={{ opacity: 0.5 }} />
            </View>
          </TouchableOpacity>

          {/* Budget utilization bar */}
          {budget?.monthly > 0 && (
            <View style={[styles.utilizationCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.utilizationHeader}>
                <Text style={[styles.utilizationLabel, { color: theme.colors.textSecondary }]}>
                  Budget Used This Month
                </Text>
                <Text style={[styles.utilizationPercent, { color: theme.colors.text }]}>
                  {Math.min(100, Math.round((stats.totalExpenses / budget.monthly) * 100))}%
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, (stats.totalExpenses / budget.monthly) * 100)}%`,
                      backgroundColor:
                        stats.totalExpenses / budget.monthly > 0.9
                          ? theme.colors.error
                          : stats.totalExpenses / budget.monthly > 0.7
                          ? theme.colors.warning
                          : theme.colors.success,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.utilizationDetail, { color: theme.colors.textSecondary }]}>
                ₱{stats.totalExpenses.toLocaleString()} of ₱{budget.monthly.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Achievements')}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFD70020' }]}>
                <Ionicons name="trophy-outline" size={20} color="#FFD700" />
              </View>
              <View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Achievements</Text>
                <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>
                  View your milestones
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text} style={{ opacity: 0.5 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Leaderboard')}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#9C27B020' }]}>
                <Ionicons name="podium-outline" size={20} color="#9C27B0" />
              </View>
              <View>
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Leaderboard</Text>
                <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>
                  See your ranking
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal
        animationType="slide"
        transparent
        visible={showEditProfile}
        onRequestClose={() => setShowEditProfile(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
              <TextInput
                style={[styles.input, {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                }]}
                value={name}
                onChangeText={setName}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter your name"
                returnKeyType="done"
                onSubmitEditing={handleUpdateProfile}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Username</Text>
              <TextInput
                style={[styles.input, {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                }]}
                value={username}
                onChangeText={setUsername}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter a unique username (optional)"
                returnKeyType="next"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.helpText, { color: theme.colors.text }]}>
                Username will be used for the Friends feature. Only letters, numbers, and underscores allowed.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  opacity: 0.6,
                }]}
                value={email}
                editable={false}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter your email"
              />
              <Text style={[styles.helpText, { color: theme.colors.text }]}>
                Email cannot be changed for security reasons
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.card }]}
                onPress={() => setShowEditProfile(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleUpdateProfile}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: theme.colors.background }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Budget Modal ── */}
      <Modal
        visible={showEditBudget}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditBudget(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Monthly Budget</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Monthly Budget</Text>
              <View style={[styles.inputContainer, {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>₱</Text>
                <TextInput
                  style={[styles.input, {
                    color: theme.colors.text,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    flex: 1,
                    paddingVertical: 16,
                  }]}
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  keyboardType="decimal-pad"
                  placeholder="Enter monthly budget"
                  placeholderTextColor={theme.colors.secondaryText}
                  returnKeyType="done"
                  onSubmitEditing={handleUpdateBudget}
                />
              </View>
              <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
                Set how much you plan to spend each month
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.card }]}
                onPress={() => setShowEditBudget(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleUpdateBudget}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: theme.colors.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },

  // Profile Card
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 16,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '31%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  // Budget Card
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  budgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  budgetAmount: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Utilization
  utilizationCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  utilizationLabel: {
    fontSize: 13,
  },
  utilizationPercent: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  utilizationDetail: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionSub: {
    fontSize: 13,
    marginTop: 1,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  input: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default ProfileScreen;
