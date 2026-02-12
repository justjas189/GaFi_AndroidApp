import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Dimensions,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BudgetService } from '../../services/BudgetService';

const { width } = Dimensions.get('window');

const BudgetManagementScreen = () => {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showSpendingModal, setShowSpendingModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    amount: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    allocated_amount: '',
    color: '#4CAF50'
  });
  const [spendingForm, setSpendingForm] = useState({
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const categoryColors = [
    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
    '#F44336', '#00BCD4', '#795548', '#607D8B'
  ];

  // Smart category allocation percentages based on importance
  // These percentages will be applied to (total budget - savings goal)
  const categoryAllocationRules = {
    food: 0.30,              // 30% - Most important, daily necessity
    transportation: 0.20,    // 20% - Essential for mobility
    utilities: 0.15,         // 15% - Bills and necessities
    education: 0.15,         // 15% - School supplies, books
    entertainment: 0.10,     // 10% - Leisure, hobbies
    shopping: 0.05,          // 5% - Clothing, personal items
    others: 0.05             // 5% - Miscellaneous
  };

  // Capitalize category names for display
  const capitalizeCategory = (categoryName) => {
    if (!categoryName) return '';
    return categoryName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Calculate smart allocation for a category based on total budget
  const getSmartAllocation = (categoryName, totalBudget) => {
    const availableBudget = totalBudget;
    const normalizedCategory = categoryName.toLowerCase();
    const percentage = categoryAllocationRules[normalizedCategory] || 0.05; // Default 5% for unknown categories
    return availableBudget * percentage;
  };

  useEffect(() => {
    if (!authLoading) {
      loadBudgetData();
    }
  }, [user, authLoading]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated
      if (!user) {
        setError('Please log in to view your budget data');
        return;
      }
      
      // Get user budget (single budget with categories)
      const budgetData = await BudgetService.getUserBudget();
      const summaryData = await BudgetService.getBudgetSummary();
      const alertsData = await BudgetService.getBudgetAlerts();

      // Set budgets as array (even if single budget)
      setBudgets(budgetData ? [budgetData] : []);
      // Extract categories from budget
      setCategories(budgetData?.budget_categories || []);
      // Extract the summary data properly
      setBudgetSummary(summaryData?.summary || {});
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error loading budget data:', error);
      setError('Failed to load budget data. Please try again.');
      Alert.alert('Error', 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBudgetData();
    setRefreshing(false);
  };

  const createBudget = async () => {
    if (!budgetForm.name || !budgetForm.amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const budgetData = {
        monthly: parseFloat(budgetForm.amount),
        weekly: Math.round((parseFloat(budgetForm.amount) / 4) * 100) / 100,
        budgetPeriod: 'monthly'
      };

      await BudgetService.createOrUpdateBudget(budgetData);
      
      setShowAddBudgetModal(false);
      setBudgetForm({
        name: '',
        amount: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      
      await loadBudgetData();
      Alert.alert('Success', 'Budget created successfully!');
    } catch (error) {
      console.error('Error creating budget:', error);
      Alert.alert('Error', 'Failed to create budget');
    }
  };

  const addBudgetCategory = async () => {
    if (!categoryForm.name || !selectedBudget) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // Calculate smart allocation if amount not provided
      let allocatedAmount = parseFloat(categoryForm.allocated_amount);
      
      if (!allocatedAmount || isNaN(allocatedAmount)) {
        const totalBudget = parseFloat(selectedBudget.monthly) || 0;
        allocatedAmount = getSmartAllocation(categoryForm.name, totalBudget);
        
        // Show user the smart allocation
        Alert.alert(
          'Smart Allocation',
          `Based on your budget (₱${totalBudget.toLocaleString()}), we recommend ₱${allocatedAmount.toFixed(2)} for ${capitalizeCategory(categoryForm.name)}.`,
          [
            { text: 'Use Recommended', onPress: () => proceedWithAllocation(allocatedAmount) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      await proceedWithAllocation(allocatedAmount);
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('Error', 'Failed to add category');
    }
  };

  const proceedWithAllocation = async (allocatedAmount) => {
    try {
      await BudgetService.addBudgetCategory(
        categoryForm.name.toLowerCase(), // Store lowercase
        allocatedAmount
      );

      setShowAddCategoryModal(false);
      setCategoryForm({
        name: '',
        allocated_amount: '',
        color: '#4CAF50'
      });

      await loadBudgetData();
      Alert.alert('Success', `${capitalizeCategory(categoryForm.name)} category added successfully!`);
    } catch (error) {
      console.error('Error in proceedWithAllocation:', error);
      Alert.alert('Error', 'Failed to add category');
    }
  };

  const deleteCategory = async (category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete ${capitalizeCategory(category.category_name || category.name)}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await BudgetService.deleteBudgetCategory(category.id);
              await loadBudgetData();
              Alert.alert('Success', 'Category deleted successfully!');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          }
        }
      ]
    );
  };

  const recalculateAllCategories = async () => {
    if (budgets.length === 0) return;

    const budget = budgets[0];
    const categories = budget.budget_categories || [];
    
    if (categories.length === 0) {
      Alert.alert('Info', 'No categories to recalculate. Add categories first.');
      return;
    }

    Alert.alert(
      'Recalculate Category Budgets',
      'This will update all category allocations based on smart allocation rules. Current spending will be preserved.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Recalculate',
          onPress: async () => {
            try {
              const totalBudget = parseFloat(budget.monthly) || 0;

              for (const category of categories) {
                const categoryName = category.category_name || category.name;
                const newAllocation = getSmartAllocation(categoryName, totalBudget);
                
                await BudgetService.addBudgetCategory(
                  categoryName.toLowerCase(),
                  newAllocation
                );
              }

              await loadBudgetData();
              Alert.alert(
                'Success', 
                'All category budgets have been recalculated based on smart allocation!'
              );
            } catch (error) {
              console.error('Error recalculating categories:', error);
              Alert.alert('Error', 'Failed to recalculate category budgets');
            }
          }
        }
      ]
    );
  };

  const addSpending = async () => {
    if (!spendingForm.amount || !selectedCategory) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }

    try {
      await BudgetService.updateCategorySpending(
        selectedCategory.name || selectedCategory.category_name,
        parseFloat(spendingForm.amount)
      );

      setShowSpendingModal(false);
      setSpendingForm({ amount: '', description: '' });

      // Check for budget alerts
      const newAlerts = await BudgetService.checkBudgetAlerts();
      if (newAlerts.length > 0) {
        const alertMessage = newAlerts.map(alert => 
          `${alert.category_name}: ${alert.message}`
        ).join('\n');
        Alert.alert('Budget Alert!', alertMessage);
      }

      await loadBudgetData();
      Alert.alert('Success', 'Spending recorded successfully!');
    } catch (error) {
      console.error('Error adding spending:', error);
      Alert.alert('Error', 'Failed to record spending');
    }
  };

  const showAchievementAlert = (achievements) => {
    const achievement = achievements[0];
    Alert.alert(
      '🏆 Achievement Unlocked!',
      `${achievement.icon} ${achievement.title}\n${achievement.description}\n\n+${achievement.points} points!`,
      [{ text: 'Awesome!', style: 'default' }]
    );
  };

  const getProgressColor = (spent, allocated) => {
    const percentage = spent / allocated;
    if (percentage >= 0.9) return '#F44336'; // Red
    if (percentage >= 0.75) return '#FF9800'; // Orange
    return '#4CAF50'; // Green
  };

  const renderBudgetSummary = () => {
    return (
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Budget Overview
        </Text>
        
        <View style={styles.summaryStats}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: theme.colors.primary }]}>
              ₱{(budgetSummary.totalBudget || 0).toLocaleString()}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>
              Total Budget
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
              ₱{(budgetSummary.totalSpent || 0).toLocaleString()}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>
              Total Spent
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>
              ₱{(budgetSummary.remaining || 0).toLocaleString()}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>
              Remaining
            </Text>
          </View>
        </View>

        <View style={styles.overallProgressContainer}>
          <Text style={[styles.progressTitle, { color: theme.colors.text }]}>
            Overall Progress
          </Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  width: `${Math.min(100, ((budgetSummary.totalSpent || 0) / (budgetSummary.totalBudget || 1)) * 100)}%`,
                  backgroundColor: getProgressColor(budgetSummary.totalSpent || 0, budgetSummary.totalBudget || 1)
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {(((budgetSummary.totalSpent || 0) / (budgetSummary.totalBudget || 1)) * 100).toFixed(1)}% used
          </Text>
        </View>
      </View>
    );
  };

  const renderBudgetAlerts = () => {
    if (alerts.length === 0) return null;

    return (
      <View style={[styles.alertsCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Budget Alerts
        </Text>
        {alerts.map((alert, index) => (
          <View key={index} style={[styles.alertItem, { backgroundColor: '#FFE5E5' }]}>
            <Ionicons name="warning" size={20} color="#F44336" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: '#F44336' }]}>
                {alert.category_name}
              </Text>
              <Text style={[styles.alertMessage, { color: '#D32F2F' }]}>
                {alert.message}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderBudgetCard = ({ item: budget }) => {
    // Categories come directly from budget.budget_categories (nested)
    const budgetCategories = budget.budget_categories || [];
    const totalSpent = budgetCategories.reduce((sum, cat) => sum + (parseFloat(cat.spent_amount) || 0), 0);
    const budgetAmount = parseFloat(budget.monthly) || parseFloat(budget.amount) || 0;
    const progressPercentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

    // Format dates, use current month/year if invalid
    const now = new Date();
    const formatDate = (dateStr) => {
      if (!dateStr) {
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
      <View style={[styles.budgetCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.budgetHeader}>
          <Text style={[styles.budgetName, { color: theme.colors.text }]}>
            {budget.name || 'Monthly Budget'}
          </Text>
          <Text style={[styles.budgetPeriod, { color: theme.colors.text + '80' }]}>
            {budget.start_date && budget.end_date 
              ? `${formatDate(budget.start_date)} - ${formatDate(budget.end_date)}`
              : formatDate(null)
            }
          </Text>
        </View>

        <View style={styles.budgetAmount}>
          <Text style={[styles.amountSpent, { color: '#F44336' }]}>
            ₱{totalSpent.toLocaleString()}
          </Text>
          <Text style={[styles.amountTotal, { color: theme.colors.text }]}>
            / ₱{budgetAmount.toLocaleString()}
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { 
                width: `${Math.min(100, progressPercentage)}%`,
                backgroundColor: getProgressColor(totalSpent, budgetAmount)
              }
            ]} 
          />
        </View>

        <Text style={[styles.progressText, { color: theme.colors.text }]}>
          {progressPercentage.toFixed(1)}% used
        </Text>

        <View style={styles.budgetActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setSelectedBudget(budget);
              setShowAddCategoryModal(true);
            }}
          >
            <Text style={styles.actionButtonText}>Add Category</Text>
          </TouchableOpacity>

          {budgetCategories.length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50', marginLeft: 8 }]}
              onPress={recalculateAllCategories}
            >
              <Ionicons name="calculator" size={16} color="white" style={{ marginRight: 4 }} />
              <Text style={styles.actionButtonText}>Smart Recalculate</Text>
            </TouchableOpacity>
          )}
        </View>

        {budgetCategories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <Text style={[styles.categoriesTitle, { color: theme.colors.text }]}>
              Categories
            </Text>
            <Text style={[styles.categoryHint, { color: theme.colors.text + '60' }]}>
              💡 Tap to add spending • Long press to delete
            </Text>
            {budgetCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryItem, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  setSelectedCategory(category);
                  setShowSpendingModal(true);
                }}
                onLongPress={() => deleteCategory(category)}
                delayLongPress={500}
              >
                <View style={styles.categoryLeft}>
                  <View 
                    style={[styles.categoryColorDot, { backgroundColor: category.color }]} 
                  />
                  <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                    {capitalizeCategory(category.category_name || category.name)}
                  </Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                    ₱{(parseFloat(category.spent_amount) || 0).toLocaleString()} / ₱{(parseFloat(category.allocated_amount) || 0).toLocaleString()}
                  </Text>
                  <View style={styles.categoryProgressContainer}>
                    <View 
                      style={[
                        styles.categoryProgress,
                        { 
                          width: `${Math.min(100, ((parseFloat(category.spent_amount) || 0) / (parseFloat(category.allocated_amount) || 1)) * 100)}%`,
                          backgroundColor: getProgressColor(parseFloat(category.spent_amount) || 0, parseFloat(category.allocated_amount) || 1)
                        }
                      ]} 
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (loading || authLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading budgets...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
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
            onPress={loadBudgetData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Budget Management</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAddBudgetModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderBudgetSummary()}

        {budgets.length > 0 ? (
          <FlatList
            data={budgets}
            renderItem={renderBudgetCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          />
        ) : (
          <View style={[styles.noBudgetsCard, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="wallet" size={48} color={theme.colors.primary} />
            <Text style={[styles.noBudgetsTitle, { color: theme.colors.text }]}>
              No budgets yet
            </Text>
            <Text style={[styles.noBudgetsSubtitle, { color: theme.colors.text + '80' }]}>
              Create your first budget to start tracking your expenses
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAddBudgetModal(true)}
            >
              <Text style={styles.createButtonText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Budget Modal */}
      <Modal
        visible={showAddBudgetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddBudgetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Create New Budget
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Budget name"
              placeholderTextColor={theme.colors.text + '60'}
              value={budgetForm.name}
              onChangeText={(text) => setBudgetForm({...budgetForm, name: text})}
            />
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Budget amount (₱)"
              placeholderTextColor={theme.colors.text + '60'}
              value={budgetForm.amount}
              onChangeText={(text) => setBudgetForm({...budgetForm, amount: text})}
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={createBudget}
              >
                <Text style={styles.modalButtonText}>Create Budget</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowAddBudgetModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        visible={showAddCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add Category to {selectedBudget?.name}
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Category name (e.g., Food, Transportation)"
              placeholderTextColor={theme.colors.text + '60'}
              value={categoryForm.name}
              onChangeText={(text) => setCategoryForm({...categoryForm, name: text})}
            />
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Allocated amount (₱) - Optional, we'll suggest"
              placeholderTextColor={theme.colors.text + '60'}
              value={categoryForm.allocated_amount}
              onChangeText={(text) => setCategoryForm({...categoryForm, allocated_amount: text})}
              keyboardType="numeric"
            />

            <Text style={[styles.helperText, { color: theme.colors.text + '80' }]}>
              💡 Leave amount empty for smart allocation based on your budget and savings goal
            </Text>

            <Text style={[styles.colorLabel, { color: theme.colors.text }]}>
              Choose Color:
            </Text>
            <View style={styles.colorPicker}>
              {categoryColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    categoryForm.color === color && styles.selectedColor
                  ]}
                  onPress={() => setCategoryForm({...categoryForm, color})}
                />
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={addBudgetCategory}
              >
                <Text style={styles.modalButtonText}>Add Category</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowAddCategoryModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Spending Modal */}
      <Modal
        visible={showSpendingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSpendingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add Spending to {capitalizeCategory(selectedCategory?.category_name || selectedCategory?.name)}
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Amount spent (₱)"
              placeholderTextColor={theme.colors.text + '60'}
              value={spendingForm.amount}
              onChangeText={(text) => setSpendingForm({...spendingForm, amount: text})}
              keyboardType="numeric"
              autoFocus={true}
            />
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.colors.text + '60'}
              value={spendingForm.description}
              onChangeText={(text) => setSpendingForm({...spendingForm, description: text})}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={addSpending}
              >
                <Text style={styles.modalButtonText}>Record Spending</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowSpendingModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  overallProgressContainer: {
    marginTop: 16,
  },
  progressTitle: {
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
  alertsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertMessage: {
    fontSize: 12,
    marginTop: 2,
  },
  budgetCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  budgetHeader: {
    marginBottom: 16,
  },
  budgetName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  budgetPeriod: {
    fontSize: 12,
    marginTop: 4,
  },
  budgetAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  amountSpent: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  amountTotal: {
    fontSize: 16,
    marginLeft: 4,
  },
  budgetActions: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesContainer: {
    marginTop: 20,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryHint: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 12,
    marginBottom: 4,
  },
  categoryProgressContainer: {
    width: 80,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
  },
  categoryProgress: {
    height: '100%',
    borderRadius: 2,
  },
  noBudgetsCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  noBudgetsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noBudgetsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 16,
    marginTop: -8,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    margin: 4,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
  },
});

export default BudgetManagementScreen;
