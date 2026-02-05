# Settings Button Disappearing After Logout - Fix Documentation

## Problem Description
The Settings button disappeared when users logged out from the Settings screen. After logout, the navigation would break and the Settings screen would become inaccessible.

## Root Cause Analysis
The issue was in the `SettingsScreen.js` file, specifically in the `handleLogout` function:

```javascript
// PROBLEMATIC CODE (before fix)
const handleLogout = () => {
  Alert.alert(
    'Logout',
    'Are you sure you want to logout?',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          const success = await logout();
          if (success) {
            // ❌ INCORRECT: This navigation.reset tries to navigate to 'Auth' 
            // from within MainNavigator context, but 'Auth' doesn't exist there
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }]
            });
          }
        }
      }
    ]
  );
};
```

### Navigation Structure Issue
The app has this navigation hierarchy:
```
App.js (Root Navigator)
├── Auth (AuthNavigator)
├── Onboarding (OnboardingNavigator) 
└── Main (MainNavigator)
    ├── MainTabs (Tab Navigator)
    │   ├── Home
    │   ├── Expenses
    │   ├── Budget
    │   ├── MonT AI
    │   ├── Progress
    │   ├── Learn
    │   ├── Goals
    │   └── Social
    └── Settings (Stack Screen)
```

When in the Settings screen, `navigation.reset({ routes: [{ name: 'Auth' }] })` was trying to reset to 'Auth' **within the MainNavigator context**, but 'Auth' is a sibling navigator at the root level, not a child of MainNavigator.

## Solution Implemented
Fixed the issue by using the global `navigationRef` to reset to the Auth screen from any nested navigator:

### 1. Added Import
```javascript
import { reset } from '../../navigation/navigationRef';
```

### 2. Fixed handleLogout Function
```javascript
// ✅ FIXED CODE
const handleLogout = () => {
  Alert.alert(
    'Logout',
    'Are you sure you want to logout?',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          const result = await logout();
          if (result.success) {
            // ✅ CORRECT: Use global navigation to reset to Auth screen
            reset('Auth');
          } else {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        }
      }
    ]
  );
};
```

## Why This Fix Works
1. **Global Navigation Reference**: The `navigationRef` from `src/navigation/navigationRef.js` provides access to the root navigation container
2. **Proper Reset**: Using the global `reset('Auth')` function correctly navigates from any nested screen back to the Auth navigator
3. **Context Independence**: This approach works regardless of how deeply nested the current screen is

## Testing
To test the fix:
1. Login to the app
2. Navigate to Settings (tap the gear icon in Home screen header)
3. Tap "Log Out" 
4. Confirm logout
5. Login again
6. Verify that the Settings button is still accessible

## Technical Notes
- The `navigationRef` is set up in `App.js` with `<NavigationContainer ref={navigationRef}>`
- The global navigation functions are defined in `src/navigation/navigationRef.js`
- This pattern should be used for any deep navigation resets across different navigator contexts

## Files Modified
- `src/screens/main/SettingsScreen.js`: Fixed logout navigation logic
