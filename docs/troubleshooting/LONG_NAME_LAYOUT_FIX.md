# Long Name Layout Fix - Settings Button Visibility

## Problem Description
When a user has a very long name, the Settings button (gear icon) in the HomeScreen header gets pushed off the screen or becomes invisible. This happens because the long name pushes the header actions (buttons) to the right, causing them to overflow beyond the screen boundaries.

## Root Cause Analysis
The original header layout had these issues:

### Original Layout Structure:
```javascript
<View style={styles.header}>
  <View>  {/* User name container - no flex constraints */}
    <Text>Hello,</Text>
    <Text>{userInfo?.name || 'User'}</Text>  {/* No text truncation */}
  </View>
  <View style={styles.headerActions}>  {/* Action buttons */}
    {/* Settings button and other buttons */}
  </View>
</View>
```

### Original Styles:
```javascript
header: {
  flexDirection: 'row',
  justifyContent: 'space-between',  // Pushes content to opposite ends
  alignItems: 'center',
  padding: 20,
},
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  // No flexShrink: 0 - could be compressed
},
name: {
  fontSize: 24,
  fontWeight: 'bold',
  // No text truncation properties
}
```

### The Problem:
1. **No flex constraints**: The name container had no `flex` or size constraints
2. **No text truncation**: Long names would expand indefinitely
3. **No protection for actions**: Header actions could be pushed off-screen
4. **Space-between layout**: Created rigid spacing that didn't adapt to content overflow

## Solution Implemented

### 1. Added User Info Container with Flex Constraints
```javascript
<View style={styles.userInfoContainer}>  {/* New container with flex: 1 */}
  <Text style={[styles.greeting, { color: theme.colors.text, opacity: 0.6 }]}>Hello,</Text>
  <Text 
    style={[styles.name, { color: theme.colors.text }]}
    numberOfLines={1}        {/* Limit to single line */}
    ellipsizeMode="tail"     {/* Add "..." at the end */}
  >
    {userInfo?.name || 'User'}
  </Text>
</View>
```

### 2. Updated Header Layout Styles
```javascript
header: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
},
userInfoContainer: {
  flex: 1,           // Takes available space but can shrink
  marginRight: 16,   // Ensures gap between name and actions
},
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,     // Prevents actions from being compressed
},
```

### 3. Enhanced Name Text Truncation
```javascript
name: {
  color: '#FFF',
  fontSize: 24,
  fontWeight: 'bold',
  flexShrink: 1,     // Allows text to shrink when needed
},
```

## How the Fix Works

### Layout Behavior:
1. **Flexible Name Container**: `userInfoContainer` with `flex: 1` takes up available space
2. **Protected Actions**: `headerActions` with `flexShrink: 0` ensures buttons always stay visible
3. **Text Truncation**: `numberOfLines={1}` and `ellipsizeMode="tail"` truncates long names with "..."
4. **Responsive Layout**: The layout adapts to different name lengths automatically

### Visual Examples:
```
Short Name:
[Hello, John        ] [🗂️ 🧪 🎯 ⚙️]

Long Name (Before Fix):
[Hello, Christopher Alexander Johnson III] [buttons pushed off-screen]

Long Name (After Fix):
[Hello, Christopher A...] [🗂️ 🧪 🎯 ⚙️]
```

## Benefits of This Solution

1. **Always Visible Settings**: Settings button is never pushed off-screen
2. **Graceful Text Handling**: Long names are truncated with ellipsis
3. **Responsive Design**: Layout adapts to any name length
4. **Preserved Functionality**: All header buttons remain accessible
5. **Visual Balance**: Maintains proper spacing and alignment
6. **Cross-Platform Compatibility**: Works on all screen sizes

## Testing Scenarios

To test this fix:
1. **Short names**: "John", "Ana" - should display fully with normal spacing
2. **Medium names**: "Christopher Johnson" - should display fully
3. **Long names**: "Christopher Alexander Johnson III" - should truncate with "..."
4. **Very long names**: "Bartholomew Christopher Alexander Johnson III" - should truncate appropriately
5. **Different screen sizes**: Test on various device widths

## Files Modified
- `src/screens/main/HomeScreen.js`: Fixed header layout and added text truncation
