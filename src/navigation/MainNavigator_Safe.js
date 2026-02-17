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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Simple Placeholder Component for new features
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
        Coming Soon!
      </Text>
    </View>
  );
};

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
          } else if (route.name === 'Budget') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Learn') {
            iconName = focused ? 'school' : 'school-outline';
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
      <Tab.Screen name="Budget" component={PlaceholderScreen} />
      <Tab.Screen name="Learn" component={LearnScreen} />
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
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Achievements" component={PlaceholderScreen} />
      <Stack.Screen name="FriendRequests" component={PlaceholderScreen} />
      <Stack.Screen name="FriendsList" component={PlaceholderScreen} />
      <Stack.Screen name="OldLearn" component={LearnScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
