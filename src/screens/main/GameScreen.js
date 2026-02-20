import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { View, StyleSheet, ImageBackground, Dimensions, TouchableWithoutFeedback, Animated, Modal, Text, TextInput, TouchableOpacity, Alert, ScrollView, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { supabase } from '../../config/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collisionSystem } from '../../utils/CollisionSystem';
import { AchievementService } from '../../services/AchievementService';
import gameDatabaseService from '../../services/GameDatabaseService';
import { normalizeCategory } from '../../utils/categoryUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const CHARACTER_SIZE = 48;

// Quick amount options for canteen
const QUICK_AMOUNTS = [20, 50, 100, 150];

// Map configurations - expandable for more maps
const MAPS = {
  school: {
    id: 'school',
    name: 'School Campus',
    icon: '🏫',
    image: require('../../../assets/Game_Graphics/maps/Map004.png'),
    spawnPoint: { x: width * 0.30, y: height * 0.55 },
    locations: [
      {
        id: 'canteen',
        name: 'Canteen',
        icon: '🍔',
        bounds: { left: 0.65, right: 0.90, top: 0.85, bottom: 0.92 },
        action: 'expense',
        category: 'Food & Dining',
      },
      {
        id: 'entrance',
        name: 'School Exit',
        icon: '🚪',
        bounds: { left: 0.10, right: 0.20, top: 0.65, bottom: 0.75 },
        action: 'travel',
        destinations: ['dorm', 'mall_1f'],
        exitSpawnPoint: { x: 0.15, y: 0.70 }, // Spawn point for arriving at this exit
      },
      {
        id: 'library',
        name: 'Library',
        icon: '📚',
        bounds: { left: 0.68, right: 0.88, top: 0.48, bottom: 0.69 },
        action: 'expense',
        category: 'School Supplies',
      },
    ],
  },
  dorm: {
    id: 'dorm',
    name: 'Home',
    icon: '🏠',
    image: require('../../../assets/Game_Graphics/maps/Home/Map002.png'),
    spawnPoint: { x: width / 2, y: height * 0.5 },
    locations: [
      {
        id: 'door',
        name: 'Exit Door',
        icon: '🚪',
        bounds: { left: 0.35, right: 0.65, top: 0.92, bottom: 1 },
        action: 'travel',
        destinations: ['school', 'mall_1f'],
        exitSpawnPoint: { x: 0.50, y: 0.88 }, // Spawn point for arriving at this exit
      },
      {
        id: 'notebook',
        name: 'Notebook',
        icon: '📓',
        bounds: { left: 0.65, right: 0.80, top: 0.70, bottom: 0.75 },
        action: 'notebook',
      },
      {
        id: 'closet',
        name: 'Closet',
        icon: '👔',
        bounds: { left: 0.32, right: 0.47, top: 0.05, bottom: 0.15 },
        action: 'closet',
      }
    ],
  },
  // Mall 1st Floor (Map006) - stores + exit + escalator up
  mall_1f: {
    id: 'mall_1f',
    name: 'Mall - 1F',
    icon: '🏬',
    image: require('../../../assets/Game_Graphics/maps/Mall/Map006.png'),
    spawnPoint: { x: width / 2, y: height * 0.5 },
    locations: [
      {
        id: 'entrance',
        name: 'Mall Exit',
        icon: '🚪',
        bounds: { left: 0.70, right: 1.0, top: 0.82, bottom: 1.0 },
        action: 'travel',
        destinations: ['school', 'dorm'],
        exitSpawnPoint: { x: 0.82, y: 0.88 },
      },
      {
        id: 'clothing_store',
        name: 'Clothing Store',
        icon: '👕',
        bounds: { left: 0.10, right: 0.32, top: 0.37, bottom: 0.55 },
        action: 'expense',
        category: 'Shopping',
      },
      {
        id: 'electronics',
        name: 'Electronics',
        icon: '📱',
        bounds: { left: 0.68, right: 0.90, top: 0.58, bottom: 0.71 },
        action: 'expense',
        category: 'Electronics',
      },
      {
        id: 'grocery_store',
        name: 'Grocery Store',
        icon: '🛒',
        bounds: { left: 0.73, right: 0.88, top: 0.20, bottom: 0.35 },
        action: 'expense',
        category: 'Groceries',
      },
      {
        id: 'escalator_2f',
        name: 'Escalator to 2F',
        icon: '⬆️',
        bounds: { left: 0.18, right: 0.39, top: 0.75, bottom: 0.92 },
        action: 'floor_change',
        targetFloor: 'mall_2f',
        exitSpawnPoint: { x: 0.15, y: 0.92 },
      },
    ],
  },
  // Mall 2nd Floor (Map007) - food court, cafe, escalators up/down
  mall_2f: {
    id: 'mall_2f',
    name: 'Mall - 2F',
    icon: '🏬',
    image: require('../../../assets/Game_Graphics/maps/Mall/Map007.png'),
    spawnPoint: { x: width / 2, y: height * 0.5 },
    locations: [
      {
        id: 'escalator_down_1f',
        name: 'Escalator to 1F',
        icon: '⬇️',
        bounds: { left: 0.18, right: 0.40, top: 0.80, bottom: 1.0 },
        action: 'floor_change',
        targetFloor: 'mall_1f',
        exitSpawnPoint: { x: 0.18, y: 0.96 },
      },
      {
        id: 'food_court',
        name: 'Food Court',
        icon: '🍕',
        bounds: { left: 0.45, right: 0.85, top: 0.13, bottom: 0.27 },
        action: 'expense',
        category: 'Food & Dining',
      },
      {
        id: 'cafe',
        name: 'Cafe',
        icon: '☕',
        bounds: { left: 0.45, right: 0.71, top: 0.83, bottom: 0.95 },
        action: 'expense',
        category: 'Food & Dining',
      },
      {
        id: 'escalator_up_3f',
        name: 'Escalator to 3F',
        icon: '⬆️',
        bounds: { left: 0.18, right: 0.39, top: 0.05, bottom: 0.20 },
        action: 'floor_change',
        targetFloor: 'mall_3f',
        exitSpawnPoint: { x: 0.15, y: 0.22 },
      },
    ],
  },
  // Mall 3rd Floor (Map008) - gym, entertainment hub, escalator down
  mall_3f: {
    id: 'mall_3f',
    name: 'Mall - 3F',
    icon: '🏬',
    image: require('../../../assets/Game_Graphics/maps/Mall/Map008.png'),
    spawnPoint: { x: width * 0.32, y: height * 0.5 },
    locations: [
      {
        id: 'escalator_down_2f',
        name: 'Escalator to 2F',
        icon: '⬇️',
        bounds: { left: 0.10, right: 0.40, top: 0.82, bottom: 1.0 },
        action: 'floor_change',
        targetFloor: 'mall_2f',
        exitSpawnPoint: { x: 0.18, y: 0.96 },
      },
      {
        id: 'gym',
        name: 'Gym',
        icon: '💪',
        bounds: { left: 0.72, right: 0.88, top: 0.59, bottom: 0.75 },
        action: 'expense',
        category: 'Health',
      },
      {
        id: 'entertainment_hub',
        name: 'Entertainment Hub',
        icon: '🎮',
        bounds: { left: 0.35, right: 0.65, top: 0.10, bottom: 0.18 },
        action: 'expense',
        category: 'Entertainment',
      },
    ],
  },
};

// ─── NPC Sprite Assets ───────────────────────────────────────────────────────
const NPC_SPRITES = {
  Library_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Library_Worker.png'),
  Food_Worker:    require('../../../assets/Game_Graphics/Character_Animation/Workers/Food_Worker.png'),
  Clothing_Worker:require('../../../assets/Game_Graphics/Character_Animation/Workers/Clothing_Worker.png'),
  Grocery_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Grocery_Worker.png'),
  Cafe_Worker:    require('../../../assets/Game_Graphics/Character_Animation/Workers/Cafe_Worker.png'),
  Games_Worker:   require('../../../assets/Game_Graphics/Character_Animation/Workers/Games_Worker.png'),
  Gym_Worker:     require('../../../assets/Game_Graphics/Character_Animation/Workers/Gym_Worker.png'),
};

// ─── NPC Placement Config ────────────────────────────────────────────────────
// To reposition an NPC, simply change its tileX / tileY values.
// Directions: 'right' | 'up' | 'left' | 'down'
// All maps are 11 tiles wide × 24 tiles tall (48 px per tile).
const NPC_POSITIONS = {
  school: [
    { id: 'library_worker',  sprite: 'Library_Worker',  tileX: 10, tileY: 15, direction: 'left'  },
    { id: 'canteen_worker',  sprite: 'Food_Worker',     tileX: 10, tileY: 21, direction: 'left'  },
  ],
  mall_1f: [
    { id: 'clothing_worker', sprite: 'Clothing_Worker', tileX: 1, tileY: 12, direction: 'right' },
    { id: 'grocery_worker',  sprite: 'Grocery_Worker',  tileX: 10, tileY: 5,  direction: 'left'  },
  ],
  mall_2f: [
    { id: 'foodcourt_worker',sprite: 'Food_Worker',     tileX: 7, tileY: 4,  direction: 'down'  },
    { id: 'cafe_worker',     sprite: 'Cafe_Worker',     tileX: 6, tileY: 21, direction: 'right' },
  ],
  mall_3f: [
    { id: 'games_worker',    sprite: 'Games_Worker',    tileX: 5, tileY: 3,  direction: 'down'  },
    { id: 'gym_worker',      sprite: 'Gym_Worker',      tileX: 10, tileY: 16, direction: 'left'  },
  ],
};

export default function BuildScreen() {
  const { colors } = useTheme();
  const { user } = useContext(AuthContext);
  const { addExpense, expenses } = useContext(DataContext);
  
  // Current map state
  const [currentMapId, setCurrentMapId] = useState('dorm');
  const currentMap = MAPS[currentMapId];
  
  // Character position
  const [characterPosition, setCharacterPosition] = useState(currentMap.spawnPoint);
  const animatedX = useRef(new Animated.Value(currentMap.spawnPoint.x - CHARACTER_SIZE / 2)).current;
  const animatedY = useRef(new Animated.Value(currentMap.spawnPoint.y - CHARACTER_SIZE / 2)).current;
  const [isWalking, setIsWalking] = useState(false);
  const [todaySpending, setTodaySpending] = useState(0);
  const walkingPulse = useRef(new Animated.Value(1)).current;
  
  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food & Dining');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('Hallway 🚶');
  const [showInstructions, setShowInstructions] = useState(true);
  
  // Travel modal state
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [travelDestinations, setTravelDestinations] = useState([]);
  
  // Transport mode state
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [transportMode, setTransportMode] = useState(null); // 'commute' or 'car'
  const [fareAmount, setFareAmount] = useState('');
  const [didBuyFuel, setDidBuyFuel] = useState(null); // null, true, or false
  const [fuelAmount, setFuelAmount] = useState('');
  
  // Main menu state
  const [showMainMenu, setShowMainMenu] = useState(true);
  const [gameMode, setGameMode] = useState(null); // 'story', 'custom', or 'tutorial'
  const [showHowToPlay, setShowHowToPlay] = useState(false); // Legacy - not used anymore
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialActive, setTutorialActive] = useState(false); // In-game tutorial mode
  const [tutorialCompleted, setTutorialCompleted] = useState(false); // Persisted — gates Story Mode
  const [tutorialConditions, setTutorialConditions] = useState(new Set()); // Tracks step completion conditions
  const [tutorialViewedCar, setTutorialViewedCar] = useState(false); // Track if car transport was viewed in tutorial
  
  // Abandon / End Session modal state
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  
  // Koin Tutorial Guide Image
  const KOIN_TUTORIAL_IMAGE = require('../../../assets/mascot/koin_tutorial.png');
  
  // Helper: mark a tutorial condition as met and auto-advance if it matches current step
  const markTutorialCondition = (conditionKey) => {
    setTutorialConditions(prev => {
      const next = new Set(prev);
      next.add(conditionKey);
      return next;
    });
    // Auto-advance: if this condition matches the current step (and it's not step 0), move forward
    const currentStep = TUTORIAL_STEPS[tutorialStep];
    if (currentStep && currentStep.conditionKey === conditionKey && tutorialStep > 0) {
      // Small delay so the user sees the action complete before the overlay advances
      setTimeout(() => {
        setTutorialStep(prev => {
          const nextIdx = prev + 1;
          if (nextIdx < TUTORIAL_STEPS.length) {
            gameDatabaseService.saveTutorialProgress({ currentStep: nextIdx, stepsCompleted: Array.from({ length: nextIdx }, (_, i) => String(i)), tutorialCompleted: false });
            return nextIdx;
          }
          return prev;
        });
      }, 600);
    }
  };
  
  // Helper: check if current tutorial step's condition is met
  const isTutorialStepComplete = () => {
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step) return false;
    if (step.nextAlwaysEnabled) return true;
    if (step.conditionKey && tutorialConditions.has(step.conditionKey)) return true;
    return false;
  };
  
  // In-game Tutorial steps configuration — step-by-step, action-gated
  const TUTORIAL_STEPS = [
    {
      id: 'budget_intro',
      title: "Budget Tracker 📊",
      message: "Hi! I'm Koin, your financial buddy! See the Budget Tracker at the top? It shows your daily spending and weekly budget. Keep an eye on it!",
      nextAlwaysEnabled: true,
      conditionKey: null,
      position: 'bottom',
      highlight: 'header',
    },
    {
      id: 'walk_around',
      title: "Move Around! 🏠",
      message: "This is your room! Tap anywhere on the screen to walk your character around. Try it now!",
      nextAlwaysEnabled: false,
      conditionKey: 'walked',
      position: 'top',
      highlight: 'map',
    },
    {
      id: 'closet',
      title: "The Closet 👔",
      message: "Walk to the Closet and check it out! Tap on the closet area to open it.",
      nextAlwaysEnabled: false,
      conditionKey: 'closet_opened',
      position: 'right',
      highlight: 'closet',
    },
    {
      id: 'notebook_and_log',
      title: "The Notebook 📓",
      message: "Walk to the Notebook, open it, and try logging an expense! Enter any amount and description, then tap Log. Don't worry — this is just practice!",
      nextAlwaysEnabled: false,
      conditionKey: 'notebook_expense_logged',
      position: 'left',
      highlight: 'notebook',
    },
    {
      id: 'exit_door',
      title: "The Exit Door 🚪",
      message: "Walk to the Exit Door to see the places you can go! Choose School and learn about transport expenses.",
      nextAlwaysEnabled: false,
      conditionKey: 'arrived_at_school',
      position: 'bottom',
      highlight: 'door',
    },
    {
      id: 'school_intro',
      title: "Welcome to School! 🏫",
      message: "This is the School Campus! See the NPCs here? You can approach the Librarian to buy school supplies, or the Canteen staff to buy food. Walk to either one and log an expense — this is just practice!",
      nextAlwaysEnabled: false,
      conditionKey: 'school_expense_logged',
      position: 'top',
      highlight: null,
    },
    {
      id: 'go_to_mall',
      title: "The Mall 🏬",
      message: "Great job! Now let's visit the Mall! Walk to the School Exit and travel there.",
      nextAlwaysEnabled: false,
      conditionKey: 'arrived_at_mall',
      position: 'center',
      highlight: null,
    },
    {
      id: 'mall_1f_intro',
      title: "Mall - 1st Floor 🏬",
      message: "Welcome to the Mall! On the 1st floor, you'll find the Clothing Store 👕, Electronics 📱, and Grocery Store 🛒. Feel free to approach any NPC to log a practice expense, or just look around!",
      nextAlwaysEnabled: true,
      conditionKey: null,
      position: 'top',
      highlight: null,
    },
    {
      id: 'go_to_2f',
      title: "Go to 2nd Floor ⬆️",
      message: "Now let's explore more! Walk to the Escalator to go up to the 2nd floor.",
      nextAlwaysEnabled: false,
      conditionKey: 'arrived_at_mall_2f',
      position: 'bottom',
      highlight: null,
    },
    {
      id: 'mall_2f_intro',
      title: "Mall - 2nd Floor 🍕",
      message: "The 2nd floor has the Food Court 🍕 and a Cafe ☕. You can approach the NPCs to log practice expenses if you'd like!",
      nextAlwaysEnabled: true,
      conditionKey: null,
      position: 'top',
      highlight: null,
    },
    {
      id: 'go_to_3f',
      title: "Go to 3rd Floor ⬆️",
      message: "One more floor to go! Walk to the Escalator to reach the 3rd floor.",
      nextAlwaysEnabled: false,
      conditionKey: 'arrived_at_mall_3f',
      position: 'bottom',
      highlight: null,
    },
    {
      id: 'mall_3f_intro',
      title: "Mall - 3rd Floor 🎮",
      message: "The 3rd floor has the Entertainment Hub 🎮 and the Gym 💪. Feel free to log a practice expense or just explore!",
      nextAlwaysEnabled: true,
      conditionKey: null,
      position: 'top',
      highlight: null,
    },
    {
      id: 'go_down_escalator',
      title: "Going Down ⬇️",
      message: "You can also go back down! Walk to the Escalator to go down to the 2nd floor. Use escalators anytime to move between mall floors.",
      nextAlwaysEnabled: false,
      conditionKey: 'went_down_escalator',
      position: 'bottom',
      highlight: null,
    },
    {
      id: 'tutorial_done',
      title: "You're All Set! 🌟",
      message: "Amazing job! You've learned all the basics — budgeting, traveling, logging expenses, and navigating mall floors. Now go start Story Mode and become a financial master!",
      nextAlwaysEnabled: true,
      conditionKey: null,
      position: 'center',
      highlight: null,
    },
  ];
  
  // Start interactive tutorial
  const startTutorial = () => {
    setShowMainMenu(false);
    setGameMode('tutorial');
    setTutorialActive(true);
    setTutorialStep(0);
    setTutorialConditions(new Set());
    setTutorialViewedCar(false);
    setCurrentMapId('dorm'); // Always start tutorial at home
    // Persist tutorial start to Supabase
    gameDatabaseService.saveTutorialProgress({ currentStep: 0, stepsCompleted: [], tutorialCompleted: false });
    gameDatabaseService.logActivity({ activityType: 'tutorial_step', details: { step: 0, action: 'started' } });
  };
  
  // End tutorial
  const endTutorial = () => {
    setTutorialActive(false);
    setTutorialStep(0);
    setTutorialConditions(new Set());
    setTutorialViewedCar(false);
    setShowMainMenu(true);
    setGameMode(null);
    setTutorialCompleted(true);
    // Persist to AsyncStorage for quick local check
    if (user?.id) {
      AsyncStorage.setItem(`tutorialCompleted_${user.id}`, 'true');
    }
    // Persist tutorial completion to Supabase
    gameDatabaseService.saveTutorialProgress({ currentStep: 0, stepsCompleted: [], tutorialCompleted: true });
    gameDatabaseService.logActivity({ activityType: 'tutorial_step', details: { step: 'done', action: 'completed' } });
  };
  
  // Story Mode state
  const [showStoryIntro, setShowStoryIntro] = useState(false);
  const [storyLevel, setStoryLevel] = useState(1); // 1, 2, or 3
  const [unlockedLevels, setUnlockedLevels] = useState([1]); // Array of unlocked levels
  const [weeklyBudget, setWeeklyBudget] = useState(0);
  const [weeklySpending, setWeeklySpending] = useState(0);
  const [storyStartDate, setStoryStartDate] = useState(null);
  const [storyEndDate, setStoryEndDate] = useState(null);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [levelPassed, setLevelPassed] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null); // Supabase session id for story/custom
  
  // Level 1 (Budgeting) - 50/30/20 Rule tracking
  const [budgetCategories, setBudgetCategories] = useState({
    needs: { budget: 0, spent: 0 },      // 50% - Food, Transport, Bills
    wants: { budget: 0, spent: 0 },      // 30% - Shopping, Entertainment
    savings: { budget: 0, spent: 0 }     // 20% - Savings (not spent)
  });
  const [categorySpending, setCategorySpending] = useState({
    'Food & Dining': 0,
    'Shopping': 0,
    'Electronics': 0,
    'Transport': 0,
    'Entertainment': 0,
    'Groceries': 0,
    'School Supplies': 0,
    'Utilities': 0,
    'Health': 0,
    'Education': 0,
    'Other': 0,
  });
  
  // Level 2 (Goal Setting) - Savings goals tracking
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [goalAllocations, setGoalAllocations] = useState({});
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showGoalAllocationModal, setShowGoalAllocationModal] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [selectedGoal, setSelectedGoal] = useState(null);
  
  // Level completion results
  const [levelResults, setLevelResults] = useState(null);
  
  // Custom Mode unlock state (locked until Level 3 completed)
  const [customModeUnlocked, setCustomModeUnlocked] = useState(false);
  
  // Story completion dialogue (after Level 3 victory)
  const [showCompletionDialogue, setShowCompletionDialogue] = useState(false);
  const [completionPage, setCompletionPage] = useState(0);
  const [completionDisplayedText, setCompletionDisplayedText] = useState('');
  const [completionTypingDone, setCompletionTypingDone] = useState(false);
  const completionTimerRef = useRef(null);
  
  // Completion dialogue script — concise and rewarding
  const COMPLETION_SCRIPTS = [
    { text: "You did it! All three levels — complete! I'm so proud of you!" },
    { text: "You've mastered budgeting, goal setting, and saving. That's no small feat!" },
    { text: "As a reward, I've unlocked Custom Mode for you — now you can create your own challenges!" },
    { text: "Set your own budget rules, design savings goals, and push yourself further." },
    { text: "This isn't the end — it's just the beginning. Keep going, financial master!" },
  ];
  
  // Pre-Level Introduction state (Pokémon-style dialogue)
  const [showLevelIntro, setShowLevelIntro] = useState(false);
  const [introLevel, setIntroLevel] = useState(null);
  const [introPage, setIntroPage] = useState(0);
  const [introDisplayedText, setIntroDisplayedText] = useState('');
  const [introTypingDone, setIntroTypingDone] = useState(false);
  const introTimerRef = useRef(null);
  
  // Level intro dialogue scripts — each level gets multiple pages
  const LEVEL_INTRO_SCRIPTS = {
    1: [
      { text: "Hey there, adventurer! I'm Koin, your financial buddy!" },
      { text: "Welcome to Level 1: Budget Basics! This is where your journey begins." },
      { text: "You'll learn the 50/30/20 rule — the golden rule of budgeting!" },
      { text: "50% of your budget goes to Needs — food, transport, school supplies..." },
      { text: "30% goes to Wants — shopping, entertainment, electronics..." },
      { text: "And 20% should be saved! That's the secret to building wealth." },
      { text: "You have 7 days. Stay within the budget limits, and you'll pass this level. Good luck!" },
    ],
    2: [
      { text: "You made it to Level 2! I knew you had it in you!" },
      { text: "This time, we're learning about Goal Setting!" },
      { text: "I'll give you three savings goals: Emergency Fund, Fun Money, and Future Savings." },
      { text: "Your mission? Allocate money towards these goals throughout the week." },
      { text: "You need to reach at least 80% of your target to pass!" },
      { text: "Remember, every peso saved is a step toward your dreams. Let's go!" },
    ],
    3: [
      { text: "Welcome to the final challenge... Level 3: Super Saver!" },
      { text: "You've learned budgeting. You've learned goal setting. Now it's time for the ultimate test." },
      { text: "Your mission: Save at least 30% of your weekly budget!" },
      { text: "This means spending wisely and resisting unnecessary purchases." },
      { text: "Think before every spend — do you NEED it, or just WANT it?" },
      { text: "Complete this, and you'll truly be a financial master. I believe in you!" },
    ],
  };
  
  // Custom Mode state
  const [showCustomSetup, setShowCustomSetup] = useState(false);
  const [customModeType, setCustomModeType] = useState(null); // 'budgeting', 'goals', 'saving'
  const [customBudgetRules, setCustomBudgetRules] = useState({ needs: 50, wants: 30, savings: 20 });
  const [customGoals, setCustomGoals] = useState([{ name: '', target: '' }]);
  const [customSavingsTarget, setCustomSavingsTarget] = useState('20');
  const [showCustomSettingsModal, setShowCustomSettingsModal] = useState(false);
  const [settingsModeType, setSettingsModeType] = useState(null); // tracks which type is selected inside the settings modal
  
  // Character Animation State
  const [selectedCharacter, setSelectedCharacter] = useState('girl'); // 'girl', 'jasper', 'businessman', 'businesswoman'
  const [characterDirection, setCharacterDirection] = useState('down'); // 'up', 'down', 'left', 'right'
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showClosetModal, setShowClosetModal] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [notebookCategory, setNotebookCategory] = useState('Food & Dining');
  const [unlockedSkins, setUnlockedSkins] = useState(['girl', 'jasper']); // Default skins
  const frameIntervalRef = useRef(null);
  
  // Expense categories for Notebook Quick Add
  const EXPENSE_CATEGORIES = [
    { id: 'Food & Dining', name: 'Food & Dining', icon: '🍔', color: '#FF9800' },
    { id: 'Transport', name: 'Transport', icon: '🚌', color: '#2196F3' },
    { id: 'Shopping', name: 'Shopping', icon: '🛒', color: '#E91E63' },
    { id: 'Groceries', name: 'Groceries', icon: '🥬', color: '#8BC34A' },
    { id: 'Entertainment', name: 'Entertainment', icon: '🎮', color: '#9C27B0' },
    { id: 'Electronics', name: 'Electronics', icon: '📱', color: '#00BCD4' },
    { id: 'School Supplies', name: 'School Supplies', icon: '📚', color: '#3F51B5' },
    { id: 'Utilities', name: 'Utilities', icon: '💡', color: '#607D8B' },
    { id: 'Health', name: 'Health', icon: '💊', color: '#4CAF50' },
    { id: 'Education', name: 'Education', icon: '🎓', color: '#673AB7' },
    { id: 'Other', name: 'Other', icon: '📦', color: '#795548' },
  ];
  
  // Character sprite configurations - including purchasable skins
  const CHARACTER_SPRITES = {
    girl: {
      name: 'Maya',
      description: 'A bright student with big dreams',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/GirlWalk.png'),
      icon: '👧',
      color: '#FF69B4',
    },
    jasper: {
      name: 'Jasper',
      description: 'A determined young saver',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/JasperWalk.png'),
      icon: '👦',
      color: '#4A90D9',
    },
    businessman: {
      name: 'Business Marco',
      description: 'A professional look for the serious saver',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Businessman.png'),
      icon: '👔',
      color: '#2C3E50',
    },
    businesswoman: {
      name: 'Business Elena',
      description: 'Power suit for the ambitious achiever',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Businesswoman.png'),
      icon: '👩‍💼',
      color: '#8E44AD',
    },
    ash_ketchum: {
      name: 'Ash Ketchum',
      description: 'Gotta save \'em all! A trainer of budgets',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Ash Ketchum.png'),
      icon: '🧢',
      color: '#E53935',
    },
    bruce_lee: {
      name: 'Bruce Lee',
      description: 'Disciplined finances, disciplined life',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Bruce Lee.png'),
      icon: '🥋',
      color: '#FFC107',
    },
    chef_stephen: {
      name: 'Chef Stephen',
      description: 'Cooking up smart savings recipes',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Chef Stephen.png'),
      icon: '👨‍🍳',
      color: '#FF7043',
    },
    detective_carol: {
      name: 'Detective Carol',
      description: 'Investigating every peso spent',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Detective Carol.png'),
      icon: '🕵️',
      color: '#5C6BC0',
    },
    lily: {
      name: 'Lily',
      description: 'A cheerful saver with a green thumb',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Lily.png'),
      icon: '🌸',
      color: '#66BB6A',
    },
    mira: {
      name: 'Mira',
      description: 'A tech-savvy student tracking every cent',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Mira.png'),
      icon: '💜',
      color: '#AB47BC',
    },
    nurse_joy: {
      name: 'Nurse Joy',
      description: 'Healing your finances back to health',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Nurse Joy.png'),
      icon: '👩‍⚕️',
      color: '#EC407A',
    },
    policeman: {
      name: 'Officer Dan',
      description: 'Keeping your spending in check',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Policeman.png'),
      icon: '👮',
      color: '#1565C0',
    },
  };
  
  // Sprite frame configuration (24 frames total: 6 per direction)
  const SPRITE_CONFIG = {
    framesPerDirection: 6,
    frameWidth: 48,  // Each frame is 48px wide
    frameHeight: 64, // Each frame is 64px tall
    directions: {
      right: 0,  // Frames 0-5
      up: 6,     // Frames 6-11
      left: 12,  // Frames 12-17
      down: 18,  // Frames 18-23
    },
  };

  // Content area dimensions (for accurate bounds detection)
  const [contentSize, setContentSize] = useState({ width: width, height: height });

  // ─── NPC helpers ────────────────────────────────────────────────────
  // Returns true if the tile at (tileX, tileY) is occupied by an NPC on the current map
  const isNPCTile = useCallback((tileX, tileY) => {
    const npcs = NPC_POSITIONS[currentMapId];
    if (!npcs) return false;
    return npcs.some(n => n.tileX === tileX && n.tileY === tileY);
  }, [currentMapId]);

  // Like collisionSystem.findNearestPassablePosition but also excludes NPC tiles
  const findNearestPassableExcludingNPCs = useCallback((targetX, targetY) => {
    if (!collisionSystem.initialized) return { x: targetX, y: targetY };
    const targetTile = collisionSystem.pixelsToTiles(targetX, targetY, contentSize.width, contentSize.height);
    if (collisionSystem.isPassable(targetTile.x, targetTile.y) && !isNPCTile(targetTile.x, targetTile.y)) {
      return { x: targetX, y: targetY };
    }
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const cx = targetTile.x + dx;
          const cy = targetTile.y + dy;
          if (collisionSystem.isPassable(cx, cy) && !isNPCTile(cx, cy)) {
            return collisionSystem.tilesToPixels(cx, cy, contentSize.width, contentSize.height);
          }
        }
      }
    }
    return { x: targetX, y: targetY };
  }, [contentSize.width, contentSize.height, isNPCTile]);

  // Achievement tracking state
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [visitedLocations, setVisitedLocations] = useState([]);
  const [totalTilesWalked, setTotalTilesWalked] = useState(0);
  const [expenseStats, setExpenseStats] = useState({
    total: 0,
    foodCount: 0,
    shoppingCount: 0,
    electronicsCount: 0
  });

  // Cached active sessions (populated during hydration, consumed when user selects a level)
  const cachedActiveStoryRef = useRef(null);
  const cachedActiveCustomRef = useRef(null);
  
  // Story Level Configurations - Restructured
  // Level 1: Budgeting (50/30/20 rule)
  // Level 2: Goal Setting (allocate to savings goals)
  // Level 3: Saving (save % of budget)
  const STORY_LEVELS = {
    1: {
      name: 'Budget Basics',
      description: 'Learn the 50/30/20 rule! Keep your Needs under 50%, Wants under 30%, and save 20%.',
      type: 'budgeting',
      icon: '📊',
      rules: {
        needs: 0.50,    // 50% max for needs (Food, Transport)
        wants: 0.30,    // 30% max for wants (Shopping, Entertainment)
        savings: 0.20   // 20% min savings
      },
      goalText: 'Follow the 50/30/20 budget rule',
    },
    2: {
      name: 'Goal Setter',
      description: 'Set savings goals and allocate money towards them. Reach at least 80% of your goal!',
      type: 'goals',
      icon: '🎯',
      minGoalProgress: 0.80, // Must reach 80% of goal
      goalText: 'Reach 80% of your savings goal',
    },
    3: {
      name: 'Super Saver',
      description: 'The ultimate challenge! Save at least 30% of your weekly budget.',
      type: 'saving',
      icon: '👑',
      savingsGoal: 0.40, // 40% savings required
      goalText: 'Save 40% of your budget',
    },
  };
  
  // Category to budget type mapping for Level 1
  const CATEGORY_BUDGET_MAP = {
    'Food & Dining': 'needs',
    'Transport': 'needs',
    'Groceries': 'needs',
    'School Supplies': 'needs',
    'Shopping': 'wants',
    'Electronics': 'wants',
    'Entertainment': 'wants',
    'Other': 'wants',
    'Utilities': 'needs',
    'Health': 'needs',
    'Education': 'needs',
  };
    
  
  // Handle layout to get actual content dimensions
  const handleContentLayout = (event) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    console.log('📐 Content area size:', w, 'x', h);
    setContentSize({ width: w, height: h });
  };

  // Initialize collision system when map changes
  useEffect(() => {
    console.log('🗺️ Initializing collision system for map:', currentMapId);
    collisionSystem.initialize(currentMapId);
    if (collisionSystem.initialized) {
      console.log(`✅ Collision system ready for ${currentMapId} map`);
      // Debug: print passability map to console
      collisionSystem.debugPrintPassabilityMap();
    }
    
    // Reset character to spawn point when map changes
    const newMap = MAPS[currentMapId];
    if (newMap) {
      const halfChar = getCharSize() / 2;
      const spawnX = newMap.spawnPoint.x - halfChar;
      const spawnY = newMap.spawnPoint.y - halfChar;
      console.log('📍 Resetting character to spawn point:', spawnX, spawnY);
      animatedX.setValue(spawnX);
      animatedY.setValue(spawnY);
      setCharacterPosition(newMap.spawnPoint);
      setCurrentLocation('Hallway 🚶');
    }
  }, [currentMapId]);

  // Get the on-screen character size that matches the displayed tile size.
  // Uses the same "contain" scale math as the ImageBackground.
  const getCharSize = () => {
    if (!collisionSystem.initialized) return CHARACTER_SIZE;
    const mapPixelW = collisionSystem.mapWidth * collisionSystem.tileSize;
    const mapPixelH = collisionSystem.mapHeight * collisionSystem.tileSize;
    const scale = Math.min(contentSize.width / mapPixelW, contentSize.height / mapPixelH);
    const size = collisionSystem.tileSize * scale;
    return size > 0 ? size : CHARACTER_SIZE;
  };

  // Fetch today's spending — re-runs whenever DataContext expenses change
  useEffect(() => {
    fetchTodaySpending();
    // Hide instructions after 5 seconds
    const timer = setTimeout(() => setShowInstructions(false), 5000);
    return () => clearTimeout(timer);
  }, [expenses]);

  // ─── Hydrate saved game progress from Supabase on mount ────
  useEffect(() => {
    if (!user?.id) return;

    const hydrate = async () => {
      try {
        const progress = await gameDatabaseService.loadGameProgress();
        if (!progress) return;

        const { userLevels, character, tutorial, activeStory, activeCustom, unlockedLevels: unlocked, introSeen } = progress;

        // 1. Unlocked story levels
        if (unlocked && unlocked.length > 0) {
          setUnlockedLevels(unlocked);
        }

        // 1b. Check if Custom Mode was previously unlocked
        // Primary source: Supabase user_levels (survives logout / device switch)
        if (userLevels?.story_level_3_completed) {
          setCustomModeUnlocked(true);
          // Keep AsyncStorage in sync for offline/fast access
          AsyncStorage.setItem(`customModeUnlocked_${user.id}`, 'true').catch(() => {});
        } else {
          // Fallback: check AsyncStorage (legacy / offline)
          const cmUnlocked = await AsyncStorage.getItem(`customModeUnlocked_${user.id}`);
          if (cmUnlocked === 'true') {
            setCustomModeUnlocked(true);
          }
        }

        // 1c. Sync intro-seen flags from DB → AsyncStorage (cross-device persistence)
        if (introSeen) {
          for (const lvl of [1, 2, 3]) {
            if (introSeen[lvl]) {
              await AsyncStorage.setItem(`level_intro_seen_${user.id}_${lvl}`, 'true');
            }
          }
        }

        // 2. Character selection
        if (character?.selected_character) {
          setSelectedCharacter(character.selected_character);
        }
        if (character?.unlocked_characters && Array.isArray(character.unlocked_characters)) {
          // Merge DB unlocked characters with local AsyncStorage skins
          setUnlockedSkins(prev => {
            const merged = new Set([...prev, ...character.unlocked_characters]);
            return Array.from(merged);
          });
        }

        // 3. Tutorial completion — hydrate from DB or AsyncStorage
        if (tutorial?.tutorial_completed) {
          setTutorialCompleted(true);
        } else {
          // Fallback to AsyncStorage
          const tcLocal = await AsyncStorage.getItem(`tutorialCompleted_${user.id}`);
          if (tcLocal === 'true') setTutorialCompleted(true);
        }

        // 4. Cache active story session for later resumption (DO NOT auto-navigate)
        if (activeStory) {
          cachedActiveStoryRef.current = activeStory;
          console.log(`📦 Cached active story session ${activeStory.id} (Level ${activeStory.level})`);
        }
        // 5. Cache active custom session for later resumption (DO NOT auto-navigate)
        if (activeCustom) {
          cachedActiveCustomRef.current = activeCustom;
          console.log(`📦 Cached active custom session ${activeCustom.id} (${activeCustom.mode_type})`);
        }

        // Always stay on Main Menu — user chooses when to resume
        console.log('✅ Game progress hydrated from Supabase (staying on Main Menu)');
      } catch (err) {
        console.error('❌ Failed to hydrate game progress:', err.message);
      }
    };

    hydrate();
  }, [user?.id]);

  // Load unlocked skins from store purchases - runs when screen is focused
  // Merges Supabase (source of truth) + AsyncStorage (local cache)
  const loadUnlockedSkins = useCallback(async () => {
    try {
      if (!user?.id) return;

      const defaults = ['girl', 'jasper'];
      let dbSkins = [];
      let localSkins = [];

      // 1. Load from Supabase (source of truth)
      try {
        const dbData = await gameDatabaseService.loadStorePurchases();
        if (dbData?.unlockedCharacters && dbData.unlockedCharacters.length > 0) {
          dbSkins = dbData.unlockedCharacters;
        }
      } catch (e) {
        console.warn('⚠️ Could not load skins from Supabase:', e.message);
      }

      // 2. Load from AsyncStorage (local cache / legacy)
      const unlockedSkinsKey = `unlocked_skins_${user.id}`;
      const savedSkins = await AsyncStorage.getItem(unlockedSkinsKey);
      if (savedSkins) {
        localSkins = JSON.parse(savedSkins);
      }

      // 3. Merge all sources
      const merged = Array.from(new Set([...defaults, ...dbSkins, ...localSkins]));
      setUnlockedSkins(merged);

      // 4. Keep AsyncStorage in sync with the merged result
      await AsyncStorage.setItem(unlockedSkinsKey, JSON.stringify(merged));
    } catch (error) {
      console.error('Error loading unlocked skins:', error);
    }
  }, [user?.id]);

  // Reload unlocked skins every time the Game screen is focused
  useFocusEffect(
    useCallback(() => {
      loadUnlockedSkins();
    }, [loadUnlockedSkins])
  );

  // Walking pulse animation
  useEffect(() => {
    if (isWalking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(walkingPulse, {
            toValue: 1.15,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(walkingPulse, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
        ])
      ).start();
      
      // Start sprite animation when walking
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % SPRITE_CONFIG.framesPerDirection);
      }, 100); // 100ms per frame
    } else {
      walkingPulse.stopAnimation();
      walkingPulse.setValue(1);
      
      // Stop sprite animation when not walking
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      setCurrentFrame(0); // Reset to idle frame
    }
    
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [isWalking]);

  const fetchTodaySpending = async () => {
    try {
      // Build start/end of today as ISO strings for range query
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user?.id)
        .gte('date', startOfDay)
        .lt('date', endOfDay);
      
      if (data) {
        const total = data.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        setTodaySpending(total);
      }
    } catch (error) {
      console.error('Error fetching spending:', error);
    }
  };

  // Fetch weekly spending for Story Mode
  const fetchWeeklySpending = async () => {
    if (!storyStartDate || !storyEndDate) return;
    
    try {
      const startDateStr = storyStartDate.toISOString().split('T')[0];
      const endDateStr = storyEndDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .eq('user_id', user?.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr);
      
      if (data) {
        const total = data.reduce((sum, expense) => sum + expense.amount, 0);
        setWeeklySpending(total);
        
        // Re-derive per-category spending from actual expense data
        // This ensures budgetCategories stay accurate after reload.
        // IMPORTANT: DB may store categories in lowercase (via BudgetDatabaseService),
        // so we normalise to Title Case before looking up CATEGORY_BUDGET_MAP.
        const derivedCategorySpending = {};
        let derivedNeedsSpent = 0;
        let derivedWantsSpent = 0;
        data.forEach(expense => {
          const cat = normalizeCategory(expense.category); // Title-Case normalisation
          derivedCategorySpending[cat] = (derivedCategorySpending[cat] || 0) + expense.amount;
          const budgetType = CATEGORY_BUDGET_MAP[cat] || 'wants';
          if (budgetType === 'needs') derivedNeedsSpent += expense.amount;
          else if (budgetType === 'wants') derivedWantsSpent += expense.amount;
        });
        
        // Update categorySpending with derived values
        setCategorySpending(prev => ({ ...prev, ...derivedCategorySpending }));
        
        // Update budgetCategories needs/wants spent (preserves budget limits)
        const isLevelBudgeting =
          (gameMode === 'story' && STORY_LEVELS[storyLevel]?.type === 'budgeting') ||
          (gameMode === 'custom' && customModeType === 'budgeting');
        if (isLevelBudgeting) {
          setBudgetCategories(prev => ({
            needs:   { ...prev.needs,   spent: derivedNeedsSpent },
            wants:   { ...prev.wants,   spent: derivedWantsSpent },
            savings: { ...prev.savings, spent: prev.savings.spent },
          }));
        }
        
        // Check if week is complete and evaluate level
        const now = new Date();
        if (now >= storyEndDate) {
          checkLevelCompletion(total);
        }
      }
    } catch (error) {
      console.error('Error fetching weekly spending:', error);
    }
  };

  // Calculate remaining weekly budget
  const getRemainingWeeklyBudget = () => {
    return Math.max(0, weeklyBudget - weeklySpending);
  };

  // Calculate savings percentage
  const getSavingsPercentage = () => {
    if (weeklyBudget <= 0) return 0;
    const saved = weeklyBudget - weeklySpending;
    return Math.max(0, (saved / weeklyBudget) * 100);
  };

  // Calculate 50/30/20 budget category percentages for Level 1
  const getBudgetCategoryPercentages = () => {
    if (weeklyBudget <= 0) return { needs: 0, wants: 0, savings: 0 };
    
    const needsSpent = budgetCategories.needs?.spent || 0;
    const wantsSpent = budgetCategories.wants?.spent || 0;
    const totalSpent = weeklySpending;
    const savingsAmount = weeklyBudget - totalSpent;
    
    return {
      needs: Math.round((needsSpent / weeklyBudget) * 100),
      wants: Math.round((wantsSpent / weeklyBudget) * 100),
      savings: Math.round((savingsAmount / weeklyBudget) * 100)
    };
  };

  // Get days remaining in the week
  const getDaysRemaining = () => {
    if (!storyEndDate) return 0;
    const now = new Date();
    const diffTime = storyEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Check if level is completed - handles all 3 level types (Story & Custom Mode)
  const checkLevelCompletion = async (totalSpent) => {
    const currentLevel = STORY_LEVELS[storyLevel];
    let passed = false;
    let results = {};
    
    // Determine if we're in Custom Mode and get the appropriate thresholds
    const isCustom = gameMode === 'custom';
    
    if (currentLevel.type === 'budgeting') {
      // Level 1: Check budget rule compliance
      // Use custom rules if in custom mode, otherwise use story mode defaults
      const needsLimit = isCustom ? customBudgetRules.needs : 50;
      const wantsLimit = isCustom ? customBudgetRules.wants : 30;
      const savingsMin = isCustom ? customBudgetRules.savings : 20;
      
      const needsPercent = (budgetCategories.needs.spent / weeklyBudget) * 100;
      const wantsPercent = (budgetCategories.wants.spent / weeklyBudget) * 100;
      const savingsPercent = ((weeklyBudget - totalSpent) / weeklyBudget) * 100;
      
      const needsOk = needsPercent <= needsLimit;
      const wantsOk = wantsPercent <= wantsLimit;
      const savingsOk = savingsPercent >= savingsMin;
      
      passed = needsOk && wantsOk && savingsOk;
      
      results = {
        type: 'budgeting',
        needsPercent: needsPercent.toFixed(1),
        wantsPercent: wantsPercent.toFixed(1),
        savingsPercent: savingsPercent.toFixed(1),
        needsOk,
        wantsOk,
        savingsOk,
        needsBudget: weeklyBudget * (needsLimit / 100),
        wantsBudget: weeklyBudget * (wantsLimit / 100),
        needsLimit,
        wantsLimit,
        savingsMin,
      };
      
    } else if (currentLevel.type === 'goals') {
      // Level 2: Check if user reached goal progress
      const totalAllocated = Object.values(goalAllocations).reduce((sum, amt) => sum + amt, 0);
      const totalGoalTarget = savingsGoals.reduce((sum, g) => sum + g.target, 0);
      const goalProgress = totalGoalTarget > 0 ? (totalAllocated / totalGoalTarget) : 0;
      
      // For custom mode, require reaching the custom goals; for story mode, 80% of goal
      const minProgress = isCustom ? 0.80 : currentLevel.minGoalProgress;
      passed = goalProgress >= minProgress;
      
      results = {
        type: 'goals',
        totalAllocated,
        goalTarget: totalGoalTarget,
        goalProgress: (goalProgress * 100).toFixed(1),
        savingsGoals,
        minProgress: minProgress * 100,
      };
      
    } else if (currentLevel.type === 'saving') {
      // Level 3: Saving percentage
      // Use custom savings target if in custom mode
      const savingsGoalPercent = isCustom ? (parseFloat(customSavingsTarget) / 100) : currentLevel.savingsGoal;
      
      const actualSavings = (weeklyBudget - totalSpent) / weeklyBudget;
      const savingsPercent = actualSavings * 100;
      
      passed = actualSavings >= savingsGoalPercent;
      
      results = {
        type: 'saving',
        savingsPercent: savingsPercent.toFixed(1),
        savingsGoal: savingsGoalPercent * 100,
        amountSaved: weeklyBudget - totalSpent,
      };
    }
    
    setLevelPassed(passed);
    setLevelResults(results);
    
    // Only unlock next story levels in Story Mode
    if (gameMode === 'story' && passed && storyLevel < 3 && !unlockedLevels.includes(storyLevel + 1)) {
      setUnlockedLevels([...unlockedLevels, storyLevel + 1]);
    }
    
    // Unlock Custom Mode when Level 3 is completed successfully
    if (gameMode === 'story' && passed && storyLevel === 3 && !customModeUnlocked) {
      setCustomModeUnlocked(true);
      AsyncStorage.setItem(`customModeUnlocked_${user?.id}`, 'true').catch(() => {});
    }
    
    setShowLevelComplete(true);

    // Clear cached active sessions since this one is now completed
    if (gameMode === 'story') cachedActiveStoryRef.current = null;
    if (gameMode === 'custom') cachedActiveCustomRef.current = null;

    // ── Persist level completion to Supabase ──
    const xpEarned = passed ? (storyLevel === 1 ? 100 : storyLevel === 2 ? 150 : 200) : 0;
    const starsEarned = passed ? (results.type === 'budgeting'
      ? (results.needsOk && results.wantsOk && results.savingsOk ? 3 : 2)
      : results.type === 'goals'
        ? (parseFloat(results.goalProgress) >= 100 ? 3 : parseFloat(results.goalProgress) >= 90 ? 2 : 1)
        : (parseFloat(results.savingsPercent) >= results.savingsGoal * 1.5 ? 3 : parseFloat(results.savingsPercent) >= results.savingsGoal * 1.2 ? 2 : 1)
    ) : 0;

    if (activeSessionId) {
      if (gameMode === 'story') {
        gameDatabaseService.completeStorySession(activeSessionId, { passed, starsEarned, xpEarned, resultsData: results, weeklySpending: totalSpent });
      } else if (gameMode === 'custom') {
        gameDatabaseService.completeCustomSession(activeSessionId, { passed, xpEarned, resultsData: results, weeklySpending: totalSpent });
      }
      gameDatabaseService.logActivity({ activityType: 'level_complete', sessionId: activeSessionId, details: { level: storyLevel, passed, stars: starsEarned, mode: gameMode }, xpEarned });
    }
    // Increment XP and goals achieved on user_levels
    if (passed) {
      gameDatabaseService.incrementUserLevelStats({ xpToAdd: xpEarned, goalsAchieved: 1 });
      // Directly mark story level completed on user_levels (safety net for DB trigger)
      if (gameMode === 'story') {
        gameDatabaseService.markStoryLevelCompleted(storyLevel, starsEarned);
      }
    }

    // 🏆 Check for story mode achievements when level is completed
    if (passed) {
      const savingsPercent = results.savingsPercent || ((weeklyBudget - totalSpent) / weeklyBudget * 100);
      checkAchievements('story_level_complete', {
        level: storyLevel,
        savingsPercent: parseFloat(savingsPercent)
      });
    }
  };

  // Start Story Mode with a specific level
  const startStoryLevel = async (level) => {
    // Guard: if an active session already exists for this level, resume it instead
    const existingSession = await gameDatabaseService.findActiveStorySession(level);
    if (existingSession) {
      console.log(`⚠️ Active session found for level ${level} — resuming instead of creating new`);
      resumeStorySession(existingSession);
      return;
    }

    // Get user's monthly budget from DataContext/Supabase
    try {
      const { data: budgetData, error } = await supabase
        .from('budgets')
        .select('monthly')
        .eq('user_id', user?.id)
        .single();
      
      let monthlyBudget = 5000; // Default fallback
      if (budgetData?.monthly) {
        monthlyBudget = budgetData.monthly;
      }
      
      // Calculate weekly budget (monthly / 4)
      const calculatedWeeklyBudget = monthlyBudget / 4;
      setWeeklyBudget(calculatedWeeklyBudget);
      
      // Set start and end dates — real-time 168-hour window from NOW
      const startDate = new Date(); // exact moment user pressed Start
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // exactly 7 days later
      
      setStoryStartDate(startDate);
      setStoryEndDate(endDate);
      setStoryLevel(level);
      setWeeklySpending(0);
      setLevelResults(null);
      
      // Reset category spending tracking
      setCategorySpending({
        'Food & Dining': 0,
        'Shopping': 0,
        'Electronics': 0,
        'Transport': 0,
        'Entertainment': 0,
        'Other': 0
      });
      
      // Level-specific setup
      const levelConfig = STORY_LEVELS[level];
      
      if (levelConfig.type === 'budgeting') {
        // Level 1: Set up 50/30/20 budget categories
        setBudgetCategories({
          needs: { budget: calculatedWeeklyBudget * 0.50, spent: 0 },
          wants: { budget: calculatedWeeklyBudget * 0.30, spent: 0 },
          savings: { budget: calculatedWeeklyBudget * 0.20, spent: 0 }
        });
      } else if (levelConfig.type === 'goals') {
        // Level 2: Set up savings goals
        setSavingsGoals([
          { id: 'emergency', name: 'Emergency Fund', icon: '🏥', target: calculatedWeeklyBudget * 0.10 },
          { id: 'wants', name: 'Fun Money', icon: '🎮', target: calculatedWeeklyBudget * 0.05 },
          { id: 'future', name: 'Future Savings', icon: '🎓', target: calculatedWeeklyBudget * 0.05 },
        ]);
        setGoalAllocations({ emergency: 0, wants: 0, future: 0 });
      }
      
      // Close intro and start game
      setShowStoryIntro(false);
      setCurrentMapId('dorm');
      setShowMainMenu(false);
      
      console.log(`📖 Story Mode Level ${level} (${levelConfig.type}) started!`);
      console.log(`   Weekly Budget: ₱${calculatedWeeklyBudget}`);
      console.log(`   Week: ${startDate.toDateString()} - ${endDate.toDateString()}`);

      // ── Persist story session to Supabase ──
      const session = await gameDatabaseService.createStorySession({
        level,
        levelType: levelConfig.type,
        levelName: levelConfig.name,
        weeklyBudget: calculatedWeeklyBudget,
        startDate,
        endDate,
        needsBudget: levelConfig.type === 'budgeting' ? calculatedWeeklyBudget * 0.50 : null,
        wantsBudget: levelConfig.type === 'budgeting' ? calculatedWeeklyBudget * 0.30 : null,
        savingsBudget: levelConfig.type === 'budgeting' ? calculatedWeeklyBudget * 0.20 : null,
        goalsData: levelConfig.type === 'goals' ? [
          { id: 'emergency', name: 'Emergency Fund', target: calculatedWeeklyBudget * 0.10 },
          { id: 'wants', name: 'Fun Money', target: calculatedWeeklyBudget * 0.05 },
          { id: 'future', name: 'Future Savings', target: calculatedWeeklyBudget * 0.05 },
        ] : null,
        savingsGoalPercent: levelConfig.type === 'saving' ? 30 : null,
      });
      if (session) setActiveSessionId(session.id);
      gameDatabaseService.logActivity({ activityType: 'level_start', details: { level, type: levelConfig.type, mode: 'story' }, sessionId: session?.id });
      
    } catch (error) {
      console.error('Error starting story level:', error);
      Alert.alert('Error', 'Could not start story mode. Please try again.');
    }
  };

  // Effect to fetch weekly spending when in story/custom mode
  useEffect(() => {
    if ((gameMode === 'story' || gameMode === 'custom') && storyStartDate && storyEndDate) {
      fetchWeeklySpending();
    }
  }, [gameMode, storyStartDate, storyEndDate, expenses]);

  // Check if the story/custom week has ended
  useEffect(() => {
    if ((gameMode === 'story' || gameMode === 'custom') && storyEndDate && !showLevelComplete) {
      const now = new Date();
      if (now >= storyEndDate) {
        // Week has ended, check completion
        checkLevelCompletion(weeklySpending);
      }
    }
  }, [gameMode, storyEndDate, showLevelComplete]);

  // Function to manually end the week (for testing or if user wants to end early)
  const handleEndWeek = () => {
    Alert.alert(
      '⏰ End Week Early?',
      'Are you sure you want to end this week and check your progress?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Week', 
          style: 'destructive',
          onPress: () => checkLevelCompletion(weeklySpending)
        }
      ]
    );
  };

  // ==================== ACHIEVEMENT FUNCTIONS ====================

  // Show achievement popup
  const showAchievementPopup = (achievement) => {
    setNewAchievement(achievement);
    setShowAchievementModal(true);
  };

  // Check and award achievements
  const checkAchievements = async (activityType, activityData = {}) => {
    if (!user?.id) return;
    
    try {
      const newAchievements = await AchievementService.checkAndAwardAchievements(
        user.id,
        activityType,
        activityData
      );
      
      // Show popup for first new achievement
      if (newAchievements && newAchievements.length > 0) {
        showAchievementPopup(newAchievements[0]);
        
        // If multiple achievements, show them sequentially
        if (newAchievements.length > 1) {
          newAchievements.slice(1).forEach((achievement, index) => {
            setTimeout(() => {
              showAchievementPopup(achievement);
            }, (index + 1) * 3000);
          });
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  // Fetch expense stats for achievement tracking
  const fetchExpenseStats = async () => {
    if (!user?.id) return;
    
    try {
      // Get total expense count
      const { data: allExpenses, error } = await supabase
        .from('expenses')
        .select('category')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const stats = {
        total: allExpenses?.length || 0,
        foodCount: allExpenses?.filter(e => e.category === 'Food & Dining').length || 0,
        shoppingCount: allExpenses?.filter(e => e.category === 'Shopping').length || 0,
        electronicsCount: allExpenses?.filter(e => e.category === 'Electronics').length || 0
      };
      
      setExpenseStats(stats);
      return stats;
    } catch (error) {
      console.error('Error fetching expense stats:', error);
      return expenseStats;
    }
  };

  // Load expense stats on mount
  useEffect(() => {
    if (user?.id) {
      fetchExpenseStats();
    }
  }, [user?.id]);

  // ==================== END ACHIEVEMENT FUNCTIONS ====================

  // Define the canteen/food stall area (bottom-left region)
  const isInCanteenArea = (x, y) => {
    const canteenBounds = {
      left: 0,
      right: width * 0.45,
      top: height * 0.50,
      bottom: height / 0.15,
      colors: red,
    };
    return (
      x >= canteenBounds.left &&
      x <= canteenBounds.right &&
      y >= canteenBounds.top &&
      y <= canteenBounds.bottom
    );
  };

  // Check if position is in a specific location
  const getLocationAtPosition = (x, y) => {
    // Use contentSize for accurate bounds detection
    const cw = contentSize.width;
    const ch = contentSize.height;
    
    for (const location of currentMap.locations) {
      const bounds = location.bounds;
      const inBounds = (
        x >= cw * bounds.left &&
        x <= cw * bounds.right &&
        y >= ch * bounds.top &&
        y <= ch * bounds.bottom
      );
      
      if (inBounds) {
        console.log(`📍 Found location: ${location.name} at (${x}, ${y})`);
        console.log(`   Bounds: left=${(cw * bounds.left).toFixed(0)}, right=${(cw * bounds.right).toFixed(0)}, top=${(ch * bounds.top).toFixed(0)}, bottom=${(ch * bounds.bottom).toFixed(0)}`);
        return location;
      }
    }
    return null;
  };

  // Get location name based on position
  const getLocationName = (x, y) => {
    const location = getLocationAtPosition(x, y);
    if (location) {
      return `${location.name} ${location.icon}`;
    }
    return 'Exploring 🚶';
  };

  // Handle location actions when character arrives
  const handleLocationAction = (location) => {
    if (!location) return;

    console.log('🎯 Location action triggered:', location.action, 'at', location.name);
    console.log('📍 Location details:', JSON.stringify(location));

    switch (location.action) {
      case 'expense':
        setExpenseCategory(location.category || 'Other');
        // Directly open the expense modal without an alert prompt
        if (tutorialActive && gameMode === 'tutorial') {
          markTutorialCondition('expense_opened');
        }
        setShowExpenseModal(true);
        break;
      case 'travel':
        console.log('🚪 Opening travel modal with destinations:', location.destinations);
        setTravelDestinations(location.destinations || []);
        setShowTravelModal(true);
        break;
      case 'closet':
        console.log('👔 Opening closet for character selection');
        // Tutorial: mark closet opened condition
        if (tutorialActive && gameMode === 'tutorial') {
          markTutorialCondition('closet_opened');
        }
        setShowClosetModal(true);
        break;
      case 'notebook':
        console.log('📓 Opening notebook for quick expense entry');
        setShowNotebookModal(true);
        break;
      case 'info':
        Alert.alert(`${location.name} ${location.icon}`, location.message || 'Nothing here.');
        break;
      case 'floor_change':
        console.log(`🔄 Floor change triggered: going to ${location.targetFloor}`);
        changeFloor(location.targetFloor);
        break;
      default:
        console.log('⚠️ Unknown action:', location.action);
        break;
    }
  };

  // Handle destination selection - show transport modal
  const handleSelectDestination = (destId) => {
    setSelectedDestination(destId);
    setShowTravelModal(false);
    setShowTransportModal(true);
    // Reset transport state
    setTransportMode(null);
    setFareAmount('');
    setDidBuyFuel(null);
    setFuelAmount('');
  };

  // Handle transport mode selection
  const handleTransportModeSelect = (mode) => {
    setTransportMode(mode);
    if (mode === 'car') {
      setDidBuyFuel(null); // Reset fuel question when switching to car
      // Tutorial: mark that user has viewed car transport
      if (tutorialActive && gameMode === 'tutorial') {
        setTutorialViewedCar(true);
      }
    }
  };

  // Confirm travel with transport cost
  const confirmTravel = async () => {
    if (!selectedDestination) return;
    
    // Validate inputs based on transport mode
    if (transportMode === 'commute') {
      const fare = parseFloat(fareAmount);
      if (!fareAmount || isNaN(fare) || fare < 0) {
        Alert.alert('Invalid Fare', 'Please enter a valid fare amount.');
        return;
      }
    } else if (transportMode === 'car') {
      if (didBuyFuel === null) {
        Alert.alert('Fuel Question', 'Please select if you bought fuel or not.');
        return;
      }
      if (didBuyFuel) {
        const fuel = parseFloat(fuelAmount);
        if (!fuelAmount || isNaN(fuel) || fuel <= 0) {
          Alert.alert('Invalid Amount', 'Please enter a valid fuel cost.');
          return;
        }
      }
    }
    
    // ── Capture values before clearing state ──
    const savedDestination = selectedDestination;
    const savedTransportMode = transportMode;
    const savedFareAmount = fareAmount;
    const savedDidBuyFuel = didBuyFuel;
    const savedFuelAmount = fuelAmount;
    const savedOriginMap = currentMapId;

    // ── Optimistic UI: travel immediately (closes transport modal inside travelToMap) ──
    travelToMap(savedDestination);

    // ── Tutorial mode: skip all DB saves, just mark conditions ──
    if (tutorialActive && gameMode === 'tutorial') {
      // Mark arrival conditions
      if (savedDestination === 'school') markTutorialCondition('arrived_at_school');
      if (savedDestination === 'mall_1f' || savedDestination.startsWith('mall')) markTutorialCondition('arrived_at_mall');
      console.log('🎓 Tutorial: Skipped transport expense save (practice mode)');
      return;
    }

    // ── Background: record transport expense and persist to Supabase ──
    try {
      if (savedTransportMode === 'commute') {
        const fare = parseFloat(savedFareAmount);
        if (fare > 0) {
          recordTransportExpense('Commute Fare', fare, 'Transport');
        }
      } else if (savedTransportMode === 'car' && savedDidBuyFuel) {
        const fuel = parseFloat(savedFuelAmount);
        if (fuel > 0) {
          recordTransportExpense('Gas/Fuel', fuel, 'Transport');
        }
      }

      // Persist transport log to Supabase (fire-and-forget)
      const fareVal = savedTransportMode === 'commute' ? parseFloat(savedFareAmount) || 0 : null;
      const fuelVal = (savedTransportMode === 'car' && savedDidBuyFuel) ? parseFloat(savedFuelAmount) || 0 : null;
      if (savedTransportMode && savedTransportMode !== 'walk') {
        gameDatabaseService.recordTransportExpense({
          transportMode: savedTransportMode || 'walk',
          originMap: savedOriginMap,
          destinationMap: savedDestination,
          fareAmount: fareVal,
          fuelAmount: fuelVal,
          sessionId: activeSessionId,
        });
      }
    } catch (error) {
      console.error('❌ ConfirmTravel background save error:', error);
    }
  };

  // Record transport expense (non-blocking, matches Canteen pattern)
  const recordTransportExpense = async (description, amount, category) => {
    // Optimistic local state updates (instant)
    setCategorySpending(prev => ({
      ...prev,
      [category]: (prev[category] || 0) + amount
    }));

    if (gameMode === 'story' || gameMode === 'custom') {
      const budgetType = CATEGORY_BUDGET_MAP[category] || 'wants';
      setBudgetCategories(prev => ({
        ...prev,
        [budgetType]: {
          ...prev[budgetType],
          spent: prev[budgetType].spent + amount
        }
      }));
      setWeeklySpending(prev => prev + amount);
    }

    // Background save — non-blocking
    try {
      const expenseData = {
        amount: amount,
        category: category,
        note: description,
        date: new Date().toISOString(),
      };

      console.log('💾 Transport: Saving expense via DataContext:', JSON.stringify(expenseData));
      const success = await addExpense(expenseData);

      if (!success) {
        console.error('❌ Transport: Failed to save expense');
        Alert.alert('Sync Error', 'Transport expense may not have been saved.');
      } else {
        console.log(`✅ Transport: Recorded ${description}: ₱${amount}`);

        // Persist session spending to Supabase (fire-and-forget)
        if (activeSessionId && (gameMode === 'story' || gameMode === 'custom')) {
          const updatedSpending = weeklySpending + amount;
          const updatedCategorySpending = { ...categorySpending, [category]: (categorySpending[category] || 0) + amount };
          const budgetType = CATEGORY_BUDGET_MAP[category] || 'wants';
          const updatedNeedsSpent = budgetCategories.needs.spent + (budgetType === 'needs' ? amount : 0);
          const updatedWantsSpent = budgetCategories.wants.spent + (budgetType === 'wants' ? amount : 0);

          const sessionUpdate = {
            weeklySpending: updatedSpending,
            categorySpending: updatedCategorySpending,
            needsSpent: updatedNeedsSpent,
            wantsSpent: updatedWantsSpent,
            savingsAmount: weeklyBudget - updatedSpending,
          };
          if (gameMode === 'story') {
            gameDatabaseService.updateStorySessionSpending(activeSessionId, sessionUpdate);
          } else {
            gameDatabaseService.updateCustomSessionSpending(activeSessionId, sessionUpdate);
          }
        }

        // Log activity (fire-and-forget)
        gameDatabaseService.logActivity({
          activityType: 'expense_recorded',
          mapId: currentMapId,
          amount: amount,
          details: { category, note: description, source: 'transport' },
          sessionId: activeSessionId,
        });
        gameDatabaseService.incrementUserLevelStats({ expensesRecorded: 1 });
      }
    } catch (error) {
      console.error('❌ Transport: Error saving expense:', error);
    }
  };

  // Travel to a new map
  const travelToMap = async (mapId) => {
    const newMap = MAPS[mapId];
    if (!newMap) return;

    setShowTransportModal(false);
    setCurrentMapId(mapId);
    
    // Find the exit location to spawn at
    const exitLocation = newMap.locations.find(loc => loc.action === 'travel');
    let spawnX, spawnY;
    
    if (exitLocation && exitLocation.exitSpawnPoint) {
      // Spawn at the exit point (percentage-based coordinates)
      spawnX = width * exitLocation.exitSpawnPoint.x;
      spawnY = height * exitLocation.exitSpawnPoint.y;
    } else {
      // Fallback to default spawn point
      spawnX = newMap.spawnPoint.x;
      spawnY = newMap.spawnPoint.y;
    }
    
    const spawn = { x: spawnX, y: spawnY };
    setCharacterPosition(spawn);
    const halfChar = getCharSize() / 2;
    animatedX.setValue(spawn.x - halfChar);
    animatedY.setValue(spawn.y - halfChar);
    setCharacterDirection('down'); // Face down when arriving
    setCurrentLocation(`${newMap.name} ${newMap.icon}`);
    
    // Track visited locations for achievements
    const newVisitedLocations = visitedLocations.includes(mapId) 
      ? visitedLocations 
      : [...visitedLocations, mapId];
    setVisitedLocations(newVisitedLocations);
    
    // Check travel and exploration achievements (fire-and-forget, no blocking)
    Promise.all([
      checkAchievements('first_travel', {}),
      checkAchievements('location_visited', { 
        locationId: mapId, 
        visitedLocations: newVisitedLocations 
      }),
    ]).catch(() => {});

    // ── Log map travel to Supabase ──
    gameDatabaseService.logActivity({
      activityType: 'map_travel',
      mapId,
      details: { from: currentMapId, to: mapId, transport: transportMode || 'walk' },
      sessionId: activeSessionId,
    });
    gameDatabaseService.incrementUserLevelStats({ mapsTraveled: 1 });
    
    // Arrival message removed - no alert needed
    
    // Reset transport state
    setSelectedDestination(null);
    setTransportMode(null);
    setFareAmount('');
    setDidBuyFuel(null);
    setFuelAmount('');
  };

  // Change floor within the mall (no transport cost)
  const changeFloor = (floorId) => {
    const newMap = MAPS[floorId];
    if (!newMap) return;

    const previousMapId = currentMapId;
    setCurrentMapId(floorId);

    // Find the escalator on the destination floor that leads back to where we came from
    const arrivalEscalator = newMap.locations.find(loc =>
      loc.action === 'floor_change' && loc.targetFloor === previousMapId
    );

    let spawnX, spawnY;
    if (arrivalEscalator && arrivalEscalator.exitSpawnPoint) {
      spawnX = width * arrivalEscalator.exitSpawnPoint.x;
      spawnY = height * arrivalEscalator.exitSpawnPoint.y;
    } else {
      spawnX = newMap.spawnPoint.x;
      spawnY = newMap.spawnPoint.y;
    }

    const spawn = { x: spawnX, y: spawnY };
    setCharacterPosition(spawn);
    const halfChar = getCharSize() / 2;
    animatedX.setValue(spawn.x - halfChar);
    animatedY.setValue(spawn.y - halfChar);
    setCharacterDirection('down');
    setCurrentLocation(`${newMap.name} ${newMap.icon}`);

    // Log floor change activity (fire-and-forget)
    gameDatabaseService.logActivity({
      activityType: 'floor_change',
      mapId: floorId,
      details: { from: previousMapId, to: floorId },
      sessionId: activeSessionId,
    });

    // Tutorial: mark floor change conditions
    if (tutorialActive && gameMode === 'tutorial') {
      if (floorId === 'mall_2f') markTutorialCondition('arrived_at_mall_2f');
      if (floorId === 'mall_3f') markTutorialCondition('arrived_at_mall_3f');
      // Track going down an escalator (from higher to lower floor)
      if ((previousMapId === 'mall_3f' && floorId === 'mall_2f') ||
          (previousMapId === 'mall_2f' && floorId === 'mall_1f')) {
        markTutorialCondition('went_down_escalator');
      }
    }
  };

  // Reference to store the current movement path
  const movementPathRef = useRef([]);
  const isMovingRef = useRef(false);
  const targetDestinationRef = useRef(null); // Store the original tap destination
  const currentAnimationRef = useRef(null); // Track current animation for cancellation

  // Calculate a simple path from current position to target (tile by tile)
  const calculatePath = (fromX, fromY, toX, toY) => {
    if (!collisionSystem.initialized) {
      // If no collision system, just return direct path
      return [{ x: toX, y: toY }];
    }

    const fromTile = collisionSystem.pixelsToTiles(fromX, fromY, contentSize.width, contentSize.height);
    const toTile = collisionSystem.pixelsToTiles(toX, toY, contentSize.width, contentSize.height);
    
    console.log(`📍 Calculating path from tile (${fromTile.x}, ${fromTile.y}) to (${toTile.x}, ${toTile.y})`);
    
    const path = [];
    let currentX = fromTile.x;
    let currentY = fromTile.y;
    
    // Simple pathfinding: move towards target one tile at a time
    // This uses a greedy approach - always move towards the goal
    const maxSteps = 100; // Prevent infinite loops
    let steps = 0;
    
    while ((currentX !== toTile.x || currentY !== toTile.y) && steps < maxSteps) {
      steps++;
      
      // Determine best direction to move
      const dx = toTile.x - currentX;
      const dy = toTile.y - currentY;
      
      // Try to move in the primary direction first
      let moved = false;
      const directions = [];
      
      // Prioritize movement based on larger distance
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx > 0) directions.push({ x: 1, y: 0, name: 'right' });
        if (dx < 0) directions.push({ x: -1, y: 0, name: 'left' });
        if (dy > 0) directions.push({ x: 0, y: 1, name: 'down' });
        if (dy < 0) directions.push({ x: 0, y: -1, name: 'up' });
      } else {
        if (dy > 0) directions.push({ x: 0, y: 1, name: 'down' });
        if (dy < 0) directions.push({ x: 0, y: -1, name: 'up' });
        if (dx > 0) directions.push({ x: 1, y: 0, name: 'right' });
        if (dx < 0) directions.push({ x: -1, y: 0, name: 'left' });
      }
      
      // Try each direction
      for (const dir of directions) {
        const nextX = currentX + dir.x;
        const nextY = currentY + dir.y;
        
        // Check if the next tile is passable (also block NPC tiles)
        if (collisionSystem.isPassable(nextX, nextY) && !isNPCTile(nextX, nextY)) {
          // Check directional blocking from current tile
          if (!collisionSystem.isDirectionBlocked(currentX, currentY, dir.name)) {
            currentX = nextX;
            currentY = nextY;
            
            // Convert tile back to pixel coordinates
            const pixelPos = collisionSystem.tilesToPixels(currentX, currentY, contentSize.width, contentSize.height);
            path.push({ x: pixelPos.x, y: pixelPos.y, tileX: currentX, tileY: currentY });
            moved = true;
            break;
          }
        }
      }
      
      // If we couldn't move in any direction, stop pathfinding
      if (!moved) {
        console.log(`🚫 Path blocked at tile (${currentX}, ${currentY})`);
        break;
      }
    }
    
    console.log(`📍 Path calculated: ${path.length} steps`);
    return path;
  };

  // Move one tile along the path
  const moveOneStep = (targetPixelX, targetPixelY, onComplete) => {
    const halfChar = getCharSize() / 2;
    const targetX = targetPixelX - halfChar;
    const targetY = targetPixelY - halfChar;
    
    // Get current position from the animated value's current value
    // Using __getValue() to get current value without stopping animation
    const currentX = animatedX.__getValue() + halfChar;
    const currentY = animatedY.__getValue() + halfChar;
    
    // Calculate direction based on movement
    const deltaX = targetPixelX - currentX;
    const deltaY = targetPixelY - currentY;
    
    // Set character direction based on movement
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setCharacterDirection(deltaX > 0 ? 'right' : 'left');
    } else if (deltaY !== 0) {
      setCharacterDirection(deltaY > 0 ? 'down' : 'up');
    }
    
    // Duration per tile (consistent speed)
    const TILE_MOVE_DURATION = 200; // 200ms per tile

    // Animate movement to the next tile
    const animation = Animated.parallel([
      Animated.timing(animatedX, {
        toValue: targetX,
        duration: TILE_MOVE_DURATION,
        useNativeDriver: false,
        easing: Easing.linear,
      }),
      Animated.timing(animatedY, {
        toValue: targetY,
        duration: TILE_MOVE_DURATION,
        useNativeDriver: false,
        easing: Easing.linear,
      }),
    ]);
    
    // Store reference for potential cancellation
    currentAnimationRef.current = animation;
    
    animation.start(({ finished }) => {
      if (finished) {
        // Update character position state
        setCharacterPosition({ x: targetPixelX, y: targetPixelY });
        onComplete();
      }
    });
  };

  // Stop current movement and get current position
  const stopCurrentMovement = () => {
    // Stop any running animation
    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }
    
    // Clear the movement path
    movementPathRef.current = [];
    
    // Get current animated position values
    let currentX, currentY;
    const halfChar = getCharSize() / 2;
    animatedX.stopAnimation(value => { currentX = value + halfChar; });
    animatedY.stopAnimation(value => { currentY = value + halfChar; });
    
    // Update character position to current location
    setCharacterPosition({ x: currentX, y: currentY });
    
    return { x: currentX, y: currentY };
  };

  // Process the movement path step by step
  const processMovementPath = () => {
    if (movementPathRef.current.length === 0) {
      // Path complete
      isMovingRef.current = false;
      setIsWalking(false);
      
      // Only check for location action at the FINAL destination (where user tapped)
      if (targetDestinationRef.current) {
        const location = getLocationAtPosition(
          targetDestinationRef.current.x, 
          targetDestinationRef.current.y
        );
        if (location) {
          console.log(`✅ Character reached tapped destination: ${location.name}!`);
          handleLocationAction(location);
        }
        targetDestinationRef.current = null; // Clear the target
      }
      return;
    }
    
    // Get next step
    const nextStep = movementPathRef.current.shift();
    
    // Update location display
    setCurrentLocation(getLocationName(nextStep.x, nextStep.y));
    
    console.log(`🚶 Moving to tile (${nextStep.tileX}, ${nextStep.tileY})`);
    
    // Move to next tile
    moveOneStep(nextStep.x, nextStep.y, () => {
      // Continue to next step (no intermediate event checks)
      processMovementPath();
    });
  };

  const handleScreenPress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Tutorial: mark 'walked' condition when user taps to move
    if (tutorialActive && gameMode === 'tutorial') {
      markTutorialCondition('walked');
    }
    
    console.log('===== TAP DEBUG =====');
    console.log('Current map:', currentMapId);
    console.log('Content dimensions:', contentSize.width, 'x', contentSize.height);
    console.log('Tap at:', locationX.toFixed(0), locationY.toFixed(0));
    console.log('Tap % of content:', (locationX/contentSize.width*100).toFixed(1) + '%', 'x', (locationY/contentSize.height*100).toFixed(1) + '%');
    
    // Check what location this tap is in
    const tapLocation = getLocationAtPosition(locationX, locationY);
    console.log('Tap location:', tapLocation ? tapLocation.name : 'None');
    console.log('====================');
    
    // If already moving, stop current movement and redirect to new destination
    let startPosition = characterPosition;
    if (isWalking || isMovingRef.current) {
      console.log('🔄 Redirecting to new destination');
      startPosition = stopCurrentMovement();
    }

    // For maps with collision, use tile-by-tile movement
    if (collisionSystem.initialized) {
      // Get tile info for debugging
      const tileCoords = collisionSystem.pixelsToTiles(
        locationX, 
        locationY, 
        contentSize.width, 
        contentSize.height
      );
      const tileInfo = collisionSystem.getTileInfo(tileCoords.x, tileCoords.y);
      console.log('🧱 Target tile info:', JSON.stringify(tileInfo));
      
      // Check if destination tile is passable (also treat NPC tiles as blocked)
      if (!tileInfo.passable || isNPCTile(tileCoords.x, tileCoords.y)) {
        console.log('🚫 Destination tile is not passable (or occupied by NPC)!');
        // Find nearest passable position (excluding NPC tiles)
        const nearestPassable = findNearestPassableExcludingNPCs(
          locationX, 
          locationY
        );
        
        // Store the original tap destination (for event checking)
        targetDestinationRef.current = { x: locationX, y: locationY };
        
        // Calculate path to nearest passable position instead
        const path = calculatePath(
          startPosition.x, 
          startPosition.y, 
          nearestPassable.x, 
          nearestPassable.y
        );
        
        if (path.length === 0) {
          console.log('🚫 No valid path found!');
          targetDestinationRef.current = null;
          return;
        }
        
        // Start tile-by-tile movement
        movementPathRef.current = path;
        isMovingRef.current = true;
        setIsWalking(true);
        processMovementPath();
        return;
      }
      
      // Store the tap destination (for event checking when movement completes)
      targetDestinationRef.current = { x: locationX, y: locationY };
      
      // Calculate path to destination
      const path = calculatePath(
        startPosition.x, 
        startPosition.y, 
        locationX, 
        locationY
      );
      
      if (path.length === 0) {
        console.log('🚫 No valid path found or already at destination!');
        targetDestinationRef.current = null;
        return;
      }
      
      // Start tile-by-tile movement
      movementPathRef.current = path;
      isMovingRef.current = true;
      setIsWalking(true);
      processMovementPath();
      
    } else {
      // For maps without collision (school), use direct movement
      setIsWalking(true);
      setCurrentLocation(getLocationName(locationX, locationY));
      
      const halfChar = getCharSize() / 2;
      const targetX = locationX - halfChar;
      const targetY = locationY - halfChar;
      
      const currentX = startPosition.x;
      const currentY = startPosition.y;
      const distance = Math.sqrt(
        Math.pow(locationX - currentX, 2) + Math.pow(locationY - currentY, 2)
      );
      
      const duration = Math.max(500, distance * 3);
      
      setCharacterPosition({ x: locationX, y: locationY });
      
      const animation = Animated.parallel([
        Animated.timing(animatedX, {
          toValue: targetX,
          duration: duration,
          useNativeDriver: false,
        }),
        Animated.timing(animatedY, {
          toValue: targetY,
          duration: duration,
          useNativeDriver: false,
        }),
      ]);
      
      currentAnimationRef.current = animation;
      
      animation.start(({ finished }) => {
        if (finished) {
          setIsWalking(false);
          
          const location = getLocationAtPosition(locationX, locationY);
          if (location) {
            console.log(`✅ Character reached ${location.name}!`);
            handleLocationAction(location);
          }
        }
      });
    }
  };

  // Level 2: Allocate money to a savings goal
  const allocateToGoal = (goalId, amount) => {
    const available = getRemainingWeeklyBudget();
    if (amount > available) {
      Alert.alert('Insufficient Funds', `You only have ₱${available.toFixed(2)} available.`);
      return;
    }
    
    // Update goal allocations
    setGoalAllocations(prev => ({
      ...prev,
      [goalId]: (prev[goalId] || 0) + amount
    }));
    
    // Update weekly spending (allocating counts as "spending" towards goals)
    setWeeklySpending(prev => prev + amount);
    
    // Update budget categories for tracking
    setBudgetCategories(prev => {
      const totalBudget = weeklyBudget;
      const totalSavings = Object.values(goalAllocations).reduce((sum, val) => sum + val, 0) + amount;
      
      return {
        needs: prev.needs,
        wants: prev.wants,
        savings: { ...prev.savings, spent: totalSavings }
      };
    });
    
    // Show allocation success feedback
    const goal = savingsGoals.find(g => g.id === goalId);
    const newTotal = (goalAllocations[goalId] || 0) + amount;
    const totalGoalTarget = savingsGoals.reduce((sum, g) => sum + g.target, 0);
    const totalAllocated = Object.values(goalAllocations).reduce((sum, val) => sum + val, 0) + amount;
    const overallProgress = totalGoalTarget > 0 ? ((totalAllocated / totalGoalTarget) * 100).toFixed(0) : 0;
    
    Alert.alert(
      '✅ Allocated!',
      `₱${amount} added to ${goal?.name || 'goal'}!\n\nOverall Progress: ${overallProgress}%`,
      [{ text: 'OK' }]
    );
    
    // NOTE: Level completion is only checked when the week ends (in useEffect),
    // NOT after each allocation. This allows players to keep allocating throughout the week.

    // ── Persist goal allocations to DB ──
    if (activeSessionId && (gameMode === 'story' || gameMode === 'custom')) {
      // Build updated allocations map (with this new allocation included)
      const updatedAllocations = { ...goalAllocations, [goalId]: (goalAllocations[goalId] || 0) + amount };
      const totalAllocatedNow = Object.values(updatedAllocations).reduce((sum, val) => sum + val, 0);

      if (gameMode === 'story') {
        // Build goals_data with per-goal allocated amounts for hydration
        const updatedGoalsData = savingsGoals.map(g => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          target: g.target,
          allocated: updatedAllocations[g.id] || 0,
        }));
        gameDatabaseService.updateStorySessionSpending(activeSessionId, {
          weeklySpending: weeklySpending + amount,
          totalAllocated: totalAllocatedNow,
          goalsData: updatedGoalsData,
          savingsAmount: weeklyBudget - (weeklySpending + amount),
        });
      } else {
        // Custom mode: save goals_progress array for hydration
        const goalsProgressArr = savingsGoals.map(g => ({
          name: g.name,
          target: g.target,
          allocated: updatedAllocations[g.id] || 0,
        }));
        gameDatabaseService.updateCustomSessionSpending(activeSessionId, {
          weeklySpending: weeklySpending + amount,
          goalsProgress: goalsProgressArr,
          savingsAmount: weeklyBudget - (weeklySpending + amount),
        });
      }
    }
  };

  const handleSubmitExpense = async () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    if (!expenseNote.trim()) {
      Alert.alert('Missing Details', 'Please describe what you bought.');
      return;
    }

    // Check if user is logged in
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to save expenses.');
      return;
    }

    // Capture values before clearing
    const savedAmount = expenseAmount;
    const savedNote = expenseNote;
    const savedCategory = expenseCategory;
    const currentDate = new Date();

    // Optimistic UI update - close modal immediately for seamless experience
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseNote('');

    // ── Tutorial mode: skip DB save, mark conditions ──
    if (tutorialActive && gameMode === 'tutorial') {
      Alert.alert(
        '🎓 Practice Expense!',
        `You practiced logging ₱${savedAmount} on ${savedCategory}.\n\nThis wasn't saved — great job learning!`,
        [{ text: 'OK' }]
      );
      // Mark tutorial conditions based on current map
      if (currentMapId === 'school') markTutorialCondition('school_expense_logged');
      if (currentMapId.startsWith('mall')) markTutorialCondition('mall_expense_logged');
      console.log('🎓 Tutorial: Skipped expense save (practice mode)');
      return;
    }

    // Show quick feedback toast-style (non-blocking)
    Alert.alert(
      '🎉 Purchase Recorded!',
      `You spent ₱${savedAmount} on ${savedCategory}.\n\n"${savedNote}"`,
      [{ text: 'OK' }]
    );

    // Save in background
    try {
      // Use DataContext's addExpense for proper syncing across the app
      const expenseData = {
        amount: parseFloat(savedAmount),
        category: savedCategory,
        note: `${savedNote} (at ${currentMap.name})`, // Include location in note
        date: currentDate.toISOString(), // Pass full ISO timestamp with date AND time
      };

      console.log('💾 Saving expense via DataContext:', JSON.stringify(expenseData));

      const success = await addExpense(expenseData);

      if (!success) {
        console.error('❌ Failed to save expense in background');
        // Optionally show error after the fact
        Alert.alert('Sync Error', 'Your expense may not have been saved. Please check your expenses list.');
      } else {
        console.log('✅ Expense saved successfully via DataContext');
        
        const expenseAmountNum = parseFloat(savedAmount);
        
        // Update category spending tracking (for all levels)
        setCategorySpending(prev => ({
          ...prev,
          [savedCategory]: (prev[savedCategory] || 0) + expenseAmountNum
        }));
        
        // Level 1 (Budgeting): Update 50/30/20 category budgets
        if ((gameMode === 'story' || gameMode === 'custom') &&
            (STORY_LEVELS[storyLevel]?.type === 'budgeting' || customModeType === 'budgeting')) {
          const budgetType = CATEGORY_BUDGET_MAP[savedCategory] || 'wants';
          setBudgetCategories(prev => ({
            ...prev,
            [budgetType]: {
              ...prev[budgetType],
              spent: prev[budgetType].spent + expenseAmountNum
            }
          }));
        }
        
        // Update expense stats and check achievements
        const newStats = {
          total: expenseStats.total + 1,
          foodCount: savedCategory === 'Food' ? expenseStats.foodCount + 1 : expenseStats.foodCount,
          shoppingCount: savedCategory === 'Shopping' ? expenseStats.shoppingCount + 1 : expenseStats.shoppingCount,
          electronicsCount: savedCategory === 'Electronics' ? expenseStats.electronicsCount + 1 : expenseStats.electronicsCount,
        };
        setExpenseStats(newStats);
        
        // Get category count for the saved category
        let categoryCount = 0;
        if (savedCategory === 'Food') categoryCount = newStats.foodCount;
        else if (savedCategory === 'Shopping') categoryCount = newStats.shoppingCount;
        else if (savedCategory === 'Electronics') categoryCount = newStats.electronicsCount;
        
        // Check expense achievements
        await checkAchievements('expense_recorded', {
          totalExpenses: newStats.total,
          category: savedCategory,
          categoryCount: categoryCount,
        });

        // ── Log expense to Supabase game_activity_log + update user_levels ──
        gameDatabaseService.logActivity({
          activityType: 'expense_recorded',
          mapId: currentMapId,
          locationId: currentLocation,
          amount: expenseAmountNum,
          details: { category: savedCategory, note: savedNote },
          sessionId: activeSessionId,
        });
        gameDatabaseService.incrementUserLevelStats({ expensesRecorded: 1 });

        // Update session spending if in story/custom mode
        if (activeSessionId && (gameMode === 'story' || gameMode === 'custom')) {
          const updatedSpending = weeklySpending + expenseAmountNum;
          const updatedCategorySpending = { ...categorySpending, [savedCategory]: (categorySpending[savedCategory] || 0) + expenseAmountNum };
          
          // Calculate updated needs/wants spent
          const budgetType = CATEGORY_BUDGET_MAP[savedCategory] || 'wants';
          const updatedNeedsSpent = budgetCategories.needs.spent + (budgetType === 'needs' ? expenseAmountNum : 0);
          const updatedWantsSpent = budgetCategories.wants.spent + (budgetType === 'wants' ? expenseAmountNum : 0);
          
          if (gameMode === 'story') {
            gameDatabaseService.updateStorySessionSpending(activeSessionId, {
              weeklySpending: updatedSpending,
              categorySpending: updatedCategorySpending,
              needsSpent: updatedNeedsSpent,
              wantsSpent: updatedWantsSpent,
              savingsAmount: weeklyBudget - updatedSpending,
            });
          } else {
            gameDatabaseService.updateCustomSessionSpending(activeSessionId, {
              weeklySpending: updatedSpending,
              categorySpending: updatedCategorySpending,
              needsSpent: updatedNeedsSpent,
              wantsSpent: updatedWantsSpent,
              savingsAmount: weeklyBudget - updatedSpending,
            });
          }
        }
      }

      fetchTodaySpending(); // Refresh spending total
    } catch (error) {
      console.error('❌ Error saving expense:', error);
      Alert.alert(
        'Sync Error', 
        `Your expense may not have been saved: ${error.message || 'Unknown error'}`
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a2e',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backToMenuButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#E67E22',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    giveUpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#C62828',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      marginRight: 8,
      gap: 4,
    },
    giveUpButtonText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: 'bold',
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    headerSubtitle: {
      fontSize: 12,
      color: '#888',
      marginTop: 2,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    spendingLabel: {
      fontSize: 11,
      color: '#888',
      marginBottom: 2,
    },
    spendingAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FF9800',
    },
    settingsGearButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(90, 90, 122, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationBadge: {
      position: 'absolute',
      top: 70,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      zIndex: 100,
    },
    locationText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    walkingIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4CAF50',
    },
    // Story Mode Progress Bar Styles - Top compact strip below header
    storyProgressContainer: {
      position: 'absolute',
      top: 135,
      left: 8,
      right: 8,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderRadius: 12,
      padding: 10,
      zIndex: 50,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 10,
    },
    storyProgressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    storyProgressLabel: {
      color: '#F5DEB3',
      fontSize: 12,
      fontWeight: '600',
    },
    storyProgressPercent: {
      color: '#4CAF50',
      fontSize: 12,
      fontWeight: 'bold',
    },
    storyProgressBar: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
    },
    storyProgressFill: {
      height: '100%',
      borderRadius: 4,
    },
    storyProgressGoalMarker: {
      position: 'absolute',
      top: -2,
      width: 3,
      height: 12,
      backgroundColor: '#FF9800',
      marginLeft: -1.5,
    },
    // Level 1 - Compact Budget Indicators
    budgetHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    budgetRuleLabel: {
      color: '#F5DEB3',
      fontSize: 13,
      fontWeight: '700',
    },
    budgetDaysLeft: {
      color: '#888',
      fontSize: 11,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    budgetCategoriesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    budgetCategoryCard: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
    },
    budgetCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
    },
    budgetCategoryName: {
      color: '#AAA',
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    budgetCategoryPercent: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    budgetCategoryLimit: {
      fontSize: 9,
      color: '#666',
      marginTop: 2,
    },
    budgetMiniBar: {
      width: '100%',
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 2,
      marginTop: 6,
      overflow: 'hidden',
    },
    budgetMiniBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    // Ultra-compact single-row budget styles
    budgetCompactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    budgetCompactLabel: {
      color: '#F5DEB3',
      fontSize: 12,
      fontWeight: '600',
    },
    budgetCompactStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      justifyContent: 'center',
    },
    budgetCompactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    budgetItemOk: {
      borderWidth: 1,
      borderColor: '#4CAF50',
    },
    budgetCompactIcon: {
      fontSize: 12,
    },
    budgetCompactPercent: {
      fontSize: 13,
      fontWeight: 'bold',
    },
    budgetCompactActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetCompactDays: {
      color: '#888',
      fontSize: 11,
      fontWeight: '600',
    },
    endWeekBtnCompact: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#E74C3C',
      justifyContent: 'center',
      alignItems: 'center',
    },
    savingsCompactProgress: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 12,
    },
    savingsCompactBar: {
      flex: 1,
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    savingsCompactFill: {
      height: '100%',
      borderRadius: 4,
    },
    // Legacy budget bar styles (kept for other uses)
    budgetBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetBarLabel: {
      color: '#F5DEB3',
      fontSize: 10,
      width: 85,
    },
    budgetBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    budgetBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    budgetBarGoalMarker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 10,
      backgroundColor: '#FFF',
      marginLeft: -1,
    },
    budgetBarLimit: {
      color: '#888',
      fontSize: 9,
      width: 30,
      textAlign: 'right',
    },
    // Level 2 - Goal Progress Styles
    goalProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    goalProgressIcon: {
      fontSize: 16,
    },
    goalProgressName: {
      color: '#F5DEB3',
      fontSize: 11,
      marginBottom: 2,
    },
    goalProgressTrack: {
      height: 5,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    goalProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    goalProgressAmount: {
      color: '#888',
      fontSize: 10,
      minWidth: 70,
      textAlign: 'right',
    },
    allocateButton: {
      backgroundColor: '#3498DB',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignSelf: 'center',
      marginTop: 8,
    },
    allocateButtonText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '600',
    },
    // Goal Allocation Modal Styles
    goalAllocationItem: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: 12,
    },
    quickAllocateBtn: {
      backgroundColor: '#3498DB',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    quickAllocateBtnText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '600',
    },
    imageBackground: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    contentContainer: {
      flex: 1,
    },
    character: {
      position: 'absolute',
      width: CHARACTER_SIZE,
      height: CHARACTER_SIZE,
      borderRadius: CHARACTER_SIZE / 2,
      backgroundColor: isWalking ? '#66BB6A' : '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: isWalking ? '#388E3C' : '#2E7D32',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 100,
      zIndex: 999,
    },
    // Sprite-based character styles
    characterContainer: {
      position: 'absolute',
      // width and height set dynamically in renderCharacter to match on-screen tile size
      justifyContent: 'flex-end', // Anchor sprite at bottom — feet align with tile edge
      alignItems: 'center',
      overflow: 'visible', // Allow sprite to extend above tile bounds
      zIndex: 1000,
      elevation: 100,
    },
    spriteContainer: {
      width: 48,
      height: 90, // Full sprite height
      overflow: 'hidden',
      transform: [{ scale: 48 / 90 }], // Scale down to fit within 48px tile (≈0.53)
    },
    characterSprite: {
      width: 48 * 24, // Full spritesheet width (24 frames)
      height: 90, // Full sprite height
    },
    characterFace: {
      fontSize: 24,
    },
    // Closet Modal - Character Selection Styles
    characterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 16,
      padding: 12,
      borderWidth: 3,
      gap: 12,
    },
    characterOptionSelected: {
      backgroundColor: 'rgba(155, 89, 182, 0.1)',
    },
    characterOptionLocked: {
      opacity: 0.7,
      backgroundColor: 'rgba(100,100,100,0.1)',
    },
    lockedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
    },
    characterPreviewContainer: {
      width: 64,
      height: 80,
      borderRadius: 12,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    characterPreviewSprite: {
      width: 48 * 24,
      height: 64,
      transform: [{ translateX: -(18 * 48) }], // Show down-facing idle frame
    },
    characterOptionInfo: {
      flex: 1,
    },
    characterOptionName: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    characterOptionDesc: {
      fontSize: 13,
    },
    characterSelectedBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingButton: {
      position: 'absolute',
      bottom: 100,
      right: 20,
      backgroundColor: '#FF9800',
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 10,
      borderWidth: 3,
      borderColor: '#FFF',
    },
    endWeekButton: {
      position: 'absolute',
      bottom: 35,
      left: 20,
      backgroundColor: '#E74C3C',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 10,
      borderWidth: 2,
      borderColor: '#FFF',
    },
    endWeekButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
    endWeekButtonInline: {
      marginTop: 12,
      backgroundColor: '#E74C3C',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    endWeekButtonTextInline: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '600',
    },
    instructionBanner: {
      position: 'absolute',
      bottom: 30,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.85)',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    instructionText: {
      flex: 1,
      color: '#fff',
      fontSize: 13,
      lineHeight: 18,
    },
    instructionHighlight: {
      color: '#FF9800',
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    },
    modalIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FF9800',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderText: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 8,
    },
    quickAmountsContainer: {
      marginBottom: 16,
    },
    quickAmountsLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    quickAmountsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    quickAmountButton: {
      flex: 1,
      backgroundColor: colors.background,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickAmountButtonActive: {
      backgroundColor: '#FF9800',
      borderColor: '#FF9800',
    },
    quickAmountText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    quickAmountTextActive: {
      color: '#fff',
    },
    inputContainer: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.border,
    },
    submitButton: {
      backgroundColor: '#FF9800',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    cancelButtonText: {
      color: colors.text,
    },
    submitButtonText: {
      color: 'white',
    },
    // Travel Modal Styles
    travelModalContent: {
      width: '90%',
      maxWidth: 350,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      alignItems: 'center',
    },
    travelTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    travelSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    destinationButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    destinationIcon: {
      fontSize: 32,
      marginRight: 16,
    },
    destinationInfo: {
      flex: 1,
    },
    destinationName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    destinationDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    travelCancelButton: {
      marginTop: 8,
      padding: 12,
    },
    travelCancelText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    // Achievement Modal styles
    achievementModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    achievementModalContent: {
      width: '85%',
      maxWidth: 340,
      backgroundColor: '#1a1a2e',
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#FFD700',
      shadowColor: '#FFD700',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 15,
    },
    achievementGlow: {
      position: 'absolute',
      top: -50,
      width: 200,
      height: 200,
      backgroundColor: '#FFD700',
      borderRadius: 100,
      opacity: 0.1,
    },
    achievementUnlockedText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFD700',
      marginBottom: 16,
      letterSpacing: 2,
    },
    achievementIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    achievementTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    achievementDescription: {
      fontSize: 14,
      color: '#B0B0B0',
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 20,
    },
    achievementPoints: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 20,
      gap: 8,
    },
    achievementPointsText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFD700',
    },
    achievementCloseButton: {
      backgroundColor: '#FFD700',
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: 25,
    },
    achievementCloseText: {
      color: '#1a1a2e',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Map indicator styles
    mapIndicatorContainer: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      zIndex: 50,
    },
    locationMarker: {
      backgroundColor: 'rgba(255, 152, 0, 0.9)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 2,
      borderColor: '#FFF',
    },
    locationMarkerText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '700',
    },
    // Placeholder map background
    placeholderMap: {
      flex: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderMapText: {
      fontSize: 64,
      marginBottom: 16,
    },
    placeholderMapTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFF',
      marginBottom: 8,
    },
    placeholderMapHint: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.7)',
    },
  });

  // Get color for location based on action type
  const getLocationColor = (action, index) => {
    const colors = {
      travel: 'rgba(52, 152, 219, 0.4)',    // Blue for doors/exits
      expense: [
        'rgba(231, 76, 60, 0.4)',            // Red
        'rgba(46, 204, 113, 0.4)',           // Green
        'rgba(155, 89, 182, 0.4)',           // Purple
        'rgba(241, 196, 15, 0.4)',           // Yellow
        'rgba(230, 126, 34, 0.4)',           // Orange
      ],
      info: 'rgba(149, 165, 166, 0.4)',     // Gray for info
    };
    
    if (action === 'expense') {
      return colors.expense[index % colors.expense.length];
    }
    return colors[action] || 'rgba(255, 255, 255, 0.3)';
  };

  // Get border color for location
  const getLocationBorderColor = (action, index) => {
    const colors = {
      travel: '#3498DB',    // Blue for doors/exits
      expense: [
        '#E74C3C',          // Red
        '#2ECC71',          // Green
        '#9B59B6',          // Purple
        '#F1C40F',          // Yellow
        '#E67E22',          // Orange
      ],
      info: '#95A5A6',      // Gray for info
    };
    
    if (action === 'expense') {
      return colors.expense[index % colors.expense.length];
    }
    return colors[action] || '#FFFFFF';
  };

  // Render location collision overlays
  const renderLocationOverlays = () => {
    return currentMap.locations.map((loc, index) => {
      const bounds = loc.bounds;
      return (
        <View
          key={`overlay-${loc.id}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${bounds.left * 100}%`,
            top: `${bounds.top * 100}%`,
            width: `${(bounds.right - bounds.left) * 100}%`,
            height: `${(bounds.bottom - bounds.top) * 100}%`,
            backgroundColor: getLocationColor(loc.action, index),
            borderWidth: 2,
            borderColor: getLocationBorderColor(loc.action, index),
            borderStyle: 'dashed',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1100,
            elevation: 110,
          }}
        >
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}>
            <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center' }}>
              {loc.icon}
            </Text>
            <Text style={{ color: '#FFF', fontSize: 10, textAlign: 'center', fontWeight: 'bold' }}>
              {loc.name}
            </Text>
          </View>
        </View>
      );
    });
  };

  // Calculate map display dimensions to match resizeMode="contain" layout
  const getMapDisplayDimensions = useCallback(() => {
    if (!collisionSystem.initialized) return null;

    const mapPixelWidth = collisionSystem.mapWidth * collisionSystem.tileSize;
    const mapPixelHeight = collisionSystem.mapHeight * collisionSystem.tileSize;

    const scaleX = contentSize.width / mapPixelWidth;
    const scaleY = contentSize.height / mapPixelHeight;
    const scale = Math.min(scaleX, scaleY);

    const displayedWidth = mapPixelWidth * scale;
    const displayedHeight = mapPixelHeight * scale;

    const offsetX = (contentSize.width - displayedWidth) / 2;
    const offsetY = (contentSize.height - displayedHeight) / 2;

    const tileDisplaySize = collisionSystem.tileSize * scale;

    return { scale, displayedWidth, displayedHeight, offsetX, offsetY, tileDisplaySize };
  }, [contentSize.width, contentSize.height]);

  // Render wall tile overlays above the character to prevent sprite overlapping walls
  const renderWallOverlays = () => {
    if (!collisionSystem.initialized || !currentMap.image) return null;

    const dims = getMapDisplayDimensions();
    if (!dims || dims.tileDisplaySize <= 0) return null;

    // Get character's current tile position
    const charTile = collisionSystem.pixelsToTiles(
      characterPosition.x, characterPosition.y,
      contentSize.width, contentSize.height
    );

    const overlays = [];
    const OVERLAY_RANGE = 2; // Check tiles within 2 tiles of character

    for (let dy = -OVERLAY_RANGE; dy <= OVERLAY_RANGE; dy++) {
      for (let dx = -OVERLAY_RANGE; dx <= OVERLAY_RANGE; dx++) {
        const tileX = charTile.x + dx;
        const tileY = charTile.y + dy;

        // Skip out-of-bounds tiles
        if (tileX < 0 || tileX >= collisionSystem.mapWidth ||
            tileY < 0 || tileY >= collisionSystem.mapHeight) continue;

        // Skip passable tiles — only overlay non-passable tiles (walls, tables, furniture)
        if (collisionSystem.isPassable(tileX, tileY)) continue;

        // Only render overlays for tiles that need to appear IN FRONT of the character.
        // Tiles above/same Y don't need overlays — the character naturally renders on top
        // of the background there. Rendering unnecessary overlays caused visible
        // distortion because the overlay image couldn't align pixel-perfectly with the
        // background (different resizeMode pipelines, rounding, etc.).
        if (tileY <= charTile.y) continue;

        // Calculate screen position for this tile — no rounding so the fractional
        // position matches the native "contain" layout of the background image.
        const screenX = dims.offsetX + tileX * dims.tileDisplaySize;
        const screenY = dims.offsetY + tileY * dims.tileDisplaySize;

        overlays.push(
          <View
            key={`wall-${tileX}-${tileY}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: dims.tileDisplaySize,
              height: dims.tileDisplaySize,
              overflow: 'hidden',
              zIndex: 1001,
              elevation: 101,
            }}
          >
            {/* Use the full container size + resizeMode="contain" so the image goes
                through the exact same native scaling pipeline as the ImageBackground,
                guaranteeing pixel-perfect alignment. */}
            <Image
              source={currentMap.image}
              style={{
                position: 'absolute',
                left: -screenX,
                top: -screenY,
                width: contentSize.width,
                height: contentSize.height,
              }}
              resizeMode="contain"
            />
          </View>
        );
      }
    }

    return overlays;
  };

  // ─── Render NPCs (static workers) on the current map ──────────────
  const renderNPCs = () => {
    const npcs = NPC_POSITIONS[currentMapId];
    if (!npcs || npcs.length === 0 || !collisionSystem.initialized) return null;

    const dims = getMapDisplayDimensions();
    if (!dims || dims.tileDisplaySize <= 0) return null;

    const charSize = getCharSize();
    const CHAR_VISUAL_SCALE = 0.9; // Same scale as the player character
    const FRAME_W = 48;
    const FRAME_H = 90;
    const TOTAL_FRAMES = 24;
    const spriteScale = (charSize * CHAR_VISUAL_SCALE) / FRAME_W;
    const scaledFrameW = FRAME_W * spriteScale;
    const scaledFrameH = FRAME_H * spriteScale;
    const halfChar = charSize / 2;

    // Get character tile for depth sorting
    const charTile = collisionSystem.pixelsToTiles(
      characterPosition.x, characterPosition.y,
      contentSize.width, contentSize.height
    );

    return npcs.map((npc) => {
      const spriteSource = NPC_SPRITES[npc.sprite];
      if (!spriteSource) return null;

      // Idle frame (frame 0) for the NPC's facing direction
      const dirOffset = SPRITE_CONFIG.directions[npc.direction] ?? SPRITE_CONFIG.directions.down;
      const npcSpriteX = -(dirOffset * FRAME_W);

      // Convert tile position → screen pixel position (center of tile)
      const pixelPos = collisionSystem.tilesToPixels(
        npc.tileX, npc.tileY,
        contentSize.width, contentSize.height
      );
      const npcLeft = pixelPos.x - halfChar;
      const npcTop  = pixelPos.y - halfChar;

      // Depth: NPC below player → in front; NPC above/same → behind
      const inFront = npc.tileY > charTile.y;
      const npcZ = inFront ? 1001 : 999;

      return (
        <View
          key={`npc-${npc.id}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: charSize,
            height: charSize,
            left: npcLeft,
            top: npcTop,
            justifyContent: 'flex-end',
            alignItems: 'center',
            overflow: 'visible',
            zIndex: npcZ,
            elevation: inFront ? 101 : 99,
          }}
        >
          <View style={{ width: scaledFrameW, height: scaledFrameH, overflow: 'hidden' }}>
            <Image
              source={spriteSource}
              style={{
                width: FRAME_W * TOTAL_FRAMES * spriteScale,
                height: FRAME_H * spriteScale,
                transform: [{ translateX: npcSpriteX * spriteScale }],
              }}
              resizeMode="cover"
            />
          </View>
        </View>
      );
    });
  };

  // Render map content based on current map
  const renderMapContent = () => {
    // Calculate sprite frame offset
    // Use ?? instead of || because 'right' direction has offset 0, and 0 || fallback would incorrectly use fallback
    const directionOffset = SPRITE_CONFIG.directions[characterDirection] ?? SPRITE_CONFIG.directions.down;
    const frameOffset = directionOffset + currentFrame;
    const spriteX = -(frameOffset * SPRITE_CONFIG.frameWidth);
    
    const characterSprite = CHARACTER_SPRITES[selectedCharacter];
    
    const renderCharacter = () => {
      const charSize = getCharSize();
      const CHAR_VISUAL_SCALE = 0.9; // Visual scale: <1 = smaller, 1 = full tile size
      const FRAME_W = 48;  // Sprite frame width in source image
      const FRAME_H = 90;  // Sprite frame height in source image
      const TOTAL_FRAMES = 24;
      const spriteScale = (charSize * CHAR_VISUAL_SCALE) / FRAME_W;
      const scaledFrameW = FRAME_W * spriteScale;
      const scaledFrameH = FRAME_H * spriteScale;

      return (
        <Animated.View
          style={[
            styles.characterContainer,
            {
              width: charSize,
              height: charSize,
              left: animatedX,
              top: animatedY,
              transform: [{ scale: walkingPulse }],
            },
          ]}
        >
          <View style={{
            width: scaledFrameW,
            height: scaledFrameH,
            overflow: 'hidden',
          }}>
            <Image
              source={characterSprite.sprite}
              style={{
                width: FRAME_W * TOTAL_FRAMES * spriteScale,
                height: FRAME_H * spriteScale,
                transform: [{ translateX: spriteX * spriteScale }],
              }}
              resizeMode="cover"
            />
          </View>
        </Animated.View>
      );
    };
    
    if (currentMap.image) {
      return (
        <ImageBackground
          source={currentMap.image}
          style={styles.imageBackground}
          resizeMode="contain"
        >
          <TouchableWithoutFeedback onPress={handleScreenPress}>
            <View style={styles.contentContainer} onLayout={handleContentLayout}>
              {/* Location Collision Overlays - Debug visualization */}
              {renderLocationOverlays()}

              {/* NPC Workers */}
              {renderNPCs()}

              {/* Character with Sprite Animation */}
              {renderCharacter()}

              {/* Wall tile overlays - rendered above character to prevent wall overlap */}
              {renderWallOverlays()}
            </View>
          </TouchableWithoutFeedback>
        </ImageBackground>
      );
    } else {
      // Placeholder for maps without images
      return (
        <View style={[styles.placeholderMap, { backgroundColor: currentMap.backgroundColor || '#2C3E50' }]}>
          <TouchableWithoutFeedback onPress={handleScreenPress}>
            <View style={styles.contentContainer} onLayout={handleContentLayout}>
              {/* Location Collision Overlays - Debug visualization */}
              {renderLocationOverlays()}

              {/* Map placeholder info */}
              <View style={{ position: 'absolute', top: contentSize.height * 0.15, alignSelf: 'center', alignItems: 'center' }}>
                <Text style={styles.placeholderMapText}>{currentMap.icon}</Text>
                <Text style={styles.placeholderMapTitle}>{currentMap.name}</Text>
                <Text style={styles.placeholderMapHint}>Tap to move around</Text>
              </View>

              {/* NPC Workers */}
              {renderNPCs()}

              {/* Character with Sprite Animation */}
              {renderCharacter()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      );
    }
  };

  // ─── Resume helpers (Bug 1 + Bug 3 fix) ──────────────────

  /**
   * Apply a cached/fetched story session to component state and navigate to gameplay.
   * This avoids creating a duplicate session.
   */
  const resumeStorySession = (session) => {
    const levelConfig = STORY_LEVELS[session.level];
    if (!levelConfig) return;

    setGameMode('story');
    setActiveSessionId(session.id);
    setStoryLevel(session.level);
    setWeeklyBudget(session.weekly_budget || 0);
    setStoryStartDate(new Date(session.start_date));
    setStoryEndDate(new Date(session.end_date));
    setWeeklySpending(session.weekly_spending || 0);
    if (session.category_spending) setCategorySpending(session.category_spending);
    if (session.needs_spent != null || session.wants_spent != null) {
      setBudgetCategories({
        needs:   { budget: session.needs_budget || 0, spent: session.needs_spent || 0 },
        wants:   { budget: session.wants_budget || 0, spent: session.wants_spent || 0 },
        savings: { budget: session.savings_budget || 0, spent: 0 },
      });
    }
    if (session.goals_data) {
      setSavingsGoals(session.goals_data);
      const allocs = {};
      session.goals_data.forEach(g => { allocs[g.id] = g.allocated || 0; });
      setGoalAllocations(allocs);
    }

    setShowStoryIntro(false);
    setShowMainMenu(false);
    setCurrentMapId('dorm');
    console.log(`🔄 Resumed active story session ${session.id} (Level ${session.level})`);
  };

  /**
   * Apply a cached/fetched custom session to component state and navigate to gameplay.
   */
  const resumeCustomSession = (session) => {
    setGameMode('custom');
    setActiveSessionId(session.id);
    setWeeklyBudget(session.weekly_budget || 0);
    setStoryStartDate(new Date(session.start_date));
    setStoryEndDate(new Date(session.end_date));
    setWeeklySpending(session.weekly_spending || 0);
    if (session.category_spending) setCategorySpending(session.category_spending);
    if (session.custom_rules) setCustomBudgetRules(session.custom_rules);

    const modeType = session.mode_type;
    if (modeType) setCustomModeType(modeType);
    if (modeType === 'budgeting') {
      setStoryLevel(1);
      const rules = session.custom_rules || { needs: 50, wants: 30, savings: 20 };
      setBudgetCategories({
        needs:   { budget: (session.weekly_budget || 0) * (rules.needs / 100), spent: parseFloat(session.needs_spent) || 0 },
        wants:   { budget: (session.weekly_budget || 0) * (rules.wants / 100), spent: parseFloat(session.wants_spent) || 0 },
        savings: { budget: (session.weekly_budget || 0) * (rules.savings / 100), spent: 0 },
      });
    } else if (modeType === 'goals') {
      setStoryLevel(2);
      if (session.custom_goals) {
        const goals = session.custom_goals.map((g, i) => ({
          id: `custom_${i}`, name: g.name, icon: ['🎯','💎','🌟','🎁','✨'][i % 5], target: g.target || 0
        }));
        setSavingsGoals(goals);
        // Restore customGoals form state so Settings modal shows correct data
        setCustomGoals(session.custom_goals.map(g => ({ name: g.name, target: String(g.target || '') })));
        const allocs = {};
        goals.forEach(g => { allocs[g.id] = 0; });
        if (session.goals_progress) {
          session.goals_progress.forEach(gp => {
            const matchGoal = goals.find(g => g.name === gp.name);
            if (matchGoal) allocs[matchGoal.id] = gp.allocated || 0;
          });
        }
        setGoalAllocations(allocs);
      }
    } else if (modeType === 'saving') {
      setStoryLevel(3);
      if (session.custom_savings_target != null) {
        setCustomSavingsTarget(String(session.custom_savings_target));
      }
    }

    setShowCustomSetup(false);
    setShowMainMenu(false);
    setCurrentMapId('dorm');
    console.log(`🔄 Resumed active custom session ${session.id} (${modeType})`);
  };

  /**
   * Unified handler when the user taps a story level button.
   * 1. Checks for an existing active session → resumes if found (Bug 3 fix)
   * 2. Checks if the level intro has been seen → skips intro if true (Bug 2 fix)
   * 3. Otherwise shows the intro dialogue
   */
  const handleLevelSelect = async (level) => {
    // 1. Check cached active session first, then fall back to DB query
    let activeSession = null;
    const cached = cachedActiveStoryRef.current;
    if (cached && cached.level === level && cached.status === 'in_progress') {
      activeSession = cached;
    } else {
      // Query DB for an in-progress session for this specific level
      activeSession = await gameDatabaseService.findActiveStorySession(level);
    }

    if (activeSession) {
      // Resume existing session — no data reset
      resumeStorySession(activeSession);
      return;
    }

    // 2. No active session — check if level intro has already been seen
    const key = `level_intro_seen_${user?.id}_${level}`;
    const seen = await AsyncStorage.getItem(key);
    if (seen === 'true') {
      // Skip intro, start a brand-new level directly
      startStoryLevel(level);
    } else {
      // Show the intro dialogue (first time)
      openLevelIntro(level);
    }
  };

  // Handle menu button press
  const handleStoryMode = async () => {
    // Gate behind tutorial completion
    if (!tutorialCompleted) {
      Alert.alert(
        '🎓 Tutorial Required',
        'Please complete the Tutorial first to learn the basics before starting Story Mode!',
        [
          { text: 'Start Tutorial', onPress: startTutorial },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    // Clear any leftover tutorial state
    if (tutorialActive) {
      setTutorialActive(false);
      setTutorialStep(0);
    }

    // ── Single Active Session: auto-resume if an in-progress session exists ──
    let activeSession = cachedActiveStoryRef.current;
    if (!activeSession) {
      activeSession = await gameDatabaseService.findAnyActiveStorySession();
    }
    if (activeSession && activeSession.status === 'in_progress') {
      // Bypass level selection — go straight to the active level
      resumeStorySession(activeSession);
      return;
    }

    // No active session — show level selection
    setGameMode('story');
    setShowStoryIntro(true);
  };

  // ── Abandon / End Session ────────────────────────────────
  const handleAbandonSession = () => {
    setShowAbandonModal(true);
  };

  const handleConfirmAbandon = async () => {
    setShowAbandonModal(false);

    // Mark the active session as 'abandoned' in the database
    if (activeSessionId) {
      if (gameMode === 'story') {
        await gameDatabaseService.abandonStorySession(activeSessionId);
        gameDatabaseService.logActivity({
          activityType: 'session_abandoned',
          sessionId: activeSessionId,
          details: { level: storyLevel, mode: 'story' },
        });
      } else if (gameMode === 'custom') {
        await gameDatabaseService.abandonCustomSession(activeSessionId);
        gameDatabaseService.logActivity({
          activityType: 'session_abandoned',
          sessionId: activeSessionId,
          details: { mode: 'custom', modeType: customModeType },
        });
      }
    }

    // Clear cached active sessions
    if (gameMode === 'story') cachedActiveStoryRef.current = null;
    if (gameMode === 'custom') cachedActiveCustomRef.current = null;

    // Reset game state and return to main menu
    setActiveSessionId(null);
    setWeeklyBudget(0);
    setWeeklySpending(0);
    setStoryStartDate(null);
    setStoryEndDate(null);
    setLevelResults(null);
    setGameMode(null);
    setShowMainMenu(true);
  };

  // Open the Pokémon-style pre-level intro for a given level
  const openLevelIntro = (level) => {
    setIntroLevel(level);
    setIntroPage(0);
    setIntroDisplayedText('');
    setIntroTypingDone(false);
    setShowLevelIntro(true);
  };

  // Typewriter effect — run whenever introPage or showLevelIntro changes
  useEffect(() => {
    if (!showLevelIntro || introLevel === null) return;
    const scripts = LEVEL_INTRO_SCRIPTS[introLevel];
    if (!scripts || introPage >= scripts.length) return;

    const fullText = scripts[introPage].text;
    let charIndex = 0;
    setIntroDisplayedText('');
    setIntroTypingDone(false);

    introTimerRef.current = setInterval(() => {
      charIndex++;
      setIntroDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(introTimerRef.current);
        introTimerRef.current = null;
        setIntroTypingDone(true);
      }
    }, 35); // 35ms per character — snappy but readable

    return () => {
      if (introTimerRef.current) {
        clearInterval(introTimerRef.current);
        introTimerRef.current = null;
      }
    };
  }, [showLevelIntro, introLevel, introPage]);

  // Handle tap on the intro dialogue
  const handleIntroTap = () => {
    const scripts = LEVEL_INTRO_SCRIPTS[introLevel];
    if (!scripts) return;

    // If still typing, skip to full text
    if (!introTypingDone) {
      if (introTimerRef.current) {
        clearInterval(introTimerRef.current);
        introTimerRef.current = null;
      }
      setIntroDisplayedText(scripts[introPage].text);
      setIntroTypingDone(true);
      return;
    }

    // If on last page, do nothing (user must press Start Level)
    if (introPage >= scripts.length - 1) return;

    // Advance to next page
    setIntroPage(introPage + 1);
  };

  // Go back one dialogue page
  const handleIntroBack = () => {
    if (introPage <= 0) return;
    setIntroPage(introPage - 1);
  };

  // Close intro and start the actual level
  const handleIntroStartLevel = async () => {
    const level = introLevel;

    // Mark intro as seen — persist to AsyncStorage + DB
    const key = `level_intro_seen_${user?.id}_${level}`;
    await AsyncStorage.setItem(key, 'true');
    gameDatabaseService.markIntroSeen(level); // fire-and-forget DB update

    setShowLevelIntro(false);
    setIntroLevel(null);
    setIntroPage(0);
    setIntroDisplayedText('');
    startStoryLevel(level);
  };

  // Close intro and go back to level select
  const handleIntroClose = () => {
    if (introTimerRef.current) {
      clearInterval(introTimerRef.current);
      introTimerRef.current = null;
    }
    setShowLevelIntro(false);
    setIntroLevel(null);
    setIntroPage(0);
    setIntroDisplayedText('');
  };

  const handleCustomMode = async () => {
    // Clear any leftover tutorial state
    if (tutorialActive) {
      setTutorialActive(false);
      setTutorialStep(0);
    }

    // Check for a cached active custom session first, then DB fallback
    let activeCustom = cachedActiveCustomRef.current;
    if (!activeCustom) {
      activeCustom = await gameDatabaseService.findActiveCustomSession();
    }

    if (activeCustom) {
      // Resume existing custom session — no data reset
      resumeCustomSession(activeCustom);
      return;
    }

    // No active session — show custom setup
    setShowCustomSetup(true);
    setShowMainMenu(false);
  };

  // Start Custom Mode with user-defined settings
  const startCustomMode = async () => {
    try {
      // Get user's monthly budget from DataContext/Supabase
      const { data: budgetData, error } = await supabase
        .from('budgets')
        .select('monthly')
        .eq('user_id', user?.id)
        .single();
      
      let monthlyBudget = 5000; // Default fallback
      if (budgetData?.monthly) {
        monthlyBudget = budgetData.monthly;
      }
      
      // Calculate weekly budget (monthly / 4)
      const calculatedWeeklyBudget = monthlyBudget / 4;
      setWeeklyBudget(calculatedWeeklyBudget);
      
      // Set start and end dates — real-time 168-hour window from NOW
      const startDate = new Date(); // exact moment user pressed Start
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // exactly 7 days later
      
      setStoryStartDate(startDate);
      setStoryEndDate(endDate);
      setWeeklySpending(0);
      setLevelResults(null);
      
      // Reset category spending tracking
      setCategorySpending({
        'Food & Dining': 0,
        'Shopping': 0,
        'Electronics': 0,
        'Transport': 0,
        'Entertainment': 0,
        'Other': 0
      });
      
      // Set up based on custom mode type
      if (customModeType === 'budgeting') {
        // Custom Budget Rules
        const needsPercent = customBudgetRules.needs / 100;
        const wantsPercent = customBudgetRules.wants / 100;
        const savingsPercent = customBudgetRules.savings / 100;
        
        setBudgetCategories({
          needs: { budget: calculatedWeeklyBudget * needsPercent, spent: 0 },
          wants: { budget: calculatedWeeklyBudget * wantsPercent, spent: 0 },
          savings: { budget: calculatedWeeklyBudget * savingsPercent, spent: 0 }
        });
        setStoryLevel(1); // Use level 1 UI
        
      } else if (customModeType === 'goals') {
        // Custom Savings Goals
        const goals = customGoals
          .filter(g => g.name.trim() && g.target)
          .map((g, index) => ({
            id: `custom_${index}`,
            name: g.name.trim(),
            icon: ['🎯', '💎', '🌟', '🎁', '✨'][index % 5],
            target: parseFloat(g.target) || 0
          }));
        
        setSavingsGoals(goals);
        const allocations = {};
        goals.forEach(g => { allocations[g.id] = 0; });
        setGoalAllocations(allocations);
        setStoryLevel(2); // Use level 2 UI
        
      } else if (customModeType === 'saving') {
        // Custom Savings Target
        const savingsTarget = parseFloat(customSavingsTarget) / 100;
        setStoryLevel(3); // Use level 3 UI
        // Store custom savings target for level completion check
        // We'll use customSavingsTarget state directly in checkLevelCompletion
      }
      
      // Set game mode and close setup
      setGameMode('custom');
      setShowCustomSetup(false);
      setCurrentMapId('dorm');
      
      console.log(`🎮 Custom Mode (${customModeType}) started!`);
      console.log(`   Weekly Budget: ₱${calculatedWeeklyBudget}`);

      // ── Persist custom session to Supabase ──
      const customGoalsForDB = customModeType === 'goals'
        ? customGoals.filter(g => g.name.trim() && g.target).map(g => ({ name: g.name.trim(), target: parseFloat(g.target) || 0 }))
        : null;
      const session = await gameDatabaseService.createCustomSession({
        modeType: customModeType,
        customRules: customBudgetRules,
        weeklyBudget: calculatedWeeklyBudget,
        startDate,
        endDate,
        customGoals: customGoalsForDB,
        customSavingsTarget: customModeType === 'saving' ? parseFloat(customSavingsTarget) : null,
      });
      if (session) setActiveSessionId(session.id);
      gameDatabaseService.logActivity({ activityType: 'level_start', details: { type: customModeType, mode: 'custom', rules: customBudgetRules }, sessionId: session?.id });
      
    } catch (error) {
      console.error('Error starting custom mode:', error);
      Alert.alert('Error', 'Could not start custom mode. Please try again.');
    }
  };

  // Apply settings changes from the Custom Settings modal (mid-game edits)
  const applyCustomSettings = (newModeType) => {
    // If user is changing the challenge type entirely, reconfigure state
    if (newModeType !== customModeType) {
      setCustomModeType(newModeType);

      if (newModeType === 'budgeting') {
        const needsPercent = customBudgetRules.needs / 100;
        const wantsPercent = customBudgetRules.wants / 100;
        const savingsPercent = customBudgetRules.savings / 100;
        setBudgetCategories({
          needs: { budget: weeklyBudget * needsPercent, spent: budgetCategories.needs?.spent || 0 },
          wants: { budget: weeklyBudget * wantsPercent, spent: budgetCategories.wants?.spent || 0 },
          savings: { budget: weeklyBudget * savingsPercent, spent: 0 },
        });
        setStoryLevel(1);
      } else if (newModeType === 'goals') {
        const goals = customGoals
          .filter(g => g.name.trim() && parseFloat(g.target) > 0)
          .map((g, index) => ({
            id: `custom_${index}`,
            name: g.name.trim(),
            icon: ['🎯', '💎', '🌟', '🎁', '✨'][index % 5],
            target: parseFloat(g.target) || 0,
          }));
        if (goals.length > 0) {
          setSavingsGoals(goals);
          const allocations = {};
          goals.forEach(g => { allocations[g.id] = 0; });
          setGoalAllocations(allocations);
        }
        setStoryLevel(2);
      } else if (newModeType === 'saving') {
        setStoryLevel(3);
      }
    } else {
      // Same mode type — user only edited values (percentages, goals, savings target)
      if (newModeType === 'budgeting') {
        const needsPercent = customBudgetRules.needs / 100;
        const wantsPercent = customBudgetRules.wants / 100;
        const savingsPercent = customBudgetRules.savings / 100;
        setBudgetCategories(prev => ({
          needs: { budget: weeklyBudget * needsPercent, spent: prev.needs?.spent || 0 },
          wants: { budget: weeklyBudget * wantsPercent, spent: prev.wants?.spent || 0 },
          savings: { budget: weeklyBudget * savingsPercent, spent: 0 },
        }));
      } else if (newModeType === 'goals') {
        const goals = customGoals
          .filter(g => g.name.trim() && parseFloat(g.target) > 0)
          .map((g, index) => ({
            id: `custom_${index}`,
            name: g.name.trim(),
            icon: ['🎯', '💎', '🌟', '🎁', '✨'][index % 5],
            target: parseFloat(g.target) || 0,
          }));
        if (goals.length > 0) {
          setSavingsGoals(goals);
          // Preserve existing allocations where possible
          const allocations = {};
          goals.forEach(g => { allocations[g.id] = goalAllocations[g.id] || 0; });
          setGoalAllocations(allocations);
        }
      }
      // For 'saving', customSavingsTarget is already updated via state
    }

    setShowCustomSettingsModal(false);
    console.log(`⚙️ Custom settings applied: mode=${newModeType}`);

    // ── Persist updated custom settings to DB ──
    if (activeSessionId) {
      const updatedGoalsForDB = (newModeType === 'goals')
        ? customGoals.filter(g => g.name.trim() && parseFloat(g.target) > 0).map(g => ({ name: g.name.trim(), target: parseFloat(g.target) || 0 }))
        : null;
      gameDatabaseService.updateCustomSessionSpending(activeSessionId, {
        weeklySpending,
        needsSpent: budgetCategories.needs?.spent || 0,
        wantsSpent: budgetCategories.wants?.spent || 0,
        savingsAmount: weeklyBudget - weeklySpending,
        goalsProgress: updatedGoalsForDB
          ? updatedGoalsForDB.map(g => ({ name: g.name, target: g.target, allocated: goalAllocations[`custom_${updatedGoalsForDB.indexOf(g)}`] || 0 }))
          : null,
      });
      // Also update the session row metadata (custom_rules, custom_goals, custom_savings_target)
      // via a direct Supabase update for the fields createCustomSession originally set
      const metadataUpdates = { updated_at: new Date().toISOString() };
      if (newModeType === 'budgeting') metadataUpdates.custom_rules = customBudgetRules;
      if (newModeType === 'goals' && updatedGoalsForDB) metadataUpdates.custom_goals = updatedGoalsForDB;
      if (newModeType === 'saving') metadataUpdates.custom_savings_target = parseFloat(customSavingsTarget);
      metadataUpdates.mode_type = newModeType;
      supabase.from('custom_mode_sessions').update(metadataUpdates).eq('id', activeSessionId).then(() => {});
    }
  };

  // Render Custom Settings Modal (in-game settings for Custom Mode)
  const renderCustomSettingsModal = () => {
    const budgetTotal = customBudgetRules.needs + customBudgetRules.wants + customBudgetRules.savings;
    const budgetValid = budgetTotal === 100;
    const goalsValid = customGoals.some(g => g.name.trim() && parseFloat(g.target) > 0);
    const savingsValid = parseFloat(customSavingsTarget) > 0 && parseFloat(customSavingsTarget) <= 100;

    return (
      <Modal
        visible={showCustomSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomSettingsModal(false)}
      >
        <View style={settingsStyles.backdrop}>
          <View style={settingsStyles.container}>
            {/* Header */}
            <View style={settingsStyles.header}>
              <Text style={settingsStyles.title}>⚙️ Custom Settings</Text>
              <TouchableOpacity onPress={() => setShowCustomSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#F5DEB3" />
              </TouchableOpacity>
            </View>

            <ScrollView style={settingsStyles.body} showsVerticalScrollIndicator={false}>
              {/* Mode Selector */}
              <Text style={settingsStyles.sectionLabel}>Challenge Type</Text>
              <View style={settingsStyles.modeRow}>
                {[
                  { key: 'budgeting', icon: '📊', label: 'Budgeting' },
                  { key: 'goals', icon: '🎯', label: 'Goals' },
                  { key: 'saving', icon: '💰', label: 'Saving' },
                ].map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      settingsStyles.modeChip,
                      settingsModeType === m.key && settingsStyles.modeChipActive,
                    ]}
                    onPress={() => setSettingsModeType(m.key)}
                  >
                    <Text style={settingsStyles.modeChipIcon}>{m.icon}</Text>
                    <Text style={[
                      settingsStyles.modeChipLabel,
                      settingsModeType === m.key && settingsStyles.modeChipLabelActive,
                    ]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Budgeting Settings */}
              {settingsModeType === 'budgeting' && (
                <View style={settingsStyles.section}>
                  <Text style={settingsStyles.sectionLabel}>Budget Split</Text>
                  {[
                    { key: 'needs', label: '🏠 Needs', color: '#4CAF50' },
                    { key: 'wants', label: '🎮 Wants', color: '#FF9800' },
                    { key: 'savings', label: '💰 Savings', color: '#3498DB' },
                  ].map(cat => (
                    <View key={cat.key} style={settingsStyles.sliderRow}>
                      <Text style={settingsStyles.sliderLabel}>{cat.label}</Text>
                      <View style={settingsStyles.sliderControls}>
                        <TouchableOpacity
                          style={settingsStyles.adjBtn}
                          onPress={() => setCustomBudgetRules(prev => ({ ...prev, [cat.key]: Math.max(0, prev[cat.key] - 5) }))}
                        >
                          <Ionicons name="remove" size={16} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={[settingsStyles.sliderValue, { color: cat.color }]}>{customBudgetRules[cat.key]}%</Text>
                        <TouchableOpacity
                          style={settingsStyles.adjBtn}
                          onPress={() => setCustomBudgetRules(prev => ({ ...prev, [cat.key]: Math.min(100, prev[cat.key] + 5) }))}
                        >
                          <Ionicons name="add" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <Text style={[settingsStyles.totalText, !budgetValid && { color: '#FF4444' }]}>
                    Total: {budgetTotal}% {budgetValid ? '✅' : `(${budgetTotal < 100 ? 'need ' + (100 - budgetTotal) + '% more' : (budgetTotal - 100) + '% over'})`}
                  </Text>
                </View>
              )}

              {/* Goals Settings */}
              {settingsModeType === 'goals' && (
                <View style={settingsStyles.section}>
                  <Text style={settingsStyles.sectionLabel}>Savings Goals</Text>
                  {customGoals.map((goal, index) => (
                    <View key={index} style={settingsStyles.goalRow}>
                      <TextInput
                        style={settingsStyles.goalNameInput}
                        placeholder="Goal name"
                        placeholderTextColor="#666"
                        value={goal.name}
                        onChangeText={(text) => {
                          const g = [...customGoals];
                          g[index].name = text;
                          setCustomGoals(g);
                        }}
                      />
                      <TextInput
                        style={settingsStyles.goalAmtInput}
                        placeholder="₱"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={goal.target}
                        onChangeText={(text) => {
                          const g = [...customGoals];
                          g[index].target = text.replace(/[^0-9.]/g, '');
                          setCustomGoals(g);
                        }}
                      />
                      {customGoals.length > 1 && (
                        <TouchableOpacity onPress={() => setCustomGoals(customGoals.filter((_, i) => i !== index))}>
                          <Ionicons name="close-circle" size={22} color="#E74C3C" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {customGoals.length < 5 && (
                    <TouchableOpacity
                      style={settingsStyles.addGoalBtn}
                      onPress={() => setCustomGoals([...customGoals, { name: '', target: '' }])}
                    >
                      <Ionicons name="add-circle" size={18} color="#4CAF50" />
                      <Text style={settingsStyles.addGoalText}>Add Goal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Saving Settings */}
              {settingsModeType === 'saving' && (
                <View style={settingsStyles.section}>
                  <Text style={settingsStyles.sectionLabel}>Savings Target</Text>
                  <View style={settingsStyles.savingsRow}>
                    <TouchableOpacity
                      style={settingsStyles.adjBtn}
                      onPress={() => setCustomSavingsTarget(prev => Math.max(5, parseInt(prev) - 5).toString())}
                    >
                      <Ionicons name="remove" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={settingsStyles.savingsBigValue}>{customSavingsTarget}%</Text>
                    <TouchableOpacity
                      style={settingsStyles.adjBtn}
                      onPress={() => setCustomSavingsTarget(prev => Math.min(80, parseInt(prev) + 5).toString())}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={settingsStyles.quickRow}>
                    {[10, 20, 30, 40, 50].map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[settingsStyles.quickBtn, customSavingsTarget === p.toString() && settingsStyles.quickBtnActive]}
                        onPress={() => setCustomSavingsTarget(p.toString())}
                      >
                        <Text style={[settingsStyles.quickBtnText, customSavingsTarget === p.toString() && { color: '#FFF' }]}>{p}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Apply Button */}
            <TouchableOpacity
              style={[
                settingsStyles.applyBtn,
                (settingsModeType === 'budgeting' && !budgetValid) && settingsStyles.applyBtnDisabled,
                (settingsModeType === 'goals' && !goalsValid) && settingsStyles.applyBtnDisabled,
                (settingsModeType === 'saving' && !savingsValid) && settingsStyles.applyBtnDisabled,
              ]}
              onPress={() => applyCustomSettings(settingsModeType)}
              disabled={
                (settingsModeType === 'budgeting' && !budgetValid) ||
                (settingsModeType === 'goals' && !goalsValid) ||
                (settingsModeType === 'saving' && !savingsValid)
              }
            >
              <Text style={settingsStyles.applyBtnText}>Apply Changes</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Custom Settings Modal Styles
  const settingsStyles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxHeight: '85%',
      backgroundColor: '#1a1a2e',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#5A5A7A',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#F5DEB3',
    },
    body: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#D4C4A8',
      marginBottom: 10,
      marginTop: 8,
    },
    section: {
      marginTop: 4,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    modeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    modeChipActive: {
      borderColor: '#F5DEB3',
      backgroundColor: 'rgba(245, 222, 179, 0.15)',
    },
    modeChipIcon: {
      fontSize: 16,
    },
    modeChipLabel: {
      fontSize: 12,
      color: '#888',
      fontWeight: '600',
    },
    modeChipLabelActive: {
      color: '#F5DEB3',
    },
    sliderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sliderLabel: {
      fontSize: 14,
      color: '#F5DEB3',
    },
    sliderControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    adjBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(90, 90, 122, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderValue: {
      fontSize: 16,
      fontWeight: 'bold',
      width: 42,
      textAlign: 'center',
    },
    totalText: {
      textAlign: 'center',
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: '600',
      marginTop: 4,
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    goalNameInput: {
      flex: 1,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: '#FFF',
      fontSize: 14,
      borderWidth: 1,
      borderColor: '#5A5A7A',
    },
    goalAmtInput: {
      width: 80,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: '#FFF',
      fontSize: 14,
      borderWidth: 1,
      borderColor: '#5A5A7A',
      textAlign: 'center',
    },
    addGoalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      paddingVertical: 6,
    },
    addGoalText: {
      color: '#4CAF50',
      fontSize: 13,
    },
    savingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginVertical: 10,
    },
    savingsBigValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#F5DEB3',
    },
    quickRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    quickBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderWidth: 1,
      borderColor: '#5A5A7A',
    },
    quickBtnActive: {
      borderColor: '#F5DEB3',
      backgroundColor: 'rgba(245, 222, 179, 0.2)',
    },
    quickBtnText: {
      fontSize: 13,
      color: '#888',
      fontWeight: '600',
    },
    applyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginVertical: 16,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#4CAF50',
    },
    applyBtnDisabled: {
      backgroundColor: '#555',
      opacity: 0.5,
    },
    applyBtnText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFF',
    },
  });
  const renderStoryIntro = () => (
    <ImageBackground
      source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
      style={storyStyles.background}
      resizeMode="cover"
    >
      <View style={storyStyles.overlay}>
        {/* Back Button */}
        <TouchableOpacity
          style={storyStyles.backButton}
          onPress={() => {
            setShowStoryIntro(false);
            setGameMode(null);
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#F5DEB3" />
        </TouchableOpacity>

        {/* Title */}
        <View style={storyStyles.titleContainer}>
          <Text style={storyStyles.title}>📖 Story Mode</Text>
          <Text style={storyStyles.subtitle}>Master your finances!</Text>
        </View>

        {/* Level Selection */}
        <View style={storyStyles.levelsContainer}>
          {[1, 2, 3].map((level) => {
            const levelConfig = STORY_LEVELS[level];
            const isUnlocked = unlockedLevels.includes(level);
            
            return (
              <TouchableOpacity
                key={level}
                style={[
                  storyStyles.levelButton,
                  isUnlocked ? storyStyles.levelUnlocked : storyStyles.levelLocked,
                ]}
                onPress={() => isUnlocked && handleLevelSelect(level)}
                activeOpacity={isUnlocked ? 0.7 : 1}
                disabled={!isUnlocked}
              >
                <View style={storyStyles.levelIconContainer}>
                  <Text style={storyStyles.levelIcon}>
                    {isUnlocked ? levelConfig.icon : '🔒'}
                  </Text>
                </View>
                <View style={storyStyles.levelInfo}>
                  <Text style={[storyStyles.levelName, !isUnlocked && storyStyles.lockedText]}>
                    Level {level}: {levelConfig.name}
                  </Text>
                  <Text style={[storyStyles.levelDesc, !isUnlocked && storyStyles.lockedText]}>
                    {isUnlocked ? levelConfig.description : 'Complete previous level to unlock'}
                  </Text>
                  <View style={storyStyles.levelGoal}>
                    <Text style={[storyStyles.goalText, !isUnlocked && storyStyles.lockedText]}>
                      🎯 {levelConfig.goalText}
                    </Text>
                  </View>
                </View>
                {isUnlocked && (
                  <Ionicons name="play-circle" size={32} color="#F5DEB3" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Box */}
        <View style={storyStyles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#F5DEB3" />
          <Text style={storyStyles.infoText}>
            Each level lasts 7 days. Your monthly budget is divided into weekly amounts.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );

  // Render Custom Mode Setup Screen
  const renderCustomSetup = () => {
    // Calculate if budget rules add up to 100
    const budgetTotal = customBudgetRules.needs + customBudgetRules.wants + customBudgetRules.savings;
    const budgetValid = budgetTotal === 100;
    
    // Check if goals are valid
    const goalsValid = customGoals.some(g => g.name.trim() && parseFloat(g.target) > 0);
    
    // Check if savings target is valid
    const savingsValid = parseFloat(customSavingsTarget) > 0 && parseFloat(customSavingsTarget) <= 100;
    
    return (
      <ImageBackground
        source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
        style={customStyles.background}
        resizeMode="cover"
      >
        <View style={customStyles.overlay}>
          {/* Back Button */}
          <TouchableOpacity
            style={customStyles.backButton}
            onPress={() => {
              setShowCustomSetup(false);
              setShowMainMenu(true);
              setCustomModeType(null);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#F5DEB3" />
          </TouchableOpacity>

          {/* Title */}
          <View style={customStyles.titleContainer}>
            <Text style={customStyles.title}>🎮 Custom Mode</Text>
            <Text style={customStyles.subtitle}>
              {customModeType ? 'Configure your challenge' : 'Choose your challenge type'}
            </Text>
          </View>

          <ScrollView 
            style={customStyles.scrollContainer}
            contentContainerStyle={customStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: Select Mode Type */}
            {!customModeType && (
              <View style={customStyles.modeSelection}>
                <TouchableOpacity
                  style={customStyles.modeButton}
                  onPress={() => setCustomModeType('budgeting')}
                >
                  <Text style={customStyles.modeIcon}>📊</Text>
                  <View style={customStyles.modeInfo}>
                    <Text style={customStyles.modeName}>Budget Basics</Text>
                    <Text style={customStyles.modeDesc}>Set your own budget split percentages</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#F5DEB3" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={customStyles.modeButton}
                  onPress={() => setCustomModeType('goals')}
                >
                  <Text style={customStyles.modeIcon}>🎯</Text>
                  <View style={customStyles.modeInfo}>
                    <Text style={customStyles.modeName}>Goal Setting</Text>
                    <Text style={customStyles.modeDesc}>Create your own savings goals</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#F5DEB3" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={customStyles.modeButton}
                  onPress={() => setCustomModeType('saving')}
                >
                  <Text style={customStyles.modeIcon}>💰</Text>
                  <View style={customStyles.modeInfo}>
                    <Text style={customStyles.modeName}>Super Saver</Text>
                    <Text style={customStyles.modeDesc}>Choose your savings percentage target</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#F5DEB3" />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2A: Budget Basics Configuration */}
            {customModeType === 'budgeting' && (
              <View style={customStyles.configSection}>
                <TouchableOpacity
                  style={customStyles.changeTypeButton}
                  onPress={() => setCustomModeType(null)}
                >
                  <Ionicons name="arrow-back" size={16} color="#F5DEB3" />
                  <Text style={customStyles.changeTypeText}>Change type</Text>
                </TouchableOpacity>

                <Text style={customStyles.configTitle}>📊 Set Your Budget Split</Text>
                <Text style={customStyles.configSubtitle}>
                  Allocate your weekly budget across Needs, Wants, and Savings.
                  Total must equal 100%.
                </Text>

                {/* Needs Slider */}
                <View style={customStyles.sliderContainer}>
                  <View style={customStyles.sliderHeader}>
                    <Text style={customStyles.sliderLabel}>🏠 Needs (Food, Transport)</Text>
                    <Text style={customStyles.sliderValue}>{customBudgetRules.needs}%</Text>
                  </View>
                  <View style={customStyles.sliderTrack}>
                    <View 
                      style={[customStyles.sliderFill, { width: `${customBudgetRules.needs}%`, backgroundColor: '#4CAF50' }]} 
                    />
                  </View>
                  <View style={customStyles.sliderButtons}>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, needs: Math.max(0, prev.needs - 5) }))}
                    >
                      <Ionicons name="remove" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, needs: Math.min(100, prev.needs + 5) }))}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Wants Slider */}
                <View style={customStyles.sliderContainer}>
                  <View style={customStyles.sliderHeader}>
                    <Text style={customStyles.sliderLabel}>🎮 Wants (Shopping, Entertainment)</Text>
                    <Text style={customStyles.sliderValue}>{customBudgetRules.wants}%</Text>
                  </View>
                  <View style={customStyles.sliderTrack}>
                    <View 
                      style={[customStyles.sliderFill, { width: `${customBudgetRules.wants}%`, backgroundColor: '#FF9800' }]} 
                    />
                  </View>
                  <View style={customStyles.sliderButtons}>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, wants: Math.max(0, prev.wants - 5) }))}
                    >
                      <Ionicons name="remove" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, wants: Math.min(100, prev.wants + 5) }))}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Savings Slider */}
                <View style={customStyles.sliderContainer}>
                  <View style={customStyles.sliderHeader}>
                    <Text style={customStyles.sliderLabel}>💰 Savings</Text>
                    <Text style={customStyles.sliderValue}>{customBudgetRules.savings}%</Text>
                  </View>
                  <View style={customStyles.sliderTrack}>
                    <View 
                      style={[customStyles.sliderFill, { width: `${customBudgetRules.savings}%`, backgroundColor: '#3498DB' }]} 
                    />
                  </View>
                  <View style={customStyles.sliderButtons}>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, savings: Math.max(0, prev.savings - 5) }))}
                    >
                      <Ionicons name="remove" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={customStyles.sliderBtn}
                      onPress={() => setCustomBudgetRules(prev => ({ ...prev, savings: Math.min(100, prev.savings + 5) }))}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Total indicator */}
                <View style={[customStyles.totalIndicator, !budgetValid && customStyles.totalInvalid]}>
                  <Text style={customStyles.totalText}>
                    Total: {budgetTotal}%
                  </Text>
                  {!budgetValid && (
                    <Text style={customStyles.totalWarning}>
                      {budgetTotal < 100 ? `Add ${100 - budgetTotal}% more` : `Remove ${budgetTotal - 100}%`}
                    </Text>
                  )}
                  {budgetValid && (
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  )}
                </View>

                {/* Start Button */}
                <TouchableOpacity
                  style={[customStyles.startButton, !budgetValid && customStyles.startButtonDisabled]}
                  onPress={startCustomMode}
                  disabled={!budgetValid}
                >
                  <Text style={customStyles.startButtonText}>Start Challenge</Text>
                  <Ionicons name="play" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2B: Goal Setting Configuration */}
            {customModeType === 'goals' && (
              <View style={customStyles.configSection}>
                <TouchableOpacity
                  style={customStyles.changeTypeButton}
                  onPress={() => setCustomModeType(null)}
                >
                  <Ionicons name="arrow-back" size={16} color="#F5DEB3" />
                  <Text style={customStyles.changeTypeText}>Change type</Text>
                </TouchableOpacity>

                <Text style={customStyles.configTitle}>🎯 Create Your Goals</Text>
                <Text style={customStyles.configSubtitle}>
                  Add savings goals you want to work towards. Enter a name and target amount.
                </Text>

                {/* Goals List */}
                {customGoals.map((goal, index) => (
                  <View key={index} style={customStyles.goalInputRow}>
                    <View style={customStyles.goalInputs}>
                      <TextInput
                        style={customStyles.goalNameInput}
                        placeholder="Goal name (e.g., New Shoes)"
                        placeholderTextColor="#888"
                        value={goal.name}
                        onChangeText={(text) => {
                          const newGoals = [...customGoals];
                          newGoals[index].name = text;
                          setCustomGoals(newGoals);
                        }}
                      />
                      <TextInput
                        style={customStyles.goalAmountInput}
                        placeholder="₱ Amount"
                        placeholderTextColor="#888"
                        keyboardType="numeric"
                        value={goal.target}
                        onChangeText={(text) => {
                          const newGoals = [...customGoals];
                          newGoals[index].target = text.replace(/[^0-9.]/g, '');
                          setCustomGoals(newGoals);
                        }}
                      />
                    </View>
                    {customGoals.length > 1 && (
                      <TouchableOpacity
                        style={customStyles.removeGoalBtn}
                        onPress={() => {
                          const newGoals = customGoals.filter((_, i) => i !== index);
                          setCustomGoals(newGoals);
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color="#E74C3C" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Add Goal Button */}
                {customGoals.length < 5 && (
                  <TouchableOpacity
                    style={customStyles.addGoalButton}
                    onPress={() => setCustomGoals([...customGoals, { name: '', target: '' }])}
                  >
                    <Ionicons name="add-circle" size={20} color="#4CAF50" />
                    <Text style={customStyles.addGoalText}>Add Another Goal</Text>
                  </TouchableOpacity>
                )}

                {/* Start Button */}
                <TouchableOpacity
                  style={[customStyles.startButton, !goalsValid && customStyles.startButtonDisabled]}
                  onPress={startCustomMode}
                  disabled={!goalsValid}
                >
                  <Text style={customStyles.startButtonText}>Start Challenge</Text>
                  <Ionicons name="play" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2C: Super Saver Configuration */}
            {customModeType === 'saving' && (
              <View style={customStyles.configSection}>
                <TouchableOpacity
                  style={customStyles.changeTypeButton}
                  onPress={() => setCustomModeType(null)}
                >
                  <Ionicons name="arrow-back" size={16} color="#F5DEB3" />
                  <Text style={customStyles.changeTypeText}>Change type</Text>
                </TouchableOpacity>

                <Text style={customStyles.configTitle}>💰 Set Your Savings Target</Text>
                <Text style={customStyles.configSubtitle}>
                  Choose what percentage of your weekly budget you want to save.
                </Text>

                {/* Savings Target Input */}
                <View style={customStyles.savingsTargetContainer}>
                  <View style={customStyles.savingsInputRow}>
                    <TouchableOpacity
                      style={customStyles.savingsAdjustBtn}
                      onPress={() => setCustomSavingsTarget(prev => Math.max(5, parseInt(prev) - 5).toString())}
                    >
                      <Ionicons name="remove" size={28} color="#FFF" />
                    </TouchableOpacity>
                    
                    <View style={customStyles.savingsValueContainer}>
                      <Text style={customStyles.savingsValue}>{customSavingsTarget}</Text>
                      <Text style={customStyles.savingsPercent}>%</Text>
                    </View>
                    
                    <TouchableOpacity
                      style={customStyles.savingsAdjustBtn}
                      onPress={() => setCustomSavingsTarget(prev => Math.min(80, parseInt(prev) + 5).toString())}
                    >
                      <Ionicons name="add" size={28} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Quick Select Buttons */}
                  <View style={customStyles.quickSelectRow}>
                    {[10, 20, 30, 40, 50].map((percent) => (
                      <TouchableOpacity
                        key={percent}
                        style={[
                          customStyles.quickSelectBtn,
                          customSavingsTarget === percent.toString() && customStyles.quickSelectActive
                        ]}
                        onPress={() => setCustomSavingsTarget(percent.toString())}
                      >
                        <Text style={[
                          customStyles.quickSelectText,
                          customSavingsTarget === percent.toString() && customStyles.quickSelectTextActive
                        ]}>
                          {percent}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Difficulty Indicator */}
                  <View style={customStyles.difficultyIndicator}>
                    <Text style={customStyles.difficultyLabel}>Difficulty: </Text>
                    <Text style={[
                      customStyles.difficultyValue,
                      { color: parseInt(customSavingsTarget) <= 15 ? '#4CAF50' : 
                               parseInt(customSavingsTarget) <= 30 ? '#FF9800' : '#E74C3C' }
                    ]}>
                      {parseInt(customSavingsTarget) <= 15 ? '🌱 Easy' : 
                       parseInt(customSavingsTarget) <= 30 ? '💪 Medium' : '🔥 Hard'}
                    </Text>
                  </View>
                </View>

                {/* Start Button */}
                <TouchableOpacity
                  style={[customStyles.startButton, !savingsValid && customStyles.startButtonDisabled]}
                  onPress={startCustomMode}
                  disabled={!savingsValid}
                >
                  <Text style={customStyles.startButtonText}>Start Challenge</Text>
                  <Ionicons name="play" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </ImageBackground>
    );
  };

  // Custom Mode Styles
  const customStyles = StyleSheet.create({
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingTop: 60,
    },
    backButton: {
      position: 'absolute',
      top: 50,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#5A5A7A',
      zIndex: 10,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 0,
    },
    subtitle: {
      fontSize: 14,
      color: '#D4C4A8',
      marginTop: 8,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    modeSelection: {
      gap: 12,
    },
    modeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#5A5A7A',
      gap: 12,
    },
    modeIcon: {
      fontSize: 32,
    },
    modeInfo: {
      flex: 1,
    },
    modeName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#F5DEB3',
    },
    modeDesc: {
      fontSize: 12,
      color: '#D4C4A8',
      marginTop: 4,
    },
    configSection: {
      gap: 16,
    },
    changeTypeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    changeTypeText: {
      fontSize: 14,
      color: '#F5DEB3',
    },
    configTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#F5DEB3',
      textAlign: 'center',
    },
    configSubtitle: {
      fontSize: 13,
      color: '#D4C4A8',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 8,
    },
    sliderContainer: {
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    sliderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sliderLabel: {
      fontSize: 14,
      color: '#F5DEB3',
      fontWeight: '600',
    },
    sliderValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FF9800',
    },
    sliderTrack: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 4,
      marginBottom: 12,
    },
    sliderFill: {
      height: '100%',
      borderRadius: 4,
    },
    sliderButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
    },
    sliderBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    totalIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    totalInvalid: {
      backgroundColor: 'rgba(231, 76, 60, 0.2)',
    },
    totalText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#F5DEB3',
    },
    totalWarning: {
      fontSize: 12,
      color: '#E74C3C',
    },
    startButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#4CAF50',
      padding: 16,
      borderRadius: 12,
      gap: 10,
      marginTop: 8,
    },
    startButtonDisabled: {
      backgroundColor: 'rgba(76, 175, 80, 0.3)',
    },
    startButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFF',
    },
    goalInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    goalInputs: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    goalNameInput: {
      flex: 2,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 8,
      padding: 12,
      color: '#FFF',
      fontSize: 14,
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    goalAmountInput: {
      flex: 1,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 8,
      padding: 12,
      color: '#FFF',
      fontSize: 14,
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    removeGoalBtn: {
      padding: 4,
    },
    addGoalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      gap: 8,
      borderWidth: 2,
      borderColor: '#4CAF50',
      borderStyle: 'dashed',
      borderRadius: 8,
    },
    addGoalText: {
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: '600',
    },
    savingsTargetContainer: {
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      borderRadius: 16,
      padding: 24,
      borderWidth: 2,
      borderColor: '#5A5A7A',
      alignItems: 'center',
    },
    savingsInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      marginBottom: 20,
    },
    savingsAdjustBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    savingsValueContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    savingsValue: {
      fontSize: 56,
      fontWeight: 'bold',
      color: '#FF9800',
    },
    savingsPercent: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FF9800',
      marginBottom: 10,
    },
    quickSelectRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    quickSelectBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    quickSelectActive: {
      backgroundColor: '#FF9800',
      borderColor: '#FF9800',
    },
    quickSelectText: {
      fontSize: 14,
      color: '#D4C4A8',
      fontWeight: '600',
    },
    quickSelectTextActive: {
      color: '#FFF',
    },
    difficultyIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    difficultyLabel: {
      fontSize: 14,
      color: '#D4C4A8',
    },
    difficultyValue: {
      fontSize: 14,
      fontWeight: 'bold',
    },
  });

  // Transport Modal Styles
  const transportStyles = StyleSheet.create({
    transportModalContent: {
      width: '95%',
      maxWidth: 400,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      maxHeight: '85%',
    },
    transportHeader: {
      alignItems: 'center',
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    transportTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    transportSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    modeSelection: {
      gap: 12,
    },
    modeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 12,
    },
    modeIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modeInfo: {
      flex: 1,
    },
    modeName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    modeDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    inputSection: {
      gap: 16,
    },
    backToModes: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    backToModesText: {
      fontSize: 14,
      color: '#3498DB',
    },
    selectedModeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    modeIconSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedModeName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    inputLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    currencySymbol: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#FF9800',
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      paddingVertical: 12,
    },
    quickAmounts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    quickAmountBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickAmountActive: {
      backgroundColor: '#FF9800',
      borderColor: '#FF9800',
    },
    quickAmountText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    quickAmountTextActive: {
      color: '#FFF',
    },
    confirmButton: {
      backgroundColor: '#3498DB',
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    confirmButtonCar: {
      backgroundColor: '#E74C3C',
    },
    confirmButtonDisabled: {
      backgroundColor: 'rgba(52, 152, 219, 0.3)',
    },
    confirmButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFF',
    },
    fuelQuestion: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginVertical: 8,
    },
    fuelOptions: {
      gap: 12,
    },
    fuelOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 12,
    },
    fuelOptionActive: {
      backgroundColor: '#4CAF50',
      borderColor: '#4CAF50',
    },
    fuelOptionActiveNo: {
      backgroundColor: '#666',
      borderColor: '#666',
    },
    fuelOptionText: {
      fontSize: 16,
      color: colors.text,
    },
    fuelOptionTextActive: {
      color: '#FFF',
      fontWeight: '600',
    },
    fuelAmountSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    cancelButton: {
      marginTop: 16,
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
  });

  // Story Mode Styles
  const storyStyles = StyleSheet.create({
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 20,
      paddingTop: 60,
    },
    backButton: {
      position: 'absolute',
      top: 50,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#5A5A7A',
      zIndex: 10,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 30,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 0,
    },
    subtitle: {
      fontSize: 16,
      color: '#D4C4A8',
      marginTop: 8,
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
    },
    levelsContainer: {
      gap: 16,
    },
    levelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderWidth: 4,
      gap: 12,
    },
    levelUnlocked: {
      backgroundColor: '#2D2D44',
      borderTopColor: '#5A5A7A',
      borderLeftColor: '#5A5A7A',
      borderBottomColor: '#1A1A2E',
      borderRightColor: '#1A1A2E',
    },
    levelLocked: {
      backgroundColor: '#1A1A2E',
      borderTopColor: '#3A3A4A',
      borderLeftColor: '#3A3A4A',
      borderBottomColor: '#0A0A1E',
      borderRightColor: '#0A0A1E',
      opacity: 0.7,
    },
    levelIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    levelIcon: {
      fontSize: 28,
    },
    levelInfo: {
      flex: 1,
    },
    levelName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
    },
    levelDesc: {
      fontSize: 12,
      color: '#D4C4A8',
      marginTop: 4,
    },
    levelGoal: {
      marginTop: 6,
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    goalText: {
      fontSize: 11,
      color: '#4CAF50',
      fontWeight: '600',
    },
    lockedText: {
      color: '#666',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      padding: 16,
      marginTop: 24,
      borderWidth: 2,
      borderColor: '#5A5A7A',
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: '#D4C4A8',
      lineHeight: 18,
    },
  });

  // ==================== POKÉMON-STYLE PRE-LEVEL INTRO ====================
  const renderLevelIntro = () => {
    const scripts = LEVEL_INTRO_SCRIPTS[introLevel];
    const isLastPage = introPage >= (scripts?.length || 1) - 1;
    const levelConfig = STORY_LEVELS[introLevel];

    return (
      <ImageBackground
        source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
        style={introStyles.background}
        resizeMode="cover"
      >
        <TouchableWithoutFeedback onPress={handleIntroTap}>
          <View style={introStyles.overlay}>
            {/* Back to level select */}
            <TouchableOpacity
              style={introStyles.closeButton}
              onPress={handleIntroClose}
            >
              <Ionicons name="arrow-back" size={22} color="#F5DEB3" />
            </TouchableOpacity>

            {/* Level badge */}
            <View style={introStyles.levelBadge}>
              <Text style={introStyles.levelBadgeText}>
                {levelConfig?.icon} Level {introLevel}: {levelConfig?.name}
              </Text>
            </View>

            {/* Koin character — centered above dialogue */}
            <View style={introStyles.characterContainer}>
              <Image
                source={require('../../../assets/mascot/koin_tutorial.png')}
                style={introStyles.characterImage}
                resizeMode="contain"
              />
            </View>

            {/* Dialogue box — Pokémon style */}
            <View style={introStyles.dialogueContainer}>
              <View style={introStyles.dialogueBox}>
                {/* Dialogue text with typewriter effect */}
                <Text style={introStyles.dialogueText}>
                  {introDisplayedText}
                  {!introTypingDone && (
                    <Text style={introStyles.cursor}>▌</Text>
                  )}
                </Text>

                {/* Bottom row: back arrow, page dots, advance indicator */}
                <View style={introStyles.dialogueFooter}>
                  {/* Back button */}
                  <TouchableOpacity
                    onPress={handleIntroBack}
                    disabled={introPage <= 0}
                    style={[introStyles.navButton, introPage <= 0 && introStyles.navButtonDisabled]}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={introPage > 0 ? '#F5DEB3' : '#555'}
                    />
                  </TouchableOpacity>

                  {/* Page dots */}
                  <View style={introStyles.dotsContainer}>
                    {scripts?.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          introStyles.dot,
                          i === introPage && introStyles.dotActive,
                          i < introPage && introStyles.dotCompleted,
                        ]}
                      />
                    ))}
                  </View>

                  {/* Advance indicator or empty space */}
                  {introTypingDone && !isLastPage ? (
                    <View style={introStyles.advanceIndicator}>
                      <Ionicons name="chevron-forward" size={16} color="#F5DEB3" />
                      <Animated.View
                        style={{
                          opacity: walkingPulse, // reuse existing pulse animation
                        }}
                      >
                        <Text style={introStyles.tapHint}>Tap</Text>
                      </Animated.View>
                    </View>
                  ) : (
                    <View style={introStyles.navButton} />
                  )}
                </View>
              </View>

              {/* Start Level button — only appears on the last page after typing is done */}
              {isLastPage && introTypingDone && (
                <TouchableOpacity
                  style={introStyles.startButton}
                  onPress={handleIntroStartLevel}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={20} color="#1a1a2e" />
                  <Text style={introStyles.startButtonText}>Start Level</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ImageBackground>
    );
  };

  const introStyles = StyleSheet.create({
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      left: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#5A5A7A',
      zIndex: 10,
    },
    levelBadge: {
      position: 'absolute',
      top: 22,
      alignSelf: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.95)',
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    levelBadgeText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
    },
    characterContainer: {
      alignItems: 'center',
      marginBottom: -10,
    },
    characterImage: {
      width: 200,
      height: 200,
    },
    dialogueContainer: {
      paddingHorizontal: 16,
      alignItems: 'center',
      marginBottom: 180,
    },
    dialogueBox: {
      width: '100%',
      backgroundColor: '#2D2D44',
      borderWidth: 4,
      borderTopColor: '#5A5A7A',
      borderLeftColor: '#5A5A7A',
      borderBottomColor: '#1A1A2E',
      borderRightColor: '#1A1A2E',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      minHeight: 130,
    },
    dialogueText: {
      fontSize: 17,
      color: '#F5DEB3',
      lineHeight: 26,
      fontWeight: '500',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      minHeight: 60,
    },
    cursor: {
      color: '#F5DEB3',
      fontSize: 17,
    },
    dialogueFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#555',
    },
    dotActive: {
      backgroundColor: '#F5DEB3',
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotCompleted: {
      backgroundColor: '#8B7355',
    },
    advanceIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tapHint: {
      fontSize: 12,
      color: '#F5DEB3',
      fontWeight: '600',
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5DEB3',
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 8,
      marginTop: 16,
      gap: 8,
      borderWidth: 3,
      borderTopColor: '#FFF8DC',
      borderLeftColor: '#FFF8DC',
      borderBottomColor: '#C4A86B',
      borderRightColor: '#C4A86B',
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 0,
      elevation: 4,
    },
    startButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1a1a2e',
    },
  });
  // ==================== END PRE-LEVEL INTRO ====================

  // ==================== STORY COMPLETION DIALOGUE ====================
  // Typewriter effect for completion dialogue
  useEffect(() => {
    if (!showCompletionDialogue) return;
    if (completionPage >= COMPLETION_SCRIPTS.length) return;

    const fullText = COMPLETION_SCRIPTS[completionPage].text;
    let charIndex = 0;
    setCompletionDisplayedText('');
    setCompletionTypingDone(false);

    completionTimerRef.current = setInterval(() => {
      charIndex++;
      setCompletionDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(completionTimerRef.current);
        completionTimerRef.current = null;
        setCompletionTypingDone(true);
      }
    }, 35);

    return () => {
      if (completionTimerRef.current) {
        clearInterval(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [showCompletionDialogue, completionPage]);

  const handleCompletionTap = () => {
    if (!completionTypingDone) {
      if (completionTimerRef.current) {
        clearInterval(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      setCompletionDisplayedText(COMPLETION_SCRIPTS[completionPage].text);
      setCompletionTypingDone(true);
      return;
    }
    if (completionPage >= COMPLETION_SCRIPTS.length - 1) return;
    setCompletionPage(completionPage + 1);
  };

  const handleCompletionBack = () => {
    if (completionPage <= 0) return;
    setCompletionPage(completionPage - 1);
  };

  const handleCompletionFinish = () => {
    if (completionTimerRef.current) {
      clearInterval(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setShowCompletionDialogue(false);
    setCompletionPage(0);
    setCompletionDisplayedText('');
    setGameMode(null);
    setShowMainMenu(true);
  };

  const renderCompletionDialogue = () => {
    const isLastPage = completionPage >= COMPLETION_SCRIPTS.length - 1;

    return (
      <ImageBackground
        source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
        style={completionStyles.background}
        resizeMode="cover"
      >
        <TouchableWithoutFeedback onPress={handleCompletionTap}>
          <View style={completionStyles.overlay}>
            {/* Celebration badge */}
            <View style={completionStyles.celebrationBadge}>
              <Text style={completionStyles.celebrationEmoji}>🏆</Text>
              <Text style={completionStyles.celebrationText}>Story Mode Complete!</Text>
            </View>

            {/* Koin character */}
            <View style={completionStyles.characterContainer}>
              <Image
                source={require('../../../assets/mascot/koin_tutorial.png')}
                style={completionStyles.characterImage}
                resizeMode="contain"
              />
            </View>

            {/* Dialogue box */}
            <View style={completionStyles.dialogueContainer}>
              <View style={completionStyles.dialogueBox}>
                <Text style={completionStyles.dialogueText}>
                  {completionDisplayedText}
                  {!completionTypingDone && (
                    <Text style={completionStyles.cursor}>▌</Text>
                  )}
                </Text>

                <View style={completionStyles.dialogueFooter}>
                  <TouchableOpacity
                    onPress={handleCompletionBack}
                    disabled={completionPage <= 0}
                    style={[completionStyles.navButton, completionPage <= 0 && completionStyles.navButtonDisabled]}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                  >
                    <Ionicons name="chevron-back" size={20} color={completionPage > 0 ? '#FFD700' : '#555'} />
                  </TouchableOpacity>

                  <View style={completionStyles.dotsContainer}>
                    {COMPLETION_SCRIPTS.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          completionStyles.dot,
                          i === completionPage && completionStyles.dotActive,
                          i < completionPage && completionStyles.dotCompleted,
                        ]}
                      />
                    ))}
                  </View>

                  {completionTypingDone && !isLastPage ? (
                    <View style={completionStyles.advanceIndicator}>
                      <Ionicons name="chevron-forward" size={16} color="#FFD700" />
                      <Text style={completionStyles.tapHint}>Tap</Text>
                    </View>
                  ) : (
                    <View style={completionStyles.navButton} />
                  )}
                </View>
              </View>

              {/* Finish button — only on last page */}
              {isLastPage && completionTypingDone && (
                <TouchableOpacity
                  style={completionStyles.finishButton}
                  onPress={handleCompletionFinish}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trophy" size={20} color="#1a1a2e" />
                  <Text style={completionStyles.finishButtonText}>Back to Menu</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ImageBackground>
    );
  };

  const completionStyles = StyleSheet.create({
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
    },
    celebrationBadge: {
      position: 'absolute',
      top: 30,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.95)',
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: '#FFD700',
      gap: 10,
    },
    celebrationEmoji: {
      fontSize: 22,
    },
    celebrationText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFD700',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
    },
    characterContainer: {
      alignItems: 'center',
      marginBottom: -10,
    },
    characterImage: {
      width: 220,
      height: 220,
    },
    dialogueContainer: {
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    dialogueBox: {
      width: '100%',
      backgroundColor: '#2D2D44',
      borderWidth: 4,
      borderTopColor: '#FFD700',
      borderLeftColor: '#FFD700',
      borderBottomColor: '#B8860B',
      borderRightColor: '#B8860B',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      minHeight: 130,
    },
    dialogueText: {
      fontSize: 17,
      color: '#FFD700',
      lineHeight: 26,
      fontWeight: '500',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      minHeight: 60,
    },
    cursor: {
      color: '#FFD700',
      fontSize: 17,
    },
    dialogueFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#555',
    },
    dotActive: {
      backgroundColor: '#FFD700',
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotCompleted: {
      backgroundColor: '#B8860B',
    },
    advanceIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tapHint: {
      fontSize: 12,
      color: '#FFD700',
      fontWeight: '600',
    },
    finishButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFD700',
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 8,
      marginTop: 16,
      gap: 8,
      borderWidth: 3,
      borderTopColor: '#FFF8DC',
      borderLeftColor: '#FFF8DC',
      borderBottomColor: '#B8860B',
      borderRightColor: '#B8860B',
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 0,
      elevation: 4,
    },
    finishButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1a1a2e',
    },
  });
  // ==================== END STORY COMPLETION DIALOGUE ====================

  // Render Main Menu
  const renderMainMenu = () => (
    <ImageBackground
      source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
      style={menuStyles.menuBackground}
      resizeMode="cover"
    >
      <View style={menuStyles.menuOverlay}>
        {/* Menu Buttons Container - centered */}
        <View style={menuStyles.menuButtonsContainer}>
          {/* Story Mode Button */}
          <TouchableOpacity
            style={[
              menuStyles.menuButton, 
              menuStyles.storyModeButton,
              !tutorialCompleted && menuStyles.lockedModeButton,
            ]}
            onPress={handleStoryMode}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuButtonIcon}>
              <Ionicons name={tutorialCompleted ? 'book' : 'lock-closed'} size={24} color={tutorialCompleted ? '#F5DEB3' : '#888'} />
            </View>
            <View style={menuStyles.menuButtonContent}>
              <Text style={[menuStyles.menuButtonText, !tutorialCompleted && { color: '#888' }]}>Story Mode</Text>
              {/* {!tutorialCompleted && (
                <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Complete Tutorial first</Text>
              )}*/}
            </View> 
          </TouchableOpacity>

          {/* Custom Mode Button */}
          <TouchableOpacity
            style={[
              menuStyles.menuButton,
              menuStyles.customModeButton,
              !customModeUnlocked && menuStyles.lockedModeButton,
            ]}
            onPress={() => {
              if (customModeUnlocked) {
                handleCustomMode();
              } else {
                Alert.alert(
                  '🔒 Locked',
                  'Complete all 3 Story Mode levels to unlock Custom Mode!',
                  [{ text: 'OK' }]
                );
              }
            }}
            activeOpacity={customModeUnlocked ? 0.7 : 1}
          >
            <View style={menuStyles.menuButtonIcon}>
              <Ionicons name={customModeUnlocked ? 'compass' : 'lock-closed'} size={24} color={customModeUnlocked ? '#F5DEB3' : '#888'} />
            </View>
            <View style={menuStyles.menuButtonContent}>
              <Text style={[menuStyles.menuButtonText, !customModeUnlocked && { color: '#888' }]}>
                Custom Mode
              </Text>
              {/* {!customModeUnlocked && (
                <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Complete Story Mode to unlock</Text>
              )} */}
            </View>
          </TouchableOpacity>

          {/* How to Play Button - Now starts interactive tutorial */}
          <TouchableOpacity
            style={[menuStyles.menuButton, menuStyles.howToPlayButton]}
            onPress={startTutorial}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuButtonIcon}>
              <Ionicons name="school" size={24} color="#F5DEB3" />
            </View>
            <View style={menuStyles.menuButtonContent}>
              <Text style={menuStyles.menuButtonText}>Tutorial</Text>
              {/* <Text style={menuStyles.menuButtonSubtext}>Learn with Koin</Text> */}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  // Menu styles - 2D RPG pixel art style
  const menuStyles = StyleSheet.create({
    menuBackground: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuButtonsContainer: {
      paddingHorizontal: 20,
      gap: 12,
      width: '85%',
      maxWidth: 320,
    },
    menuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      gap: 12,
      // RPG-style box with pixel border effect
      backgroundColor: '#2D2D44',
      borderWidth: 4,
      borderTopColor: '#5A5A7A',
      borderLeftColor: '#5A5A7A',
      borderBottomColor: '#1A1A2E',
      borderRightColor: '#1A1A2E',
      // Subtle inner shadow effect
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 0,
      elevation: 4,
    },
    storyModeButton: {
      backgroundColor: '#8B4513', // Wood brown - RPG style
      borderTopColor: '#CD853F',
      borderLeftColor: '#CD853F',
      borderBottomColor: '#5D3A1A',
      borderRightColor: '#5D3A1A',
    },
    customModeButton: {
      backgroundColor: '#2E5A3E', // Forest green - RPG style
      borderTopColor: '#4A8B5C',
      borderLeftColor: '#4A8B5C',
      borderBottomColor: '#1A3828',
      borderRightColor: '#1A3828',
    },
    lockedModeButton: {
      backgroundColor: '#2A2A3A',
      borderTopColor: '#3A3A4A',
      borderLeftColor: '#3A3A4A',
      borderBottomColor: '#1A1A2A',
      borderRightColor: '#1A1A2A',
      opacity: 0.7,
    },
    howToPlayButton: {
      backgroundColor: '#3A5A8C', // Medieval blue - RPG style
      borderTopColor: '#5A7AAC',
      borderLeftColor: '#5A7AAC',
      borderBottomColor: '#2A3A5C',
      borderRightColor: '#2A3A5C',
    },
    menuButtonIcon: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuButtonText: {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#F5DEB3', // Wheat color - classic RPG text
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      letterSpacing: 1,
    },
    menuButtonSubtext: {
      fontSize: 10,
      color: '#D4C4A8',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      marginTop: 2,
    },
    menuButtonContent: {
      flex: 1,
    },
  });

  // How to Play styles (legacy - keeping for potential future use)
  const howToPlayStyles = StyleSheet.create({
    section: {
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    sectionText: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
  
  // Koin Tutorial Styles - In-Game Interactive Tutorial
  const tutorialStyles = StyleSheet.create({
    // Game overlay styles
    gameOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 900,
    },
    highlightFab: {
      position: 'absolute',
      bottom: 90,
      right: 10,
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 3,
      borderColor: '#FF9800',
      backgroundColor: 'transparent',
    },
    highlightHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      borderWidth: 3,
      borderColor: '#FF9800',
      backgroundColor: 'transparent',
    },
    // Koin positioning
    koinGameContainer: {
      position: 'absolute',
      zIndex: 950,
    },
    koinPositionCenter: {
      top: '25%',
      left: 20,
      right: 20,
      alignItems: 'center',
    },
    koinPositionTop: {
      top: 140,
      left: 10,
      right: 10,
    },
    koinPositionBottom: {
      bottom: 180,
      left: 10,
      right: 10,
    },
    koinPositionLeft: {
      top: '35%',
      left: 10,
      width: '80%',
    },
    koinPositionRight: {
      top: '25%',
      right: 50,
      width: '80%',
      alignItems: 'flex-end',
    },
    koinWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    koinGameImage: {
      width: 120,
      height: 120,
    },
    speechBubbleGame: {
      flex: 1,
      backgroundColor: '#FFFDE7',
      borderRadius: 16,
      padding: 14,
      marginLeft: -10,
      marginTop: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 8,
      maxWidth: 240,
    },
    speechTitleGame: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#2C3E50',
      marginBottom: 6,
    },
    speechMessageGame: {
      fontSize: 13,
      color: '#5D6D7E',
      lineHeight: 18,
      marginBottom: 10,
    },
    stepIndicator: {
      fontSize: 11,
      color: '#999',
      marginTop: 8,
      textAlign: 'right',
    },
    // Progress dots inside speech bubble
    progressDotsInline: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
      marginBottom: 10,
    },
    // Navigation inside speech bubble
    navButtonRowInline: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    skipButtonInline: {
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    backButtonInline: {
      backgroundColor: '#F0F0F0',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    nextButtonInline: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF9800',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      gap: 4,
    },
    nextButtonTextInline: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#FFF',
    },
    // Navigation at bottom (legacy - no longer used)
    tutorialNavigation: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      paddingVertical: 16,
      paddingHorizontal: 20,
      paddingBottom: 30,
      zIndex: 1000,
    },
    progressDotsGame: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 16,
    },
    dotGame: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#DDD',
    },
    dotActiveGame: {
      backgroundColor: '#FF9800',
      width: 14,
    },
    dotCompletedGame: {
      backgroundColor: '#4CAF50',
    },
    navButtonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    navMainButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    skipButtonGame: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    skipButtonTextGame: {
      fontSize: 12,
      color: '#999',
    },
    backButtonGame: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 25,
    },
    nextButtonGame: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF9800',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 25,
      gap: 8,
    },
    nextButtonTextGame: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFF',
    },
    // Legacy styles (kept for reference)
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    koinContainer: {
      marginBottom: -20,
      zIndex: 10,
    },
    koinImage: {
      width: 180,
      height: 180,
    },
    speechBubble: {
      backgroundColor: '#FFFDE7',
      borderRadius: 24,
      padding: 24,
      paddingTop: 32,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    speechBubbleArrow: {
      position: 'absolute',
      top: -15,
      width: 0,
      height: 0,
      borderLeftWidth: 15,
      borderRightWidth: 15,
      borderBottomWidth: 20,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#FFFDE7',
    },
    speechTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#2C3E50',
      textAlign: 'center',
      marginBottom: 12,
    },
    speechMessage: {
      fontSize: 15,
      color: '#5D6D7E',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    progressDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#E0E0E0',
    },
    dotActive: {
      backgroundColor: '#FF9800',
      width: 24,
    },
    dotCompleted: {
      backgroundColor: '#4CAF50',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: '#F5F5F5',
      gap: 6,
    },
    backButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#666',
    },
    nextButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: '#FF9800',
      gap: 8,
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFF',
    },
    skipButton: {
      marginTop: 16,
      paddingVertical: 8,
    },
    skipButtonText: {
      fontSize: 13,
      color: '#999',
      textDecorationLine: 'underline',
    },
  });

  // Show Story Completion Dialogue (after Level 3 victory)
  if (showCompletionDialogue) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderCompletionDialogue()}
      </SafeAreaView>
    );
  }

  // Show Pokémon-style Pre-Level Intro
  if (showLevelIntro && introLevel !== null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderLevelIntro()}
      </SafeAreaView>
    );
  }

  // Show Story Intro / Level Selection
  if (showStoryIntro) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderStoryIntro()}
      </SafeAreaView>
    );
  }

  // Show Custom Mode Setup
  if (showCustomSetup) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderCustomSetup()}
      </SafeAreaView>
    );
  }

  // Show main menu if active
  if (showMainMenu) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderMainMenu()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Title and Spending Tracker */}
      <View style={styles.header}>
        {/* Back to Menu Button */}
        <TouchableOpacity
          style={styles.backToMenuButton}
          onPress={() => {
            // Clear tutorial state if active
            if (tutorialActive) {
              setTutorialActive(false);
              setTutorialStep(0);
            }
            setGameMode(null);
            setShowMainMenu(true);
          }}
        >
          <Ionicons name="home" size={20} color="#FFF" />
        </TouchableOpacity>
        {/* End Session / Give Up Button — story & custom mode only */}
        {(gameMode === 'story') && (
          <TouchableOpacity
            style={styles.giveUpButton}
            onPress={handleAbandonSession}
          >
            <Ionicons name="flag" size={16} color="#FFF" />
            <Text style={styles.giveUpButtonText}>Give Up</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{currentMap.icon} {currentMap.name}</Text>
          <Text style={styles.headerSubtitle}>
            {gameMode === 'tutorial' ? '🎓 Tutorial' : gameMode === 'story' ? `Story Mode - Level ${storyLevel}` : 'Custom Mode'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.spendingLabel}>Today's Spending</Text>
          <Text style={styles.spendingAmount}>₱{todaySpending.toFixed(2)}</Text>
          {/* Weekly Budget - Show in Story Mode and Custom Mode */}
          {(gameMode === 'story' || gameMode === 'custom') && (
            <>
              <Text style={[styles.spendingLabel, { marginTop: 6 }]}>Weekly Budget</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.spendingAmount, { 
                  color: getRemainingWeeklyBudget() < weeklyBudget * 0.2 ? '#FF4444' : '#4CAF50' 
                }]}>
                  ₱{getRemainingWeeklyBudget().toFixed(2)}
                </Text>
                {gameMode === 'custom' && (
                  <TouchableOpacity
                    onPress={() => { setSettingsModeType(customModeType); setShowCustomSettingsModal(true); }}
                    style={styles.settingsGearButton}
                  >
                    <Ionicons name="settings-sharp" size={18} color="#F5DEB3" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Story/Custom Mode Progress - Level-specific UI */}
      {(gameMode === 'story' || gameMode === 'custom') && (
        <View style={styles.storyProgressContainer}>
          {/* Level 1: Budget Tracking - Compact Card Layout */}
          {STORY_LEVELS[storyLevel]?.type === 'budgeting' && (() => {
            const percentages = getBudgetCategoryPercentages();
            // Use custom rules if in custom mode
            const needsLimit = gameMode === 'custom' ? customBudgetRules.needs : 50;
            const wantsLimit = gameMode === 'custom' ? customBudgetRules.wants : 30;
            const savingsMin = gameMode === 'custom' ? customBudgetRules.savings : 20;
            const ruleText = `${needsLimit}/${wantsLimit}/${savingsMin}`;
            
            const needsOk = percentages.needs <= needsLimit;
            const wantsOk = percentages.wants <= wantsLimit;
            const savingsOk = percentages.savings >= savingsMin;
            
            return (
              <View style={styles.budgetCompactRow}>
                {/* Rule Label */}
                <Text style={styles.budgetCompactLabel}>📊 {ruleText}</Text>
                
                {/* Compact Stats */}
                <View style={styles.budgetCompactStats}>
                  <View style={[styles.budgetCompactItem, needsOk && styles.budgetItemOk]}>
                    <Text style={styles.budgetCompactIcon}>🍔</Text>
                    <Text style={[styles.budgetCompactPercent, { color: needsOk ? '#4CAF50' : '#FF4444' }]}>
                      {percentages.needs}%
                    </Text>
                  </View>
                  <View style={[styles.budgetCompactItem, wantsOk && styles.budgetItemOk]}>
                    <Text style={styles.budgetCompactIcon}>🛍️</Text>
                    <Text style={[styles.budgetCompactPercent, { color: wantsOk ? '#4CAF50' : '#FF4444' }]}>
                      {percentages.wants}%
                    </Text>
                  </View>
                  <View style={[styles.budgetCompactItem, savingsOk && styles.budgetItemOk]}>
                    <Text style={styles.budgetCompactIcon}>💰</Text>
                    <Text style={[styles.budgetCompactPercent, { color: savingsOk ? '#4CAF50' : '#FF9800' }]}>
                      {percentages.savings}%
                    </Text>
                  </View>
                </View>
                
                {/* Days & End Week */}
                <View style={styles.budgetCompactActions}>
                  <Text style={styles.budgetCompactDays}>{getDaysRemaining()}d</Text>
                  <TouchableOpacity style={styles.endWeekBtnCompact} onPress={handleEndWeek}>
                    <Ionicons name="flag" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
          
          {/* Level 2: Goal Allocation Tracking - Compact */}
          {STORY_LEVELS[storyLevel]?.type === 'goals' && (
            <View style={styles.budgetCompactRow}>
              <Text style={styles.budgetCompactLabel}>🎯 Goals</Text>
              <View style={styles.budgetCompactStats}>
                {savingsGoals.slice(0, 3).map((goal) => {
                  const allocated = goalAllocations[goal.id] || 0;
                  const progress = Math.min(100, (allocated / goal.target) * 100);
                  return (
                    <View key={goal.id} style={[styles.budgetCompactItem, progress >= 100 && styles.budgetItemOk]}>
                      <Text style={styles.budgetCompactIcon}>{goal.icon}</Text>
                      <Text style={[styles.budgetCompactPercent, { 
                        color: progress >= 100 ? '#4CAF50' : '#3498DB' 
                      }]}>{progress.toFixed(0)}%</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.budgetCompactActions}>
                <Text style={styles.budgetCompactDays}>{getDaysRemaining()}d</Text>
                <TouchableOpacity 
                  style={[styles.endWeekBtnCompact, { backgroundColor: '#3498DB' }]} 
                  onPress={() => setShowGoalAllocationModal(true)}
                >
                  <Ionicons name="add" size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.endWeekBtnCompact} onPress={handleEndWeek}>
                  <Ionicons name="flag" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Level 3: Savings Percentage Tracking - Compact */}
          {STORY_LEVELS[storyLevel]?.type === 'saving' && (() => {
            const savingsGoalPercent = gameMode === 'custom' 
              ? parseFloat(customSavingsTarget) 
              : STORY_LEVELS[storyLevel].savingsGoal * 100;
            const currentSavings = getSavingsPercentage();
            const savingsOk = currentSavings >= savingsGoalPercent;
            
            return (
              <View style={styles.budgetCompactRow}>
                <Text style={styles.budgetCompactLabel}>💰 Save {savingsGoalPercent}%</Text>
                <View style={styles.savingsCompactProgress}>
                  <View style={styles.savingsCompactBar}>
                    <View style={[styles.savingsCompactFill, { 
                      width: `${Math.min(100, (currentSavings / savingsGoalPercent) * 100)}%`,
                      backgroundColor: savingsOk ? '#4CAF50' : '#FF9800'
                    }]} />
                  </View>
                  <Text style={[styles.budgetCompactPercent, { 
                    color: savingsOk ? '#4CAF50' : '#FF9800',
                    marginLeft: 8
                  }]}>{currentSavings.toFixed(1)}%</Text>
                </View>
                <View style={styles.budgetCompactActions}>
                  <Text style={styles.budgetCompactDays}>{getDaysRemaining()}d</Text>
                  <TouchableOpacity style={styles.endWeekBtnCompact} onPress={handleEndWeek}>
                    <Ionicons name="flag" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>
      )}

      {/* Location Badge - positioned below progress bar in story/custom mode */}
      <View style={[
        styles.locationBadge,
        (gameMode === 'story' || gameMode === 'custom') && { top: 105 }
      ]}>
        <View style={[styles.walkingIndicator, isWalking && { backgroundColor: '#FF9800' }]} />
        <Text style={styles.locationText}>
          {isWalking ? 'Walking to...' : currentLocation}
        </Text>
      </View>

      {/* Map Content */}
      {renderMapContent()}

      {/* Floating Action Button for Quick Expense Entry
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          setExpenseCategory('Other');
          setShowExpenseModal(true);
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity> */}

      {/* Instruction Banner (auto-hides after 5 seconds) */}
      {showInstructions && !tutorialActive && (
        <View style={styles.instructionBanner}>
          <Ionicons name="information-circle" size={24} color="#FF9800" />
          <Text style={styles.instructionText}>
            <Text style={styles.instructionHighlight}>Tap anywhere</Text> to move your character. 
            Walk to <Text style={styles.instructionHighlight}>doors 🚪</Text> to travel between locations!
          </Text>
        </View>
      )}

      {/* In-Game Koin Tutorial Overlay */}
      {tutorialActive && gameMode === 'tutorial' && (
        <>
          {/* Semi-transparent overlay for non-highlighted areas */}
          <View style={tutorialStyles.gameOverlay} pointerEvents="box-none">
            {/* Highlight specific UI elements based on current step */}
            {TUTORIAL_STEPS[tutorialStep]?.highlight === 'fab' && (
              <View style={tutorialStyles.highlightFab} />
            )}
            {TUTORIAL_STEPS[tutorialStep]?.highlight === 'header' && (
              <View style={tutorialStyles.highlightHeader} />
            )}
          </View>
          
          {/* Koin Character and Speech Bubble */}
          <View 
            style={[
              tutorialStyles.koinGameContainer,
              TUTORIAL_STEPS[tutorialStep]?.position === 'top' && tutorialStyles.koinPositionTop,
              TUTORIAL_STEPS[tutorialStep]?.position === 'bottom' && tutorialStyles.koinPositionBottom,
              TUTORIAL_STEPS[tutorialStep]?.position === 'left' && tutorialStyles.koinPositionLeft,
              TUTORIAL_STEPS[tutorialStep]?.position === 'right' && tutorialStyles.koinPositionRight,
              TUTORIAL_STEPS[tutorialStep]?.position === 'center' && tutorialStyles.koinPositionCenter,
            ]}
            pointerEvents="box-none"
          >
            <View style={tutorialStyles.koinWrapper}>
              {/* Koin Image */}
              <Image
                source={KOIN_TUTORIAL_IMAGE}
                style={tutorialStyles.koinGameImage}
                resizeMode="contain"
              />
              
              {/* Speech Bubble with Navigation Inside */}
              <View style={tutorialStyles.speechBubbleGame}>
                <Text style={tutorialStyles.speechTitleGame}>
                  {TUTORIAL_STEPS[tutorialStep]?.title}
                </Text>
                <Text style={tutorialStyles.speechMessageGame}>
                  {TUTORIAL_STEPS[tutorialStep]?.message}
                </Text>

                {/* Condition hint - show what user needs to do */}
                {!isTutorialStepComplete() && TUTORIAL_STEPS[tutorialStep]?.conditionKey && (
                  <View style={{ backgroundColor: '#FFF3E0', borderRadius: 8, padding: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#E65100', textAlign: 'center', fontStyle: 'italic' }}>
                      ⏳ Complete the action above to continue
                    </Text>
                  </View>
                )}
                
                {/* Step Counter */}
                <Text style={{ fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 6 }}>
                  Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
                </Text>
                
                {/* Progress Dots */}
                <View style={tutorialStyles.progressDotsInline}>
                  {TUTORIAL_STEPS.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        tutorialStyles.dotGame,
                        index === tutorialStep && tutorialStyles.dotActiveGame,
                        index < tutorialStep && tutorialStyles.dotCompletedGame,
                      ]}
                    />
                  ))}
                </View>
                
                {/* Navigation Buttons Inside Speech Bubble */}
                <View style={tutorialStyles.navButtonRowInline}>
                  <TouchableOpacity
                    style={tutorialStyles.skipButtonInline}
                    onPress={endTutorial}
                  >
                    <Text style={tutorialStyles.skipButtonTextGame}>Skip</Text>
                  </TouchableOpacity>
                  
                  <View style={tutorialStyles.navMainButtons}>
                    {tutorialStep > 0 && (
                      <TouchableOpacity
                        style={tutorialStyles.backButtonInline}
                        onPress={() => setTutorialStep(prev => prev - 1)}
                      >
                        <Ionicons name="arrow-back" size={18} color="#666" />
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={[
                        tutorialStyles.nextButtonInline,
                        !isTutorialStepComplete() && { backgroundColor: '#CCC' },
                      ]}
                      disabled={!isTutorialStepComplete()}
                      onPress={() => {
                        if (tutorialStep < TUTORIAL_STEPS.length - 1) {
                          const nextStep = tutorialStep + 1;
                          setTutorialStep(nextStep);
                          // Persist step progress to Supabase
                          gameDatabaseService.saveTutorialProgress({ currentStep: nextStep, stepsCompleted: Array.from({ length: nextStep }, (_, i) => String(i)), tutorialCompleted: false });
                        } else {
                          endTutorial();
                        }
                      }}
                    >
                      <Text style={tutorialStyles.nextButtonTextInline}>
                        {tutorialStep === TUTORIAL_STEPS.length - 1 ? "Done!" : 'Next'}
                      </Text>
                      <Ionicons 
                        name={tutorialStep === TUTORIAL_STEPS.length - 1 ? "checkmark" : "arrow-forward"} 
                        size={16} 
                        color="#FFF" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Closet Modal - Character Selection */}
      <Modal
        visible={showClosetModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowClosetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#9B59B6' }]}>
                <Ionicons name="shirt" size={28} color="white" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>👔 Closet</Text>
                <Text style={styles.modalSubtitle}>Choose your character</Text>
              </View>
            </View>
            
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {Object.entries(CHARACTER_SPRITES).map(([key, char]) => {
                  const isSelected = selectedCharacter === key;
                  const isUnlocked = unlockedSkins.includes(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.characterOption,
                        isSelected && styles.characterOptionSelected,
                        !isUnlocked && styles.characterOptionLocked,
                        { borderColor: isSelected ? char.color : (isUnlocked ? colors.border : '#888') }
                      ]}
                      onPress={() => {
                        if (isUnlocked) {
                          setSelectedCharacter(key);
                          // ── Persist character selection to Supabase ──
                          gameDatabaseService.saveCharacterCustomization({
                            selectedCharacter: key,
                            unlockedCharacters: unlockedSkins,
                          });
                          gameDatabaseService.logActivity({ activityType: 'closet_visit', details: { selected: key } });
                        } else {
                          Alert.alert(
                            '🔒 Skin Locked',
                            `${char.name} is not unlocked yet! Visit the Store in the Achievements screen to purchase this skin with XP.`,
                            [{ text: 'OK' }]
                          );
                        }
                      }}
                    >
                      {/* Character sprite preview - matches Store style */}
                      <View style={[
                        styles.characterPreviewContainer, 
                        { backgroundColor: isUnlocked ? char.color + '20' : '#44444440' }
                      ]}>
                        <Image
                          source={char.sprite}
                          style={{
                            width: 64,
                            height: 64,
                            opacity: isUnlocked ? 1 : 0.4,
                          }}
                          resizeMode="cover"
                        />
                        {!isUnlocked && (
                          <View style={styles.lockedOverlay}>
                            <Ionicons name="lock-closed" size={24} color="#FFF" />
                          </View>
                        )}
                      </View>
                      <View style={styles.characterOptionInfo}>
                        <Text style={[
                          styles.characterOptionName, 
                          { color: isUnlocked ? colors.text : '#888' }
                        ]}>
                          {char.icon} {char.name}
                        </Text>
                        <Text style={[
                          styles.characterOptionDesc, 
                          { color: isUnlocked ? colors.textSecondary : '#666' }
                        ]}>
                          {isUnlocked ? char.description : '🔒 Purchase in Store'}
                        </Text>
                      </View>
                      {isSelected && isUnlocked && (
                        <View style={[styles.characterSelectedBadge, { backgroundColor: char.color }]}>
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            
            <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
              💡 Unlock more skins in Achievements → Store
            </Text>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#FF9800',
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 12,
                marginTop: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setShowClosetModal(false)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notebook Modal - Quick Add Expense */}
      <Modal
        visible={showNotebookModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotebookModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#6B4226' }]}>
                <Ionicons name="book" size={28} color="white" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>📓 Notebook</Text>
                <Text style={styles.modalSubtitle}>Quick Add Any Expense</Text>
              </View>
            </View>

            {/* Tutorial guidance banner inside notebook modal */}
            {tutorialActive && gameMode === 'tutorial' && (
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FF9800' }}>
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontWeight: '600' }}>
                  🎓 Practice logging! Enter any amount and tap Log. This won't be saved to your records.
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 590 }}>
              {/* Category Selection */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.inputLabel, { marginBottom: 12 }]}>Select Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = notebookCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 20,
                          backgroundColor: isSelected ? cat.color : colors.surface,
                          borderWidth: 2,
                          borderColor: isSelected ? cat.color : colors.border,
                        }}
                        onPress={() => setNotebookCategory(cat.id)}
                      >
                        <Text style={{ fontSize: 16, marginRight: 6 }}>{cat.icon}</Text>
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 'bold' : 'normal',
                          color: isSelected ? '#FFF' : colors.text,
                        }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Quick Amount Buttons */}
              <View style={styles.quickAmountsContainer}>
                <Text style={styles.quickAmountsLabel}>Quick amounts:</Text>
                <View style={styles.quickAmountsRow}>
                  {QUICK_AMOUNTS.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.quickAmountButton,
                        expenseAmount === String(amount) && styles.quickAmountButtonActive,
                      ]}
                      onPress={() => setExpenseAmount(String(amount))}
                    >
                      <Text
                        style={[
                          styles.quickAmountText,
                          expenseAmount === String(amount) && styles.quickAmountTextActive,
                        ]}
                      >
                        ₱{amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount (₱)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter custom amount"
                  placeholderTextColor={colors.textSecondary + '80'}
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  editable={!isSubmitting}
                />
              </View>

              {/* Note Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., Lunch at canteen, Bus fare to school..."
                  placeholderTextColor={colors.textSecondary + '80'}
                  multiline
                  numberOfLines={3}
                  value={expenseNote}
                  onChangeText={setExpenseNote}
                  editable={!isSubmitting}
                />
              </View>

              {/* Budget Info (if in Story/Custom Mode) */}
              {(gameMode === 'story' || gameMode === 'custom') && (
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                    📊 Budget Status
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    Remaining: <Text style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                      ₱{getRemainingWeeklyBudget().toFixed(0)}
                    </Text>
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                    {CATEGORY_BUDGET_MAP[notebookCategory] === 'needs' ? '(Counts as Needs - 50%)' : '(Counts as Wants - 30%)'}
                  </Text>
                </View>
              )}

              {/* No Spend Today Button — hidden in tutorial */}
              {!(tutorialActive && gameMode === 'tutorial') && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 2,
                  borderColor: '#4CAF50',
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  marginBottom: 16,
                }}
                onPress={async () => {
                  setIsSubmitting(true);
                  try {
                    // Record a ₱0 entry to mark day as tracked
                    await addExpense({
                      amount: 0,
                      category: 'No Spend Day',
                      description: 'No expenses today - keeping my streak! 🎯',
                      created_at: new Date().toISOString(),
                    });

                    // Check achievements for logging activity
                    const currentStats = await fetchExpenseStats();
                    await checkAchievements('expense_logged', {
                      expenseCount: currentStats?.total || expenseStats.total + 1,
                      category: 'No Spend Day',
                    });

                    // Close modal and reset
                    setShowNotebookModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                    setNotebookCategory('Food & Dining');

                    // Success feedback
                    Alert.alert(
                      '🌟 Great Job!',
                      'No-spend day logged! Your tracking streak continues.',
                      [{ text: 'Awesome!' }]
                    );
                  } catch (error) {
                    console.error('Error logging no-spend day:', error);
                    Alert.alert('Error', 'Failed to log. Please try again.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
              >
                <Ionicons name="checkmark-circle" size={22} color="#4CAF50" style={{ marginRight: 8 }} />
                <Text style={{ color: '#4CAF50', fontSize: 15, fontWeight: '600' }}>
                  No Spend Today
                </Text>
              </TouchableOpacity>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowNotebookModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                    setNotebookCategory('Food & Dining');
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.submitButton, {
                    backgroundColor: EXPENSE_CATEGORIES.find(c => c.id === notebookCategory)?.color || '#4CAF50'
                  }]}
                  onPress={async () => {
                    // Validate amount
                    const amount = parseFloat(expenseAmount);
                    if (!expenseAmount || isNaN(amount) || amount <= 0) {
                      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
                      return;
                    }

                    // Capture values before clearing (same pattern as Canteen)
                    const savedAmount = amount;
                    const savedNote = expenseNote;
                    const savedCategory = notebookCategory;
                    const currentDate = new Date();

                    // Optimistic UI — close modal immediately
                    setShowNotebookModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                    setNotebookCategory('Food & Dining');

                    // ── Tutorial mode: skip DB save, mark condition ──
                    if (tutorialActive && gameMode === 'tutorial') {
                      Alert.alert(
                        '🎓 Practice Expense!',
                        `You practiced logging ₱${savedAmount.toFixed(2)} in ${savedCategory}.\n\nThis wasn't saved — nice work!`,
                        [{ text: 'OK' }]
                      );
                      markTutorialCondition('notebook_expense_logged');
                      console.log('🎓 Tutorial: Skipped notebook expense save (practice mode)');
                      return;
                    }

                    // Quick non-blocking feedback
                    Alert.alert(
                      '✅ Expense Recorded!',
                      `₱${savedAmount.toFixed(2)} added to ${savedCategory}`,
                      [{ text: 'OK' }]
                    );

                    // Optimistic local state updates (instant, no await)
                    setCategorySpending(prev => ({
                      ...prev,
                      [savedCategory]: (prev[savedCategory] || 0) + savedAmount
                    }));

                    if (gameMode === 'story' || gameMode === 'custom') {
                      const budgetType = CATEGORY_BUDGET_MAP[savedCategory] || 'wants';
                      setBudgetCategories(prev => ({
                        ...prev,
                        [budgetType]: {
                          ...prev[budgetType],
                          spent: prev[budgetType].spent + savedAmount
                        }
                      }));
                      setWeeklySpending(prev => prev + savedAmount);
                    }

                    // Save in background — non-blocking
                    try {
                      const expenseData = {
                        amount: savedAmount,
                        category: savedCategory,
                        note: savedNote || `${savedCategory} expense`,
                        date: currentDate.toISOString(),
                      };

                      console.log('💾 Notebook: Saving expense via DataContext:', JSON.stringify(expenseData));
                      const success = await addExpense(expenseData);

                      if (!success) {
                        console.error('❌ Notebook: Failed to save expense');
                        Alert.alert('Sync Error', 'Your expense may not have been saved. Please check your expenses list.');
                      } else {
                        console.log('✅ Notebook: Expense saved successfully');

                        // Persist session spending to Supabase (fire-and-forget)
                        if (activeSessionId && (gameMode === 'story' || gameMode === 'custom')) {
                          const updatedSpending = weeklySpending + savedAmount;
                          const updatedCategorySpending = { ...categorySpending, [savedCategory]: (categorySpending[savedCategory] || 0) + savedAmount };
                          const budgetType = CATEGORY_BUDGET_MAP[savedCategory] || 'wants';
                          const updatedNeedsSpent = budgetCategories.needs.spent + (budgetType === 'needs' ? savedAmount : 0);
                          const updatedWantsSpent = budgetCategories.wants.spent + (budgetType === 'wants' ? savedAmount : 0);

                          const sessionUpdate = {
                            weeklySpending: updatedSpending,
                            categorySpending: updatedCategorySpending,
                            needsSpent: updatedNeedsSpent,
                            wantsSpent: updatedWantsSpent,
                            savingsAmount: weeklyBudget - updatedSpending,
                          };
                          if (gameMode === 'story') {
                            gameDatabaseService.updateStorySessionSpending(activeSessionId, sessionUpdate);
                          } else {
                            gameDatabaseService.updateCustomSessionSpending(activeSessionId, sessionUpdate);
                          }
                        }

                        // Log to Supabase game activity (fire-and-forget)
                        gameDatabaseService.logActivity({
                          activityType: 'expense_recorded',
                          mapId: currentMapId,
                          locationId: currentLocation,
                          amount: savedAmount,
                          details: { category: savedCategory, note: savedNote, source: 'notebook' },
                          sessionId: activeSessionId,
                        });
                        gameDatabaseService.incrementUserLevelStats({ expensesRecorded: 1 });

                        // Achievements — fire-and-forget (no await blocking)
                        checkAchievements('expense_logged', {
                          expenseCount: expenseStats.total + 1,
                          category: savedCategory,
                        }).catch(() => {});
                      }
                    } catch (error) {
                      console.error('❌ Notebook: Error saving expense:', error);
                      Alert.alert('Sync Error', `Your expense may not have been saved: ${error.message || 'Unknown error'}`);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.buttonText, styles.submitButtonText]}>
                    {isSubmitting ? 'Logging...' : `Log Expense ₱${expenseAmount || '0'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Goal Allocation Modal - Level 2 */}
      <Modal
        visible={showGoalAllocationModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowGoalAllocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💰 Allocate to Goals</Text>
            <Text style={styles.modalSubtitle}>
              Available: ₱{getRemainingWeeklyBudget().toFixed(2)}
            </Text>
            
            <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
              {savingsGoals.map((goal) => {
                const allocated = goalAllocations[goal.id] || 0;
                const progress = Math.min(100, (allocated / goal.target) * 100);
                const remaining = goal.target - allocated;
                
                return (
                  <View key={goal.id} style={[styles.goalAllocationItem, { marginBottom: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 24, marginRight: 12 }}>{goal.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{goal.name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          ₱{allocated.toFixed(0)} / ₱{goal.target} ({progress.toFixed(0)}%)
                        </Text>
                      </View>
                    </View>
                    
                    {/* Progress bar */}
                    <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 8 }}>
                      <View style={{ 
                        height: '100%', 
                        width: `${progress}%`, 
                        backgroundColor: progress >= 100 ? '#4CAF50' : '#3498DB',
                        borderRadius: 4 
                      }} />
                    </View>
                    
                    {/* Quick allocation buttons */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[50, 100, 200].map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={[styles.quickAllocateBtn, { 
                            opacity: getRemainingWeeklyBudget() < amount ? 0.5 : 1 
                          }]}
                          disabled={getRemainingWeeklyBudget() < amount}
                          onPress={() => allocateToGoal(goal.id, amount)}
                        >
                          <Text style={styles.quickAllocateBtnText}>+₱{amount}</Text>
                        </TouchableOpacity>
                      ))}
                      {remaining > 0 && getRemainingWeeklyBudget() >= remaining && (
                        <TouchableOpacity
                          style={[styles.quickAllocateBtn, { backgroundColor: '#4CAF50' }]}
                          onPress={() => allocateToGoal(goal.id, remaining)}
                        >
                          <Text style={styles.quickAllocateBtnText}>Fill ₱{remaining.toFixed(0)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#3498DB',
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setShowGoalAllocationModal(false)}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Mode Settings Modal */}
      {gameMode === 'custom' && renderCustomSettingsModal()}

      {/* Level Complete Modal */}
      <Modal
        visible={showLevelComplete}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLevelComplete(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>
              {levelPassed ? '🎉' : '😔'}
            </Text>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>
              {levelPassed ? (gameMode === 'custom' ? 'Challenge Complete!' : 'Level Complete!') : 'Week Ended'}
            </Text>
            
            {/* Level-specific results */}
            {levelResults && (
              <View style={{ width: '100%', marginBottom: 20 }}>
                {levelResults.type === 'budgeting' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.modalSubtitle, { textAlign: 'center', marginBottom: 12 }]}>
                      {levelResults.needsLimit}/{levelResults.wantsLimit}/{levelResults.savingsMin} Rule Results:
                    </Text>
                    <View style={styles.resultRow}>
                      <Text style={{ color: levelResults.needsOk ? '#4CAF50' : '#FF4444', fontSize: 14 }}>
                        {levelResults.needsOk ? '✓' : '✗'} Needs: {levelResults.needsPercent}% (max {levelResults.needsLimit}%)
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={{ color: levelResults.wantsOk ? '#4CAF50' : '#FF4444', fontSize: 14 }}>
                        {levelResults.wantsOk ? '✓' : '✗'} Wants: {levelResults.wantsPercent}% (max {levelResults.wantsLimit}%)
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={{ color: levelResults.savingsOk ? '#4CAF50' : '#FF4444', fontSize: 14 }}>
                        {levelResults.savingsOk ? '✓' : '✗'} Savings: {levelResults.savingsPercent}% (min {levelResults.savingsMin}%)
                      </Text>
                    </View>
                  </View>
                )}
                
                {levelResults.type === 'goals' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.modalSubtitle, { textAlign: 'center', marginBottom: 12 }]}>
                      Goal Progress Results:
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center' }}>
                      You allocated ₱{levelResults.totalAllocated.toFixed(2)} to your goals
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center' }}>
                      Progress: {levelResults.goalProgress}% of target
                    </Text>
                    <Text style={{ color: parseFloat(levelResults.goalProgress) >= (levelResults.minProgress || 80) ? '#4CAF50' : '#FF4444', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>
                      {parseFloat(levelResults.goalProgress) >= (levelResults.minProgress || 80) ? '✓ Goal reached!' : `✗ Need ${levelResults.minProgress || 80}% to pass`}
                    </Text>
                  </View>
                )}
                
                {levelResults.type === 'saving' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.modalSubtitle, { textAlign: 'center', marginBottom: 12 }]}>
                      Savings Results:
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center' }}>
                      You saved ₱{levelResults.amountSaved.toFixed(2)}
                    </Text>
                    <Text style={{ color: parseFloat(levelResults.savingsPercent) >= levelResults.savingsGoal ? '#4CAF50' : '#FF4444', fontSize: 16, textAlign: 'center', fontWeight: 'bold' }}>
                      {levelResults.savingsPercent}% saved (Goal: {levelResults.savingsGoal}%)
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={{ width: '100%', gap: 12 }}>
              {/* Next Level button - only for Story Mode levels 1-2 */}
              {gameMode === 'story' && levelPassed && storyLevel < 3 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FF9800',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    setShowLevelComplete(false);
                    openLevelIntro(storyLevel + 1);
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                    Next Level →
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Story Complete button — Level 3 passed → triggers completion dialogue */}
              {gameMode === 'story' && levelPassed && storyLevel === 3 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFD700',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    setShowLevelComplete(false);
                    setCompletionPage(0);
                    setCompletionDisplayedText('');
                    setCompletionTypingDone(false);
                    setShowCompletionDialogue(true);
                  }}
                >
                  <Text style={{ color: '#1a1a2e', fontSize: 16, fontWeight: 'bold' }}>
                    ⭐ Continue
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Replay/Try Again button */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#3498DB',
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  setShowLevelComplete(false);
                  if (gameMode === 'custom') {
                    // For custom mode, restart with same settings
                    startCustomMode();
                  } else {
                    startStoryLevel(storyLevel);
                  }
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                  {levelPassed ? (gameMode === 'custom' ? 'Play Again' : 'Replay Level') : 'Try Again'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(100,100,100,0.5)',
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
                onPress={() => {
                  setShowLevelComplete(false);
                  setShowMainMenu(true);
                  setGameMode(null);
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                  Back to Menu
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Abandon / End Session Confirmation Modal */}
      <Modal
        visible={showAbandonModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAbandonModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.travelModalContent, { alignItems: 'center', paddingVertical: 30 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 8, textAlign: 'center' }}>
              End Session?
            </Text>
            <Text style={{ fontSize: 14, color: '#BBB', textAlign: 'center', marginBottom: 24, paddingHorizontal: 12 }}>
              Ending the session will reset your progress for this level. You will need to start over.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%', paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(100,100,100,0.6)',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
                onPress={() => setShowAbandonModal(false)}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#E53935',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleConfirmAbandon}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>Give Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Travel Modal */}
      <Modal
        visible={showTravelModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTravelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.travelModalContent}>
            <Text style={styles.travelTitle}>🚪 Where to?</Text>
            <Text style={styles.travelSubtitle}>Choose your destination</Text>

            {/* Tutorial guidance banner inside travel modal */}
            {tutorialActive && gameMode === 'tutorial' && (
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FF9800' }}>
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontWeight: '600' }}>
                  {TUTORIAL_STEPS[tutorialStep]?.id === 'exit_door' 
                    ? '🎓 Choose School to continue the tutorial!'
                    : TUTORIAL_STEPS[tutorialStep]?.id === 'go_to_mall'
                    ? '🎓 Choose the Mall to continue!'
                    : '🎓 Pick a destination!'}
                </Text>
              </View>
            )}

            {travelDestinations.map((destId) => {
              const dest = MAPS[destId];
              if (!dest) return null;
              return (
                <TouchableOpacity
                  key={destId}
                  style={styles.destinationButton}
                  onPress={() => handleSelectDestination(destId)}
                >
                  <Text style={styles.destinationIcon}>{dest.icon}</Text>
                  <View style={styles.destinationInfo}>
                    <Text style={styles.destinationName}>{dest.name}</Text>
                    <Text style={styles.destinationDesc}>
                      {dest.locations.length} locations to explore
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.travelCancelButton}
              onPress={() => setShowTravelModal(false)}
            >
              <Text style={styles.travelCancelText}>Stay here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transport Mode Modal */}
      <Modal
        visible={showTransportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowTransportModal(false);
          setSelectedDestination(null);
          setTransportMode(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={transportStyles.transportModalContent}>
            {/* Header */}
            <View style={transportStyles.transportHeader}>
              <Text style={transportStyles.transportTitle}>🚗 Mode of Transport</Text>
              <Text style={transportStyles.transportSubtitle}>
                How will you travel to {selectedDestination ? MAPS[selectedDestination]?.name : ''}?
              </Text>
            </View>

            {/* Tutorial guidance banner inside transport modal */}
            {tutorialActive && gameMode === 'tutorial' && (
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FF9800' }}>
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontWeight: '600' }}>
                  {!transportMode && !tutorialViewedCar
                    ? '🎓 First, try the Car option to learn about gas tracking!'
                    : !transportMode && tutorialViewedCar
                    ? '🎓 Great! Now choose Commute to log your fare!'
                    : transportMode === 'car'
                    ? '🎓 You can track gas expenses here! Now go back and try Commute.'
                    : transportMode === 'commute'
                    ? '🎓 Enter your commute fare and confirm! This is practice only.'
                    : '🎓 Pick a transport mode!'
                  }
                </Text>
              </View>
            )}

            {/* Transport Mode Selection */}
            {!transportMode && (
              <View style={transportStyles.modeSelection}>
                <TouchableOpacity
                  style={transportStyles.modeButton}
                  onPress={() => handleTransportModeSelect('commute')}
                >
                  <View style={[transportStyles.modeIconContainer, { backgroundColor: '#3498DB' }]}>
                    <Ionicons name="bus" size={32} color="#FFF" />
                  </View>
                  <View style={transportStyles.modeInfo}>
                    <Text style={transportStyles.modeName}>Commute</Text>
                    <Text style={transportStyles.modeDesc}>Bus, Jeepney, Tricycle, etc.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={transportStyles.modeButton}
                  onPress={() => handleTransportModeSelect('car')}
                >
                  <View style={[transportStyles.modeIconContainer, { backgroundColor: '#E74C3C' }]}>
                    <Ionicons name="car" size={32} color="#FFF" />
                  </View>
                  <View style={transportStyles.modeInfo}>
                    <Text style={transportStyles.modeName}>Car</Text>
                    <Text style={transportStyles.modeDesc}>Private vehicle or motorcycle</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Commute Fare Input */}
            {transportMode === 'commute' && (
              <View style={transportStyles.inputSection}>
                <TouchableOpacity 
                  style={transportStyles.backToModes}
                  onPress={() => setTransportMode(null)}
                >
                  <Ionicons name="arrow-back" size={20} color="#3498DB" />
                  <Text style={transportStyles.backToModesText}>Change transport mode</Text>
                </TouchableOpacity>

                <View style={transportStyles.selectedModeHeader}>
                  <View style={[transportStyles.modeIconSmall, { backgroundColor: '#3498DB' }]}>
                    <Ionicons name="bus" size={24} color="#FFF" />
                  </View>
                  <Text style={transportStyles.selectedModeName}>Commute Fare</Text>
                </View>

                <Text style={transportStyles.inputLabel}>How much was the fare?</Text>
                <View style={transportStyles.amountInputContainer}>
                  <Text style={transportStyles.currencySymbol}>₱</Text>
                  <TextInput
                    style={transportStyles.amountInput}
                    placeholder="0"
                    placeholderTextColor="#888"
                    value={fareAmount}
                    onChangeText={setFareAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>

                {/* Quick fare amounts */}
                <View style={transportStyles.quickAmounts}>
                  {[10, 15, 20, 30, 50].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        transportStyles.quickAmountBtn,
                        fareAmount === String(amount) && transportStyles.quickAmountActive
                      ]}
                      onPress={() => setFareAmount(String(amount))}
                    >
                      <Text style={[
                        transportStyles.quickAmountText,
                        fareAmount === String(amount) && transportStyles.quickAmountTextActive
                      ]}>₱{amount}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    transportStyles.confirmButton,
                    (!fareAmount || parseFloat(fareAmount) < 0) && transportStyles.confirmButtonDisabled
                  ]}
                  onPress={confirmTravel}
                  disabled={!fareAmount || parseFloat(fareAmount) < 0}
                >
                  <Text style={transportStyles.confirmButtonText}>
                    Confirm & Travel 🚌
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Car/Fuel Input */}
            {transportMode === 'car' && (
              <View style={transportStyles.inputSection}>
                <TouchableOpacity 
                  style={transportStyles.backToModes}
                  onPress={() => setTransportMode(null)}
                >
                  <Ionicons name="arrow-back" size={20} color="#E74C3C" />
                  <Text style={transportStyles.backToModesText}>Change transport mode</Text>
                </TouchableOpacity>

                <View style={transportStyles.selectedModeHeader}>
                  <View style={[transportStyles.modeIconSmall, { backgroundColor: '#E74C3C' }]}>
                    <Ionicons name="car" size={24} color="#FFF" />
                  </View>
                  <Text style={transportStyles.selectedModeName}>Car / Motorcycle</Text>
                </View>

                <Text style={transportStyles.fuelQuestion}>Did you buy fuel?</Text>
                
                <View style={transportStyles.fuelOptions}>
                  <TouchableOpacity
                    style={[
                      transportStyles.fuelOptionBtn,
                      didBuyFuel === true && transportStyles.fuelOptionActive
                    ]}
                    onPress={() => setDidBuyFuel(true)}
                  >
                    <Ionicons 
                      name="checkmark-circle" 
                      size={24} 
                      color={didBuyFuel === true ? '#FFF' : '#4CAF50'} 
                    />
                    <Text style={[
                      transportStyles.fuelOptionText,
                      didBuyFuel === true && transportStyles.fuelOptionTextActive
                    ]}>Yes, I bought gas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      transportStyles.fuelOptionBtn,
                      didBuyFuel === false && transportStyles.fuelOptionActiveNo
                    ]}
                    onPress={() => setDidBuyFuel(false)}
                  >
                    <Ionicons 
                      name="close-circle" 
                      size={24} 
                      color={didBuyFuel === false ? '#FFF' : '#888'} 
                    />
                    <Text style={[
                      transportStyles.fuelOptionText,
                      didBuyFuel === false && transportStyles.fuelOptionTextActive
                    ]}>No fuel needed</Text>
                  </TouchableOpacity>
                </View>

                {/* Fuel amount input (only if yes) */}
                {didBuyFuel === true && (
                  <View style={transportStyles.fuelAmountSection}>
                    <Text style={transportStyles.inputLabel}>How much did you spend on gas?</Text>
                    <View style={transportStyles.amountInputContainer}>
                      <Text style={transportStyles.currencySymbol}>₱</Text>
                      <TextInput
                        style={transportStyles.amountInput}
                        placeholder="0"
                        placeholderTextColor="#888"
                        value={fuelAmount}
                        onChangeText={setFuelAmount}
                        keyboardType="numeric"
                        autoFocus
                      />
                    </View>

                    {/* Quick fuel amounts */}
                    <View style={transportStyles.quickAmounts}>
                      {[100, 200, 500, 1000].map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={[
                            transportStyles.quickAmountBtn,
                            fuelAmount === String(amount) && transportStyles.quickAmountActive
                          ]}
                          onPress={() => setFuelAmount(String(amount))}
                        >
                          <Text style={[
                            transportStyles.quickAmountText,
                            fuelAmount === String(amount) && transportStyles.quickAmountTextActive
                          ]}>₱{amount}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Confirm button for car */}
                {didBuyFuel !== null && (
                  <TouchableOpacity
                    style={[
                      transportStyles.confirmButton,
                      transportStyles.confirmButtonCar,
                      (didBuyFuel && (!fuelAmount || parseFloat(fuelAmount) <= 0)) && transportStyles.confirmButtonDisabled
                    ]}
                    onPress={confirmTravel}
                    disabled={didBuyFuel && (!fuelAmount || parseFloat(fuelAmount) <= 0)}
                  >
                    <Text style={transportStyles.confirmButtonText}>
                      {didBuyFuel ? `Confirm & Travel 🚗` : 'Continue Without Expense 🚗'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Cancel button */}
            <TouchableOpacity
              style={transportStyles.cancelButton}
              onPress={() => {
                setShowTransportModal(false);
                setSelectedDestination(null);
                setTransportMode(null);
                setShowTravelModal(true); // Go back to destination selection
              }}
            >
              <Text style={transportStyles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Expense Entry Modal */}
      <Modal
        visible={showExpenseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: expenseCategory === 'Food & Dining' ? '#FF9800' : '#4CAF50' }]}>
                <Ionicons 
                  name={expenseCategory === 'Food & Dining' ? 'fast-food' : 'cart'} 
                  size={30} 
                  color="white" 
                />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>{currentMap.icon} {expenseCategory}</Text>
                <Text style={styles.modalSubtitle}>What did you buy?</Text>
              </View>
            </View>

            {/* Tutorial guidance banner inside expense modal */}
            {tutorialActive && gameMode === 'tutorial' && (
              <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FF9800' }}>
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontWeight: '600' }}>
                  🎓 Practice time! Log an expense here. It won't be saved to your records.
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Quick Amount Buttons */}
              <View style={styles.quickAmountsContainer}>
                <Text style={styles.quickAmountsLabel}>Quick amounts:</Text>
                <View style={styles.quickAmountsRow}>
                  {QUICK_AMOUNTS.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.quickAmountButton,
                        expenseAmount === String(amount) && styles.quickAmountButtonActive,
                      ]}
                      onPress={() => setExpenseAmount(String(amount))}
                    >
                      <Text
                        style={[
                          styles.quickAmountText,
                          expenseAmount === String(amount) && styles.quickAmountTextActive,
                        ]}
                      >
                        ₱{amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount (₱)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter custom amount"
                  placeholderTextColor={colors.textSecondary + '80'}
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>What did you buy?</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., Burger, fries, and juice"
                  placeholderTextColor={colors.textSecondary + '80'}
                  multiline
                  numberOfLines={3}
                  value={expenseNote}
                  onChangeText={setExpenseNote}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowExpenseModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.submitButton]}
                  onPress={handleSubmitExpense}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.buttonText, styles.submitButtonText]}>
                    {isSubmitting ? 'Logging...' : 'Log ₱' + (expenseAmount || '0')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Achievement Unlocked Modal */}
      <Modal
        visible={showAchievementModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAchievementModal(false)}
      >
        <View style={styles.achievementModalOverlay}>
          <View style={styles.achievementModalContent}>
            <View style={styles.achievementGlow} />
            <Text style={styles.achievementUnlockedText}>🏆 ACHIEVEMENT UNLOCKED!</Text>
            {newAchievement && (
              <>
                <Text style={styles.achievementIcon}>{newAchievement.icon}</Text>
                <Text style={styles.achievementTitle}>{newAchievement.name}</Text>
                <Text style={styles.achievementDescription}>{newAchievement.description}</Text>
                <View style={styles.achievementPoints}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.achievementPointsText}>+{newAchievement.points} XP</Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={styles.achievementCloseButton}
              onPress={() => setShowAchievementModal(false)}
            >
              <Text style={styles.achievementCloseText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
