import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

// Import main screens
import HomeScreen from '../screens/main/HomeScreen';
import ExpenseScreen from '../screens/main/ExpenseScreen';
import ExpenseGraphScreen from '../screens/main/ExpenseGraphScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import NoteScreen from '../screens/main/NoteScreen';
import AddNoteScreen from '../screens/main/AddNoteScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import LearnScreen from '../screens/main/LearnScreen';
import SavingsGoalsScreen from '../screens/main/SavingsGoalsScreen';
import ChatScreen from '../screens/main/EnhancedChatScreen';
import ChatHistorySettingsScreen from '../screens/main/ChatHistorySettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { theme } = useContext(ThemeContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Expenses') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'MonT AI') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Learn') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Goals') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpenseScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="MonT AI" component={ChatScreen} />
      <Tab.Screen name="Learn" component={LearnScreen} />
      <Tab.Screen name="Goals" component={SavingsGoalsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  return (
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
      <Stack.Screen name="ChatHistorySettings" component={ChatHistorySettingsScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;