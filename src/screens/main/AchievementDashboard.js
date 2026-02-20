import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  FlatList,
  Modal,
  Animated,
  Image,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AchievementService } from '../../services/AchievementService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import gameDatabaseService from '../../services/GameDatabaseService';

const { width } = Dimensions.get('window');

// Store item definitions - Skins
const STORE_ITEMS = {
  skins: [
    {
      id: 'skin_girl',
      name: 'Maya',
      description: 'The default bright student with big dreams',
      price: 0,
      icon: '👧',
      color: '#FF69B4',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/GirlWalk.png'),
      characterKey: 'girl',
      isDefault: true,
    },
    {
      id: 'skin_jasper',
      name: 'Jasper',
      description: 'A determined young saver',
      price: 0,
      icon: '👦',
      color: '#4A90D9',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/JasperWalk.png'),
      characterKey: 'jasper',
      isDefault: true,
    },
    {
      id: 'skin_businessman',
      name: 'Business Marco',
      description: 'A professional look for the serious saver',
      price: 150,
      icon: '👔',
      color: '#2C3E50',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Businessman.png'),
      characterKey: 'businessman',
      isDefault: false,
    },
    {
      id: 'skin_businesswoman',
      name: 'Business Elena',
      description: 'Power suit for the ambitious achiever',
      price: 150,
      icon: '👩‍💼',
      color: '#8E44AD',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Businesswoman.png'),
      characterKey: 'businesswoman',
      isDefault: false,
    },
    {
      id: 'skin_ash_ketchum',
      name: 'Ash Ketchum',
      description: 'Gotta save \'em all! A trainer of budgets',
      price: 200,
      icon: '🧢',
      color: '#E53935',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Ash Ketchum.png'),
      characterKey: 'ash_ketchum',
      isDefault: false,
    },
    {
      id: 'skin_bruce_lee',
      name: 'Bruce Lee',
      description: 'Disciplined finances, disciplined life',
      price: 200,
      icon: '🥋',
      color: '#FFC107',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Bruce Lee.png'),
      characterKey: 'bruce_lee',
      isDefault: false,
    },
    {
      id: 'skin_chef_stephen',
      name: 'Chef Stephen',
      description: 'Cooking up smart savings recipes',
      price: 175,
      icon: '👨‍🍳',
      color: '#FF7043',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Chef Stephen.png'),
      characterKey: 'chef_stephen',
      isDefault: false,
    },
    {
      id: 'skin_detective_carol',
      name: 'Detective Carol',
      description: 'Investigating every peso spent',
      price: 175,
      icon: '🕵️',
      color: '#5C6BC0',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Detective Carol.png'),
      characterKey: 'detective_carol',
      isDefault: false,
    },
    {
      id: 'skin_lily',
      name: 'Lily',
      description: 'A cheerful saver with a green thumb',
      price: 150,
      icon: '🌸',
      color: '#66BB6A',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Lily.png'),
      characterKey: 'lily',
      isDefault: false,
    },
    {
      id: 'skin_mira',
      name: 'Mira',
      description: 'A tech-savvy student tracking every cent',
      price: 150,
      icon: '💜',
      color: '#AB47BC',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Mira.png'),
      characterKey: 'mira',
      isDefault: false,
    },
    {
      id: 'skin_nurse_joy',
      name: 'Nurse Joy',
      description: 'Healing your finances back to health',
      price: 200,
      icon: '👩‍⚕️',
      color: '#EC407A',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Nurse Joy.png'),
      characterKey: 'nurse_joy',
      isDefault: false,
    },
    {
      id: 'skin_policeman',
      name: 'Officer Dan',
      description: 'Keeping your spending in check',
      price: 175,
      icon: '👮',
      color: '#1565C0',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Policeman.png'),
      characterKey: 'policeman',
      isDefault: false,
    },
  ],
};

const AchievementDashboard = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [userAchievements, setUserAchievements] = useState([]);
  const [allAchievements, setAllAchievements] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, earned, unearned
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scaleAnimation] = useState(new Animated.Value(1));
  const [error, setError] = useState(null);
  
  // Store state
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [spentXP, setSpentXP] = useState(0); // XP spent in store (separate from leaderboard score)
  const [selectedStoreItem, setSelectedStoreItem] = useState(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadAchievementData();
    }
  }, [user]);

  const loadAchievementData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      // Use fallback data if services are not available
      let achievements = [];
      let allAchievementsData = [];
      let stats = {};

      try {
        [achievements, allAchievementsData, stats] = await Promise.all([
          AchievementService.getUserAchievements(),
          AchievementService.getAchievementDefinitionsArray(),
          AchievementService.getUserStats()
        ]);
      } catch (serviceError) {
        console.log('Achievement service not available, using fallback data');
        // Provide fallback achievement definitions matching new game-based achievements
        allAchievementsData = [
          // Expense Tracking Achievements
          {
            id: 'first_expense',
            title: 'First Purchase',
            description: 'Record your first expense in the game',
            icon: '🎯',
            points: 10,
            achievement_type: 'expense',
            target_value: 1,
            category: 'expense'
          },
          {
            id: 'expense_tracker_10',
            title: 'Diligent Tracker',
            description: 'Record 10 expenses',
            icon: '📝',
            points: 25,
            achievement_type: 'expense',
            target_value: 10,
            category: 'expense'
          },
          {
            id: 'expense_master_50',
            title: 'Expense Master',
            description: 'Record 50 expenses',
            icon: '📊',
            points: 50,
            achievement_type: 'expense',
            target_value: 50,
            category: 'expense'
          },
          // Story Mode Achievements
          {
            id: 'story_beginner',
            title: 'Story Beginner',
            description: 'Complete Level 1 of Story Mode',
            icon: '📖',
            points: 30,
            achievement_type: 'story',
            target_value: 1,
            category: 'story'
          },
          {
            id: 'story_intermediate',
            title: 'Budget Apprentice',
            description: 'Complete Level 2 of Story Mode',
            icon: '📚',
            points: 50,
            achievement_type: 'story',
            target_value: 2,
            category: 'story'
          },
          {
            id: 'story_master',
            title: 'Budget Master',
            description: 'Complete Level 3 of Story Mode',
            icon: '🎓',
            points: 100,
            achievement_type: 'story',
            target_value: 3,
            category: 'story'
          },
          // Exploration Achievements
          {
            id: 'explorer_school',
            title: 'School Explorer',
            description: 'Visit the School map',
            icon: '🏫',
            points: 15,
            achievement_type: 'exploration',
            target_value: 1,
            category: 'exploration'
          },
          {
            id: 'explorer_mall',
            title: 'Mall Explorer',
            description: 'Visit the Mall map',
            icon: '🛒',
            points: 15,
            achievement_type: 'exploration',
            target_value: 1,
            category: 'exploration'
          },
          {
            id: 'explorer_home',
            title: 'Home Explorer',
            description: 'Visit your Home/Dorm',
            icon: '🏠',
            points: 15,
            achievement_type: 'exploration',
            target_value: 1,
            category: 'exploration'
          },
          {
            id: 'world_traveler',
            title: 'World Traveler',
            description: 'Visit all 3 maps',
            icon: '🌍',
            points: 50,
            achievement_type: 'exploration',
            target_value: 3,
            category: 'exploration'
          },
          // Category Spending Achievements
          {
            id: 'foodie',
            title: 'Foodie',
            description: 'Record 10 food expenses',
            icon: '🍔',
            points: 20,
            achievement_type: 'category',
            target_value: 10,
            category: 'spending'
          },
          {
            id: 'shopaholic',
            title: 'Shopaholic',
            description: 'Record 10 shopping expenses',
            icon: '🛍️',
            points: 20,
            achievement_type: 'category',
            target_value: 10,
            category: 'spending'
          },
          // Gameplay Achievements
          {
            id: 'first_travel',
            title: 'First Steps',
            description: 'Travel to a new location for the first time',
            icon: '👣',
            points: 10,
            achievement_type: 'gameplay',
            target_value: 1,
            category: 'gameplay'
          },
          {
            id: 'speed_walker',
            title: 'Speed Walker',
            description: 'Walk 100 tiles total',
            icon: '🚶',
            points: 25,
            achievement_type: 'gameplay',
            target_value: 100,
            category: 'gameplay'
          },
          // Savings Achievements
          {
            id: 'saver_bronze',
            title: 'Bronze Saver',
            description: 'Save 20% of your budget in Story Mode',
            icon: '🥉',
            points: 30,
            achievement_type: 'savings',
            target_value: 20,
            category: 'savings'
          },
          {
            id: 'saver_silver',
            title: 'Silver Saver',
            description: 'Save 30% of your budget in Story Mode',
            icon: '🥈',
            points: 50,
            achievement_type: 'savings',
            target_value: 30,
            category: 'savings'
          },
          {
            id: 'saver_gold',
            title: 'Gold Saver',
            description: 'Save 40% of your budget in Story Mode',
            icon: '🥇',
            points: 100,
            achievement_type: 'savings',
            target_value: 40,
            category: 'savings'
          }
        ];
        
        // Provide fallback stats
        stats = {
          totalExpenses: 0,
          totalSaved: 0,
          streakDays: 0,
          currentLevel: 1,
          budgetsCreated: 0,
          goalsCompleted: 0,
          mapsVisited: 0,
          tilesWalked: 0
        };
      }

      setUserAchievements(achievements);
      setAllAchievements(allAchievementsData);
      setUserStats(stats);
    } catch (error) {
      console.error('Error loading achievement data:', error);
      setError('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  // Load store data — Supabase first, AsyncStorage fallback
  // Also cross-references unlocked_characters column to catch skins unlocked
  // before purchase tracking was added to the database.
  const loadStoreData = async () => {
    try {
      if (!user?.id) return;

      // Default owned items
      const defaultOwned = STORE_ITEMS.skins
        .filter(item => item.isDefault)
        .map(item => item.id);

      // Helper: derive purchased item IDs from an unlocked_characters array
      // e.g. ['girl','jasper','mira'] → ['skin_girl','skin_jasper','skin_mira']
      const derivePurchasedFromUnlocked = (unlockedChars) => {
        if (!unlockedChars || !Array.isArray(unlockedChars)) return [];
        return STORE_ITEMS.skins
          .filter(item => unlockedChars.includes(item.characterKey))
          .map(item => item.id);
      };

      // 1. Try loading from Supabase (source of truth)
      const dbData = await gameDatabaseService.loadStorePurchases();

      if (dbData) {
        // Merge: defaults + purchasedItems from JSONB + skins derived from unlocked_characters
        const fromJsonb = dbData.purchasedItems || [];
        const fromUnlocked = derivePurchasedFromUnlocked(dbData.unlockedCharacters);
        const merged = Array.from(new Set([...defaultOwned, ...fromJsonb, ...fromUnlocked]));
        setPurchasedItems(merged);
        setSpentXP(dbData.spentXP || 0);

        // If there were unlocked characters missing from purchasedItems, persist the fix
        if (merged.length > new Set([...defaultOwned, ...fromJsonb]).size) {
          await gameDatabaseService.saveStorePurchases({
            purchasedItems: merged,
            spentXP: dbData.spentXP || 0,
            unlockedCharacters: dbData.unlockedCharacters || ['girl', 'jasper'],
          });
        }

        // Sync to AsyncStorage for offline/fast access
        const purchasedKey = `purchased_items_${user.id}`;
        const spentXPKey = `spent_xp_${user.id}`;
        const unlockedSkinsKey = `unlocked_skins_${user.id}`;
        await AsyncStorage.setItem(purchasedKey, JSON.stringify(merged));
        await AsyncStorage.setItem(spentXPKey, (dbData.spentXP || 0).toString());
        if (dbData.unlockedCharacters && dbData.unlockedCharacters.length > 0) {
          await AsyncStorage.setItem(unlockedSkinsKey, JSON.stringify(dbData.unlockedCharacters));
        }
        return;
      }

      // 2. Fallback: load from AsyncStorage (legacy/offline)
      const purchasedKey = `purchased_items_${user.id}`;
      const spentXPKey = `spent_xp_${user.id}`;
      const [purchasedData, spentXPData] = await Promise.all([
        AsyncStorage.getItem(purchasedKey),
        AsyncStorage.getItem(spentXPKey),
      ]);

      if (purchasedData) {
        const parsed = JSON.parse(purchasedData);
        const merged = Array.from(new Set([...defaultOwned, ...parsed]));
        setPurchasedItems(merged);

        // Migrate AsyncStorage data → Supabase so it persists across logins
        const unlockedSkinsKey = `unlocked_skins_${user.id}`;
        const savedSkins = await AsyncStorage.getItem(unlockedSkinsKey);
        const unlockedChars = savedSkins ? JSON.parse(savedSkins) : ['girl', 'jasper'];
        const spentVal = spentXPData ? parseInt(spentXPData, 10) : 0;
        setSpentXP(spentVal);
        await gameDatabaseService.saveStorePurchases({
          purchasedItems: merged,
          spentXP: spentVal,
          unlockedCharacters: unlockedChars,
        });
      } else {
        setPurchasedItems(defaultOwned);
      }

      if (spentXPData) {
        setSpentXP(parseInt(spentXPData, 10));
      }
    } catch (error) {
      console.error('Error loading store data:', error);
    }
  };

  // Save store data — write to both Supabase and AsyncStorage
  const saveStoreData = async (newPurchasedItems, newSpentXP, newUnlockedCharacters) => {
    try {
      if (!user?.id) return;

      const purchasedKey = `purchased_items_${user.id}`;
      const spentXPKey = `spent_xp_${user.id}`;

      // Save to AsyncStorage (fast local cache)
      await Promise.all([
        AsyncStorage.setItem(purchasedKey, JSON.stringify(newPurchasedItems)),
        AsyncStorage.setItem(spentXPKey, newSpentXP.toString()),
      ]);

      // Save to Supabase (persistent across devices/logins)
      await gameDatabaseService.saveStorePurchases({
        purchasedItems: newPurchasedItems,
        spentXP: newSpentXP,
        unlockedCharacters: newUnlockedCharacters || ['girl', 'jasper'],
      });
    } catch (error) {
      console.error('Error saving store data:', error);
    }
  };

  // Calculate total earned XP from the points stored in user_achievements DB rows
  // This is the single source of truth — same data the Leaderboard screen uses
  const getTotalEarnedXP = () => {
    if (!Array.isArray(userAchievements)) return 0;
    return userAchievements.reduce((sum, ua) => sum + (ua.points || 0), 0);
  };

  // Calculate spendable XP (earned - spent)
  const getSpendableXP = () => {
    return Math.max(0, getTotalEarnedXP() - spentXP);
  };

  // Check if item is purchased
  const isItemPurchased = (itemId) => {
    return purchasedItems.includes(itemId);
  };

  // Purchase item
  const purchaseItem = async (item) => {
    const spendableXP = getSpendableXP();
    
    if (item.price > spendableXP) {
      Alert.alert(
        'Not Enough XP',
        `You need ${item.price - spendableXP} more XP to purchase this item.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (isItemPurchased(item.id)) {
      Alert.alert('Already Owned', 'You already own this item!', [{ text: 'OK' }]);
      return;
    }
    
    // Process purchase
    const newPurchasedItems = [...purchasedItems, item.id];
    const newSpentXP = spentXP + item.price;
    
    setPurchasedItems(newPurchasedItems);
    setSpentXP(newSpentXP);
    
    // Build updated unlocked characters list
    let updatedUnlockedSkins = ['girl', 'jasper'];
    try {
      const unlockedSkinsKey = `unlocked_skins_${user.id}`;
      const existingUnlocked = await AsyncStorage.getItem(unlockedSkinsKey);
      updatedUnlockedSkins = existingUnlocked ? JSON.parse(existingUnlocked) : ['girl', 'jasper'];
      
      if (!updatedUnlockedSkins.includes(item.characterKey)) {
        updatedUnlockedSkins.push(item.characterKey);
      }
      await AsyncStorage.setItem(unlockedSkinsKey, JSON.stringify(updatedUnlockedSkins));
    } catch (error) {
      console.error('Error saving unlocked skin:', error);
    }
    
    // Save to both AsyncStorage AND Supabase (persistent)
    await saveStoreData(newPurchasedItems, newSpentXP, updatedUnlockedSkins);

    // Also update the character_customizations unlocked_characters column directly
    await gameDatabaseService.saveCharacterCustomization({
      selectedCharacter: undefined, // don't change selection
      unlockedCharacters: updatedUnlockedSkins,
    });
    
    setShowPurchaseConfirm(false);
    setSelectedStoreItem(null);
    
    Alert.alert(
      '🎉 Purchase Successful!',
      `You've unlocked ${item.name}! Go to the Game tab and open the Closet to use your new skin.`,
      [{ text: 'Awesome!' }]
    );
  };

  // Load store data on mount
  useEffect(() => {
    if (user?.id) {
      loadStoreData();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAchievementData();
    await loadStoreData();
    setRefreshing(false);
  };

  const getFilteredAchievements = () => {
    // Safety check: ensure allAchievements is an array
    if (!Array.isArray(allAchievements)) {
      return [];
    }
    
    const earnedIds = userAchievements.map(ua => ua.achievement_id);
    
    if (filter === 'earned') {
      return allAchievements.filter(achievement => 
        earnedIds.includes(achievement.id)
      );
    } else if (filter === 'unearned') {
      return allAchievements.filter(achievement => 
        !earnedIds.includes(achievement.id)
      );
    }
    
    return allAchievements;
  };

  const getAchievementProgress = (achievement) => {
    // Safety check for userAchievements
    if (!Array.isArray(userAchievements)) {
      return {
        earned: false,
        progress: 0,
        percentage: 0,
        earnedAt: null
      };
    }

    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
    
    if (userAchievement) {
      return {
        earned: true,
        progress: achievement.target_value,
        percentage: 100,
        earnedAt: userAchievement.earned_at
      };
    }

    // Calculate progress based on achievement type/category
    let currentValue = 0;
    
    switch (achievement.achievement_type) {
      // Expense tracking achievements
      case 'expense':
        currentValue = userStats.totalExpenses || 0;
        break;
      // Story mode achievements
      case 'story':
        currentValue = userStats.storyLevelCompleted || 0;
        break;
      // Exploration achievements
      case 'exploration':
        currentValue = userStats.mapsVisited || 0;
        break;
      // Category spending achievements
      case 'category':
        if (achievement.id === 'foodie') {
          currentValue = userStats.foodExpenses || 0;
        } else if (achievement.id === 'shopaholic') {
          currentValue = userStats.shoppingExpenses || 0;
        } else if (achievement.id === 'tech_enthusiast') {
          currentValue = userStats.electronicsExpenses || 0;
        }
        break;
      // Savings achievements
      case 'savings':
        currentValue = userStats.savingsPercentage || 0;
        break;
      // Gameplay achievements
      case 'gameplay':
        if (achievement.id === 'first_travel') {
          currentValue = userStats.travelCount > 0 ? 1 : 0;
        } else if (achievement.id === 'speed_walker' || achievement.id === 'marathon_runner') {
          currentValue = userStats.tilesWalked || 0;
        }
        break;
      // Legacy achievement types (for backwards compatibility)
      case 'first_save':
        currentValue = userStats.totalSaved > 0 ? 1 : 0;
        break;
      case 'savings_streak':
        currentValue = userStats.streakDays || 0;
        break;
      case 'level_complete':
        currentValue = userStats.currentLevel || 0;
        break;
      case 'budget_create':
      case 'first_budget':
        currentValue = userStats.budgetsCreated || 0;
        break;
      case 'total_saved':
        currentValue = userStats.totalSaved || 0;
        break;
      case 'goals_completed':
      case 'first_goal':
        currentValue = userStats.goalsCompleted || 0;
        break;
      case 'first_expense':
        currentValue = userStats.expensesCount || 0;
        break;
      default:
        currentValue = 0;
    }

    const percentage = Math.min(100, (currentValue / achievement.target_value) * 100);
    
    return {
      earned: false,
      progress: currentValue,
      percentage,
      earnedAt: null
    };
  };

  const animateAchievement = () => {
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderStatsOverview = () => {
    // Safety checks for arrays
    const totalAchievements = Array.isArray(allAchievements) ? allAchievements.length : 0;
    const earnedAchievements = Array.isArray(userAchievements) ? userAchievements.length : 0;
    const totalPoints = getTotalEarnedXP();
    const spendablePoints = getSpendableXP();

    return (
      <View style={[styles.statsCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.statsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Achievement Progress
          </Text>
          <TouchableOpacity
            style={[styles.storeButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowStoreModal(true)}
          >
            <Ionicons name="storefront" size={16} color="white" />
            <Text style={styles.storeButtonText}>Store</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
               {earnedAchievements}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              Earned
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {totalAchievements}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              Total
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {totalPoints}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              XP Earned
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
              {spendablePoints}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              Spendable
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={[styles.progressLabel, { color: theme.colors.text }]}>
            Overall Progress
          </Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  width: totalAchievements > 0 ? `${(earnedAchievements / totalAchievements) * 100}%` : '0%',
                  backgroundColor: theme.colors.primary
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {totalAchievements > 0 ? ((earnedAchievements / totalAchievements) * 100).toFixed(1) : 0}% Complete
          </Text>
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => {
    const filters = [
      { key: 'all', label: 'All', icon: 'grid' },
      { key: 'earned', label: 'Earned', icon: 'trophy' },
      { key: 'unearned', label: 'Locked', icon: 'lock-closed' }
    ];

    return (
      <View style={styles.filterContainer}>
        {filters.map((filterOption) => (
          <TouchableOpacity
            key={filterOption.key}
            style={[
              styles.filterButton,
              { 
                backgroundColor: filter === filterOption.key 
                  ? theme.colors.primary 
                  : theme.colors.card
              }
            ]}
            onPress={() => setFilter(filterOption.key)}
          >
            <Ionicons 
              name={filterOption.icon} 
              size={20} 
              color={filter === filterOption.key ? 'white' : theme.colors.text} 
            />
            <Text 
              style={[
                styles.filterButtonText,
                { 
                  color: filter === filterOption.key ? 'white' : theme.colors.text
                }
              ]}
            >
              {filterOption.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderAchievementCard = ({ item: achievement }) => {
    const progress = getAchievementProgress(achievement);
    
    return (
      <TouchableOpacity
        style={[
          styles.achievementCard,
          { 
            backgroundColor: theme.colors.card,
            opacity: progress.earned ? 1 : 0.7
          }
        ]}
        onPress={() => {
          setSelectedAchievement(achievement);
          setShowDetailModal(true);
          if (progress.earned) {
            animateAchievement();
          }
        }}
      >
        <View style={styles.achievementHeader}>
          <View style={[
            styles.achievementIcon,
            { 
              backgroundColor: progress.earned 
                ? theme.colors.primary 
                : theme.colors.border
            }
          ]}>
            <Text style={styles.achievementEmoji}>
              {achievement.icon}
            </Text>
          </View>
          
          <View style={styles.achievementInfo}>
            <Text style={[
              styles.achievementTitle,
              { 
                color: progress.earned 
                  ? theme.colors.text 
                  : theme.colors.text + '60'
              }
            ]}>
              {achievement.title}
            </Text>
            <Text style={[
              styles.achievementDescription,
              { 
                color: progress.earned 
                  ? theme.colors.text + '80' 
                  : theme.colors.text + '40'
              }
            ]}>
              {achievement.description}
            </Text>
          </View>
          
          <View style={styles.achievementMeta}>
            <Text style={[
              styles.achievementPoints,
              { color: theme.colors.primary }
            ]}>
              +{achievement.points}
            </Text>
            {progress.earned && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </View>
        </View>

        {!progress.earned && (
          <View style={styles.progressSection}>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { 
                    width: `${progress.percentage}%`,
                    backgroundColor: theme.colors.primary
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.text }]}>
              {progress.progress} / {achievement.target_value} 
              ({progress.percentage.toFixed(1)}%)
            </Text>
          </View>
        )}

        {progress.earned && progress.earnedAt && (
          <Text style={[styles.earnedDate, { color: theme.colors.text + '60' }]}>
            Earned {new Date(progress.earnedAt).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedAchievement) return null;
    
    const progress = getAchievementProgress(selectedAchievement);
    
    return (
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              { 
                backgroundColor: theme.colors.card,
                transform: [{ scale: scaleAnimation }]
              }
            ]}
          >
            <View style={[
              styles.modalIcon,
              { 
                backgroundColor: progress.earned 
                  ? theme.colors.primary 
                  : theme.colors.border
              }
            ]}>
              <Text style={styles.modalEmoji}>
                {selectedAchievement.icon}
              </Text>
            </View>
            
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {selectedAchievement.title}
            </Text>
            
            <Text style={[styles.modalDescription, { color: theme.colors.text + '80' }]}>
              {selectedAchievement.description}
            </Text>
            
            <View style={styles.modalStats}>
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatLabel, { color: theme.colors.text }]}>
                  Points
                </Text>
                <Text style={[styles.modalStatValue, { color: theme.colors.primary }]}>
                  {selectedAchievement.points}
                </Text>
              </View>
              
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatLabel, { color: theme.colors.text }]}>
                  Target
                </Text>
                <Text style={[styles.modalStatValue, { color: theme.colors.text }]}>
                  {selectedAchievement.target_value}
                </Text>
              </View>
              
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatLabel, { color: theme.colors.text }]}>
                  Progress
                </Text>
                <Text style={[styles.modalStatValue, { color: theme.colors.text }]}>
                  {progress.progress}
                </Text>
              </View>
            </View>

            {progress.earned ? (
              <View style={styles.earnedBadge}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={[styles.earnedText, { color: theme.colors.text }]}>
                  Achievement Unlocked!
                </Text>
                {progress.earnedAt && (
                  <Text style={[styles.earnedDate, { color: theme.colors.text + '60' }]}>
                    {new Date(progress.earnedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.progressSection}>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar,
                      { 
                        width: `${progress.percentage}%`,
                        backgroundColor: theme.colors.primary
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.colors.text }]}>
                  {progress.percentage.toFixed(1)}% Complete
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Render Store Item Card
  const renderStoreItem = (item) => {
    const owned = isItemPurchased(item.id);
    const canAfford = getSpendableXP() >= item.price;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.storeItemCard,
          { 
            backgroundColor: theme.colors.card,
            borderColor: owned ? '#4CAF50' : (canAfford ? theme.colors.primary : theme.colors.border),
            borderWidth: owned ? 2 : 1,
          }
        ]}
        onPress={() => {
          if (!owned && item.price > 0) {
            setSelectedStoreItem(item);
            setShowPurchaseConfirm(true);
          }
        }}
        disabled={owned}
      >
        {/* Skin Preview */}
        <View style={[styles.skinPreviewContainer, { backgroundColor: item.color + '20' }]}>
          <Image 
            source={item.sprite}
            style={styles.skinPreviewImage}
            resizeMode="cover"
          />
        </View>
        
        {/* Item Info */}
        <View style={styles.storeItemInfo}>
          <View style={styles.storeItemHeader}>
            <Text style={styles.storeItemIcon}>{item.icon}</Text>
            <Text style={[styles.storeItemName, { color: theme.colors.text }]}>
              {item.name}
            </Text>
          </View>
          <Text style={[styles.storeItemDesc, { color: theme.colors.text + '80' }]}>
            {item.description}
          </Text>
        </View>
        
        {/* Price/Status */}
        <View style={styles.storeItemPriceContainer}>
          {owned ? (
            <View style={styles.ownedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.ownedText}>Owned</Text>
            </View>
          ) : item.price === 0 ? (
            <Text style={[styles.freeText, { color: '#4CAF50' }]}>FREE</Text>
          ) : (
            <View style={[
              styles.priceBadge, 
              { backgroundColor: canAfford ? theme.colors.primary : theme.colors.border }
            ]}>
              <Ionicons name="star" size={14} color={canAfford ? '#FFD700' : '#888'} />
              <Text style={[
                styles.priceText, 
                { color: canAfford ? 'white' : '#888' }
              ]}>
                {item.price} XP
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render Store Modal
  const renderStoreModal = () => {
    return (
      <Modal
        visible={showStoreModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStoreModal(false)}
      >
        <View style={styles.storeModalOverlay}>
          <View style={[styles.storeModalContent, { backgroundColor: theme.colors.background }]}>
            {/* Store Header */}
            <View style={[styles.storeHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.storeHeaderLeft}>
                <Ionicons name="storefront" size={28} color={theme.colors.primary} />
                <Text style={[styles.storeTitle, { color: theme.colors.text }]}>Store</Text>
              </View>
              <TouchableOpacity
                style={[styles.storeCloseBtn, { backgroundColor: theme.colors.card }]}
                onPress={() => setShowStoreModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* XP Balance */}
            <View style={[styles.xpBalanceCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.xpBalanceRow}>
                <View style={styles.xpBalanceItem}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={[styles.xpBalanceLabel, { color: theme.colors.text + '80' }]}>
                    Total Earned
                  </Text>
                  <Text style={[styles.xpBalanceValue, { color: theme.colors.text }]}>
                    {getTotalEarnedXP()} XP
                  </Text>
                </View>
                <View style={styles.xpBalanceDivider} />
                <View style={styles.xpBalanceItem}>
                  <Ionicons name="wallet" size={20} color="#4CAF50" />
                  <Text style={[styles.xpBalanceLabel, { color: theme.colors.text + '80' }]}>
                    Spendable
                  </Text>
                  <Text style={[styles.xpBalanceValue, { color: '#4CAF50' }]}>
                    {getSpendableXP()} XP
                  </Text>
                </View>
              </View>
              <Text style={[styles.xpNote, { color: theme.colors.text + '60' }]}>
                💡 Your leaderboard score stays at {getTotalEarnedXP()} XP
              </Text>
            </View>
            
            {/* Store Items */}
            <ScrollView 
              style={styles.storeItemsList}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.storeSectionTitle, { color: theme.colors.text }]}>
                🎭 Character Skins
              </Text>
              {STORE_ITEMS.skins.map(renderStoreItem)}
              
              <View style={styles.storeComingSoon}>
                <Ionicons name="construct" size={32} color={theme.colors.text + '40'} />
                <Text style={[styles.comingSoonText, { color: theme.colors.text + '60' }]}>
                  More items coming soon!
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Render Purchase Confirmation Modal
  const renderPurchaseConfirmModal = () => {
    if (!selectedStoreItem) return null;
    
    const canAfford = getSpendableXP() >= selectedStoreItem.price;
    
    return (
      <Modal
        visible={showPurchaseConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPurchaseConfirm(false);
          setSelectedStoreItem(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.purchaseModalContent, { backgroundColor: theme.colors.card }]}>
            {/* Item Preview */}
            <View style={[styles.purchasePreview, { backgroundColor: selectedStoreItem.color + '20' }]}>
              <Image 
                source={selectedStoreItem.sprite}
                style={styles.purchasePreviewImage}
                resizeMode="cover"
              />
            </View>
            
            <Text style={[styles.purchaseTitle, { color: theme.colors.text }]}>
              {selectedStoreItem.name}
            </Text>
            <Text style={[styles.purchaseDesc, { color: theme.colors.text + '80' }]}>
              {selectedStoreItem.description}
            </Text>
            
            <View style={styles.purchasePriceRow}>
              <View style={styles.purchasePriceItem}>
                <Text style={[styles.purchasePriceLabel, { color: theme.colors.text + '80' }]}>
                  Price
                </Text>
                <View style={styles.purchasePriceValue}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={[styles.purchasePriceText, { color: theme.colors.text }]}>
                    {selectedStoreItem.price} XP
                  </Text>
                </View>
              </View>
              <View style={styles.purchasePriceItem}>
                <Text style={[styles.purchasePriceLabel, { color: theme.colors.text + '80' }]}>
                  Your Balance
                </Text>
                <Text style={[
                  styles.purchasePriceText, 
                  { color: canAfford ? '#4CAF50' : '#FF5252' }
                ]}>
                  {getSpendableXP()} XP
                </Text>
              </View>
            </View>
            
            {!canAfford && (
              <Text style={styles.notEnoughXP}>
                You need {selectedStoreItem.price - getSpendableXP()} more XP
              </Text>
            )}
            
            <View style={styles.purchaseButtons}>
              <TouchableOpacity
                style={[styles.purchaseCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowPurchaseConfirm(false);
                  setSelectedStoreItem(null);
                }}
              >
                <Text style={[styles.purchaseCancelText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.purchaseConfirmBtn, 
                  { backgroundColor: canAfford ? theme.colors.primary : theme.colors.border }
                ]}
                onPress={() => purchaseItem(selectedStoreItem)}
                disabled={!canAfford}
              >
                <Text style={styles.purchaseConfirmText}>
                  {canAfford ? 'Purchase' : 'Not Enough XP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading achievements...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text, marginTop: 16 }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={loadAchievementData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredAchievements = getFilteredAchievements();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Achievements</Text>
        <View style={[styles.levelBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.levelText}>Level {userStats.currentLevel || 1}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderStatsOverview()}
        {renderFilterButtons()}

        <FlatList
          data={filteredAchievements}
          renderItem={renderAchievementCard}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { backgroundColor: theme.colors.card }]}>
              <Ionicons name="trophy" size={48} color={theme.colors.primary} />
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                {filter === 'earned' ? 'No achievements earned yet' :
                 filter === 'unearned' ? 'All achievements unlocked!' :
                 'No achievements available'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.text + '60' }]}>
                {filter === 'earned' ? 'Start using the app to unlock achievements!' :
                 filter === 'unearned' ? 'Congratulations on completing all achievements!' :
                 'Check back later for new achievements'}
              </Text>
            </View>
          }
        />
      </ScrollView>

      {renderDetailModal()}
      {renderStoreModal()}
      {renderPurchaseConfirmModal()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievementCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  achievementEmoji: {
    fontSize: 24,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  achievementMeta: {
    alignItems: 'center',
  },
  achievementPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressSection: {
    marginTop: 12,
  },
  earnedDate: {
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalEmoji: {
    fontSize: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  modalStat: {
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  earnedBadge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  earnedText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Stats header row with store button
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  storeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Store Modal Styles
  storeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  storeModalContent: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  storeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  storeCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpBalanceCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  xpBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  xpBalanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  xpBalanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  xpBalanceLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  xpBalanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  xpNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  storeItemsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  storeSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  storeItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  skinPreviewContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skinPreviewImage: {
    width: 64,
    height: 64,
  },
  storeItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeItemIcon: {
    fontSize: 18,
  },
  storeItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  storeItemDesc: {
    fontSize: 12,
    marginTop: 4,
  },
  storeItemPriceContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  freeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  storeComingSoon: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  comingSoonText: {
    fontSize: 14,
    marginTop: 8,
  },
  // Purchase Confirmation Modal
  purchaseModalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  purchasePreview: {
    width: 100,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  purchasePreviewImage: {
    width: 100,
    height: 100,
  },
  purchaseTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  purchaseDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  purchasePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  purchasePriceItem: {
    alignItems: 'center',
  },
  purchasePriceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  purchasePriceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  purchasePriceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notEnoughXP: {
    color: '#FF5252',
    fontSize: 13,
    marginBottom: 16,
  },
  purchaseButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  purchaseCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  purchaseCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  purchaseConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AchievementDashboard;
