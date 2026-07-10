import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import onboarding screens
// UserTypeScreen retired: the Student/Employee selection now lives on
// SignUpScreen (with a Google-sign-up fallback on GetStartedScreen).
import GetStartedScreen from '../screens/onboarding/GetStartedScreen';
import BudgetGoalsScreen from '../screens/onboarding/BudgetGoalsScreen';

const Stack = createStackNavigator();

const OnboardingNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
      <Stack.Screen name="BudgetGoals" component={BudgetGoalsScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;

export { OnboardingNavigator };