// Service Imports Configuration
// Use this file to easily import all the new services in your components

// Friend System Services
// export { FriendService } from '../services/FriendService';

// Gamified Savings Services  
// export { GamifiedSavingsService } from '../services/GamifiedSavingsService';

// Budget Management Services
// export { BudgetService } from '../services/BudgetService';

// Achievement System Services
// export { AchievementService } from '../services/AchievementService';

// Existing Services (you may already have these)
import LeaderboardService from '../services/LeaderboardService';
export { LeaderboardService };

// Usage Examples:
/*
// In your component files, import the services you need:

import { 
  FriendService, 
  GamifiedSavingsService, 
  BudgetService,
  AchievementService 
} from '../config/serviceImports';

// OR import individual services:
import { FriendService } from '../services/FriendService';
import { BudgetService } from '../services/BudgetService';

// Example usage in components:
const loadData = async () => {
  try {
    // Get friends
    const friends = await FriendService.getFriendsList();
    
    // Get budget data
    const budgets = await BudgetService.getUserBudgets();
    
    // Check achievements
    const achievements = await AchievementService.getUserAchievements();
    
    // Get gamified savings
    const currentGoal = await GamifiedSavingsService.getCurrentGamifiedGoal();
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
};
*/
