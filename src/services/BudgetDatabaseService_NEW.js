// Budget Database Service - Updated for New Schema
// Handles all database operations for budget management via chatbot

import { supabase } from '../config/supabase';
import DebugUtils from '../utils/DebugUtils';

/**
 * Service class for budget-related database operations
 * Provides secure, validated access to budget data
 */
export class BudgetDatabaseService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Check and ensure tracking columns exist in expenses table
   * @returns {Object} Result of column check/creation
   */
  async ensureTrackingColumnsExist() {
    try {
      DebugUtils.log('DB_SERVICE', 'Checking for tracking columns in expenses table');

      // Test if the columns exist by trying to select them
      const { data, error } = await this.supabase
        .from('expenses')
        .select('created_via, confidence_score, needs_review, natural_language_input')
        .limit(1);

      if (error) {
        // Columns might not exist, return info for manual migration
        DebugUtils.log('DB_SERVICE', 'Tracking columns may not exist', { error: error.message });
        return {
          success: false,
          columnsExist: false,
          message: 'Tracking columns need to be added. Please run the migration: add_expense_tracking_columns.sql',
          migrationPath: 'supabase/migrations/add_expense_tracking_columns.sql'
        };
      }

      DebugUtils.log('DB_SERVICE', 'Tracking columns exist and are accessible');
      return {
        success: true,
        columnsExist: true,
        message: 'All tracking columns are available'
      };

    } catch (error) {
      console.error('Error checking tracking columns:', error);
      return {
        success: false,
        columnsExist: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize category names to ensure consistency
   * @param {string} category - Raw category
   * @returns {string} Normalized category (lowercase)
   */
  normalizeCategory(category) {
    if (!category) return 'others';
    
    // First normalize to lowercase
    const normalized = category.toLowerCase().trim();
    
    // Map alternative category names to standard categories
    const categoryMap = {
      // Food-related terms
      'groceries': 'food',
      'dining': 'food',
      'restaurant': 'food',
      'meals': 'food',
      'takeout': 'food',
      'delivery': 'food',
      'snacks': 'food',
      'coffee': 'food',
      'cafe': 'food',
      'lunch': 'food',
      'dinner': 'food',
      'breakfast': 'food',
      'food': 'food',

      // Transportation-related terms
      'fuel': 'transportation',
      'gas': 'transportation',
      'commute': 'transportation',
      'transport': 'transportation',
      'bus': 'transportation',
      'train': 'transportation',
      'subway': 'transportation',
      'uber': 'transportation',
      'lyft': 'transportation',
      'parking': 'transportation',
      'bike': 'transportation',
      'transit': 'transportation',

      // Entertainment-related terms
      'movies': 'entertainment',
      'cinema': 'entertainment',
      'games': 'entertainment',
      'gaming': 'entertainment',
      'hobby': 'entertainment',
      'concert': 'entertainment',
      'music': 'entertainment',
      'netflix': 'entertainment',
      'streaming': 'entertainment',
      'party': 'entertainment',
      'event': 'entertainment',
      'sports': 'entertainment',
      'gym': 'entertainment',

      // Shopping-related terms
      'clothes': 'shopping',
      'clothing': 'shopping',
      'gadgets': 'shopping',
      'electronics': 'shopping',
      'books': 'shopping',
      'textbooks': 'shopping',
      'supplies': 'shopping',
      'stationery': 'shopping',
      'shoes': 'shopping',
      'accessories': 'shopping',
      'laptop': 'shopping',
      'phone': 'shopping',

      // Utilities-related terms
      'bills': 'utilities',
      'electricity': 'utilities',
      'water': 'utilities',
      'internet': 'utilities',
      'phone': 'utilities',
      'rent': 'utilities',
      'housing': 'utilities',
      'gas bill': 'utilities',
      'wifi': 'utilities',
      'cellphone': 'utilities',
      'cable': 'utilities',
      'heating': 'utilities',

      // Others (miscellaneous) terms
      'miscellaneous': 'others',
      'misc': 'others',
      'other': 'others',
      'savings': 'others',
      'emergency': 'others',
      'health': 'others',
      'medical': 'others',
      'insurance': 'others',
      'donation': 'others',
      'gift': 'others',
      'personal': 'others',
      'miscellaneous expenses': 'others'
    };
    
    // Return mapped category or the normalized input if no mapping exists
    const mappedCategory = categoryMap[normalized] || normalized;
    
    // Validate that the category is one of our allowed categories
    const allowedCategories = ['food', 'transportation', 'entertainment', 'shopping', 'utilities', 'others'];
    
    return allowedCategories.includes(mappedCategory) ? mappedCategory : 'others';
  }

  /**
   * Check if budget tables exist in the database
   * @returns {boolean} True if tables exist
   */
  async checkTablesExist() {
    try {
      const { error } = await this.supabase
        .from('budgets')
        .select('id')
        .limit(1);
      
      return !error || error.code !== '42P01';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get or create user's budget
   * @param {string} userId - User ID
   * @returns {Object} Budget data
   */
  async getUserBudget(userId) {
    try {
      DebugUtils.log('DB_SERVICE', 'Getting user budget', { userId });

      // Validate userId parameter
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid userId provided');
      }

      // Check if tables exist first
      const tablesExist = await this.checkTablesExist();
      if (!tablesExist) {
        console.warn('Budget tables not found. Please run the database migration.');
        return this.getFallbackBudgetData();
      }

      // First, try to get existing budget with strict user filtering
      const { data: budget, error: fetchError } = await this.supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        DebugUtils.log('DB_SERVICE', 'Budget fetch error', { userId, error: fetchError });
        throw fetchError;
      }

      // If no budget exists, create a default one
      if (!budget) {
        DebugUtils.log('DB_SERVICE', 'No budget found, creating default', { userId });
        return await this.createDefaultBudget(userId);
      }

      // Validate that the budget actually belongs to the current user
      if (budget.user_id !== userId) {
        DebugUtils.log('DB_SERVICE', 'Budget user_id mismatch', { 
          requestedUserId: userId, 
          budgetUserId: budget.user_id 
        });
        throw new Error('Budget user ID mismatch - security violation');
      }

      // Get budget categories with strict budget_id filtering
      const { data: budgetCategories, error: categoriesError } = await this.supabase
        .from('budget_categories')
        .select('*')
        .eq('budget_id', budget.id);

      if (categoriesError) {
        console.error('Error getting budget categories:', categoriesError);
        budget.budget_categories = [];
      } else {
        budget.budget_categories = budgetCategories || [];
      }

      DebugUtils.log('DB_SERVICE', 'Budget retrieved successfully', { 
        userId,
        budgetId: budget.id, 
        budgetUserId: budget.user_id,
        categoriesCount: budget.budget_categories.length 
      });

      return {
        success: true,
        data: budget
      };
    } catch (error) {
      console.error('Error getting user budget:', error);
      DebugUtils.log('DB_SERVICE', 'getUserBudget error', { userId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Returns fallback budget data when tables don't exist
   * @param {number} monthlyBudget - Total budget amount
   * @param {number} savingsGoal - Savings goal amount
   * @returns {Object} Fallback budget structure
   */
  getFallbackBudgetData(monthlyBudget = 0, savingsGoal = 0) {
    const budgetableAmount = Math.max(0, monthlyBudget - savingsGoal);
    const categoryBudget = Math.round((budgetableAmount / 6) * 100) / 100;
    
    return {
      success: true,
      data: {
        id: 'fallback-budget',
        monthly: monthlyBudget,
        weekly: Math.round((monthlyBudget / 4) * 100) / 100,
        savings_goal: savingsGoal,
        currency: 'PHP',
        budget_categories: [
          { category_name: 'food', allocated_amount: categoryBudget, spent_amount: 0 },
          { category_name: 'transportation', allocated_amount: categoryBudget, spent_amount: 0 },
          { category_name: 'entertainment', allocated_amount: categoryBudget, spent_amount: 0 },
          { category_name: 'utilities', allocated_amount: categoryBudget, spent_amount: 0 },
          { category_name: 'shopping', allocated_amount: categoryBudget, spent_amount: 0 },
          { category_name: 'others', allocated_amount: categoryBudget, spent_amount: 0 }
        ]
      },
      message: 'Using fallback data. Please run database migration to enable full functionality.'
    };
  }

  /**
   * Create a default budget for new users with proper allocation
   * @param {string} userId - User ID
   * @param {number} monthlyBudget - Monthly budget amount from onboarding
   * @param {number} savingsGoal - Savings goal from onboarding
   * @returns {Object} Created budget
   */
  async createDefaultBudget(userId, monthlyBudget = 20500, savingsGoal = 0) {
    try {
      DebugUtils.log('DB_SERVICE', 'Creating default budget', { userId, monthlyBudget, savingsGoal });

      // Check if tables exist first
      const tablesExist = await this.checkTablesExist();
      if (!tablesExist) {
        return this.getFallbackBudgetData(monthlyBudget, savingsGoal);
      }

      // Check if user already has a budget
      const { data: existingBudget, error: checkError } = await this.supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .single();

      let budget;
      
      if (existingBudget) {
        // Update existing budget instead of creating new one
        DebugUtils.log('DB_SERVICE', 'Updating existing budget', { budgetId: existingBudget.id });
        
        const { data: updatedBudget, error: updateError } = await this.supabase
          .from('budgets')
          .update({
            monthly: monthlyBudget,
            weekly: Math.round((monthlyBudget / 4) * 100) / 100,
            savings_goal: savingsGoal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBudget.id)
          .select()
          .single();

        if (updateError) throw updateError;
        budget = updatedBudget;
      } else {
        // Create new budget
        DebugUtils.log('DB_SERVICE', 'Creating new budget');
        
        const { data: newBudget, error: budgetError } = await this.supabase
          .from('budgets')
          .insert({
            user_id: userId,
            monthly: monthlyBudget,
            weekly: Math.round((monthlyBudget / 4) * 100) / 100,
            currency: 'PHP',
            savings_goal: savingsGoal
          })
          .select()
          .single();

        if (budgetError) throw budgetError;
        budget = newBudget;
      }

      // Calculate budgetable amount (monthly budget minus savings goal)
      const budgetableAmount = Math.max(0, monthlyBudget - savingsGoal);
      
      // Define proper category allocation percentages
      const categoryPercentages = {
        food: 0.30,           // 30%
        transportation: 0.15, // 15%
        entertainment: 0.10,  // 10%
        shopping: 0.15,       // 15%
        utilities: 0.20,      // 20%
        others: 0.10          // 10%
      };

      // Get existing categories to avoid duplicates
      const { data: existingCategories } = await this.supabase
        .from('budget_categories')
        .select('category_name')
        .eq('budget_id', budget.id);

      const existingCategoryNames = new Set(
        (existingCategories || []).map(cat => cat.category_name.toLowerCase())
      );

      // Create budget categories with proper percentage-based allocation
      const categories = Object.entries(categoryPercentages).map(([name, percentage]) => ({
        name: name.toLowerCase(),
        allocation: Math.round((budgetableAmount * percentage) * 100) / 100
      }));

      // Only insert categories that don't already exist
      const categoriesToInsert = categories.filter(cat => !existingCategoryNames.has(cat.name));
      
      let budgetCategories = [];
      if (categoriesToInsert.length > 0) {
        DebugUtils.log('DB_SERVICE', 'Inserting new categories', { 
          toInsert: categoriesToInsert.map(c => c.name),
          existing: Array.from(existingCategoryNames) 
        });

        const { data: newCategories, error: categoriesError } = await this.supabase
          .from('budget_categories')
          .insert(
            categoriesToInsert.map(cat => ({
              budget_id: budget.id,
              category_name: cat.name,
              allocated_amount: cat.allocation,
              spent_amount: 0
            }))
          )
          .select();

        if (categoriesError) throw categoriesError;
        budgetCategories = newCategories || [];
      }

      // Update existing categories with new allocations
      const categoriesToUpdate = categories.filter(cat => existingCategoryNames.has(cat.name));
      if (categoriesToUpdate.length > 0) {
        DebugUtils.log('DB_SERVICE', 'Updating existing categories', { 
          toUpdate: categoriesToUpdate.map(c => c.name) 
        });

        const updatePromises = categoriesToUpdate.map(cat => 
          this.supabase
            .from('budget_categories')
            .update({
              allocated_amount: cat.allocation,
              updated_at: new Date().toISOString()
            })
            .eq('budget_id', budget.id)
            .eq('category_name', cat.name)
            .select()
        );

        const updateResults = await Promise.all(updatePromises);
        const updatedCategories = updateResults
          .filter(result => !result.error && result.data)
          .flatMap(result => result.data);
        
        budgetCategories = [...budgetCategories, ...updatedCategories];
      }

      // Get all final categories
      const { data: allCategories } = await this.supabase
        .from('budget_categories')
        .select('*')
        .eq('budget_id', budget.id);

      DebugUtils.log('DB_SERVICE', 'Default budget created/updated successfully', { 
        budgetId: budget.id,
        categoriesCount: allCategories?.length || 0,
        categoryAllocations: categories.map(c => `${c.name}: ₱${c.allocation}`),
        monthlyBudget,
        savingsGoal,
        wasUpdate: !!existingBudget
      });

      return {
        success: true,
        data: {
          ...budget,
          budget_categories: allCategories || []
        }
      };
    } catch (error) {
      console.error('Error creating default budget:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure a category exists in the budget_categories table
   * @param {string} budgetId - Budget ID
   * @param {string} category - Category name (will be normalized to lowercase)
   * @returns {Promise<void>}
   */
  async ensureCategoryExists(budgetId, category) {
    try {
      // Normalize category to lowercase for consistency
      const normalizedCategory = category.toLowerCase().trim();
      
      DebugUtils.log('DB_SERVICE', 'Ensuring category exists', { budgetId, category: normalizedCategory });
      
      // Check if category already exists
      const { data: existingCategory, error: checkError } = await this.supabase
        .from('budget_categories')
        .select('id')
        .eq('budget_id', budgetId)
        .eq('category_name', normalizedCategory)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // If category doesn't exist, create it
      if (!existingCategory) {
        const { error: insertError } = await this.supabase
          .from('budget_categories')
          .insert({
            budget_id: budgetId,
            category_name: normalizedCategory,
            allocated_amount: 0,
            spent_amount: 0
          });

        if (insertError) throw insertError;
        
        DebugUtils.log('DB_SERVICE', 'Category created', { budgetId, category: normalizedCategory });
      }
    } catch (error) {
      console.error('Error ensuring category exists:', error);
      throw error;
    }
  }

  /**
   * Record a new expense transaction
   * @param {string} userId - User ID
   * @param {Object} transactionData - Transaction details
   * @returns {Object} Transaction result
   */
  async recordExpense(userId, transactionData) {
    try {
      DebugUtils.log('DB_SERVICE', 'Recording expense', { userId, transactionData });
      
      // Validate required fields
      const { amount, category, description, date, naturalLanguageInput, confidence } = transactionData;
      
      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Normalize and ensure category is valid
      let validCategory = this.normalizeCategory(category);
      
      DebugUtils.log('DB_SERVICE', 'Normalized category', { original: category, normalized: validCategory });

      // Get user's budget
      const budgetResult = await this.getUserBudget(userId);
      if (!budgetResult.success) throw new Error(budgetResult.error);

      const budget = budgetResult.data;
      
      // Ensure the category exists in budget_categories table
      await this.ensureCategoryExists(budget.id, validCategory);

      // Insert into expenses table (primary source of truth)
      const expenseToInsert = {
        user_id: userId,
        amount,
        category: validCategory,
        note: description || null,
        // Enhanced date/time handling - respect manually selected dates
        date: (() => {
          try {
            // If a specific date is provided (from UI date picker), use it
            if (date && typeof date === 'string' && date.trim() !== '') {
              const dateObj = new Date(date);
              if (!isNaN(dateObj.getTime())) {
                // Valid date provided - use it as-is (includes time from date picker)
                return dateObj.toISOString();
              } else {
                console.warn(`Invalid date provided: ${date}, using current timestamp`);
                return new Date().toISOString();
              }
            }
            
            // Handle Date objects passed directly
            if (date instanceof Date && !isNaN(date.getTime())) {
              return date.toISOString();
            }
            
            // For chatbot/AI entries without specific date, use current timestamp
            const isChatbotEntry = (naturalLanguageInput || confidence !== null);
            if (isChatbotEntry) {
              // This is a real-time chatbot entry - use current timestamp
              return new Date().toISOString();
            }
            
            // Default case for manual entries without date - use current timestamp
            return new Date().toISOString();
          } catch (error) {
            console.warn(`Date parsing error: ${error.message}, using current timestamp`);
            return new Date().toISOString();
          }
        })()
      };

      // Add metadata fields only if they will be accepted by the database
      // This prevents errors when columns don't exist yet
      if (naturalLanguageInput !== undefined && naturalLanguageInput !== null && naturalLanguageInput.trim() !== '') {
        expenseToInsert.natural_language_input = naturalLanguageInput.trim();
      }
      
      if (confidence !== undefined && confidence !== null && typeof confidence === 'number') {
        expenseToInsert.confidence_score = Math.max(0, Math.min(1, confidence)); // Ensure 0-1 range
        expenseToInsert.needs_review = confidence < 0.7;
      }
      
      // Fix created_via logic - check if this is a chatbot-generated expense
      // Chatbot expenses have either naturalLanguageInput OR confidence score
      const isChatbotExpense = (
        (naturalLanguageInput !== undefined && naturalLanguageInput !== null && naturalLanguageInput.trim() !== '') ||
        (confidence !== undefined && confidence !== null && typeof confidence === 'number')
      );
      
      expenseToInsert.created_via = isChatbotExpense ? 'chatbot' : 'user';
      
      DebugUtils.log('DB_SERVICE', 'Expense insertion details', {
        userId,
        originalDate: date,
        dateProvided: !!(date && date.trim() !== ''),
        formattedDate: expenseToInsert.date,
        currentTimestamp: new Date().toISOString(),
        naturalLanguageInput: naturalLanguageInput,
        confidence: confidence,
        isChatbotExpense,
        created_via: expenseToInsert.created_via,
        hasNaturalLanguage: !!(naturalLanguageInput && naturalLanguageInput.trim()),
        hasConfidence: !!(confidence !== undefined && confidence !== null)
      });
      
      DebugUtils.log('DB_SERVICE', 'Inserting expense (primary source)', expenseToInsert);

      const { data: expense, error: expenseError } = await this.supabase
        .from('expenses')
        .insert(expenseToInsert)
        .select()
        .single();

      if (expenseError) {
        console.error('Expense insert error:', expenseError);
        throw expenseError;
      }
      
      DebugUtils.log('DB_SERVICE', 'Expense inserted successfully', expense);

      // Get updated category spending
      let categoryInfo = null;
      try {
        categoryInfo = await this.getCategorySpending(userId, validCategory);
      } catch (categoryError) {
        console.error('Error getting category spending:', categoryError);
        categoryInfo = { success: false, error: categoryError.message };
      }

      return {
        success: true,
        data: expense,
        categoryInfo,
        message: `✅ Recorded ₱${amount.toLocaleString()} expense for ${validCategory}${description ? ` (${description})` : ''}`
      };
    } catch (error) {
      console.error('Error recording expense:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get spending for a specific category
   * @param {string} userId - User ID
   * @param {string} category - Category name
   * @param {string} period - Time period
   * @returns {Object} Category spending data
   */
  async getCategorySpending(userId, category, period = 'this_month') {
    try {
      DebugUtils.log('DB_SERVICE', 'Getting category spending', { userId, category, period });

      const dateFilter = this.getDateFilter(period);
      
      // Get category info and recent transactions from expenses table (single source of truth)
      const expensesResult = await this.supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .gte('date', dateFilter.start + 'T00:00:00.000Z')
        .lte('date', dateFilter.end + 'T23:59:59.999Z')
        .order('created_at', { ascending: false });

      if (expensesResult.error) {
        DebugUtils.log('DB_SERVICE', 'Expenses query error in category spending', expensesResult.error);
        throw expensesResult.error;
      }

      // Process expenses data
      const expenses = (expensesResult.data || []).filter(e => e.user_id === userId).map(exp => ({
        ...exp,
        amount: parseFloat(exp.amount),
        category: this.normalizeCategory(exp.category),
        description: exp.note,
        transaction_date: exp.date.split('T')[0],
        source: 'expenses',
        user_id: exp.user_id
      }));

      // Calculate total spent from expenses (single source of truth)
      const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      DebugUtils.log('DB_SERVICE', 'Category spending validation', {
        userId,
        category,
        expensesFromDB: expenses.length,
        totalSpent
      });

      // Get budget allocation for this category
      const budgetResult = await this.getUserBudget(userId);
      let allocated = 0;
      if (budgetResult.success) {
        const categoryBudget = budgetResult.data.budget_categories
          .find(c => c.category_name === category);
        allocated = categoryBudget ? parseFloat(categoryBudget.allocated_amount) : 0;
      }

      DebugUtils.log('DB_SERVICE', 'Category spending calculated', {
        userId,
        category,
        totalSpent,
        allocated,
        expenseCount: expenses.length
      });

      return {
        success: true,
        data: {
          category,
          totalSpent,
          allocated,
          remaining: allocated - totalSpent,
          percentage: allocated > 0 ? (totalSpent / allocated) * 100 : 0,
          transactionCount: expenses.length,
          recentTransactions: expenses.slice(0, 5),
          debug: {
            userId,
            dateFilter,
            sourceCounts: {
              expenses: expenses.length
            }
          }
        }
      };
    } catch (error) {
      console.error('Error getting category spending:', error);
      DebugUtils.log('DB_SERVICE', 'Category spending error', { userId, category, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Recalculate and update category allocations based on current monthly budget
   * @param {string} userId - User ID
   * @returns {Object} Update result
   */
  async recalculateCategoryAllocations(userId) {
    try {
      DebugUtils.log('DB_SERVICE', 'Recalculating category allocations', { userId });

      // Get user's current budget
      const budgetResult = await this.getUserBudget(userId);
      if (!budgetResult.success) throw new Error(budgetResult.error);

      const budget = budgetResult.data;
      const monthlyBudget = parseFloat(budget.monthly || 0);
      const savingsGoal = parseFloat(budget.savings_goal || 0);
      
      // Calculate budgetable amount (monthly budget minus savings goal)
      const budgetableAmount = Math.max(0, monthlyBudget - savingsGoal);
      
      // Define proper category allocation percentages
      const categoryPercentages = {
        food: 0.30,           // 30%
        transportation: 0.15, // 15%
        entertainment: 0.10,  // 10%
        shopping: 0.15,       // 15%
        utilities: 0.20,      // 20%
        others: 0.10          // 10%
      };

      DebugUtils.log('DB_SERVICE', 'Recalculating with proper percentages', {
        monthlyBudget,
        savingsGoal,
        budgetableAmount,
        categoryPercentages
      });

      // Update each category with its proper allocation
      const updatePromises = Object.entries(categoryPercentages).map(async ([categoryName, percentage]) => {
        const categoryBudget = Math.round((budgetableAmount * percentage) * 100) / 100;
        
        const { data, error } = await this.supabase
          .from('budget_categories')
          .update({
            allocated_amount: categoryBudget,
            updated_at: new Date().toISOString()
          })
          .eq('budget_id', budget.id)
          .eq('category_name', categoryName)
          .select();

        if (error) throw error;
        
        return { categoryName, allocated: categoryBudget, updated: data?.length || 0 };
      });

      const results = await Promise.all(updatePromises);

      DebugUtils.log('DB_SERVICE', 'Category allocations updated with proper percentages', {
        results,
        totalAllocated: results.reduce((sum, r) => sum + r.allocated, 0)
      });

      return {
        success: true,
        data: results,
        message: `Updated category allocations: Food ₱${results.find(r => r.categoryName === 'food')?.allocated.toLocaleString()}, Transportation ₱${results.find(r => r.categoryName === 'transportation')?.allocated.toLocaleString()}, etc.`
      };
    } catch (error) {
      console.error('Error recalculating category allocations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get budget summary using DataContext methods (same as HomeScreen)
   * @param {string} userId - User ID
   * @param {string} period - Time period
   * @param {Object} dataContext - DataContext with expenses and helper methods
   * @returns {Object} Budget summary
   */
  async getBudgetSummaryFromContext(userId, period = 'this_month', dataContext) {
    try {
      DebugUtils.log('DB_SERVICE', 'Getting budget summary using DataContext methods', { userId, period });

      if (!dataContext) {
        throw new Error('DataContext is required for reliable expense calculation');
      }

      const { expenses, budget, calculateTotalExpenses, getExpensesByDateRange } = dataContext;

      // First, ensure category allocations are correct (recalculate if needed)
      await this.recalculateCategoryAllocations(userId);

      // Use the same date logic as HomeScreen
      const currentDate = new Date();
      
      let monthlyExpenses, totalSpent;
      
      if (period === 'this_month' || period === 'monthly') {
        // Exact same logic as HomeScreen.js
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
        monthlyExpenses = getExpensesByDateRange(startOfMonth, endOfMonth);
        totalSpent = calculateTotalExpenses(monthlyExpenses);
      } else {
        // For other periods, use all expenses and calculate
        monthlyExpenses = expenses || [];
        totalSpent = calculateTotalExpenses(monthlyExpenses);
      }

      const monthlyBudget = parseFloat(budget?.monthly || 0);
      const remaining = monthlyBudget - totalSpent;

      // Calculate category spending from the filtered expenses
      const categorySpending = {};
      monthlyExpenses.forEach(expense => {
        const category = this.normalizeCategory(expense.category);
        categorySpending[category] = (categorySpending[category] || 0) + parseFloat(expense.amount);
      });

      // Get budget category allocations
      const budgetResult = await this.getUserBudget(userId);
      let budgetCategories = [];
      if (budgetResult.success && budgetResult.data.budget_categories) {
        budgetCategories = budgetResult.data.budget_categories;
      }

      // Create category summary with proper allocations
      const categorySummary = [];
      const allCategories = ['food', 'transportation', 'entertainment', 'shopping', 'utilities', 'others'];
      
      allCategories.forEach(categoryName => {
        const spent = categorySpending[categoryName] || 0;
        const budgetCategory = budgetCategories.find(bc => bc.category_name === categoryName);
        const allocated = budgetCategory ? parseFloat(budgetCategory.allocated_amount || 0) : 0;
        
        if (spent > 0 || allocated > 0) { // Only include categories with spending or budget allocation
          categorySummary.push({
            name: categoryName,
            spent: spent,
            allocated: allocated,
            remaining: allocated - spent
          });
        }
      });

      DebugUtils.log('DB_SERVICE', 'Budget summary calculated using DataContext', {
        userId,
        totalSpent,
        monthlyBudget,
        expenseCount: monthlyExpenses.length,
        categorySpending,
        categorySummary,
        method: 'DataContext'
      });

      return {
        success: true,
        data: {
          totalBudget: monthlyBudget,
          totalSpent,
          remaining,
          percentage: monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0,
          categories: categorySummary,
          period: period,
          alerts: [], // Can be added later if needed
          debug: {
            method: 'DataContext',
            expenseCount: monthlyExpenses.length,
            budgetCategoriesFound: budgetCategories.length,
            dateRange: period === 'this_month' ? {
              start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
              end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
            } : null
          }
        }
      };
    } catch (error) {
      console.error('Error getting budget summary from context:', error);
      DebugUtils.log('DB_SERVICE', 'Budget summary error', { userId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get budget summary and status
   * @param {string} userId - User ID
   * @param {string} period - Time period
   * @returns {Object} Budget summary
   */
  async getBudgetSummary(userId, period = 'this_month') {
    try {
      // Critical security validation
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        throw new Error('Invalid or missing userId');
      }

      // Verify current user session matches requested userId
      const currentUserResult = await this.getCurrentUser();
      if (currentUserResult.success && currentUserResult.user) {
        if (currentUserResult.user.id !== userId) {
          DebugUtils.log('DB_SERVICE', 'USER ID MISMATCH DETECTED', {
            requestedUserId: userId,
            authenticatedUserId: currentUserResult.user.id,
            userEmail: currentUserResult.user.email
          });
          throw new Error(`User ID mismatch: requested ${userId}, authenticated ${currentUserResult.user.id}`);
        }
      }

      DebugUtils.log('DB_SERVICE', 'Getting budget summary with strict validation', { userId, period });

      const budgetResult = await this.getUserBudget(userId);
      if (!budgetResult.success) throw new Error(budgetResult.error);

      const budget = budgetResult.data;
      
      // Double-check budget ownership
      if (budget.user_id !== userId) {
        throw new Error(`Budget ownership mismatch: budget belongs to ${budget.user_id}, requested by ${userId}`);
      }

      const dateFilter = this.getDateFilter(period);

      DebugUtils.log('DB_SERVICE', 'Date filter applied', { dateFilter, userId });

      // Enhanced query using expenses table as single source of truth
      DebugUtils.log('DB_SERVICE', 'Executing database query using expenses table only', { 
        userId, 
        dateFilter,
        userIdType: typeof userId,
        userIdLength: userId.length 
      });

      const expensesResult = await this.supabase
        .from('expenses')
        .select('amount, category, user_id, date, id, note')
        .eq('user_id', userId)
        .gte('date', dateFilter.start + 'T00:00:00.000Z')
        .lte('date', dateFilter.end + 'T23:59:59.999Z');

      if (expensesResult.error) {
        DebugUtils.log('DB_SERVICE', 'Expenses query error', expensesResult.error);
        throw expensesResult.error;
      }

      // Process expenses data with detailed logging
      const rawExpenses = expensesResult.data || [];

      DebugUtils.log('DB_SERVICE', 'Raw expenses data received', { 
        rawExpensesCount: rawExpenses.length,
        userId,
        uniqueExpenseUsers: [...new Set(rawExpenses.map(e => e.user_id))],
        sampleExpense: rawExpenses[0]
      });

      // Check for cross-user contamination in raw data
      const wrongUserExpenses = rawExpenses.filter(e => e.user_id !== userId);

      if (wrongUserExpenses.length > 0) {
        DebugUtils.log('DB_SERVICE', 'CRITICAL SECURITY BREACH: Wrong user data in query result', {
          wrongUserExpenses: wrongUserExpenses.length,
          expectedUserId: userId,
          wrongExpenseUsers: [...new Set(wrongUserExpenses.map(e => e.user_id))]
        });
      }

      // Filter and validate each record
      const expenses = rawExpenses.filter(e => {
        const isValid = e.user_id === userId;
        if (!isValid) {
          DebugUtils.log('DB_SERVICE', 'SECURITY ALERT: Expense with wrong user_id', {
            expenseUserId: e.user_id,
            requestedUserId: userId,
            expenseId: e.id
          });
        }
        return isValid;
      });

      DebugUtils.log('DB_SERVICE', 'Filtered expenses data', { 
        userId,
        expensesCount: expenses.length,
        dateRange: dateFilter,
        filteredOutExpenses: rawExpenses.length - expenses.length
      });

      // Process validated expenses data (single source of truth)
      const processedExpenses = expenses.map(exp => ({
        amount: parseFloat(exp.amount),
        category: this.normalizeCategory(exp.category),
        user_id: exp.user_id,
        source: 'expenses',
        id: exp.id,
        description: exp.note
      }));

      // Final security check
      const invalidExpenses = processedExpenses.filter(exp => exp.user_id !== userId);
      if (invalidExpenses.length > 0) {
        DebugUtils.log('DB_SERVICE', 'CRITICAL: Invalid expenses found after filtering', {
          count: invalidExpenses.length,
          invalidExpenses
        });
        throw new Error(`Security violation: ${invalidExpenses.length} expenses found with wrong user_id`);
      }

      const totalSpent = processedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      // Calculate category spending from validated expenses data
      const categorySpending = {};
      processedExpenses.forEach(exp => {
        categorySpending[exp.category] = (categorySpending[exp.category] || 0) + exp.amount;
      });

      DebugUtils.log('DB_SERVICE', 'Budget summary calculated', {
        userId,
        totalSpent,
        categorySpending,
        monthlyBudget: budget.monthly,
        transactionCount: allTransactions.length
      });

      // Get active alerts
      const alertsResult = await this.getActiveAlerts(userId);

      // Ensure we use the monthly budget and handle null values
      const monthlyBudget = parseFloat(budget.monthly || 0);

      return {
        success: true,
        data: {
          totalBudget: monthlyBudget,
          totalSpent,
          remaining: monthlyBudget - totalSpent,
          percentage: monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0,
          categories: budget.budget_categories.map(cat => ({
            name: cat.category_name,
            allocated: parseFloat(cat.allocated_amount),
            spent: categorySpending[cat.category_name] || 0,
            remaining: parseFloat(cat.allocated_amount) - (categorySpending[cat.category_name] || 0)
          })),
          period: period,
          alerts: alertsResult.success ? alertsResult.data : [],
          debug: {
            userId,
            dateFilter,
            transactionSources: {
              transactions: transactions.length,
              expenses: expenses.length
            },
            securityValidation: {
              filteredOutTransactions: rawTransactions.length - transactions.length,
              filteredOutExpenses: rawExpenses.length - expenses.length,
              totalValidatedTransactions: allTransactions.length
            }
          }
        }
      };
    } catch (error) {
      console.error('Error getting budget summary:', error);
      DebugUtils.log('DB_SERVICE', 'Budget summary error', { userId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update user's total budget
   * @param {string} userId - User ID
   * @param {number} newAmount - New budget amount
   * @param {string} period - Budget period
   * @returns {Object} Update result
   */
  async updateTotalBudget(userId, newAmount) {
    try {
      // Validate input
      if (!newAmount || newAmount <= 0) {
        throw new Error('Budget amount must be greater than 0');
      }

      // Update budget
      const { data: budget, error: updateError } = await this.supabase
        .from('budgets')
        .update({
          monthly: newAmount,
          weekly: Math.round((newAmount / 4) * 100) / 100,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        success: true,
        data: budget,
        message: `Monthly budget updated to ₱${newAmount.toLocaleString()}`
      };
    } catch (error) {
      console.error('Error updating total budget:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update category budget allocation
   * @param {string} userId - User ID
   * @param {string} category - Category name
   * @param {number} amount - New allocation amount
   * @returns {Object} Update result
   */
  async updateCategoryBudget(userId, category, amount) {
    try {
      // Get user's budget
      const budgetResult = await this.getUserBudget(userId);
      if (!budgetResult.success) throw new Error(budgetResult.error);

      const budget = budgetResult.data;

      // Update category allocation
      const { data, error } = await this.supabase
        .from('budget_categories')
        .update({
          allocated_amount: amount,
          updated_at: new Date().toISOString()
        })
        .eq('budget_id', budget.id)
        .eq('category_name', category)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: `${category} budget updated to ₱${amount.toLocaleString()}`
      };
    } catch (error) {
      console.error('Error updating category budget:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get active budget alerts for user
   * @param {string} userId - User ID
   * @returns {Object} Active alerts
   */
  async getActiveAlerts(userId) {
    try {
      const { data: alerts, error } = await this.supabase
        .from('budget_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return {
        success: true,
        data: alerts || []
      };
    } catch (error) {
      console.error('Error getting active alerts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log chatbot interaction for analytics
   * @param {string} userId - User ID
   * @param {Object} interactionData - Interaction details
   * @returns {Object} Log result
   */
  async logInteraction(userId, interactionData) {
    try {
      const {
        userInput,
        intent,
        extractedData,
        chatbotResponse,
        success,
        errorMessage,
        processingTime
      } = interactionData;

      const { error } = await this.supabase
        .from('chatbot_interactions')
        .insert({
          user_id: userId,
          user_input: userInput,
          intent,
          extracted_data: extractedData,
          chatbot_response: chatbotResponse,
          success: success !== false,
          error_message: errorMessage || null,
          processing_time_ms: processingTime || null
        });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error logging interaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get date filter for different periods
   * @param {string} period - Period type
   * @returns {Object} Start and end dates
   * @private
   */
  getDateFilter(period) {
    const now = new Date();
    const filters = {
      today: {
        start: now.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      },
      this_week: {
        start: new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      this_month: {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      },
      monthly: {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      }
    };

    return filters[period] || filters.this_month;
  }

  /**
   * Search expenses by query
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {number} limit - Result limit
   * @returns {Object} Search results
   */
  async searchTransactions(userId, query, limit = 10) {
    try {
      const { data: expenses, error } = await this.supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .or(`note.ilike.%${query}%,category.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: expenses || []
      };
    } catch (error) {
      console.error('Error searching transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete an expense
   * @param {string} userId - User ID
   * @param {string} expenseId - Expense ID
   * @returns {Object} Delete result
   */
  async deleteTransaction(userId, expenseId) {
    try {
      const { data, error } = await this.supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: `Expense deleted successfully`
      };
    } catch (error) {
      console.error('Error deleting expense:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update an expense
   * @param {string} userId - User ID
   * @param {string} expenseId - Expense ID
   * @param {Object} updates - Update data
   * @returns {Object} Update result
   */
  async updateTransaction(userId, expenseId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('expenses')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', expenseId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: `Expense updated successfully`
      };
    } catch (error) {
      console.error('Error updating expense:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Diagnostic method to verify user data integrity (expenses table only)
   * @param {string} userId - User ID
   * @returns {Object} Diagnostic results
   */
  async getUserDataDiagnostic(userId) {
    try {
      DebugUtils.log('DB_SERVICE', 'Running user data diagnostic from expenses table', { userId });

      // Get current date for filtering
      const now = new Date();
      const thisMonth = {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      };

      // Get ALL expenses data for this month (to check data isolation)
      const { data: allExpenses, error: allExpensesError } = await this.supabase
        .from('expenses')
        .select('*')
        .gte('date', thisMonth.start + 'T00:00:00.000Z')
        .lte('date', thisMonth.end + 'T23:59:59.999Z');

      if (allExpensesError) throw allExpensesError;

      // Get user-specific expenses
      const { data: userExpenses, error: userExpensesError } = await this.supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thisMonth.start + 'T00:00:00.000Z')
        .lte('date', thisMonth.end + 'T23:59:59.999Z');

      if (userExpensesError) throw userExpensesError;

      // Get user budget
      const { data: budget, error: budgetError } = await this.supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId);

      // Calculate totals from expenses only
      const allExpenseTotal = (allExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      const userExpenseTotal = (userExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      // Category analysis
      const userCategories = {};
      (userExpenses || []).forEach(expense => {
        const category = expense.category || 'uncategorized';
        userCategories[category] = (userCategories[category] || 0) + parseFloat(expense.amount || 0);
      });

      // Find unique user IDs in expense data
      const allUserIds = [...new Set((allExpenses || []).map(e => e.user_id))].filter(id => id);

      const diagnostic = {
        userId,
        timestamp: new Date().toISOString(),
        dateRange: thisMonth,
        
        // Summary totals (expenses table only)
        totals: {
          userExpenseTotal,
          userExpenseCount: (userExpenses || []).length,
          monthlyBudget: budget?.[0]?.monthly || 0,
          remainingBudget: (budget?.[0]?.monthly || 0) - userExpenseTotal
        },

        // Expense data breakdown
        expenses: {
          userCount: (userExpenses || []).length,
          userTotal: userExpenseTotal,
          allCount: (allExpenses || []).length,
          allTotal: allExpenseTotal,
          categories: Object.keys(userCategories),
          categoryTotals: userCategories,
          error: userExpensesError?.message || null,
          sampleUserData: (userExpenses || []).slice(0, 5).map(e => ({
            id: e.id,
            user_id: e.user_id,
            amount: e.amount,
            category: e.category,
            note: e.note,
            date: e.date,
            created_via: e.created_via
          }))
        },
        
        budget: {
          exists: !!budget?.length,
          monthlyBudget: budget?.[0]?.monthly || 0,
          error: budgetError?.message || null
        },

        // Data integrity analysis
        dataIntegrity: {
          totalUsers: allUserIds.length,
          currentUserIndex: allUserIds.indexOf(userId),
          otherUsersExpenseTotal: allExpenseTotal - userExpenseTotal,
          expensesWithNotes: (userExpenses || []).filter(e => e.note).length,
          expensesWithCategory: (userExpenses || []).filter(e => e.category).length,
          chatbotCreatedExpenses: (userExpenses || []).filter(e => e.created_via === 'chatbot').length,
          averageExpenseAmount: userExpenseTotal / ((userExpenses || []).length || 1)
        }
      };

      DebugUtils.log('DB_SERVICE', 'Expenses-only diagnostic completed', diagnostic);

      return {
        success: true,
        data: diagnostic
      };

    } catch (error) {
      console.error('Error running expenses diagnostic:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
