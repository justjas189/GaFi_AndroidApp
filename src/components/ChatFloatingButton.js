// Notes Floating Button Component (formerly Chat)
import React, { useContext } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';

const NotesFloatingButton = ({ style }) => {
  const navigation = useNavigation();
  const { theme } = useContext(ThemeContext);

  return (
    <TouchableOpacity
      style={[
        styles.chatButton,
        { backgroundColor: theme.colors.primary },
        style
      ]}
      onPress={() => navigation.navigate('Notes')}
    >
      <Ionicons name="document-text" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chatButton: { // Note: kept old name for backwards compatibility
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});

export default NotesFloatingButton;
