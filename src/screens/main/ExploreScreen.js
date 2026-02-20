// src/screens/main/ExploreScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import MascotImage from '../../components/MascotImage';

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; // 2 columns with padding

const ExploreScreen = ({ navigation }) => {
  const { theme } = useTheme();

  // Define your explore categories/features
  const exploreItems = [
    {
      id: '1',
      title: 'Budget',
      subtitle: 'Track your budget',
      icon: 'wallet',
      color: '#4CAF50',
      screen: 'Budget'
    },
    {
      id: '2',
      title: 'Leaderboard',
      subtitle: 'Compare savings',
      icon: 'podium',
      color: '#9C27B0',
      screen: 'Leaderboard'
    },
    {
      id: '3',
      title: 'Achievements',
      subtitle: 'Your milestones',
      icon: 'ribbon',
      color: '#FFEB3B',
      screen: 'Achievements'
    },
    {
      id: '4',
      title: 'Gamification',
      subtitle: 'Fun challenges',
      icon: 'game-controller',
      color: '#E91E63',
      screen: 'Gamification'
    }
  ];

  const handleCardPress = (item) => {
    if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const renderExploreCard = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, { backgroundColor: theme.colors.card }]}
      onPress={() => handleCardPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={32} color={item.color} />
      </View>
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
        {item.title}
      </Text>
      <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>
        {item.subtitle}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MascotImage size={60} style={styles.mascot} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Explore</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Discover all features
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.grid}>
          {exploreItems.map(item => renderExploreCard(item))}
        </View>

        {/* Optional: Add a promotional banner or featured content */}
        <View style={[styles.bannerCard, { backgroundColor: theme.colors.primary + '10' }]}>
          <Ionicons name="bulb" size={40} color={theme.colors.primary} />
          <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>
            New to GaFI?
          </Text>
          <Text style={[styles.bannerText, { color: theme.colors.textSecondary }]}>
            Start by setting your first savings goal and tracking your daily expenses!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    alignItems: 'center',
  },
  mascot: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: cardWidth,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  bannerCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  bannerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ExploreScreen;
{/*    {
      id: '1',
      title: 'Budget',
      subtitle: 'Track your budget',
      icon: 'wallet',
      color: '#4CAF50',
      screen: 'Budget'
    },
    {
      id: '2',
      title: 'Learn',
      subtitle: 'Financial tips',
      icon: 'school',
      color: '#2196F3',
      screen: 'Learn'
    },
    {
      id: '3',
      title: 'Savings',
      subtitle: 'Goals & progress',
      icon: 'trophy',
      color: '#FF9800',
      screen: 'SavingsGoals'
    },
    {
      id: '4',
      title: 'Leaderboard',
      subtitle: 'Compare savings',
      icon: 'podium',
      color: '#9C27B0',
      screen: 'Leaderboard'
    },
    {
      id: '5',
      title: 'Calendar',
      subtitle: 'Expense history',
      icon: 'calendar',
      color: '#F44336',
      screen: 'Calendar'
    },
    {
      id: '6',
      title: 'Notes',
      subtitle: 'Financial notes',
      icon: 'document-text',
      color: '#00BCD4',
      screen: 'Note'
    },
    {
      id: '7',
      title: 'Achievements',
      subtitle: 'Your milestones',
      icon: 'ribbon',
      color: '#FFEB3B',
      screen: 'Achievements'
    },
    {
      id: '8',
      title: 'Gamification',
      subtitle: 'Fun challenges',
      icon: 'game-controller',
      color: '#E91E63',
      screen: 'Gamification'
    },*/}
