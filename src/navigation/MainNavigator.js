import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

// Core screens
import HomeScreen from '../screens/main/HomeScreen';
import ExpenseScreen from '../screens/main/ExpenseScreen';
import ExpenseGraphScreen from '../screens/main/ExpenseGraphScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import NoteScreen from '../screens/main/NoteScreen';
import AddNoteScreen from '../screens/main/AddNoteScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import LearnScreen from '../screens/main/LearnScreen';
import GamificationScreen from '../screens/main/GamificationScreen';
import NotificationSettingsScreen from '../screens/main/NotificationSettingsScreen';
import NotificationTestScreen from '../screens/main/NotificationTestScreen';
import GameScreen from '../screens/main/GameScreen';
import ExploreScreen from '../screens/main/ExploreScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BudgetManagementScreen from '../screens/main/BudgetManagementScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import AchievementDashboard from '../screens/main/AchievementDashboard';
import FriendRequestsScreen from '../screens/main/FriendRequestsScreen';
import FriendsListScreen from '../screens/main/FriendsListScreen';
import ManageFriendsScreen from '../screens/main/ManageFriendsScreen';
import DataPredictionScreen from '../screens/main/DataPrediction';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Placeholder for new features to prevent crashes
const PlaceholderScreen = ({ route }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: theme.colors.background 
    }}>
      <Ionicons name="construct" size={48} color={theme.colors.primary} />
      <Text style={{ 
        color: theme.colors.text, 
        fontSize: 18, 
        marginTop: 16,
        textAlign: 'center' 
      }}>
        {route.name} Feature
      </Text>
      <Text style={{ 
        color: theme.colors.text, 
        fontSize: 14, 
        marginTop: 8,
        textAlign: 'center',
        opacity: 0.7
      }}>
        Coming Soon! Features being loaded...
      </Text>
    </View>
  );
};

// Screens are now imported directly above

const TabNavigator = () => {
  const { theme } = useContext(ThemeContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Game') {
            iconName = focused ? 'game-controller' : 'game-controller-outline';
          } else if (route.name === 'Expenses') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Predictions') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'apps' : 'apps-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}
    >
      <Tab.Screen name="Game" component={GameScreen} />
      <Tab.Screen name="Expenses" component={ExpenseScreen} />
      <Tab.Screen name="Predictions" component={DataPredictionScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="ExpenseGraph" component={ExpenseGraphScreen} />
        <Stack.Screen name="AddNote" component={AddNoteScreen} />
        <Stack.Screen name="Notes" component={NoteScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="NotificationTest" component={NotificationTestScreen} />
        <Stack.Screen name="Gamification" component={GamificationScreen} />
        <Stack.Screen name="Achievements" component={AchievementDashboard} />
        <Stack.Screen name="Budget" component={BudgetManagementScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} />
        <Stack.Screen name="FriendsList" component={FriendsListScreen} />
        <Stack.Screen name="ManageFriends" component={ManageFriendsScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="OldLearn" component={LearnScreen} />
      </Stack.Navigator>
    </View>
  );
};

export default MainNavigator;