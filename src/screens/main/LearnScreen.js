import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Alert,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import LearningProgressDatabaseService from '../../services/LearningProgressDatabaseService';
import { MonTMascot } from '../../MonT/components/MascotSystem';
import { MASCOT_STATES } from '../../MonT/constants/MascotStates';

const { width } = Dimensions.get('window');

const financialTips = [
  {
    id: '1',
    title: 'Student Budget Hack',
    description: 'Follow the 70/20/10 rule: 70% for monthly expenses, 20% for savings, and 10% for personal enjoyment.',
    icon: 'school-outline',
    category: 'Student Life',
    detailedContent: `The 70/20/10 Budget Rule for Students:

💰 70% Monthly Expenses:
• Rent, utilities, groceries
• Transportation costs
• Essential school supplies
• Phone/internet bills

💳 20% Savings:
• Emergency fund (start with ₱5,000)
• Future goals (laptop, vacation)
• Investment opportunities
• Textbook fund for next semester

🎉 10% Personal Enjoyment:
• Entertainment (movies, games)
• Dining out with friends
• Hobbies and interests
• Personal treats

Pro Tips:
✓ Track expenses weekly
✓ Use student discounts everywhere
✓ Review and adjust monthly
✓ Automate your savings`,
    quiz: {
      question: "If your monthly allowance is ₱15,000, how much should you allocate for savings?",
      options: ["₱1,500", "₱3,000", "₱4,500", "₱5,000"],
      correct: 1,
      explanation: "20% of ₱15,000 = ₱3,000 for savings"
    }
  },
  {
    id: '2',
    title: 'Side Hustle Success',
    description: 'Explore part-time work or freelancing opportunities that fit around your class schedule.',
    icon: 'briefcase-outline',
    category: 'Income',
    detailedContent: `Smart Side Hustles for Students:

📚 Academic Services:
• Tutoring (₱300-500/hour)
• Assignment writing help
• Note-taking services
• Study group facilitation

💻 Digital Opportunities:
• Social media management
• Content writing/blogging
• Online English tutoring
• Graphic design projects

🛍️ Service-Based:
• Food delivery (flexible hours)
• Virtual assistant work
• Photography for events
• Selling handmade items

⏰ Time Management Tips:
✓ Set specific work hours
✓ Choose flexible gigs
✓ Don't compromise studies
✓ Save earnings wisely`,
    quiz: {
      question: "What's the most important factor when choosing a side hustle as a student?",
      options: ["Highest pay rate", "Flexibility with schedule", "Easiest work", "Location"],
      correct: 1,
      explanation: "Flexibility allows you to prioritize your studies while earning income"
    }
  },
  {
    id: '3',
    title: 'Textbook Savings',
    description: 'Save money by buying used books, renting, or using digital versions. Compare prices online!',
    icon: 'book-outline',
    category: 'Education',
    detailedContent: `Smart Textbook Strategies:

💸 Money-Saving Options:
• Buy used books (save 50-70%)
• Rent textbooks online
• Digital/PDF versions
• Library reserve copies

🔍 Where to Find Deals:
• Facebook Marketplace
• OLX Philippines
• Shopee/Lazada
• School bulletin boards
• Senior students

📱 Useful Apps/Websites:
• Scribd (digital library)
• Z-Library (free ebooks)
• Course Hero (study materials)
• Quizlet (flashcards)

💡 Pro Strategies:
✓ Share books with classmates
✓ Photocopy essential chapters
✓ Sell books after semester
✓ Form buying groups for discounts`,
    quiz: {
      question: "What's typically the cheapest way to get textbooks?",
      options: ["New from bookstore", "Used from seniors", "Digital versions", "Library copies"],
      correct: 3,
      explanation: "Library copies are usually free, though availability may be limited"
    }
  },
  {
    id: '4',
    title: 'Food Budget Mastery',
    description: 'Learn to cook simple meals and use student discounts. Meal prep can save both time and money!',
    icon: 'restaurant-outline',
    category: 'Daily Life',
    detailedContent: `Smart Food Budgeting Guide:

🍳 Cooking Basics:
• Learn 5-10 simple recipes
• Buy ingredients in bulk
• Invest in basic kitchen tools
• Meal prep on weekends

💰 Budget-Friendly Foods:
• Rice, pasta, bread (carbs)
• Eggs, canned fish (protein)
• Seasonal vegetables
• Bananas, local fruits

🎯 Money-Saving Tips:
• Student discounts at restaurants
• Happy hour/promo timing
• Group orders for delivery discounts
• Campus cafeteria meal plans

📅 Weekly Meal Prep:
✓ Plan meals Sunday
✓ Shop with grocery list
✓ Cook in batches
✓ Store properly`,
    quiz: {
      question: "What's the biggest money-saver for student food budgets?",
      options: ["Eating out less", "Using delivery apps", "Buying organic", "Skipping meals"],
      correct: 0,
      explanation: "Cooking at home typically costs 3-4x less than eating out"
    }
  },
  {
    id: '5',
    title: 'Smart Shopping',
    description: 'Use student discounts, buy during sales, and always compare prices before making big purchases.',
    icon: 'cart-outline',
    category: 'Shopping',
    detailedContent: `Student Shopping Strategies:

🎓 Student Discounts:
• Present school ID everywhere
• Spotify/Netflix student rates
• Software discounts (Adobe, Microsoft)
• Transportation discounts

🛒 Smart Shopping Tips:
• Compare prices across platforms
• Use price tracking apps
• Shop during sale seasons
• Buy generic/store brands

💳 Online Shopping Hacks:
• Abandon cart for discount codes
• Follow brands for exclusive deals
• Use cashback apps (GrabPay, PayMaya)
• Sign up for newsletters (first-buy discounts)

📱 Essential Apps:
✓ Shopback (cashback)
✓ Honey (coupon finder)
✓ PricePanda (price comparison)
✓ Klook (activity discounts)`,
    quiz: {
      question: "When is the best time to make major purchases as a student?",
      options: ["Beginning of semester", "During sale seasons", "End of month", "Anytime"],
      correct: 1,
      explanation: "Sale seasons like 11.11, 12.12 offer significant discounts on big-ticket items"
    }
  },
  {
    id: '6',
    title: 'Emergency Fund Basics',
    description: 'Start small! Even saving ₱500 per month can build a safety net for unexpected expenses.',
    icon: 'umbrella-outline',
    category: 'Savings',
    detailedContent: `Building Your Emergency Fund:

🎯 Emergency Fund Goals:
• Start: ₱5,000 (basic safety net)
• Goal: ₱15,000-25,000 (3-6 months expenses)
• Purpose: Unexpected expenses only

💰 What Counts as Emergency:
• Medical expenses
• Urgent family needs
• Emergency travel
• Essential device repairs

🏦 Where to Keep It:
• Separate savings account
• High-yield digital banks (ING, CIMB)
• Easy access but not too easy
• Don't invest emergency funds

📈 Building Strategy:
✓ Automate transfers (₱500/month)
✓ Save windfalls (gifts, refunds)
✓ Use the "pay yourself first" method
✓ Celebrate milestones`,
    quiz: {
      question: "What's a good emergency fund target for students?",
      options: ["₱1,000", "₱5,000-25,000", "₱50,000", "₱100,000"],
      correct: 1,
      explanation: "₱5,000-25,000 covers 3-6 months of basic student expenses"
    }
  }
];

const learningModules = [
  {
    id: '1',
    title: 'Personal Finance Basics',
    description: 'Master the fundamentals of money management for students',
    progress: 0,
    totalLessons: 6,
    icon: 'cash-outline',
    color: '#4CAF50',
    lessons: [
      {
        id: '1-1',
        title: 'Understanding Money Flow',
        content: `Money Flow for Students:

📊 Income Sources:
• Family allowance
• Part-time jobs
• Scholarships/grants
• Side hustles

📉 Common Expenses:
• Tuition and fees
• Food and living costs
• Transportation
• Study materials
• Entertainment

💡 Key Principle: Track everything for one month to understand your personal money flow pattern.

🎯 Action Steps:
1. List all income sources
2. Track every expense for a week
3. Categorize your spending
4. Identify areas for improvement`,
        quiz: {
          question: "What's the first step in managing money flow?",
          options: ["Cut all expenses", "Track income and expenses", "Get more income", "Save everything"],
          correct: 1
        }
      },
      {
        id: '1-2',
        title: 'Setting Financial Goals',
        content: `SMART Financial Goals for Students:

🎯 Short-term (1-6 months):
• Build ₱5,000 emergency fund
• Save for new laptop
• Pay off small debts

📅 Medium-term (6 months - 2 years):
• Study abroad fund
• Graduation expenses
• First job preparation fund

🌟 Long-term (2+ years):
• Post-graduation savings
• Investment portfolio start
• Career development fund

✅ SMART Criteria:
• Specific: Exact amount/purpose
• Measurable: Track progress
• Achievable: Realistic for your income
• Relevant: Matches your priorities
• Time-bound: Set deadlines`,
        quiz: {
          question: "What makes a financial goal 'SMART'?",
          options: ["Having lots of money", "Specific, Measurable, Achievable, Relevant, Time-bound", "Being easy to achieve", "Having no deadline"],
          correct: 1
        }
      }
    ]
  },
  {
    id: '2',
    title: 'Budgeting for Students',
    description: 'Create and stick to budgets that work with student life',
    progress: 0,
    totalLessons: 5,
    icon: 'calculator-outline',
    color: '#2196F3',
    lessons: [
      {
        id: '2-1',
        title: 'The Student Budget Formula',
        content: `Student-Friendly Budget Methods:

📊 50/30/20 Rule (Modified for Students):
• 50% Needs (food, transport, bills)
• 30% Wants (entertainment, dining out)
• 20% Savings (emergency fund, goals)

🎓 Student-Specific 70/20/10:
• 70% Monthly essentials
• 20% Savings & future goals
• 10% Fun & entertainment

📱 Zero-Based Budgeting:
Every peso gets a purpose:
• Income: ₱15,000
• Essentials: ₱10,000
• Savings: ₱3,000
• Fun: ₱2,000
• Total: ₱15,000 (matches income)

🔄 Weekly vs Monthly:
Many students benefit from weekly budgets due to irregular income patterns.`,
        quiz: {
          question: "In the 70/20/10 student budget, what percentage goes to savings?",
          options: ["70%", "20%", "10%", "50%"],
          correct: 1
        }
      }
    ]
  },
  {
    id: '3',
    title: 'Saving Strategies',
    description: 'Build wealth while still in school',
    progress: 0,
    totalLessons: 4,
    icon: 'trending-up-outline',
    color: '#FF9800',
    lessons: [
      {
        id: '3-1',
        title: 'The Power of Small Savings',
        content: `Small Amounts, Big Impact:

💰 Daily Savings Challenge:
• Week 1: Save ₱20/day = ₱140
• Week 2: Save ₱25/day = ₱175
• Week 3: Save ₱30/day = ₱210
• Week 4: Save ₱35/day = ₱245
• Monthly total: ₱770

🔄 Automatic Savings:
• Set up auto-transfer on payday
• "Pay yourself first" principle
• Start with small amounts (₱100/week)
• Increase by ₱50 each month

🎯 Savings Hacks:
• Round up purchases (₱87 → save ₱13)
• 52-week challenge (save week number in pesos)
• Spare change jar
• No-spend days (save what you would have spent)

📈 Compound Growth:
Saving ₱500/month for 4 years = ₱24,000+ (with basic interest)`,
        quiz: {
          question: "What's the 'pay yourself first' principle?",
          options: ["Pay debts first", "Save before spending on wants", "Pay bills before saving", "Spend on yourself first"],
          correct: 1
        }
      }
    ]
  }
];

const modules = [
  {
    id: '1',
    title: 'College Finance 101',
    lessons: [
      'Managing Your Allowance',
      'Student Discounts & Benefits',
      'Balancing Studies & Part-time Work'
    ],
    progress: 0,
    icon: 'school-outline',
  },
  {
    id: '2',
    title: 'Daily Money Management',
    lessons: [
      'Smart Food Budgeting',
      'Transportation Savings',
      'Entertainment on a Budget'
    ],
    progress: 0,
    icon: 'wallet-outline',
  },
  {
    id: '3',
    title: 'Digital Money Skills',
    lessons: [
      'Mobile Banking Basics',
      'Online Shopping Tips',
      'Avoiding Online Scams'
    ],
    progress: 0,
    icon: 'phone-portrait-outline',
  },
  {
    id: '4',
    title: 'Future Planning',
    lessons: [
      'Starting to Invest Early',
      'Building Credit Wisely',
      'Planning for Graduation'
    ],
    progress: 0,
    icon: 'trending-up-outline',
  }
];

const LearnScreen = () => {
  const { theme } = useContext(ThemeContext);
  const { userInfo } = useContext(AuthContext);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [progress, setProgress] = useState({});
  const [showTipModal, setShowTipModal] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Financial Calculator States
  const [selectedCalculator, setSelectedCalculator] = useState(null);
  
  // Budget Calculator States
  const [budgetIncome, setBudgetIncome] = useState('');
  const [budgetResult, setBudgetResult] = useState(null);
  
  // Savings Goal States
  const [savingsGoal, setSavingsGoal] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [savingsResult, setSavingsResult] = useState(null);
  
  // Emergency Fund States
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [emergencyResult, setEmergencyResult] = useState(null);
  
  // Student Loan States
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanTermMonths, setLoanTermMonths] = useState('');
  const [loanResult, setLoanResult] = useState(null);

  useEffect(() => {
    if (userInfo) {
      loadUserData();
    }
  }, [userInfo]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProgress(),
        loadFavorites(),
        loadQuizResults()
      ]);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your learning progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const userProgress = await LearningProgressDatabaseService.getUserLearningProgress();
      setProgress(userProgress);
      console.log('Loaded user-specific learning progress:', Object.keys(userProgress).length);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const userFavorites = await LearningProgressDatabaseService.getUserFavoriteTips();
      setFavoriteItems(userFavorites);
      console.log('Loaded user-specific favorites:', userFavorites.length);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadQuizResults = async () => {
    try {
      const userQuizResults = await LearningProgressDatabaseService.getUserQuizResults();
      setQuizAnswers(userQuizResults);
      console.log('Loaded user-specific quiz results:', Object.keys(userQuizResults).length);
    } catch (error) {
      console.error('Error loading quiz results:', error);
    }
  };

  const saveProgress = async (newProgress) => {
    // This function is no longer needed as progress is saved directly to database
    // Keeping for compatibility with existing code
    console.log('Progress is now automatically saved to database');
  };

  const saveFavorites = async (newFavorites) => {
    // This function is no longer needed as favorites are saved directly to database
    // Keeping for compatibility with existing code
    console.log('Favorites are now automatically saved to database');
  };

  // Financial Calculator Functions
  const openCalculator = (calculatorType) => {
    setSelectedCalculator(calculatorType);
    setShowCalculatorModal(false);
    // Reset all calculator states
    resetCalculatorStates();
  };

  const resetCalculatorStates = () => {
    setBudgetIncome('');
    setBudgetResult(null);
    setSavingsGoal('');
    setCurrentSavings('');
    setMonthlyContribution('');
    setSavingsResult(null);
    setMonthlyExpenses('');
    setEmergencyResult(null);
    setLoanAmount('');
    setInterestRate('');
    setLoanTermMonths('');
    setLoanResult(null);
  };

  const calculateBudget = () => {
    const income = parseFloat(budgetIncome);
    if (isNaN(income) || income <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid income amount');
      return;
    }

    const needs = income * 0.7; // 70% for needs
    const savings = income * 0.2; // 20% for savings
    const wants = income * 0.1; // 10% for wants/entertainment

    setBudgetResult({
      income,
      needs,
      savings,
      wants,
      breakdown: [
        { category: 'Needs (Food, Transport, etc.)', amount: needs, percentage: 70, color: '#FF6B6B' },
        { category: 'Savings & Emergency Fund', amount: savings, percentage: 20, color: '#4CAF50' },
        { category: 'Wants & Entertainment', amount: wants, percentage: 10, color: '#2196F3' }
      ]
    });
  };

  const calculateSavingsGoal = () => {
    const goal = parseFloat(savingsGoal);
    const current = parseFloat(currentSavings) || 0;
    const monthly = parseFloat(monthlyContribution);

    if (isNaN(goal) || isNaN(monthly) || goal <= 0 || monthly <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid amounts for goal and monthly contribution');
      return;
    }

    const remaining = goal - current;
    if (remaining <= 0) {
      setSavingsResult({
        message: 'Congratulations! You\'ve already reached your savings goal!',
        achieved: true
      });
      return;
    }

    const monthsToGoal = Math.ceil(remaining / monthly);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsToGoal);

    setSavingsResult({
      goal,
      current,
      remaining,
      monthly,
      monthsToGoal,
      targetDate: targetDate.toLocaleDateString('en-PH', { 
        year: 'numeric', 
        month: 'long' 
      }),
      achieved: false
    });
  };

  const calculateEmergencyFund = () => {
    const expenses = parseFloat(monthlyExpenses);
    if (isNaN(expenses) || expenses <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid monthly expenses amount');
      return;
    }

    const emergencyFund3Months = expenses * 3;
    const emergencyFund6Months = expenses * 6;
    const weeklyTarget = expenses / 4; // Weekly saving target
    const dailyTarget = expenses / 30; // Daily saving target

    setEmergencyResult({
      monthlyExpenses: expenses,
      emergencyFund3Months,
      emergencyFund6Months,
      weeklyTarget,
      dailyTarget,
      recommendations: [
        'Start with a 3-month emergency fund as your initial goal',
        'Save ₱' + dailyTarget.toFixed(2) + ' daily to reach your 3-month goal in 90 days',
        'Consider a 6-month fund for better financial security',
        'Keep emergency funds in a separate, easily accessible account'
      ]
    });
  };

  const calculateStudentLoan = () => {
    const principal = parseFloat(loanAmount);
    const rate = parseFloat(interestRate) / 100 / 12; // Monthly interest rate
    const term = parseInt(loanTermMonths);

    if (isNaN(principal) || isNaN(rate) || isNaN(term) || principal <= 0 || term <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid loan details');
      return;
    }

    // Calculate monthly payment using loan payment formula
    const monthlyPayment = principal * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    const totalPaid = monthlyPayment * term;
    const totalInterest = totalPaid - principal;

    // Payment strategies
    const extraPayment = monthlyPayment * 0.1; // 10% extra payment
    const newMonthlyPayment = monthlyPayment + extraPayment;
    
    // Calculate time saved with extra payment
    let balance = principal;
    let monthsWithExtra = 0;
    while (balance > 0 && monthsWithExtra < term) {
      const interestPayment = balance * rate;
      const principalPayment = newMonthlyPayment - interestPayment;
      balance -= principalPayment;
      monthsWithExtra++;
    }
    
    const timeSaved = term - monthsWithExtra;
    const interestSaved = (monthlyPayment * term) - (newMonthlyPayment * monthsWithExtra);

    setLoanResult({
      principal,
      monthlyPayment,
      totalPaid,
      totalInterest,
      term,
      strategies: {
        extraPayment,
        newMonthlyPayment,
        monthsWithExtra,
        timeSaved,
        interestSaved
      }
    });
  };

  const closeCalculator = () => {
    setSelectedCalculator(null);
    resetCalculatorStates();
  };

  const toggleFavorite = async (itemId) => {
    try {
      const isFavorited = await LearningProgressDatabaseService.toggleFavoriteTip(itemId);
      
      // Update local state
      if (isFavorited) {
        setFavoriteItems(prev => [...prev, itemId]);
      } else {
        setFavoriteItems(prev => prev.filter(id => id !== itemId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite. Please try again.');
    }
  };

  const openTipDetails = (tip) => {
    setSelectedTip(tip);
    setShowTipModal(true);
  };

  const openLessonDetails = (lesson, moduleId) => {
    setSelectedLesson({ ...lesson, moduleId });
    setShowLessonModal(true);
  };

  const startQuiz = (quiz, lessonId) => {
    setCurrentQuiz({ ...quiz, lessonId });
    setShowQuizModal(true);
  };

  const submitQuizAnswer = async (selectedOption) => {
    const isCorrect = selectedOption === currentQuiz.correct;
    const quizId = `${currentQuiz.lessonId}_quiz`;
    
    try {
      // Save quiz result to database
      await LearningProgressDatabaseService.saveQuizResult(
        quizId,
        selectedOption,
        currentQuiz.correct,
        isCorrect,
        currentQuiz.lessonId,
        null // tipId - not applicable for lesson quizzes
      );

      // Update local state
      const newAnswers = {
        ...quizAnswers,
        [currentQuiz.lessonId]: { selected: selectedOption, correct: isCorrect }
      };
      setQuizAnswers(newAnswers);

      if (isCorrect) {
        Alert.alert('Correct!', currentQuiz.explanation || 'Great job!');
        
        // Mark lesson as completed and update progress
        const moduleId = selectedLesson?.moduleId;
        if (moduleId) {
          await LearningProgressDatabaseService.completLesson(moduleId, currentQuiz.lessonId, 100);
          
          // Update local progress state
          const newProgress = {
            ...progress,
            [moduleId]: (progress[moduleId] || 0) + 1
          };
          setProgress(newProgress);
          
          // Update learning streak
          await LearningProgressDatabaseService.updateLearningStreak();
        }
      } else {
        Alert.alert('Try Again', currentQuiz.explanation || 'That\'s not quite right. Try again!');
      }
      
      setShowQuizModal(false);
      
    } catch (error) {
      console.error('Error submitting quiz answer:', error);
      Alert.alert('Error', 'Failed to save your quiz result. Please try again.');
      setShowQuizModal(false);
    }
  };

  const categories = ['All', 'Student Life', 'Daily Life', 'Education', 'Income', 'Shopping', 'Savings'];

  const renderTipCard = (tip) => (
    <TouchableOpacity
      key={tip.id}
      style={[styles.tipCard, { backgroundColor: theme.colors.card }]}
      onPress={() => openTipDetails(tip)}
    >
      <View style={styles.tipHeader}>
        <View style={[styles.tipIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={tip.icon} size={24} color={theme.colors.primary} />
        </View>
        <TouchableOpacity
          onPress={() => toggleFavorite(tip.id)}
          style={styles.favoriteButton}
        >
          <Ionicons
            name={favoriteItems.includes(tip.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={favoriteItems.includes(tip.id) ? '#FF6B6B' : theme.colors.text}
          />
        </TouchableOpacity>
      </View>
      <Text style={[styles.tipTitle, { color: theme.colors.text }]}>{tip.title}</Text>
      <Text style={[styles.tipDescription, { color: theme.colors.text + 'CC' }]}>
        {tip.description}
      </Text>
      <View style={[styles.categoryBadge, { backgroundColor: theme.colors.primary + '20' }]}>
        <Text style={[styles.categoryText, { color: theme.colors.primary }]}>
          {tip.category}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderModuleCard = (module) => (
    <TouchableOpacity
      key={module.id}
      style={[styles.moduleCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.moduleHeader}>
        <View style={[styles.moduleIcon, { backgroundColor: module.color + '20' }]}>
          <Ionicons name={module.icon} size={32} color={module.color} />
        </View>
        <View style={styles.moduleProgress}>
          <Text style={[styles.progressText, { color: theme.colors.text + 'CC' }]}>
            {progress[module.id] || 0}/{module.totalLessons} lessons
          </Text>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: module.color,
                  width: `${((progress[module.id] || 0) / module.totalLessons) * 100}%`
                }
              ]}
            />
          </View>
        </View>
      </View>
      <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{module.title}</Text>
      <Text style={[styles.moduleDescription, { color: theme.colors.text + 'CC' }]}>
        {module.description}
      </Text>
      {module.lessons && module.lessons.length > 0 && (
        <View style={styles.lessonsList}>
          {module.lessons.slice(0, 2).map((lesson, index) => (
            <TouchableOpacity
              key={lesson.id}
              style={styles.lessonItem}
              onPress={() => openLessonDetails(lesson, module.id)}
            >
              <Text style={[styles.lessonTitle, { color: theme.colors.text }]}>
                {lesson.title}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.text + '80'} />
            </TouchableOpacity>
          ))}
          {module.lessons.length > 2 && (
            <Text style={[styles.moreLessons, { color: theme.colors.primary }]}>
              +{module.lessons.length - 2} more lessons
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* MonT Learning Center Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <MonTMascot 
          graphicsMode="piggy-emoji"
          currentState={MASCOT_STATES.FOCUSED}
          size="medium"
          showBubble={true}
          bubbleText="Ready to learn about money? 📚✨"
          onTap={() => {
            Alert.alert('Gafi Says', 'Learning about money is the best investment you can make! Let\'s get smarter together! 🐷🧠');
          }}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>Learn with Gafi</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Financial Tips
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsContainer}
          >
            {financialTips.map(renderTipCard)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Learning Modules
            </Text>
            <TouchableOpacity
              style={[styles.calculatorButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowCalculatorModal(true)}
            >
              <Ionicons name="calculator" size={16} color="white" />
              <Text style={styles.calculatorText}>Tools</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modulesContainer}>
            {learningModules.map(renderModuleCard)}
          </View>
        </View>
      </ScrollView>

      {/* Tip Detail Modal */}
      <Modal
        visible={showTipModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTipModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleFavorite(selectedTip?.id)}>
              <Ionicons
                name={favoriteItems.includes(selectedTip?.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={favoriteItems.includes(selectedTip?.id) ? '#FF6B6B' : theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          {selectedTip && (
            <ScrollView style={styles.modalContent}>
              <View style={[styles.tipIcon, { backgroundColor: theme.colors.primary + '20', alignSelf: 'center' }]}>
                <Ionicons name={selectedTip.icon} size={32} color={theme.colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedTip.title}
              </Text>
              <Text style={[styles.modalDescription, { color: theme.colors.text }]}>
                {selectedTip.detailedContent}
              </Text>
              {selectedTip.quiz && (
                <TouchableOpacity
                  style={[styles.quizButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    setShowTipModal(false);
                    startQuiz(selectedTip.quiz, selectedTip.id);
                  }}
                >
                  <Text style={styles.quizButtonText}>Take Quiz</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Lesson Detail Modal */}
      <Modal
        visible={showLessonModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLessonModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          {selectedLesson && (
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedLesson.title}
              </Text>
              <Text style={[styles.modalDescription, { color: theme.colors.text }]}>
                {selectedLesson.content}
              </Text>
              {selectedLesson.quiz && (
                <TouchableOpacity
                  style={[styles.quizButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    setShowLessonModal(false);
                    startQuiz(selectedLesson.quiz, selectedLesson.id);
                  }}
                >
                  <Text style={styles.quizButtonText}>Take Quiz</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Quiz Modal */}
      <Modal
        visible={showQuizModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.quizOverlay}>
          <View style={[styles.quizModal, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.quizQuestion, { color: theme.colors.text }]}>
              {currentQuiz?.question}
            </Text>
            {currentQuiz?.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.quizOption, { borderColor: theme.colors.border }]}
                onPress={() => submitQuizAnswer(index)}
              >
                <Text style={[styles.quizOptionText, { color: theme.colors.text }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.quizCancel}
              onPress={() => setShowQuizModal(false)}
            >
              <Text style={[styles.quizCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calculator/Tools Modal */}
      <Modal
        visible={showCalculatorModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCalculatorModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Financial Tools</Text>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.toolsDescription, { color: theme.colors.text }]}>
              Practical financial calculators and tools for students:
            </Text>
            
            <View style={styles.toolsGrid}>
              <TouchableOpacity 
                style={[styles.toolCard, { backgroundColor: theme.colors.primary + '20' }]}
                onPress={() => openCalculator('budget')}
              >
                <Ionicons name="calculator" size={24} color={theme.colors.primary} />
                <Text style={[styles.toolTitle, { color: theme.colors.text }]}>Budget Calculator</Text>
                <Text style={[styles.toolDescription, { color: theme.colors.text + 'CC' }]}>
                  Calculate your 70/20/10 budget breakdown
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.toolCard, { backgroundColor: '#4CAF50' + '20' }]}
                onPress={() => openCalculator('savings')}
              >
                <Ionicons name="trending-up" size={24} color="#4CAF50" />
                <Text style={[styles.toolTitle, { color: theme.colors.text }]}>Savings Goal</Text>
                <Text style={[styles.toolDescription, { color: theme.colors.text + 'CC' }]}>
                  Plan how to reach your savings targets
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.toolCard, { backgroundColor: '#FF9800' + '20' }]}
                onPress={() => openCalculator('emergency')}
              >
                <Ionicons name="time" size={24} color="#FF9800" />
                <Text style={[styles.toolTitle, { color: theme.colors.text }]}>Emergency Fund</Text>
                <Text style={[styles.toolDescription, { color: theme.colors.text + 'CC' }]}>
                  Calculate your emergency fund target
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.toolCard, { backgroundColor: '#2196F3' + '20' }]}
                onPress={() => openCalculator('loan')}
              >
                <Ionicons name="school" size={24} color="#2196F3" />
                <Text style={[styles.toolTitle, { color: theme.colors.text }]}>Student Loan</Text>
                <Text style={[styles.toolDescription, { color: theme.colors.text + 'CC' }]}>
                  Plan loan repayment strategies
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Individual Calculator Modals */}
      
      {/* Budget Calculator Modal */}
      <Modal
        visible={selectedCalculator === 'budget'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCalculator}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Budget Calculator</Text>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.calculatorDescription, { color: theme.colors.text }]}>
              Calculate your 70/20/10 budget breakdown
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Monthly Income (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={budgetIncome}
                onChangeText={setBudgetIncome}
                placeholder="Enter your monthly income"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.calculateButton, { backgroundColor: theme.colors.primary }]}
              onPress={calculateBudget}
            >
              <Text style={styles.calculateButtonText}>Calculate Budget</Text>
            </TouchableOpacity>

            {budgetResult && (
              <View style={[styles.resultContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                  Budget Breakdown for ₱{budgetResult.income.toLocaleString()}
                </Text>
                {budgetResult.breakdown.map((item, index) => (
                  <View key={index} style={styles.budgetBreakdownItem}>
                    <View style={styles.budgetItemHeader}>
                      <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                      <Text style={[styles.budgetCategory, { color: theme.colors.text }]}>
                        {item.category}
                      </Text>
                      <Text style={[styles.budgetPercentage, { color: theme.colors.text }]}>
                        {item.percentage}%
                      </Text>
                    </View>
                    <Text style={[styles.budgetAmount, { color: item.color }]}>
                      ₱{item.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Savings Goal Calculator Modal */}
      <Modal
        visible={selectedCalculator === 'savings'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCalculator}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Savings Goal</Text>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.calculatorDescription, { color: theme.colors.text }]}>
              Plan how to reach your savings targets
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Savings Goal (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={savingsGoal}
                onChangeText={setSavingsGoal}
                placeholder="Enter your savings goal"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Current Savings (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={currentSavings}
                onChangeText={setCurrentSavings}
                placeholder="Enter current amount saved"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Monthly Contribution (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={monthlyContribution}
                onChangeText={setMonthlyContribution}
                placeholder="How much can you save monthly?"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.calculateButton, { backgroundColor: '#4CAF50' }]}
              onPress={calculateSavingsGoal}
            >
              <Text style={styles.calculateButtonText}>Calculate Timeline</Text>
            </TouchableOpacity>

            {savingsResult && (
              <View style={[styles.resultContainer, { backgroundColor: theme.colors.card }]}>
                {savingsResult.achieved ? (
                  <Text style={[styles.resultTitle, { color: '#4CAF50' }]}>
                    {savingsResult.message}
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                      Savings Plan
                    </Text>
                    <View style={styles.savingsResultItem}>
                      <Text style={[styles.savingsLabel, { color: theme.colors.text }]}>Goal:</Text>
                      <Text style={[styles.savingsValue, { color: '#4CAF50' }]}>₱{savingsResult.goal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.savingsResultItem}>
                      <Text style={[styles.savingsLabel, { color: theme.colors.text }]}>Current:</Text>
                      <Text style={[styles.savingsValue, { color: theme.colors.text }]}>₱{savingsResult.current.toLocaleString()}</Text>
                    </View>
                    <View style={styles.savingsResultItem}>
                      <Text style={[styles.savingsLabel, { color: theme.colors.text }]}>Remaining:</Text>
                      <Text style={[styles.savingsValue, { color: '#FF9800' }]}>₱{savingsResult.remaining.toLocaleString()}</Text>
                    </View>
                    <View style={styles.savingsResultItem}>
                      <Text style={[styles.savingsLabel, { color: theme.colors.text }]}>Time to Goal:</Text>
                      <Text style={[styles.savingsValue, { color: '#2196F3' }]}>
                        {savingsResult.monthsToGoal} months ({savingsResult.targetDate})
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency Fund Calculator Modal */}
      <Modal
        visible={selectedCalculator === 'emergency'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCalculator}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Emergency Fund</Text>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.calculatorDescription, { color: theme.colors.text }]}>
              Calculate your emergency fund target based on monthly expenses
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Monthly Expenses (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={monthlyExpenses}
                onChangeText={setMonthlyExpenses}
                placeholder="Enter your total monthly expenses"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.calculateButton, { backgroundColor: '#FF9800' }]}
              onPress={calculateEmergencyFund}
            >
              <Text style={styles.calculateButtonText}>Calculate Emergency Fund</Text>
            </TouchableOpacity>

            {emergencyResult && (
              <View style={[styles.resultContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                  Emergency Fund Targets
                </Text>
                
                <View style={styles.emergencyTargetItem}>
                  <Text style={[styles.emergencyLabel, { color: theme.colors.text }]}>3-Month Emergency Fund:</Text>
                  <Text style={[styles.emergencyValue, { color: '#FF9800' }]}>
                    ₱{emergencyResult.emergencyFund3Months.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.emergencyTargetItem}>
                  <Text style={[styles.emergencyLabel, { color: theme.colors.text }]}>6-Month Emergency Fund:</Text>
                  <Text style={[styles.emergencyValue, { color: '#4CAF50' }]}>
                    ₱{emergencyResult.emergencyFund6Months.toLocaleString()}
                  </Text>
                </View>

                <Text style={[styles.savingTargetsTitle, { color: theme.colors.text }]}>Saving Targets:</Text>
                <Text style={[styles.savingTarget, { color: theme.colors.text }]}>
                  Daily: ₱{emergencyResult.dailyTarget.toFixed(2)}
                </Text>
                <Text style={[styles.savingTarget, { color: theme.colors.text }]}>
                  Weekly: ₱{emergencyResult.weeklyTarget.toFixed(2)}
                </Text>

                <View style={styles.recommendationsContainer}>
                  <Text style={[styles.recommendationsTitle, { color: theme.colors.text }]}>Recommendations:</Text>
                  {emergencyResult.recommendations.map((rec, index) => (
                    <Text key={index} style={[styles.recommendation, { color: theme.colors.text }]}>
                      • {rec}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Student Loan Calculator Modal */}
      <Modal
        visible={selectedCalculator === 'loan'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCalculator}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Student Loan Calculator</Text>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.calculatorDescription, { color: theme.colors.text }]}>
              Plan your loan repayment strategies
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Loan Amount (₱)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={loanAmount}
                onChangeText={setLoanAmount}
                placeholder="Enter total loan amount"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Interest Rate (%)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Enter annual interest rate"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Loan Term (Months)</Text>
              <TextInput
                style={[styles.calculatorInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={loanTermMonths}
                onChangeText={setLoanTermMonths}
                placeholder="Enter loan term in months"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.calculateButton, { backgroundColor: '#2196F3' }]}
              onPress={calculateStudentLoan}
            >
              <Text style={styles.calculateButtonText}>Calculate Loan Payment</Text>
            </TouchableOpacity>

            {loanResult && (
              <View style={[styles.resultContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                  Loan Payment Details
                </Text>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Loan Amount:</Text>
                  <Text style={[styles.loanValue, { color: theme.colors.text }]}>
                    ₱{loanResult.principal.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Monthly Payment:</Text>
                  <Text style={[styles.loanValue, { color: '#2196F3' }]}>
                    ₱{loanResult.monthlyPayment.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Total Interest:</Text>
                  <Text style={[styles.loanValue, { color: '#FF5722' }]}>
                    ₱{loanResult.totalInterest.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Total Paid:</Text>
                  <Text style={[styles.loanValue, { color: theme.colors.text }]}>
                    ₱{loanResult.totalPaid.toLocaleString()}
                  </Text>
                </View>

                <Text style={[styles.strategyTitle, { color: theme.colors.text }]}>
                  💡 Strategy: Pay 10% Extra Monthly
                </Text>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>New Monthly Payment:</Text>
                  <Text style={[styles.loanValue, { color: '#4CAF50' }]}>
                    ₱{loanResult.strategies.newMonthlyPayment.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Time Saved:</Text>
                  <Text style={[styles.loanValue, { color: '#4CAF50' }]}>
                    {loanResult.strategies.timeSaved} months
                  </Text>
                </View>
                
                <View style={styles.loanResultItem}>
                  <Text style={[styles.loanLabel, { color: theme.colors.text }]}>Interest Saved:</Text>
                  <Text style={[styles.loanValue, { color: '#4CAF50' }]}>
                    ₱{loanResult.strategies.interestSaved.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  calculatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  calculatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    paddingTop: 2,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  categoryContainer: {
    paddingLeft: 20,
    marginBottom: 16,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsContainer: {
    paddingHorizontal: 20,
  },
  tipCard: {
    width: width * 0.7,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  favoriteButton: {
    padding: 4,
  },
  tipCategory: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modulesContainer: {
    paddingHorizontal: 20,
  },
  moduleCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moduleProgress: {
    flex: 1,
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 12,
    marginBottom: 4,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  moduleDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  lessonsList: {
    marginTop: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  lessonText: {
    marginLeft: 8,
    fontSize: 14,
  },
  moreLessons: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  quizButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  quizButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quizOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quizModal: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  quizQuestion: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  quizOption: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  quizOptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  quizCancel: {
    padding: 16,
    alignItems: 'center',
  },
  quizCancelText: {
    fontSize: 16,
  },
  toolsDescription: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  toolCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  toolDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Calculator Modal Styles
  calculatorDescription: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  calculatorInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  calculateButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    padding: 20,
    borderRadius: 16,
    marginTop: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Budget Calculator Styles
  budgetBreakdownItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  budgetItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  budgetCategory: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  budgetPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  budgetAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  // Savings Calculator Styles
  savingsResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  savingsLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  savingsValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Emergency Fund Styles
  emergencyTargetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  emergencyLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  emergencyValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  savingTargetsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  savingTarget: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8,
  },
  recommendationsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  // Loan Calculator Styles
  loanResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  loanLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  loanValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
});

export default LearnScreen;
