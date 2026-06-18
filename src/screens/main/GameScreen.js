import React, { useState, useRef, useContext, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ImageBackground, Dimensions, TouchableWithoutFeedback, Animated, Modal, Text, TextInput, TouchableOpacity, Alert, ScrollView, SectionList, Easing, Image, useWindowDimensions, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { supabase } from '../../config/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collisionSystem } from '../../utils/CollisionSystem';
import { AchievementService } from '../../services/AchievementService';
import AnimatedBar from '../../components/AnimatedBar';
import gameDatabaseService from '../../services/GameDatabaseService';
import { normalizeCategory } from '../../utils/categoryUtils';
import { getCategoryIcon } from '../../utils/categoryIcons';
import {
  STORY_DAILY_TASKS,
  STORY_DAY_COUNTS,
  NEEDS_CATEGORIES,
  WANTS_CATEGORIES,
  getStoryDayTasks,
  getStoryDayDisplayNumber,
  getStoryLevelDisplayTotalDays,
} from '../../config/storyDailyTasks';
import { evaluateDailyTaskRule } from '../../utils/storyDailyTaskEvaluator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTutorial, TUTORIAL_PHASE } from '../../context/TutorialContext';
import DailyTaskPopup from '../../components/DailyTaskPopup';
import EndOfDayReportModal from '../../components/EndOfDayReportModal';
import { useGameAudio } from '../../context/AudioContext';
import { FONTS } from '../../theme/typography';

const { width: INITIAL_WIDTH, height: INITIAL_HEIGHT } = Dimensions.get('window');
const CHARACTER_SIZE = 48;

// Quick amount options for canteen
const QUICK_AMOUNTS = [20, 50, 100, 150];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_TASK_STORAGE_KEY_PREFIX = 'story_daily_task_state_';
const DEBUG_MOVEMENT = false;

// Dynamic Level Mapping Configuration
const LEVEL_CONFIG = {
  1: { maxDays: 3 },
  2: { maxDays: 3 },
  3: { maxDays: 4 },
  // Easily scalable for future levels - just add new entries
};

// Sub-categories per expense category
const SUBCATEGORIES = {
  'Food & Dining': [],
  'Transport': ['Public Transit', 'Ride-Hailing & Taxis', 'Fuel & Gas', 'Parking & Tolls'],
  'Shopping': ['Clothing & Footwear', 'Personal Care & Beauty', 'Gifts', 'Home Decor', 'Others'],
  'Groceries': ['Food & Pantry', 'Toiletries', 'Cleaning Supplies', 'Others'],
  'Entertainment': ['Gaming', 'Digital Subscriptions', 'Personal Hobbies', 'Events & Outings', 'Others'],
  'Electronics': ['Hardware & Gadgets', 'Accessories & Peripherals', 'Repairs', 'Software Licenses & Web Hosting'],
  'School Supplies': ['Textbooks & Literature', 'Stationery', 'Printing & Copying'],
  'Education': ['Tuition & Lab Fees', 'Seminars & Workshops', 'Others'],
  'Utilities': ['Electricity', 'Water', 'Internet & Mobile', 'Rent & Dues', 'Others'],
  'Health': ['Medicines & Pharmacy', 'Fitness & Sports', 'Dental & Medical Visits', 'Personal Care & First Aid', 'Others'],
  'Other': [],
};

// Map configurations - expandable for more maps
const MAPS = {
  school: {
    id: 'school',
    name: 'School Campus',
    icon: '🏫',
    image: require('../../../assets/Game_Graphics/maps/School/Map004.png'),
    spawnPoint: { xPct: 0.30, yPct: 0.55 },
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
        destinations: ['dorm', 'mall_1f', 'office'],
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
    spawnPoint: { xPct: 0.5, yPct: 0.5 },
    locations: [
      {
        id: 'door',
        name: 'Exit Door',
        icon: '🚪',
        bounds: { left: 0.35, right: 0.65, top: 0.92, bottom: 1 },
        action: 'travel',
        destinations: ['school', 'mall_1f', 'office'],
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
  office: {
    id: 'office',
    name: 'Office',
    icon: '🏢',
    image: require('../../../assets/Game_Graphics/maps/Office/Map010.png'),
    spawnPoint: { xPct: 0.85, yPct: 0.82 },
    locations: [
      {
        id: 'office_exit',
        name: 'Office Exit',
        icon: '🚪',
        bounds: { left: 0.75, right: 0.90, top: 0.88, bottom: 1.0 },
        action: 'travel',
        destinations: ['dorm', 'school', 'mall_1f'],
        exitSpawnPoint: { x: 0.81, y: 0.90 },
      },
      // {
      //   id: 'reception',
      //   name: 'Reception',
      //   icon: '🗂️',
      //   bounds: { left: 0.06, right: 0.32, top: 0.17, bottom: 0.34 },
      //   action: 'expense',
      //   category: 'Utilities',
      // },
      // {
      //   id: 'workstations',
      //   name: 'Workstations',
      //   icon: '💻',
      //   bounds: { left: 0.54, right: 0.94, top: 0.30, bottom: 0.56 },
      //   action: 'expense',
      //   category: 'Electronics',
      // },
      // {
      //   id: 'print_station',
      //   name: 'Print Station',
      //   icon: '🖨️',
      //   bounds: { left: 0.60, right: 0.84, top: 0.60, bottom: 0.76 },
      //   action: 'expense',
      //   category: 'School Supplies',
      // },
      {
        id: 'pantry',
        name: 'Pantry',
        icon: '☕',
        bounds: { left: 0.50, right: 0.83, top: 0.05, bottom: 0.40 },
        action: 'expense',
        category: 'Food & Dining',
      },
      // {
      //   id: 'meeting_room',
      //   name: 'Meeting Room',
      //   icon: '📊',
      //   bounds: { left: 0.70, right: 0.92, top: 0.06, bottom: 0.22 },
      //   action: 'expense',
      //   category: 'Education',
      // },
    ],
  },
  // Mall 1st Floor (Map006) - stores + exit + escalator up
  mall_1f: {
    id: 'mall_1f',
    name: 'Mall',
    icon: '🏬',
    image: require('../../../assets/Game_Graphics/maps/Mall/Map006.png'),
    spawnPoint: { xPct: 0.5, yPct: 0.5 },
    locations: [
      {
        id: 'entrance',
        name: 'Mall Exit',
        icon: '🚪',
        bounds: { left: 0.70, right: 1.0, top: 0.82, bottom: 1.0 },
        action: 'travel',
        destinations: ['school', 'dorm', 'office'],
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
    spawnPoint: { xPct: 0.5, yPct: 0.5 },
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
    spawnPoint: { xPct: 0.32, yPct: 0.7 },
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
        bounds: { left: 0.35, right: 0.65, top: 0.10, bottom: 0.28 },
        action: 'expense',
        category: 'Entertainment',
      },
    ],
  },
};

const STORY_MODE_ALLOWED_MAPS = {
  student: ['dorm', 'school', 'mall_1f', 'mall_2f', 'mall_3f'],
  employee: ['dorm', 'office', 'mall_1f', 'mall_2f', 'mall_3f'],
};

// ─── NPC Sprite Assets ───────────────────────────────────────────────────────
const NPC_SPRITES = {
  Library_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Library_Worker.png'),
  Food_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Food_Worker.png'),
  Clothing_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Clothing_Worker.png'),
  Grocery_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Grocery_Worker.png'),
  Cafe_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Cafe_Worker.png'),
  Games_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Games_Worker.png'),
  Gym_Worker: require('../../../assets/Game_Graphics/Character_Animation/Workers/Gym_Worker.png'),
};

// ─── NPC Placement Config ────────────────────────────────────────────────────
// To reposition an NPC, simply change its tileX / tileY values.
// Directions: 'right' | 'up' | 'left' | 'down'
// All maps are 11 tiles wide × 24 tiles tall (48 px per tile).
const NPC_POSITIONS = {
  school: [
    { id: 'library_worker', sprite: 'Library_Worker', tileX: 10, tileY: 15, direction: 'left' },
    { id: 'canteen_worker', sprite: 'Food_Worker', tileX: 10, tileY: 21, direction: 'left' },
  ],
  mall_1f: [
    { id: 'clothing_worker', sprite: 'Clothing_Worker', tileX: 1, tileY: 12, direction: 'right' },
    { id: 'grocery_worker', sprite: 'Grocery_Worker', tileX: 10, tileY: 5, direction: 'left' },
  ],
  mall_2f: [
    { id: 'foodcourt_worker', sprite: 'Food_Worker', tileX: 7, tileY: 4, direction: 'down' },
    { id: 'cafe_worker', sprite: 'Cafe_Worker', tileX: 6, tileY: 21, direction: 'right' },
  ],
  mall_3f: [
    { id: 'games_worker', sprite: 'Games_Worker', tileX: 5, tileY: 3, direction: 'down' },
    { id: 'gym_worker', sprite: 'Gym_Worker', tileX: 10, tileY: 16, direction: 'left' },
  ],
  office: [
    { id: 'receptionist', sprite: 'Library_Worker', tileX: 3, tileY: 7, direction: 'down' },
    { id: 'office_staff', sprite: 'Clothing_Worker', tileX: 2, tileY: 17, direction: 'right' },
    { id: 'pantry_staff', sprite: 'Food_Worker', tileX: 8, tileY: 6, direction: 'down' },
  ],
};

export default function BuildScreen() {
  const { colors } = useTheme();
  const { user } = useContext(AuthContext);
  const { addExpense, expenses } = useContext(DataContext);
  const { startGameTutorial: startContextTutorial, markConditionComplete, cancelTutorial, tutorialPhase } = useTutorial();
  const navigation = useNavigation();

  // Background music lives in AudioContext (global, survives this unmount).
  // Here we only drive the "distant room" illusion: full audio when this
  // screen is focused, muffled (low volume + dropped pitch) when it is not.
  const isFocused = useIsFocused();
  const { enterRoom, exitRoom } = useGameAudio();

  useEffect(() => {
    if (isFocused) {
      enterRoom();
    } else {
      exitRoom();
    }
  }, [isFocused, enterRoom, exitRoom]);

  // ─── Responsive dimensions ─────────────────────────────────────────
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Helper: resolve a percentage-based spawn point to actual pixels
  const resolveSpawn = useCallback(
    (sp, w = screenWidth, h = screenHeight) => ({
      x: w * (sp.xPct ?? 0.5),
      y: h * (sp.yPct ?? 0.5),
    }),
    [screenWidth, screenHeight],
  );

  // Helper: resolve where the character should APPEAR when entering a map.
  // Priority (Issue 2 — continuous travel):
  //   1. explicit per-origin entryPoints[fromMapId]
  //   2. floor_change escalator that leads back to fromMapId (mall floors)
  //   3. the map's travel-exit door (exitSpawnPoint) — single-door maps
  //   4. default centre spawnPoint
  // Percentages are relative to the rendered content area, so callers pass
  // contentSize (NOT screen) dimensions.
  const resolveEntrySpawn = useCallback(
    (map, fromMapId, w, h) => {
      if (!map) return { x: w * 0.5, y: h * 0.5 };

      const perOrigin = fromMapId && map.entryPoints?.[fromMapId];
      if (perOrigin) return { x: w * perOrigin.x, y: h * perOrigin.y };

      const arrivalEscalator = map.locations?.find(
        (loc) =>
          loc.action === 'floor_change' &&
          loc.targetFloor === fromMapId &&
          loc.exitSpawnPoint,
      );
      if (arrivalEscalator) {
        return {
          x: w * arrivalEscalator.exitSpawnPoint.x,
          y: h * arrivalEscalator.exitSpawnPoint.y,
        };
      }

      const travelExit = map.locations?.find(
        (loc) => loc.action === 'travel' && loc.exitSpawnPoint,
      );
      if (travelExit) {
        return {
          x: w * travelExit.exitSpawnPoint.x,
          y: h * travelExit.exitSpawnPoint.y,
        };
      }

      return resolveSpawn(map.spawnPoint, w, h);
    },
    [resolveSpawn],
  );

  // Current map state
  const [currentMapId, setCurrentMapId] = useState('dorm');
  const currentMap = MAPS[currentMapId];
  // Set by travel/floor handlers right before they switch currentMapId: tells the
  // map-change effect to land at the doorway we came through instead of the room
  // centre. Shape: { mapId, fromMapId }. Consumed + cleared by the effect. (Issue 2)
  const pendingEntrySpawnRef = useRef(null);

  const profileUserType = user?.userType === 'employee' ? 'employee' : 'student';

  // Character position — resolve spawn point from percentages using initial screen size
  const initialSpawn = { x: INITIAL_WIDTH * (currentMap.spawnPoint.xPct ?? 0.5), y: INITIAL_HEIGHT * (currentMap.spawnPoint.yPct ?? 0.5) };
  const [characterPosition, setCharacterPosition] = useState(initialSpawn);
  const characterPositionRef = useRef(initialSpawn);
  const animatedX = useRef(new Animated.Value(initialSpawn.x - CHARACTER_SIZE / 2)).current;
  const animatedY = useRef(new Animated.Value(initialSpawn.y - CHARACTER_SIZE / 2)).current;
  const animatedPositionRef = useRef({
    x: initialSpawn.x - CHARACTER_SIZE / 2,
    y: initialSpawn.y - CHARACTER_SIZE / 2,
  });
  const [isWalking, setIsWalking] = useState(false);
  const [todaySpending, setTodaySpending] = useState(0);
  const walkingPulse = useRef(new Animated.Value(1)).current;
  const walkingPulseAnimationRef = useRef(null);

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food & Dining');
  const [expenseSubCategory, setExpenseSubCategory] = useState(null);
  const [showSubCategoryDropdown, setShowSubCategoryDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('Hallway 🚶');
  const currentLocationRef = useRef('Hallway 🚶');
  const [showInstructions, setShowInstructions] = useState(true);

  const commitCurrentLocation = useCallback((nextLocation) => {
    if (currentLocationRef.current !== nextLocation) {
      currentLocationRef.current = nextLocation;
      setCurrentLocation(nextLocation);
    }
  }, []);

  const commitCharacterPosition = useCallback((nextPosition) => {
    characterPositionRef.current = nextPosition;
    setCharacterPosition(nextPosition);
  }, []);

  const setAnimatedPosition = useCallback((x, y) => {
    animatedX.setValue(x);
    animatedY.setValue(y);
    animatedPositionRef.current = { x, y };
  }, [animatedX, animatedY]);

  // Mirror the native-driven animated values into a JS ref so movement math
  // can read the live character position.
  //
  // IMPORTANT: this must re-run every time the game view re-mounts. Tapping the
  // home button sets showMainMenu=true, which early-returns the render and
  // unmounts the character's <Animated.View>. On unmount, React Native's
  // AnimatedNode.__detach() calls removeAllListeners() — destroying these
  // listeners AND the native value-update subscription, and resetting the
  // value's native tag. With stable [animatedX, animatedY] deps this effect
  // never re-ran on re-entry, so the listeners stayed dead and
  // animatedPositionRef froze at the previous session's position — causing the
  // character to rubber-band/teleport back on the next redirect. Keying on
  // showMainMenu re-registers the listeners (and re-subscribes to the new
  // native node) each time we return to the game view.
  useEffect(() => {
    if (showMainMenu) return; // game view (and its native animated nodes) not mounted

    const xId = animatedX.addListener(({ value }) => {
      animatedPositionRef.current = { x: value, y: animatedPositionRef.current.y };
    });
    const yId = animatedY.addListener(({ value }) => {
      animatedPositionRef.current = { x: animatedPositionRef.current.x, y: value };
    });

    return () => {
      animatedX.removeListener(xId);
      animatedY.removeListener(yId);
    };
  }, [showMainMenu, animatedX, animatedY]);

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
  const [gameMode, setGameMode] = useState(null); // 'story' or 'tutorial'
  const [showHowToPlay, setShowHowToPlay] = useState(false); // Legacy - not used anymore
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialActive, setTutorialActive] = useState(false); // In-game tutorial mode
  const [tutorialCompleted, setTutorialCompleted] = useState(false); // Persisted — gates Story Mode
  const [tutorialConditions, setTutorialConditions] = useState(new Set()); // Tracks step completion conditions
  const [tutorialViewedCar, setTutorialViewedCar] = useState(false); // Track if car transport was viewed in tutorial

  const isStoryModeMapAllowed = useCallback((mapId) => {
    if (gameMode !== 'story') return true;
    const allowedMaps = STORY_MODE_ALLOWED_MAPS[profileUserType] || STORY_MODE_ALLOWED_MAPS.student;
    return allowedMaps.includes(mapId);
  }, [gameMode, profileUserType]);

  const filterStoryModeDestinations = useCallback((destinations = []) => {
    if (gameMode !== 'story') return destinations;
    return destinations.filter((destId) => isStoryModeMapAllowed(destId));
  }, [gameMode, isStoryModeMapAllowed]);

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
    // Also notify TutorialContext so KoinTutorialOverlay can react
    markConditionComplete(conditionKey);
    // Auto-advance: if this condition matches the current step, move forward
    const currentStep = TUTORIAL_STEPS[tutorialStep];
    if (currentStep && currentStep.conditionKey === conditionKey) {
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
    // {
    //   id: 'budget_intro',
    //   title: "Budget Tracker 📊",
    //   message: " See the Budget Tracker at the top? It shows your daily spending and weekly budget. Keep an eye on it!",
    //   nextAlwaysEnabled: true,
    //   conditionKey: null,
    //   position: 'bottom',
    //   highlight: 'header',
    // },
    {
      id: 'walk_around',
      title: "Move Around! 🏠",
      message: "Hi! I'm Koin, your financial buddy! This is your room! Tap anywhere on the screen to walk your character around. Try it now!",
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
    // Also start the new KoinTutorialOverlay system
    startContextTutorial();
    // Persist tutorial start to Supabase
    gameDatabaseService.saveTutorialProgress({ currentStep: 0, stepsCompleted: [], tutorialCompleted: false });
    gameDatabaseService.logActivity({ activityType: 'tutorial_step', details: { step: 0, action: 'started' } });
  };

  // End tutorial — the in-game part is done, Koin will continue with the App Tour
  const endTutorial = useCallback(() => {
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
  }, [user?.id]);

  // Auto-detect when TutorialContext finishes the GAME_TUTORIAL phase
  // and clean up GameScreen local state (exit to main menu, unlock Story Mode)
  const prevTutorialPhaseRef = useRef(tutorialPhase);
  useEffect(() => {
    const prevPhase = prevTutorialPhaseRef.current;
    prevTutorialPhaseRef.current = tutorialPhase;
    // If we were in GAME_TUTORIAL and now transitioned to APP_TOUR or beyond, end the game tutorial
    if (prevPhase === TUTORIAL_PHASE.GAME_TUTORIAL && tutorialPhase !== TUTORIAL_PHASE.GAME_TUTORIAL) {
      endTutorial();
    }
  }, [tutorialPhase, endTutorial]);

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
  const [activeSessionId, setActiveSessionId] = useState(null); // Supabase session id for story
  const [dailyTaskCompletion, setDailyTaskCompletion] = useState({}); // { [conditionKey]: true }
  const [dailyTaskRuntimeByDay, setDailyTaskRuntimeByDay] = useState({}); // { [dayNumber]: {...runtime} }
  const dailyTaskRuntimeByDayRef = useRef({}); // Ref mirror — always fresh for async callbacks
  const [activeStoryDay, setActiveStoryDay] = useState(1);
  const dailyTaskAnnouncedDayRef = useRef(null);
  const isHydratingDailyTaskStateRef = useRef(false);

  // End of Day/Level Progression State
  const [dailyTasksCompleted, setDailyTasksCompleted] = useState(false); // Tracks if all daily tasks are checked
  const [dayReportViewed, setDayReportViewed] = useState(false); // Tracks if day report has been viewed
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState(null); // Last saved progress timestamp
  // Anchor marking when the CURRENT in-game day began. "Today's Spending" counts an
  // expense only when its created_at >= this value. Persisted (AsyncStorage) so the
  // boundary survives reloads/resumes; ref mirror lets async fetchers read fresh value.
  const [currentInGameDayStartTimestamp, setCurrentInGameDayStartTimestamp] = useState(null);
  const currentInGameDayStartRef = useRef(null);
  const [showDayReportNotification, setShowDayReportNotification] = useState(false); // UI: color of Day Report Modal icon
  const [hasUnreadReport, setHasUnreadReport] = useState(false);
  const [showLevelCompleteModal, setShowLevelCompleteModal] = useState(false); // Level Complete modal visibility
  const [showDayReportModal, setShowDayReportModal] = useState(false);
  const [liveDayReportData, setLiveDayReportData] = useState(null);

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
  // Mirror latest allocations into a ref. fetchWeeklySpending runs from an effect
  // whose closure can be stale; reading the ref guarantees it re-adds the CURRENT
  // committed allocations and never refunds them on a day transition. (Issue 1)
  const goalAllocationsRef = useRef(goalAllocations);
  goalAllocationsRef.current = goalAllocations;
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showGoalAllocationModal, setShowGoalAllocationModal] = useState(false);
  const [showDailyTasksModal, setShowDailyTasksModal] = useState(false);
  const [showDailyTaskPopup, setShowDailyTaskPopup] = useState(false);
  const [dailyTaskPopupPayload, setDailyTaskPopupPayload] = useState(null);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isExpenseListModalVisible, setIsExpenseListModalVisible] = useState(false);
  const [showHistoryReportModal, setShowHistoryReportModal] = useState(false);
  const [historyReportData, setHistoryReportData] = useState(null);
  const [dayReportHistory, setDayReportHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
      { text: "Ever heard of the 50/30/20 rule? It's one of the most popular budgeting strategies out there — and for good reason!" },
      { text: "The idea is simple: split your money into three buckets so you always know where it's going." },
      { text: "50% goes to Needs — the essentials like food, transport, and school supplies." },
      { text: "30% goes to Wants — the fun stuff like shopping, entertainment, and gadgets." },
      { text: "And 20% goes straight to Savings — this is how you build a safety net and grow your wealth over time." },
      { text: "Why does this matter? Because without a plan, money disappears fast. The 50/30/20 rule gives you control!" },
      { text: "You have 3 in-game days. Stay within the budget limits, and you'll pass this level. Good luck!" },
    ],
    2: [
      { text: "You made it to Level 2! I knew you had it in you!" },
      { text: "This time, we're diving into Goal Setting — one of the most powerful money habits you can build." },
      { text: "In real life, people set short-term, mid-term, and long-term financial goals." },
      { text: "Short-term goals are things you save for within weeks or months — like an emergency fund or a small treat." },
      { text: "Mid-term goals take a few months to a year — maybe a new gadget or a trip." },
      { text: "Long-term goals are the big dreams — college funds, a car, or even your first home!" },
      { text: "Since this level is 3 in-game days, you'll focus on two goals: an Emergency Fund and Fun Money." },
      { text: "Your Emergency Fund will be 15% of your budget — because unexpected expenses can happen anytime!" },
      { text: "Fun Money will be 5% — a small reward for yourself, because balance matters." },
      { text: "Reach at least 20% of your target to pass. Every peso counts — let's go!" },
    ],
    3: [
      { text: "Welcome to the final challenge... Level 3: Super Saver!" },
      { text: "You've learned budgeting. You've learned goal setting. Now it's time for the ultimate test." },
      { text: "This level is all about building the habit of saving — and understanding why it truly matters." },
      { text: "Savings aren't just extra money sitting around. They're your safety net when life throws surprises at you." },
      { text: "A medical emergency, a broken phone, an unexpected school expense — savings protect you from all of that." },
      { text: "Beyond emergencies, savings give you freedom — the freedom to chase opportunities without financial stress." },
      { text: "Your mission: Save at least 30% of your weekly budget!" },
      { text: "This means spending wisely and resisting unnecessary purchases. Think before every spend — do you NEED it, or just WANT it?" },
      { text: "Complete this, and you'll truly be a financial master. I believe in you!" },
    ],
  };

  // Custom Mode state - moved to CustomModeDashboard

  // Character Animation State
  const [selectedCharacter, setSelectedCharacter] = useState('girl'); // 'girl', 'jasper', 'businessman', 'businesswoman'
  const [characterDirection, setCharacterDirection] = useState('down'); // 'up', 'down', 'left', 'right'
  const lastDirectionRef = useRef('down');
  const spriteFrameAnim = useRef(new Animated.Value(0)).current;
  const spriteAnimationRef = useRef(null);
  const [showClosetModal, setShowClosetModal] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [notebookCategory, setNotebookCategory] = useState('Food & Dining');
  const [notebookSubCategory, setNotebookSubCategory] = useState(null);
  const [showNotebookSubCategoryDropdown, setShowNotebookSubCategoryDropdown] = useState(false);
  const [unlockedSkins, setUnlockedSkins] = useState(['girl', 'jasper']); // Default skins

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
    budget_trainer: {
      name: 'Budget Trainer',
      description: 'Gotta save \'em all! A trainer of budgets',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Budget Trainer.png'),
      icon: '🧢',
      color: '#E53935',
    },
    martial_artist: {
      name: 'Martial Artist',
      description: 'Disciplined finances, disciplined life',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Martial Artist.png'),
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
    head_nurse: {
      name: 'Head Nurse',
      description: 'Healing your finances back to health',
      sprite: require('../../../assets/Game_Graphics/Character_Animation/Head Nurse.png'),
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
  const [contentSize, setContentSize] = useState({ width: screenWidth, height: screenHeight });

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
      description: 'Allocate money to your Emergency Fund (15%) and Fun Money (5%). Reach at least 20% of your goal!',
      type: 'goals',
      icon: '🎯',
      minGoalProgress: 0.20, // Must reach 20% of goal (paced for the 3-day cycle)
      goalText: 'Reach 20% of your savings goal',
    },
    3: {
      name: 'Super Saver',
      description: 'The ultimate challenge! Save at least 30% of your weekly budget.',
      type: 'saving',
      icon: '👑',
      savingsGoal: 0.30, // 30% savings required
      goalText: 'Save 30% of your budget',
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

  const buildEmptyDailyRuntime = () => ({
    expenseCount: 0,
    expenseTotal: 0,
    categoryCounts: {},
    categoryTotals: {},
    expenseEntries: [],
    travelCount: 0,
    commuteTravelCount: 0,
    travelDestinations: [],
    needsAfterTravelCount: 0,
    mallVisited: false,
    goalAllocations: {},
    goalAllocationActions: 0,
  });

  const getStoryDurationDays = useCallback((level = storyLevel) => {
    return STORY_DAY_COUNTS[level] || 7;
  }, [storyLevel]);

  const getFirstIncompleteStoryDay = useCallback((level, completionMap = {}) => {
    const levelConfig = STORY_DAILY_TASKS[level];
    if (!levelConfig) return 1;

    for (const dayConfig of levelConfig.days) {
      const dayComplete = dayConfig.tasks.every((task) => !!completionMap[task.conditionKey]);
      if (!dayComplete) return dayConfig.dayNumber;
    }

    return levelConfig.totalDays;
  }, []);

  // In-game day progression for Story Mode is explicit; completing tasks does not advance the day.
  const getActiveStoryDay = useCallback((level = storyLevel) => {
    const levelConfig = STORY_DAILY_TASKS[level];
    if (!levelConfig) return 1;

    return Math.min(Math.max(activeStoryDay, 1), levelConfig.totalDays);
  }, [storyLevel, activeStoryDay]);

  const getDailyTaskStorageKey = useCallback((sessionId) => {
    return `${DAILY_TASK_STORAGE_KEY_PREFIX}${sessionId}`;
  }, []);

  const persistDailyTaskState = useCallback(async (sessionId, completionState, runtimeState) => {
    if (!sessionId) return;
    try {
      await AsyncStorage.setItem(
        getDailyTaskStorageKey(sessionId),
        JSON.stringify({
          completion: completionState || {},
          runtimeByDay: runtimeState || {},
        }),
      );
    } catch (error) {
      console.warn('⚠️ Failed to persist daily task state:', error?.message || error);
    }
  }, [getDailyTaskStorageKey]);

  const hydrateDailyTaskState = useCallback(async (sessionId, level = storyLevel) => {
    if (!sessionId) return;
    isHydratingDailyTaskStateRef.current = true;
    try {
      const raw = await AsyncStorage.getItem(getDailyTaskStorageKey(sessionId));
      if (!raw) {
        setDailyTaskCompletion({});
        setDailyTaskRuntimeByDay({});
        dailyTaskRuntimeByDayRef.current = {};
        setActiveStoryDay(1);
        return;
      }

      const parsed = JSON.parse(raw);
      const completion = parsed?.completion || {};
      const runtimeByDay = parsed?.runtimeByDay || {};
      setDailyTaskCompletion(completion);
      setDailyTaskRuntimeByDay(runtimeByDay);
      dailyTaskRuntimeByDayRef.current = runtimeByDay;
      setActiveStoryDay(getFirstIncompleteStoryDay(level, completion));
    } catch (error) {
      console.warn('⚠️ Failed to hydrate daily task state:', error?.message || error);
      setDailyTaskCompletion({});
      setDailyTaskRuntimeByDay({});
      dailyTaskRuntimeByDayRef.current = {};
      setActiveStoryDay(1);
    } finally {
      isHydratingDailyTaskStateRef.current = false;
    }
  }, [getDailyTaskStorageKey, getFirstIncompleteStoryDay, storyLevel]);

  const getDayRuntimeState = useCallback((dayNumber) => {
    return dailyTaskRuntimeByDay[dayNumber] || buildEmptyDailyRuntime();
  }, [dailyTaskRuntimeByDay]);

  const updateDailyTaskRuntimeForActiveDay = useCallback((updater) => {
    if (gameMode !== 'story') return;
    const dayNumber = getActiveStoryDay();

    setDailyTaskRuntimeByDay((prev) => {
      const base = prev[dayNumber] || buildEmptyDailyRuntime();
      const nextDayState = {
        ...base,
        categoryCounts: { ...(base.categoryCounts || {}) },
        categoryTotals: { ...(base.categoryTotals || {}) },
        expenseEntries: [...(base.expenseEntries || [])],
        travelDestinations: [...(base.travelDestinations || [])],
        goalAllocations: { ...(base.goalAllocations || {}) },
      };

      updater(nextDayState);

      const nextFull = { ...prev, [dayNumber]: nextDayState };
      // Keep the ref in sync so async callers always read fresh data
      dailyTaskRuntimeByDayRef.current = nextFull;
      return nextFull;
    });
  }, [gameMode, getActiveStoryDay]);

  const completedDaysHistory = useMemo(() => {
    if (gameMode !== 'story') return [];

    const totalDays = STORY_DAILY_TASKS[storyLevel]?.totalDays || STORY_DAY_COUNTS?.[storyLevel] || 0;
    const history = [];

    for (let day = 1; day <= totalDays; day += 1) {
      const dayConfig = getStoryDayTasks(storyLevel, day);
      if (!dayConfig?.tasks) continue;

      const tasks = dayConfig.tasks.map((task) => ({
        id: task.id,
        label: task.requiredAppAction,
        completed: !!dailyTaskCompletion[task.conditionKey],
        rewardXp: task.reward?.xp || 0,
      }));
      const completedCount = tasks.filter((task) => task.completed).length;
      const totalCount = tasks.length;

      if (totalCount > 0 && completedCount === totalCount) {
        const xpEarned = tasks.reduce((sum, task) => sum + (task.completed ? task.rewardXp : 0), 0);
        history.push({
          dayNumber: day,
          displayDay: getStoryDayDisplayNumber(storyLevel, day),
          completedCount,
          totalCount,
          xpEarned,
          tasks,
        });
      }
    }

    return history;
  }, [gameMode, storyLevel, dailyTaskCompletion]);

  const buildHistoryReportData = useCallback((dayItem) => {
    const dayNumber = dayItem.dayNumber;
    const dayState = getDayRuntimeState(dayNumber);
    const spentToday = Number(dayState?.expenseTotal) || 0;
    const totalDays = STORY_DAILY_TASKS[storyLevel]?.totalDays || STORY_DAY_COUNTS?.[storyLevel] || 1;
    const dailyBudget = (Number(weeklyBudget) || 0) / Math.max(1, totalDays);
    const categoryTotals = dayState?.categoryTotals || {};
    const topCategory = Object.entries(categoryTotals)
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))[0]?.[0];
    const budgetStatus = spentToday === 0
      ? 'No-spend day - great discipline'
      : spentToday <= dailyBudget
        ? 'You stayed within your daily budget'
        : 'You went over your daily budget';
    const topCategoryLine = topCategory ? `; top spend was ${topCategory}` : '';
    const taskLine = dayItem.totalCount
      ? `. Tasks completed: ${dayItem.completedCount}/${dayItem.totalCount}.`
      : '.';
    const historyInsight = `${budgetStatus}${topCategoryLine}${taskLine}`;
    const cumulativeSpend = Object.entries(dailyTaskRuntimeByDay).reduce((sum, [key, value]) => {
      const dayKey = Number(key);
      if (!Number.isFinite(dayKey) || dayKey > dayNumber) return sum;
      return sum + (Number(value?.expenseTotal) || 0);
    }, 0);
    const weeklyBudgetRemaining = Math.max(0, (Number(weeklyBudget) || 0) - cumulativeSpend);
    const expensesToday = (dayState?.expenseEntries || []).map((entry, index) => ({
      id: `${dayNumber}-${index}`,
      name: entry.note || entry.category || 'Expense',
      category: entry.category,
      amount: Number(entry.amount) || 0,
      timestamp: entry.timestamp || null,
    }));

    return {
      dayNumber: dayItem.dayNumber,
      displayDay: dayItem.displayDay,
      title: `Day ${dayItem.displayDay} Report`,
      weeklyBudgetRemaining,
      spentToday,
      dailyTasks: dayItem.tasks,
      xpEarned: dayItem.xpEarned,
      currentXP: Math.min(dayItem.xpEarned, 100),
      xpForNextLevel: 100,
      unlockedAchievement: null,
      koinInsight: historyInsight,
      expensesToday,
      actionLabel: 'Close',
    };
  }, [dailyTaskRuntimeByDay, getDayRuntimeState, weeklyBudget, storyLevel]);

  const buildLocalHistoryItems = useCallback(() => {
    if (!completedDaysHistory.length) return [];

    return completedDaysHistory.map((dayItem) => ({
      id: `local-${storyLevel}-${dayItem.dayNumber}`,
      storyLevel,
      dayNumber: dayItem.dayNumber,
      displayDay: dayItem.displayDay,
      completedCount: dayItem.completedCount,
      totalCount: dayItem.totalCount,
      xpEarned: dayItem.xpEarned,
      tasks: dayItem.tasks,
    }));
  }, [completedDaysHistory, storyLevel]);

  const normalizeDayReportRow = useCallback((row) => {
    const details = row?.details || {};
    const reportData = details?.report || null;
    const storyLevelValue = Number(details?.storyLevel ?? reportData?.storyLevel);
    if (!Number.isFinite(storyLevelValue)) return null;

    const dailyTasks = Array.isArray(reportData?.dailyTasks) ? reportData.dailyTasks : [];
    const completedCount = dailyTasks.filter((task) => task.completed).length;
    const totalCount = dailyTasks.length;
    const dayNumberValue = Number(details?.dayNumber ?? reportData?.dayNumber ?? reportData?.displayDay);
    const displayDayValue = reportData?.displayDay ?? dayNumberValue;
    const updatedAt = details?.updated_at || row?.created_at || null;

    return {
      id: row?.id ?? `${storyLevelValue}-${dayNumberValue || 'day'}-${row?.created_at || 'unknown'}`,
      storyLevel: storyLevelValue,
      dayNumber: Number.isFinite(dayNumberValue) ? dayNumberValue : null,
      displayDay: displayDayValue,
      completedCount,
      totalCount,
      xpEarned: Number(reportData?.xpEarned) || 0,
      tasks: dailyTasks,
      reportData,
      createdAt: row?.created_at || null,
      updatedAt: updatedAt,
    };
  }, []);

  const buildHistorySections = useCallback((reports) => {
    if (!reports?.length) return [];

    const levelsReached = new Set([storyLevel, ...unlockedLevels].filter((level) => Number.isFinite(level)));
    
    // Deduplicate array, keep most recently updated report for any Level/Day combination
    const dedupedReports = Object.values(
      reports.reduce((acc, report) => {
        const key = `${report.storyLevel}_${report.dayNumber}`;
        const existing = acc[key];
        const reportDate = new Date(report.updatedAt || report.createdAt || 0).getTime();
        const existingDate = existing ? new Date(existing.updatedAt || existing.createdAt || 0).getTime() : 0;
        
        if (!existing || reportDate > existingDate) {
          acc[key] = report;
        }
        return acc;
      }, {})
    );

    const filteredReports = dedupedReports.filter((report) => {
      if (!Number.isFinite(report?.storyLevel)) return false;
      if (levelsReached.size === 0) return true;
      return levelsReached.has(report.storyLevel);
    });

    if (!filteredReports.length) return [];

    const grouped = filteredReports.reduce((acc, report) => {
      const levelKey = report.storyLevel;
      if (!acc[levelKey]) acc[levelKey] = [];
      acc[levelKey].push(report);
      return acc;
    }, {});

    const levelKeys = Object.keys(grouped)
      .map((level) => Number(level))
      .filter((level) => Number.isFinite(level))
      .sort((a, b) => b - a);

    const orderedLevels = Number.isFinite(storyLevel) && levelKeys.includes(storyLevel)
      ? [storyLevel, ...levelKeys.filter((level) => level !== storyLevel)]
      : levelKeys;

    return orderedLevels
      .map((level) => {
        const sortedItems = grouped[level].slice().sort((a, b) => {
          const dayA = Number(a.dayNumber);
          const dayB = Number(b.dayNumber);
          if (Number.isFinite(dayA) && Number.isFinite(dayB) && dayA !== dayB) {
            return dayB - dayA;
          }
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        return {
          title: `Level ${level}`,
          level,
          data: sortedItems,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [storyLevel, unlockedLevels]);

  const fetchDayReportHistory = useCallback(async () => {
    if (gameMode !== 'story') {
      setDayReportHistory([]);
      return;
    }

    const localFallback = buildLocalHistoryItems();

    if (!user?.id) {
      setDayReportHistory(localFallback);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_activity_log')
        .select('id, created_at, details')
        .eq('user_id', user.id)
        .eq('activity_type', 'day_report')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || [])
        .map((row) => normalizeDayReportRow(row))
        .filter(Boolean);

      setDayReportHistory(normalized);
    } catch (err) {
      console.warn('⚠️ Failed to load day report history:', err?.message || err);
      setDayReportHistory(localFallback);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [gameMode, user?.id, buildLocalHistoryItems, normalizeDayReportRow]);

  const dayReportSections = useMemo(() => buildHistorySections(dayReportHistory), [dayReportHistory, buildHistorySections]);

  const openDayReportHistory = useCallback(() => {
    setHasUnreadReport(false);
    fetchDayReportHistory();
    setIsHistoryModalVisible(true);
  }, [fetchDayReportHistory]);

  const handleCloseDayReport = useCallback(() => {
    setShowDayReportModal(false);
    setLiveDayReportData(null);
  }, []);

  const openHistoryReport = useCallback((dayItem) => {
    const reportData = dayItem?.reportData || dayItem?.report || buildHistoryReportData(dayItem);
    if (!reportData) return;
    setHistoryReportData(reportData);
    setIsHistoryModalVisible(false);
    setShowHistoryReportModal(true);
  }, [buildHistoryReportData]);

  const renderHistoryItem = useCallback(({ item }) => {
    const displayDay = item.displayDay ?? item.dayNumber ?? '-';
    const completedCount = Number(item.completedCount) || 0;
    const totalCount = Number(item.totalCount) || 0;
    const xpEarned = Number(item.xpEarned) || 0;

    let formattedDate = '';
    if (item.updatedAt) {
      const dateObj = new Date(item.updatedAt);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
      }
    }

    return (
      <TouchableOpacity
        onPress={() => openHistoryReport(item)}
        className="flex-row items-center justify-between bg-slate-800 p-4 mb-3 rounded-2xl"
        style={styles.historyItem}
      >
        <View className="flex-row items-center flex-1" style={styles.historyItemLeft}>
          <View className="h-10 w-10 rounded-full bg-[#2a1c12] items-center justify-center mr-3" style={styles.historyItemIcon}>
            <Ionicons name="document-text-outline" size={20} color="#ff7a00" />
          </View>
          <View className="flex-1">
            <Text className="text-[#e5e2e1] text-base font-semibold" style={styles.historyItemTitle}>
              Day {displayDay}
            </Text>
            {formattedDate ? (
              <Text className="text-[#e0c0af] text-[10px] mb-1" style={styles.historyItemSubtitle}>
                {formattedDate}
              </Text>
            ) : null}
            <Text className="text-[#a78b7c] text-xs" style={styles.historyItemSubtitle}>
              Tasks: {completedCount}/{totalCount} • +{xpEarned} XP
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#a78b7c" />
      </TouchableOpacity>
    );
  }, [openHistoryReport]);

  const renderHistorySectionHeader = useCallback(({ section }) => (
    <View style={styles.historySectionHeader}>
      <Text style={styles.historySectionTitle}>{section.title}</Text>
    </View>
  ), []);

  const closeHistoryReport = useCallback(() => {
    setShowHistoryReportModal(false);
    setHistoryReportData(null);
  }, []);

  const currentDayExpenseEntries = useMemo(() => {
    const dayState = dailyTaskRuntimeByDay[activeStoryDay];
    return dayState?.expenseEntries || [];
  }, [dailyTaskRuntimeByDay, activeStoryDay]);

  const evaluateActiveStoryDayTasks = useCallback(() => {
    if (gameMode !== 'story') return;

    const activeDay = getActiveStoryDay();
    const dayConfig = getStoryDayTasks(storyLevel, activeDay);
    if (!dayConfig) return;

    // Read from the ref so we always get the freshest runtime data,
    // even when called from an async callback with stale closures.
    const freshRuntime = dailyTaskRuntimeByDayRef.current;
    const dayState = freshRuntime[activeDay] || buildEmptyDailyRuntime();
    const goalTotalsByName = {};
    const goalTargetsByName = {};

    savingsGoals.forEach((goal) => {
      goalTotalsByName[goal.name] = goalAllocations[goal.id] || 0;
      goalTargetsByName[goal.name] = goal.target || 0;
    });

    const evalContext = {
      dayState,
      weeklyBudget,
      weeklySpending,
      dailyBudget: weeklyBudget / Math.max(1, STORY_DAILY_TASKS[storyLevel]?.totalDays || 1),
      needsCategories: NEEDS_CATEGORIES,
      wantsCategories: WANTS_CATEGORIES,
      goalTotalsByName,
      goalTargetsByName,
    };

    const newlyCompleted = [];

    setDailyTaskCompletion((prev) => {
      const next = { ...prev };
      let changed = false;

      dayConfig.tasks.forEach((task) => {
        if (next[task.conditionKey]) return;

        const passed = evaluateDailyTaskRule(task.validationLogic, evalContext);
        if (passed) {
          next[task.conditionKey] = true;
          changed = true;
          newlyCompleted.push(task);
        }
      });

      return changed ? next : prev;
    });

    if (newlyCompleted.length > 0 && !isHydratingDailyTaskStateRef.current) {
      const earnedXp = newlyCompleted.reduce((sum, task) => sum + (task.reward?.xp || 0), 0);
      if (gameMode === 'story' && earnedXp > 0) {
        gameDatabaseService.incrementUserLevelStats({ xpToAdd: earnedXp });
      }

      if (gameMode === 'story') {
        newlyCompleted.forEach((task) => {
          gameDatabaseService.logActivity({
            activityType: 'daily_task_completed',
            sessionId: activeSessionId,
            details: {
              level: storyLevel,
              day: activeDay,
              taskId: task.id,
              conditionKey: task.conditionKey,
              rewardXp: task.reward?.xp || 0,
            },
            xpEarned: task.reward?.xp || 0,
          });
        });
      }

      const completedLines = newlyCompleted.map((task) => `• ${task.successMessage}`).join('\n');
      Alert.alert('Daily Task Complete', `${completedLines}${earnedXp > 0 ? `\n\n+${earnedXp} XP` : ''}`);
    }
  }, [
    gameMode,
    getActiveStoryDay,
    storyLevel,
    getDayRuntimeState,
    savingsGoals,
    goalAllocations,
    weeklyBudget,
    weeklySpending,
    activeSessionId,
  ]);

  useEffect(() => {
    if (gameMode !== 'story' || !activeSessionId) return;
    if (isHydratingDailyTaskStateRef.current) return;

    persistDailyTaskState(activeSessionId, dailyTaskCompletion, dailyTaskRuntimeByDay);
  }, [activeSessionId, gameMode, dailyTaskCompletion, dailyTaskRuntimeByDay, persistDailyTaskState]);

  useEffect(() => {
    if (gameMode !== 'story' || showLevelComplete) return;
    evaluateActiveStoryDayTasks();
  }, [gameMode, showLevelComplete, evaluateActiveStoryDayTasks]);

  useEffect(() => {
    if (gameMode !== 'story' || showLevelComplete) return;

    const activeDay = getActiveStoryDay();
    const dayConfig = getStoryDayTasks(storyLevel, activeDay);
    if (!dayConfig) return;

    const dayAlreadyComplete = dayConfig.tasks.every((task) => !!dailyTaskCompletion[task.conditionKey]);
    if (dayAlreadyComplete) return;

    const announcementKey = `${activeSessionId || 'local'}_${storyLevel}_${activeDay}`;
    if (dailyTaskAnnouncedDayRef.current === announcementKey) return;
    dailyTaskAnnouncedDayRef.current = announcementKey;

    const dialogue = dayConfig.koinDialogue[profileUserType];

    setDailyTaskPopupPayload({
      key: announcementKey,
      title: `Day ${getStoryDayDisplayNumber(storyLevel, activeDay)}: ${STORY_DAILY_TASKS[storyLevel]?.levelName || 'Story'}`,
      subtitle: dayConfig.financialConcept || null,
      dialogue,
    });
    setShowDailyTaskPopup(true);
  }, [gameMode, showLevelComplete, storyLevel, getActiveStoryDay, dailyTaskCompletion, activeSessionId, profileUserType]);

  useEffect(() => {
    if (gameMode !== 'story' && showDailyTasksModal) {
      setShowDailyTasksModal(false);
    }
  }, [gameMode, showDailyTasksModal]);

  useEffect(() => {
    if ((gameMode !== 'story' || showLevelComplete) && showDailyTaskPopup) {
      setShowDailyTaskPopup(false);
    }
  }, [gameMode, showLevelComplete, showDailyTaskPopup]);


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

    // Position the character on map change. If a travel/floor handler queued an
    // entry (pendingEntrySpawnRef matching this map), land at the corresponding
    // doorway so inter-map travel feels continuous. Otherwise (fresh load,
    // resume, or a programmatic map switch) fall back to the map's default
    // centre spawn. Previously this ALWAYS reset to centre, clobbering the
    // doorway spawn the travel handler had just set. (Issue 2)
    const newMap = MAPS[currentMapId];
    if (newMap) {
      const halfChar = getCharSize() / 2;
      const entry = pendingEntrySpawnRef.current;
      const fromMapId =
        entry && entry.mapId === currentMapId ? entry.fromMapId : null;
      pendingEntrySpawnRef.current = null;

      const spawn = fromMapId
        ? resolveEntrySpawn(newMap, fromMapId, contentSize.width, contentSize.height)
        : resolveSpawn(newMap.spawnPoint, contentSize.width, contentSize.height);

      setAnimatedPosition(spawn.x - halfChar, spawn.y - halfChar);
      commitCharacterPosition(spawn);
      commitCurrentLocation(
        fromMapId ? `${newMap.name} ${newMap.icon}` : 'Hallway 🚶',
      );
    }
  }, [currentMapId]);

  // Get the on-screen character size that matches the displayed tile size.
  // Uses the same "contain" scale math as the ImageBackground.
  const getCharSize = useCallback(() => {
    if (!collisionSystem.initialized) return CHARACTER_SIZE;
    const mapPixelW = collisionSystem.mapWidth * collisionSystem.tileSize;
    const mapPixelH = collisionSystem.mapHeight * collisionSystem.tileSize;
    const scale = Math.min(contentSize.width / mapPixelW, contentSize.height / mapPixelH);
    const size = collisionSystem.tileSize * scale;
    return size > 0 ? size : CHARACTER_SIZE;
  }, [contentSize.width, contentSize.height]);

  // Story Mode map restrictions by user profile (Student vs Employee)
  useEffect(() => {
    if (gameMode !== 'story') return;

    if (!isStoryModeMapAllowed(currentMapId)) {
      const fallbackMap = MAPS.dorm;
      if (!fallbackMap) return;

      const halfChar = getCharSize() / 2;
      const spawn = resolveSpawn(fallbackMap.spawnPoint, contentSize.width, contentSize.height);

      setCurrentMapId('dorm');
      commitCharacterPosition(spawn);
      setAnimatedPosition(spawn.x - halfChar, spawn.y - halfChar);
      lastDirectionRef.current = 'down';
      setCharacterDirection('down');
      commitCurrentLocation(`${fallbackMap.name} ${fallbackMap.icon}`);
      setShowTravelModal(false);
      setShowTransportModal(false);
      setTravelDestinations([]);
      setSelectedDestination(null);
      setTransportMode(null);
      setFareAmount('');
      setDidBuyFuel(null);
      setFuelAmount('');
    }
  }, [
    gameMode,
    currentMapId,
    isStoryModeMapAllowed,
    resolveSpawn,
    contentSize.width,
    contentSize.height,
    animatedX,
    animatedY,
  ]);

  // Keep visible travel options in sync when profile changes mid-session.
  useEffect(() => {
    if (gameMode !== 'story') return;

    setTravelDestinations((prev) => {
      const filtered = filterStoryModeDestinations(prev);
      const same = filtered.length === prev.length && filtered.every((id, idx) => id === prev[idx]);
      return same ? prev : filtered;
    });

    if (selectedDestination && !isStoryModeMapAllowed(selectedDestination)) {
      setSelectedDestination(null);
      setShowTransportModal(false);
      setTransportMode(null);
      setFareAmount('');
      setDidBuyFuel(null);
      setFuelAmount('');
    }
  }, [gameMode, filterStoryModeDestinations, selectedDestination, isStoryModeMapAllowed]);

  // Fetch today's spending — re-runs on expense changes AND when the in-game day
  // boundary moves (new day), so the total resets to the new day's window.
  useEffect(() => {
    fetchTodaySpending();
    // Hide instructions after 5 seconds
    const timer = setTimeout(() => setShowInstructions(false), 5000);
    return () => clearTimeout(timer);
  }, [expenses, currentInGameDayStartTimestamp]);

  // ─── Hydrate saved game progress from Supabase on mount ────
  useEffect(() => {
    if (!user?.id) return;

    const hydrate = async () => {
      try {
        const progress = await gameDatabaseService.loadGameProgress();
        if (!progress) return;

        const { userLevels, character, tutorial, activeStory, unlockedLevels: unlocked, introSeen } = progress;

        // 1. Unlocked story levels
        if (unlocked && unlocked.length > 0) {
          setUnlockedLevels(unlocked);
        }

        // 1b. Check if Custom Mode was previously unlocked
        // Primary source: Supabase user_levels (survives logout / device switch)
        if (userLevels?.story_level_3_completed) {
          setCustomModeUnlocked(true);
          // Keep AsyncStorage in sync for offline/fast access
          AsyncStorage.setItem(`customModeUnlocked_${user.id}`, 'true').catch(() => { });
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
      if (walkingPulseAnimationRef.current) {
        walkingPulseAnimationRef.current.stop();
      }

      walkingPulseAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(walkingPulse, {
            toValue: 1.15,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(walkingPulse, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      );
      walkingPulseAnimationRef.current.start();

      // Start sprite animation when walking (native driver)
      if (spriteAnimationRef.current) {
        spriteAnimationRef.current.stop();
      }

      const frameDurationMs = 100;
      spriteFrameAnim.setValue(0);

      const frameSteps = [];
      for (let idx = 1; idx < SPRITE_CONFIG.framesPerDirection; idx += 1) {
        frameSteps.push(
          Animated.delay(frameDurationMs),
          Animated.timing(spriteFrameAnim, {
            toValue: idx,
            duration: 0,
            useNativeDriver: true,
          })
        );
      }

      frameSteps.push(
        Animated.delay(frameDurationMs),
        Animated.timing(spriteFrameAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      );

      spriteAnimationRef.current = Animated.loop(
        Animated.sequence(frameSteps)
      );
      spriteAnimationRef.current.start();
    } else {
      walkingPulse.stopAnimation();
      walkingPulse.setValue(1);

      if (walkingPulseAnimationRef.current) {
        walkingPulseAnimationRef.current.stop();
        walkingPulseAnimationRef.current = null;
      }

      // Stop sprite animation when not walking
      if (spriteAnimationRef.current) {
        spriteAnimationRef.current.stop();
        spriteAnimationRef.current = null;
      }
      spriteFrameAnim.setValue(0); // Reset to idle frame
    }

    return () => {
      if (walkingPulseAnimationRef.current) {
        walkingPulseAnimationRef.current.stop();
        walkingPulseAnimationRef.current = null;
      }
      if (spriteAnimationRef.current) {
        spriteAnimationRef.current.stop();
        spriteAnimationRef.current = null;
      }
    };
  }, [isWalking, spriteFrameAnim, walkingPulse]);

  // AppState foreground listener - checks for new day when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (gameMode !== 'story' || !activeSessionId || !showLevelComplete) return;

      // Only check when coming to foreground
      if (nextAppState === 'active') {
        // Check if it's a new day based on last progress timestamp
        const now = new Date();
        const lastTimestamp = lastProgressTimestamp ? new Date(lastProgressTimestamp) : null;

        // If we have a last timestamp and it's from a previous day, check for day report
        if (lastTimestamp && now.toDateString() !== lastTimestamp.toDateString()) {

          // Check if all daily tasks are completed for current day
          const activeDay = getActiveStoryDay();
          const dayConfig = getStoryDayTasks(storyLevel, activeDay);

          if (dayConfig) {
            const dayAlreadyComplete = dayConfig.tasks.every((task) => !!dailyTaskCompletion[task.conditionKey]);

            if (dayAlreadyComplete && !dayReportViewed) {
              // Trigger day report notification
              setShowDayReportNotification(true);
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [gameMode, activeSessionId, showLevelComplete, storyLevel, dailyTaskCompletion, dayReportViewed, lastProgressTimestamp, getActiveStoryDay, getStoryDayTasks]);

  // Single source of truth for the in-game day boundary. Updates ref (sync reads),
  // state (UI/effects), and AsyncStorage (survives reload) together.
  const applyInGameDayStart = useCallback(async (isoTimestamp) => {
    const ts = isoTimestamp || new Date().toISOString();
    currentInGameDayStartRef.current = ts;
    setCurrentInGameDayStartTimestamp(ts);
    try {
      if (user?.id) {
        await AsyncStorage.setItem(`currentInGameDayStart_${user.id}`, ts);
      }
    } catch (e) {
      console.error('Failed to persist in-game day start timestamp:', e);
    }
    return ts;
  }, [user?.id]);

  const fetchTodaySpending = async () => {
    if (!user?.id) return; // Guard: don't overwrite state when auth is transiently unavailable
    try {
      let query = supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user?.id)
        .eq('app_mode', 'story');

      // Scope to the CURRENT in-game day only. Expenses written before this in-game day
      // started (even if on the same real calendar day) must be excluded.
      const dayStart = currentInGameDayStartRef.current;
      if (dayStart) {
        query = query.gte('created_at', dayStart);
      } else {
        // Fallback for sessions started before this boundary existed: real calendar day.
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('date', startOfDay);
      }

      const { data, error } = await query;

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
    if (!user?.id) return; // Guard: don't overwrite state when auth is transiently unavailable

    try {
      const startDateStr = storyStartDate.toISOString().split('T')[0];
      const endDateStr = storyEndDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .eq('user_id', user?.id)
        .eq('app_mode', 'story')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (data) {
        const expenseTotal = data.reduce((sum, expense) => sum + expense.amount, 0);
        // Goal allocations are part of weekly "spending" (funds committed to
        // savings goals) but are NOT stored as expense rows — they live on the
        // story session. Re-add them here so re-deriving weeklySpending from the
        // expenses table on a day transition does NOT refund money the player
        // already allocated on a previous day. (Issue 1)
        const allocatedTotal = Object.values(goalAllocationsRef.current).reduce(
          (sum, val) => sum + (Number(val) || 0),
          0,
        );
        const total = expenseTotal + allocatedTotal;
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
          (gameMode === 'story' && STORY_LEVELS[storyLevel]?.type === 'budgeting');
        if (isLevelBudgeting) {
          setBudgetCategories(prev => ({
            needs: { ...prev.needs, spent: derivedNeedsSpent },
            wants: { ...prev.wants, spent: derivedWantsSpent },
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

  // End of Day Handler
  const handleEndDay = async () => {
    // 1. Generate report data using the current active story day
    const dayItem = {
      dayNumber: activeStoryDay,
      displayDay: getStoryDayDisplayNumber(storyLevel, activeStoryDay),
      completedCount: activeStoryDayCompletedCount,
      totalCount: activeStoryDayTotalCount,
      xpEarned: activeStoryDayConfigForUi?.tasks?.reduce((sum, task) => {
        return sum + (dailyTaskCompletion[task.conditionKey] ? (task.reward?.xp || 0) : 0);
      }, 0) || 0,
      tasks: activeStoryDayConfigForUi?.tasks?.map(t => ({
        id: t.id,
        label: t.requiredAppAction,
        completed: !!dailyTaskCompletion[t.conditionKey],
        rewardXp: t.reward?.xp || 0
      })) || []
    };

    const reportData = buildHistoryReportData(dayItem);
    
    // Evaluate if this is the final day of the level
    const maxDays = STORY_DAY_COUNTS[storyLevel] || 3;
    const isFinalDay = activeStoryDay >= maxDays;

    if (isFinalDay) {
      // FINAL-DAY FIX: the last day (3/6/10) never opens the Day Report modal, so it
      // skips handleStartNextDay where the save lives. Force-persist the report HERE,
      // and AWAIT it, before checkLevelCompletion resets daily-task state / unmounts.
      if (activeSessionId) {
        try {
          await gameDatabaseService.saveDayReport({
            sessionId: activeSessionId,
            storyLevel,
            dayNumber: dayItem.dayNumber || activeStoryDay,
            report: reportData,
          });
        } catch (e) {
          console.warn('Failed to persist final day report:', e?.message || e);
        }
      }
      // It's the final day, trigger checkLevelCompletion which handles the end of level
      checkLevelCompletion(weeklySpending);
    } else {
      // It's not the final day, show the Day Report Modal
      setLiveDayReportData(reportData);
      setShowDayReportNotification(false);
      setShowDayReportModal(true);
    }
  };

  const handleStartNextDay = async () => {
    const reportPayload = liveDayReportData || null;
    setShowDayReportModal(false);
    setLiveDayReportData(null);
    setIsExpenseListModalVisible(false);
    setHasUnreadReport(true);
    setTodaySpending(0);

    if (activeSessionId && reportPayload) {
      try {
        await gameDatabaseService.saveDayReport({
          sessionId: activeSessionId,
          storyLevel,
          dayNumber: reportPayload.dayNumber || activeStoryDay,
          report: reportPayload,
        });
      } catch (e) {
        console.warn('Failed to persist day report:', e?.message || e);
      }
    }
    
    // Save last progress timestamp
    const nowTimestamp = new Date().toISOString();
    setLastProgressTimestamp(nowTimestamp);
    try {
      await AsyncStorage.setItem(`lastProgressTimestamp_${user?.id}`, nowTimestamp);
    } catch (e) {
      console.error('Failed to save last progress timestamp:', e);
    }

    // New in-game day starts NOW — move the "Today's Spending" boundary so the next
    // day starts from ₱0 even if it falls on the same real-world calendar day.
    await applyInGameDayStart(nowTimestamp);

    // Advance the day
    setActiveStoryDay((prev) => prev + 1);
  };

  // Check if level is completed - handles all 3 level types
  const checkLevelCompletion = async (totalSpent) => {
    const currentLevel = STORY_LEVELS[storyLevel];
    let passed = false;
    let results = {};

    if (currentLevel.type === 'budgeting') {
      // Level 1: Check budget rule compliance
      const needsLimit = 50;
      const wantsLimit = 30;
      const savingsMin = 20;

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

      // For story mode, require 80% of goal
      const minProgress = currentLevel.minGoalProgress;
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
      const savingsGoalPercent = currentLevel.savingsGoal;

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

    if (gameMode === 'story') {
      const levelTaskConfig = STORY_DAILY_TASKS[storyLevel];
      if (levelTaskConfig) {
        const allTaskKeys = levelTaskConfig.days.flatMap((day) => day.tasks.map((task) => task.conditionKey));
        const completedTaskCount = allTaskKeys.filter((key) => !!dailyTaskCompletion[key]).length;
        const allDailyTasksComplete = allTaskKeys.length > 0 && completedTaskCount === allTaskKeys.length;

        results.dailyTasks = {
          completed: completedTaskCount,
          total: allTaskKeys.length,
          allComplete: allDailyTasksComplete,
        };

        passed = passed && allDailyTasksComplete;
      }
    }

    setLevelPassed(passed);
    results.history = completedDaysHistory;
    setLevelResults(results);

    // Only unlock next story levels in Story Mode
    if (gameMode === 'story' && passed && storyLevel < 3 && !unlockedLevels.includes(storyLevel + 1)) {
      setUnlockedLevels([...unlockedLevels, storyLevel + 1]);
    }

    // Unlock Custom Mode when Level 3 is completed successfully
    if (gameMode === 'story' && passed && storyLevel === 3 && !customModeUnlocked) {
      setCustomModeUnlocked(true);
      AsyncStorage.setItem(`customModeUnlocked_${user?.id}`, 'true').catch(() => { });
    }

    setShowLevelComplete(true);

    // Clear cached active sessions since this one is now completed
    if (gameMode === 'story') cachedActiveStoryRef.current = null;

    // ── Persist level completion to Supabase ──
    const xpEarned = passed ? (storyLevel === 1 ? 100 : storyLevel === 2 ? 150 : 200) : 0;
    const starsEarned = passed ? (results.type === 'budgeting'
      ? (results.needsOk && results.wantsOk && results.savingsOk ? 3 : 2)
      : results.type === 'goals'
        ? (parseFloat(results.goalProgress) >= 100 ? 3 : parseFloat(results.goalProgress) >= 90 ? 2 : 1)
        : (parseFloat(results.savingsPercent) >= results.savingsGoal * 1.5 ? 3 : parseFloat(results.savingsPercent) >= results.savingsGoal * 1.2 ? 2 : 1)
    ) : 0;

    if (activeSessionId && gameMode === 'story') {
      gameDatabaseService.completeStorySession(activeSessionId, { passed, starsEarned, xpEarned, resultsData: results, weeklySpending: totalSpent });
      gameDatabaseService.logActivity({ activityType: 'level_complete', sessionId: activeSessionId, details: { level: storyLevel, passed, stars: starsEarned, mode: gameMode }, xpEarned });
    }
    // Increment XP and goals achieved on user_levels
    if (passed && gameMode === 'story') {
      gameDatabaseService.incrementUserLevelStats({ xpToAdd: xpEarned, goalsAchieved: 1 });
      // Directly mark story level completed on user_levels (safety net for DB trigger)
      gameDatabaseService.markStoryLevelCompleted(storyLevel, starsEarned);
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
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to start Story Mode.');
      return;
    }
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

      // Set start and end dates based on level day count
      const startDate = new Date(); // exact moment user pressed Start
      const levelDurationDays = getStoryDurationDays(level);
      const endDate = new Date(startDate.getTime() + levelDurationDays * ONE_DAY_MS);

      setStoryStartDate(startDate);
      setStoryEndDate(endDate);
      setStoryLevel(level);
      setWeeklySpending(0);
      setLevelResults(null);
      setDailyTaskCompletion({});
      setDailyTaskRuntimeByDay({});
      dailyTaskRuntimeByDayRef.current = {};
      setActiveStoryDay(1);
      dailyTaskAnnouncedDayRef.current = null;

      // Anchor Day 1's "Today's Spending" window to the exact start moment.
      applyInGameDayStart(startDate.toISOString());

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
          { id: 'emergency', name: 'Emergency Fund', icon: '🏥', target: calculatedWeeklyBudget * 0.15 },
          { id: 'wants', name: 'Fun Money', icon: '🎮', target: calculatedWeeklyBudget * 0.05 },
        ]);
        setGoalAllocations({ emergency: 0, wants: 0 });
      }

      // Close intro and start game
      setShowStoryIntro(false);
      setCurrentMapId('dorm');
      setShowMainMenu(false);

      console.log(`📖 Story Mode Level ${level} (${levelConfig.type}) started!`);
      console.log(`   Weekly Budget: ₱${calculatedWeeklyBudget}`);
      console.log(`   Duration: ${levelDurationDays} day(s)`);
      console.log(`   Session: ${startDate.toDateString()} - ${endDate.toDateString()}`);

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
          { id: 'emergency', name: 'Emergency Fund', target: calculatedWeeklyBudget * 0.15 },
          { id: 'wants', name: 'Fun Money', target: calculatedWeeklyBudget * 0.05 },
        ] : null,
        savingsGoalPercent: levelConfig.type === 'saving' ? 30 : null,
      });
      if (session) {
        setActiveSessionId(session.id);
        persistDailyTaskState(session.id, {}, {});
      }
      gameDatabaseService.logActivity({ activityType: 'level_start', details: { level, type: levelConfig.type, mode: 'story' }, sessionId: session?.id });

    } catch (error) {
      console.error('Error starting story level:', error);
      Alert.alert('Error', 'Could not start story mode. Please try again.');
    }
  };

  // Effect to fetch weekly spending when in story mode
  useEffect(() => {
    if (gameMode === 'story' && storyStartDate && storyEndDate) {
      fetchWeeklySpending();
    }
  }, [gameMode, storyStartDate, storyEndDate, expenses]);

  // Check if the story week has ended
  useEffect(() => {
    if (gameMode === 'story' && storyEndDate && !showLevelComplete) {
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
    if (!user?.id || gameMode !== 'story') return;

    try {
      const newAchievements = await AchievementService.checkAndAwardAchievements(
        user.id,
        activityType,
        { ...activityData, appMode: 'story' }
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
        .eq('user_id', user.id)
        .eq('app_mode', 'story');

      if (error) {
        console.warn('Could not fetch expense stats:', error?.message || error);
        return expenseStats;
      }

      const stats = {
        total: allExpenses?.length || 0,
        foodCount: allExpenses?.filter(e => e.category === 'Food & Dining').length || 0,
        shoppingCount: allExpenses?.filter(e => e.category === 'Shopping').length || 0,
        electronicsCount: allExpenses?.filter(e => e.category === 'Electronics').length || 0
      };

      setExpenseStats(stats);
      return stats;
    } catch (error) {
      console.warn('Could not fetch expense stats:', error?.message || error);
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
      right: contentSize.width * 0.45,
      top: contentSize.height * 0.50,
      bottom: contentSize.height / 0.15,
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
        setExpenseSubCategory(null);
        setShowSubCategoryDropdown(false);
        // Directly open the expense modal without an alert prompt
        if (tutorialActive && gameMode === 'tutorial') {
          markTutorialCondition('expense_opened');
        }
        setShowExpenseModal(true);
        break;
      case 'travel':
        const filteredDestinations = filterStoryModeDestinations(location.destinations || []);
        console.log('🚪 Opening travel modal with destinations:', filteredDestinations);
        if (filteredDestinations.length === 0) {
          return;
        }
        setTravelDestinations(filteredDestinations);
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
    if (!isStoryModeMapAllowed(destId)) {
      return;
    }
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

    if (!isStoryModeMapAllowed(selectedDestination)) {
      setShowTransportModal(false);
      setSelectedDestination(null);
      return;
    }

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

    if (gameMode === 'story') {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.travelCount = (dayState.travelCount || 0) + 1;
        if (savedTransportMode === 'commute') {
          dayState.commuteTravelCount = (dayState.commuteTravelCount || 0) + 1;
        }
        dayState.travelDestinations.push(savedDestination);
      });
    }

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
          recordTransportExpense('Commute Fare', fare, 'Transport', 'Public Transit');
        }
      } else if (savedTransportMode === 'car' && savedDidBuyFuel) {
        const fuel = parseFloat(savedFuelAmount);
        if (fuel > 0) {
          recordTransportExpense('Gas/Fuel', fuel, 'Transport', 'Fuel & Gas');
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
  const recordTransportExpense = async (description, amount, category, subCategory) => {
    // Optimistic local state updates (instant)
    setCategorySpending(prev => ({
      ...prev,
      [category]: (prev[category] || 0) + amount
    }));

    if (gameMode === 'story') {
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

    // ── Optimistic: update daily task runtime & evaluate INSTANTLY (before DB save) ──
    if (gameMode === 'story') {
      const normalizedCategory = normalizeCategory(category);
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.expenseCount = (dayState.expenseCount || 0) + 1;
        dayState.expenseTotal = (dayState.expenseTotal || 0) + amount;
        dayState.categoryCounts[normalizedCategory] = (dayState.categoryCounts[normalizedCategory] || 0) + 1;
        dayState.categoryTotals[normalizedCategory] = (dayState.categoryTotals[normalizedCategory] || 0) + amount;
        dayState.expenseEntries.push({
          category: normalizedCategory,
          amount,
          note: description,
          source: 'transport',
          timestamp: new Date().toISOString(),
        });
        if ((dayState.travelCount || 0) > 0 && CATEGORY_BUDGET_MAP[normalizedCategory] === 'needs') {
          dayState.needsAfterTravelCount = (dayState.needsAfterTravelCount || 0) + 1;
        }
      });
      // Evaluate tasks instantly against the freshest runtime (ref)
      evaluateActiveStoryDayTasks();
    }

    // Background save — non-blocking
    try {
      const appMode = gameMode === 'story' ? 'story' : 'custom';
      const expenseData = {
        amount: amount,
        category: category,
        sub_category: subCategory || null,
        note: description,
        date: new Date().toISOString(),
        appMode,
      };

      console.log('💾 Transport: Saving expense via DataContext:', JSON.stringify(expenseData));
      const success = await addExpense(expenseData);

      if (!success) {
        console.error('❌ Transport: Failed to save expense');
        Alert.alert('Sync Error', 'Transport expense may not have been saved.');
      } else {
        console.log(`✅ Transport: Recorded ${description}: ₱${amount}`);

        // Persist session spending to Supabase (fire-and-forget)
        if (activeSessionId && gameMode === 'story') {
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
          gameDatabaseService.updateStorySessionSpending(activeSessionId, sessionUpdate);
        }

        if (gameMode === 'story') {
          // Log activity (fire-and-forget)
          gameDatabaseService.logActivity({
            activityType: 'expense_recorded',
            mapId: currentMapId,
            amount: amount,
            details: { category, note: description, source: 'transport' },
            sessionId: activeSessionId,
          });
          gameDatabaseService.incrementUserLevelStats({ expensesRecorded: 1 });
          fetchTodaySpending();
        }
      }
    } catch (error) {
      console.error('❌ Transport: Error saving expense:', error);
    }
  };

  // Travel to a new map
  const travelToMap = async (mapId) => {
    if (!isStoryModeMapAllowed(mapId)) {
      return;
    }

    const newMap = MAPS[mapId];
    if (!newMap) return;

    const fromMapId = currentMapId; // capture origin BEFORE switching maps

    setShowTransportModal(false);
    // Queue the doorway entry so the map-change effect lands us at the gateway we
    // came through instead of the room centre. (Issue 2)
    pendingEntrySpawnRef.current = { mapId, fromMapId };
    setCurrentMapId(mapId);

    // Optimistic positioning so the move feels instant; the map-change effect
    // re-affirms the exact same doorway spawn (no centre snap).
    const spawn = resolveEntrySpawn(newMap, fromMapId, contentSize.width, contentSize.height);
    commitCharacterPosition(spawn);
    const halfChar = getCharSize() / 2;
    setAnimatedPosition(spawn.x - halfChar, spawn.y - halfChar);
    lastDirectionRef.current = 'down';
    setCharacterDirection('down'); // Face down when arriving
    commitCurrentLocation(`${newMap.name} ${newMap.icon}`);

    if (gameMode === 'story' && mapId.startsWith('mall')) {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.mallVisited = true;
      });
    }

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
    ]).catch(() => { });

    if (gameMode === 'story') {
      // ── Log map travel to Supabase ──
      gameDatabaseService.logActivity({
        activityType: 'map_travel',
        mapId,
        details: { from: currentMapId, to: mapId, transport: transportMode || 'walk' },
        sessionId: activeSessionId,
      });
      gameDatabaseService.incrementUserLevelStats({ mapsTraveled: 1 });
    }

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
    // Queue doorway entry so the map-change effect keeps us at the arrival
    // escalator instead of snapping to the floor centre. resolveEntrySpawn
    // matches the floor_change escalator whose targetFloor === previousMapId. (Issue 2)
    pendingEntrySpawnRef.current = { mapId: floorId, fromMapId: previousMapId };
    setCurrentMapId(floorId);

    const spawn = resolveEntrySpawn(newMap, previousMapId, contentSize.width, contentSize.height);
    commitCharacterPosition(spawn);
    const halfChar = getCharSize() / 2;
    setAnimatedPosition(spawn.x - halfChar, spawn.y - halfChar);
    lastDirectionRef.current = 'down';
    setCharacterDirection('down');
    commitCurrentLocation(`${newMap.name} ${newMap.icon}`);

    if (gameMode === 'story' && floorId.startsWith('mall')) {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.mallVisited = true;
      });
    }

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

  const logMovement = (...args) => {
    if (DEBUG_MOVEMENT) {
      console.log(...args);
    }
  };

  // Calculate a simple path from current position to target (tile by tile)
  const calculatePath = (fromX, fromY, toX, toY) => {
    if (!collisionSystem.initialized) {
      // If no collision system, just return direct path
      return [{ x: toX, y: toY }];
    }

    const fromTile = collisionSystem.pixelsToTiles(fromX, fromY, contentSize.width, contentSize.height);
    const toTile = collisionSystem.pixelsToTiles(toX, toY, contentSize.width, contentSize.height);

    logMovement(`📍 Calculating path from tile (${fromTile.x}, ${fromTile.y}) to (${toTile.x}, ${toTile.y})`);

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
        logMovement(`🚫 Path blocked at tile (${currentX}, ${currentY})`);
        break;
      }
    }

    logMovement(`📍 Path calculated: ${path.length} steps`);
    return path;
  };

  // Move one tile along the path
  const moveOneStep = (targetPixelX, targetPixelY, onComplete) => {
    const halfChar = getCharSize() / 2;
    const targetX = targetPixelX - halfChar;
    const targetY = targetPixelY - halfChar;

    // Get current position from the animated value's current value
    const currentX = animatedPositionRef.current.x + halfChar;
    const currentY = animatedPositionRef.current.y + halfChar;

    // Calculate direction based on movement
    const deltaX = targetPixelX - currentX;
    const deltaY = targetPixelY - currentY;

    // Set character direction based on movement
    let nextDirection = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      nextDirection = deltaX > 0 ? 'right' : 'left';
    } else if (deltaY !== 0) {
      nextDirection = deltaY > 0 ? 'down' : 'up';
    }

    if (nextDirection && nextDirection !== lastDirectionRef.current) {
      lastDirectionRef.current = nextDirection;
      setCharacterDirection(nextDirection);
    }

    // Duration per tile (consistent speed)
    const TILE_MOVE_DURATION = 200; // 200ms per tile

    // Animate movement to the next tile
    const animation = Animated.parallel([
      Animated.timing(animatedX, {
        toValue: targetX,
        duration: TILE_MOVE_DURATION,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(animatedY, {
        toValue: targetY,
        duration: TILE_MOVE_DURATION,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    ]);

    // Store reference for potential cancellation
    currentAnimationRef.current = animation;

    animation.start(({ finished }) => {
      if (finished) {
        characterPositionRef.current = { x: targetPixelX, y: targetPixelY };
        // Keep the animated-position mirror authoritative at each tile boundary
        // (defense-in-depth: stays correct even if a native listener update is missed).
        animatedPositionRef.current = { x: targetX, y: targetY };
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

    const halfChar = getCharSize() / 2;
    animatedX.stopAnimation();
    animatedY.stopAnimation();

    const nextPosition = {
      x: animatedPositionRef.current.x + halfChar,
      y: animatedPositionRef.current.y + halfChar,
    };
    characterPositionRef.current = nextPosition;
    setCharacterPosition(nextPosition);

    return nextPosition;
  };

  // Process the movement path step by step
  const processMovementPath = () => {
    if (movementPathRef.current.length === 0) {
      // Path complete
      isMovingRef.current = false;
      setIsWalking(false);

      const finalPosition = characterPositionRef.current;
      if (finalPosition && (finalPosition.x !== characterPosition.x || finalPosition.y !== characterPosition.y)) {
        setCharacterPosition(finalPosition);
      }

      // Only check for location action at the FINAL destination (where user tapped)
      if (targetDestinationRef.current) {
        const location = getLocationAtPosition(
          targetDestinationRef.current.x,
          targetDestinationRef.current.y
        );
        if (location) {
          logMovement(`✅ Character reached tapped destination: ${location.name}!`);
          handleLocationAction(location);
        }
        targetDestinationRef.current = null; // Clear the target
      }
      return;
    }

    // Get next step
    const nextStep = movementPathRef.current.shift();

    // Update location display
    const nextLocation = getLocationName(nextStep.x, nextStep.y);
    commitCurrentLocation(nextLocation);

    logMovement(`🚶 Moving to tile (${nextStep.tileX}, ${nextStep.tileY})`);

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

    logMovement('===== TAP DEBUG =====');
    logMovement('Current map:', currentMapId);
    logMovement('Content dimensions:', contentSize.width, 'x', contentSize.height);
    logMovement('Tap at:', locationX.toFixed(0), locationY.toFixed(0));
    logMovement('Tap % of content:', (locationX / contentSize.width * 100).toFixed(1) + '%', 'x', (locationY / contentSize.height * 100).toFixed(1) + '%');

    // Check what location this tap is in
    const tapLocation = getLocationAtPosition(locationX, locationY);
    logMovement('Tap location:', tapLocation ? tapLocation.name : 'None');
    logMovement('====================');

    // If already moving, stop current movement and redirect to new destination
    let startPosition = characterPositionRef.current || characterPosition;
    if (isWalking || isMovingRef.current) {
      logMovement('🔄 Redirecting to new destination');
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
      logMovement('🧱 Target tile info:', JSON.stringify(tileInfo));

      // Check if destination tile is passable (also treat NPC tiles as blocked)
      if (!tileInfo.passable || isNPCTile(tileCoords.x, tileCoords.y)) {
        logMovement('🚫 Destination tile is not passable (or occupied by NPC)!');
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
          logMovement('🚫 No valid path found!');
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
        logMovement('🚫 No valid path found or already at destination!');
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
      commitCurrentLocation(getLocationName(locationX, locationY));

      const halfChar = getCharSize() / 2;
      const targetX = locationX - halfChar;
      const targetY = locationY - halfChar;

      const currentX = startPosition.x;
      const currentY = startPosition.y;
      const distance = Math.sqrt(
        Math.pow(locationX - currentX, 2) + Math.pow(locationY - currentY, 2)
      );

      const duration = Math.max(500, distance * 3);

      const animation = Animated.parallel([
        Animated.timing(animatedX, {
          toValue: targetX,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(animatedY, {
          toValue: targetY,
          duration: duration,
          useNativeDriver: true,
        }),
      ]);

      currentAnimationRef.current = animation;

      animation.start(({ finished }) => {
        if (finished) {
          setIsWalking(false);
          characterPositionRef.current = { x: locationX, y: locationY };
          if (characterPosition.x !== locationX || characterPosition.y !== locationY) {
            setCharacterPosition({ x: locationX, y: locationY });
          }

          const location = getLocationAtPosition(locationX, locationY);
          if (location) {
            logMovement(`✅ Character reached ${location.name}!`);
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

    if (gameMode === 'story' && goal?.name) {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.goalAllocations[goal.name] = (dayState.goalAllocations[goal.name] || 0) + amount;
        dayState.goalAllocationActions = (dayState.goalAllocationActions || 0) + 1;
      });
      // Listen to the allocation event: check off goal tasks against the freshest runtime (ref)
      evaluateActiveStoryDayTasks();
    }

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
    if (activeSessionId && gameMode === 'story') {
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
      }
    }
  };

  // Level 2: Deduct money from a savings goal (rebalancing transaction).
  // The addition/deduction buttons in the Allocate to Goals modal both feed the
  // validation loop so goal tasks (e.g. rebalancing) check off dynamically.
  const deallocateFromGoal = (goalId, amount) => {
    const currentAllocated = goalAllocations[goalId] || 0;
    const deduction = Math.min(amount, currentAllocated);
    if (deduction <= 0) return;

    // Return the funds to the weekly budget
    setGoalAllocations(prev => ({
      ...prev,
      [goalId]: (prev[goalId] || 0) - deduction,
    }));

    // Allocating counts as spending toward goals; deducting returns it
    setWeeklySpending(prev => prev - deduction);

    setBudgetCategories(prev => {
      const totalSavings = Object.values(goalAllocations).reduce((sum, val) => sum + val, 0) - deduction;
      return {
        needs: prev.needs,
        wants: prev.wants,
        savings: { ...prev.savings, spent: totalSavings },
      };
    });

    const goal = savingsGoals.find(g => g.id === goalId);

    if (gameMode === 'story' && goal?.name) {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.goalAllocations[goal.name] = Math.max(0, (dayState.goalAllocations[goal.name] || 0) - deduction);
        // A deduction is still a rebalancing transaction — register it.
        dayState.goalAllocationActions = (dayState.goalAllocationActions || 0) + 1;
      });
      // Listen to the deduction event: re-check goal tasks against the freshest runtime (ref)
      evaluateActiveStoryDayTasks();
    }

    // ── Persist updated goal allocations to DB ──
    if (activeSessionId && gameMode === 'story') {
      const updatedAllocations = { ...goalAllocations, [goalId]: (goalAllocations[goalId] || 0) - deduction };
      const totalAllocatedNow = Object.values(updatedAllocations).reduce((sum, val) => sum + val, 0);
      const updatedGoalsData = savingsGoals.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        target: g.target,
        allocated: updatedAllocations[g.id] || 0,
      }));
      gameDatabaseService.updateStorySessionSpending(activeSessionId, {
        weeklySpending: weeklySpending - deduction,
        totalAllocated: totalAllocatedNow,
        goalsData: updatedGoalsData,
        savingsAmount: weeklyBudget - (weeklySpending - deduction),
      });
    }
  };

  const handleSubmitExpense = async () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    if (!expenseNote.trim() && !(SUBCATEGORIES[expenseCategory] || []).length) {
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
    const savedSubCategory = expenseSubCategory;
    const currentDate = new Date();

    // Optimistic UI update - close modal immediately for seamless experience
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseSubCategory(null);
    setShowSubCategoryDropdown(false);

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

    const expenseAmountNum = parseFloat(savedAmount);
    const normalizedCategory = normalizeCategory(savedCategory);

    // ── Optimistic: update daily task runtime & evaluate INSTANTLY (before DB save) ──
    if (gameMode === 'story') {
      updateDailyTaskRuntimeForActiveDay((dayState) => {
        dayState.expenseCount = (dayState.expenseCount || 0) + 1;
        dayState.expenseTotal = (dayState.expenseTotal || 0) + expenseAmountNum;
        dayState.categoryCounts[normalizedCategory] = (dayState.categoryCounts[normalizedCategory] || 0) + 1;
        dayState.categoryTotals[normalizedCategory] = (dayState.categoryTotals[normalizedCategory] || 0) + expenseAmountNum;
        dayState.expenseEntries.push({
          category: normalizedCategory,
          amount: expenseAmountNum,
          note: savedNote || savedSubCategory || savedCategory,
          source: 'map',
          timestamp: new Date().toISOString(),
        });
        if ((dayState.travelCount || 0) > 0 && CATEGORY_BUDGET_MAP[normalizedCategory] === 'needs') {
          dayState.needsAfterTravelCount = (dayState.needsAfterTravelCount || 0) + 1;
        }
      });
      // Evaluate tasks instantly against the freshest runtime (ref)
      evaluateActiveStoryDayTasks();
    }

    // Save in background
    try {
      // Use DataContext's addExpense for proper syncing across the app
      const expenseData = {
        amount: expenseAmountNum,
        category: savedCategory,
        sub_category: savedSubCategory || null,
        note: `${savedNote || savedSubCategory || savedCategory} (at ${currentMap.name})`, // Include location in note
        date: currentDate.toISOString(), // Pass full ISO timestamp with date AND time
        appMode: 'story',
      };

      console.log('💾 Saving expense via DataContext:', JSON.stringify(expenseData));

      const success = await addExpense(expenseData);

      if (!success) {
        console.error('❌ Failed to save expense in background');
        // Optionally show error after the fact
        Alert.alert('Sync Error', 'Your expense may not have been saved. Please check your expenses list.');
      } else {
        console.log('✅ Expense saved successfully via DataContext');

        // Update category spending tracking (for all levels)
        setCategorySpending(prev => ({
          ...prev,
          [savedCategory]: (prev[savedCategory] || 0) + expenseAmountNum
        }));

        // Level 1 (Budgeting): Update 50/30/20 category budgets
        if (gameMode === 'story' &&
          STORY_LEVELS[storyLevel]?.type === 'budgeting') {
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

        if (gameMode === 'story') {
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
        }

        // Update session spending if in story mode
        if (activeSessionId && gameMode === 'story') {
          const updatedSpending = weeklySpending + expenseAmountNum;
          const updatedCategorySpending = { ...categorySpending, [savedCategory]: (categorySpending[savedCategory] || 0) + expenseAmountNum };

          // Calculate updated needs/wants spent
          const budgetType = CATEGORY_BUDGET_MAP[savedCategory] || 'wants';
          const updatedNeedsSpent = budgetCategories.needs.spent + (budgetType === 'needs' ? expenseAmountNum : 0);
          const updatedWantsSpent = budgetCategories.wants.spent + (budgetType === 'wants' ? expenseAmountNum : 0);

          gameDatabaseService.updateStorySessionSpending(activeSessionId, {
            weeklySpending: updatedSpending,
            categorySpending: updatedCategorySpending,
            needsSpent: updatedNeedsSpent,
            wantsSpent: updatedWantsSpent,
            savingsAmount: weeklyBudget - updatedSpending,
          });
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
      paddingTop: screenHeight * 0.012,
      paddingBottom: 12,
      backgroundColor: '#1a1a2e',
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    backToMenuButton: {
      width: Math.round(screenWidth * 0.09),
      height: Math.round(screenWidth * 0.09),
      borderRadius: Math.round(screenWidth * 0.045),
      backgroundColor: '#E67E22',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerLeftControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    historyButtonAlert: {
      backgroundColor: '#ffb68b',
    },
    historyButton: {
      flexDirection: 'row',
      width: Math.round(screenWidth * 0.09),
      height: Math.round(screenWidth * 0.09),
      borderRadius: Math.round(screenWidth * 0.025),
      backgroundColor: 'rgba(90, 90, 122, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    historyBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ff3b30',
      borderWidth: 1,
      borderColor: '#1a1a2e',
    },
    giveUpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#C62828',
      paddingHorizontal: Math.round(screenWidth * 0.018),
      paddingVertical: screenHeight * 0.007,
      borderRadius: Math.round(screenWidth * 0.035),
      minWidth: Math.round(screenWidth * 0.18),
      gap: 4,
    },
    giveUpButtonText: {
      color: '#FFF',
      fontSize: Math.round(screenWidth * 0.026),
      fontFamily: FONTS.bodyBold,
    },
    dailyTasksButtonSleep: {
      backgroundColor: '#5c6bc0',
    },
    dailyTasksButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: Math.round(screenWidth * 0.09),
      height: Math.round(screenWidth * 0.09),
      borderRadius: Math.round(screenWidth * 0.025),
      backgroundColor: 'rgba(90, 90, 122, 0.9)',
    },
    dailyTasksButtonText: {
      fontSize: Math.round(screenWidth * 0.026),
      fontFamily: FONTS.bodyBold,
    },
    headerLeft: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.3,
      color: '#fff',
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: Math.round(screenWidth * 0.03),
      color: '#888',
      marginTop: 2,
      textAlign: 'center',
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    spendingLabel: {
      fontSize: Math.round(screenWidth * 0.028),
      color: '#888',
      marginBottom: 2,
      textAlign: 'right',
    },
    spendingLabelStacked: {
      marginTop: 6,
    },
    spendingAmount: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
      color: '#FF9800',
      textAlign: 'right',
    },
    weeklyBudgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
    },
    settingsGearButton: {
      width: Math.round(screenWidth * 0.07),
      height: Math.round(screenWidth * 0.07),
      borderRadius: Math.round(screenWidth * 0.035),
      backgroundColor: 'rgba(90, 90, 122, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationBadge: {
      position: 'absolute',
      top: screenHeight * 0.085,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: screenWidth * 0.04,
      paddingVertical: screenHeight * 0.01,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      zIndex: 100,
    },
    locationText: {
      color: '#fff',
      fontSize: Math.round(screenWidth * 0.035),
      fontFamily: FONTS.bodySemiBold,
    },
    walkingIndicator: {
      width: Math.round(screenWidth * 0.02),
      height: Math.round(screenWidth * 0.02),
      borderRadius: Math.round(screenWidth * 0.01),
      backgroundColor: '#4CAF50',
    },
    // Story Mode Progress Bar Styles - Top compact strip below header
    storyProgressContainer: {
      position: 'absolute',
      top: screenHeight * 0.165,
      left: screenWidth * 0.02,
      right: screenWidth * 0.02,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderRadius: 12,
      padding: screenWidth * 0.025,
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
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.bodySemiBold,
    },
    storyProgressPercent: {
      color: '#4CAF50',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
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
      marginBottom: screenHeight * 0.012,
    },
    budgetRuleLabel: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.033),
      fontFamily: FONTS.bodyBold,
    },
    budgetDaysLeft: {
      color: '#888',
      fontSize: Math.round(screenWidth * 0.028),
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: screenWidth * 0.02,
      paddingVertical: 3,
      borderRadius: Math.round(screenWidth * 0.025),
    },
    budgetCategoriesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    budgetCategoryCard: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: Math.round(screenWidth * 0.025),
      padding: Math.round(screenWidth * 0.025),
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
      fontSize: Math.round(screenWidth * 0.025),
      fontFamily: FONTS.bodySemiBold,
      textTransform: 'uppercase',
    },
    budgetCategoryPercent: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
    },
    budgetCategoryLimit: {
      fontSize: Math.round(screenWidth * 0.023),
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
      marginTop: 4,
      paddingHorizontal: 4,
      gap: 8,
    },
    budgetCompactLabel: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.bodySemiBold,
    },
    budgetCompactStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.round(screenWidth * 0.03),
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
      fontSize: Math.round(screenWidth * 0.03),
    },
    budgetCompactPercent: {
      fontSize: Math.round(screenWidth * 0.033),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
    },
    budgetCompactActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetCompactDays: {
      color: '#888',
      fontSize: Math.round(screenWidth * 0.028),
      fontFamily: FONTS.bodySemiBold,
      fontVariant: ['tabular-nums'],
    },
    endWeekBtnCompact: {
      width: Math.round(screenWidth * 0.07),
      height: Math.round(screenWidth * 0.07),
      borderRadius: Math.round(screenWidth * 0.035),
      backgroundColor: '#E74C3C',
      justifyContent: 'center',
      alignItems: 'center',
    },
    savingsCompactProgress: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Math.round(screenWidth * 0.03),
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
    historyOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    historyBackdrop: {
      flex: 1,
    },
    historySheet: {
      backgroundColor: '#0f172a',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      // Cap height so the unbounded SectionList can't grow the sheet past the
      // top of the screen and clip the header under the status bar/notch.
      maxHeight: '85%',
    },
    historyHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    historyTitle: {
      color: '#ffb68b',
      fontSize: 18,
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
    },
    historyCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    historySectionHeader: {
      marginBottom: 8,
      marginTop: 4,
    },
    historySectionTitle: {
      color: '#F5DEB3',
      fontSize: 14,
      fontFamily: FONTS.bodySemiBold,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#1e293b',
      padding: 16,
      marginBottom: 12,
      borderRadius: 16,
    },
    historyItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    historyItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#2a1c12',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    historyItemTitle: {
      color: '#e5e2e1',
      fontSize: 16,
      fontFamily: FONTS.bodySemiBold,
    },
    historyItemSubtitle: {
      color: '#a78b7c',
      fontSize: 12,
    },
    historyEmptyState: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    historyEmptyText: {
      color: '#a78b7c',
      fontSize: 12,
    },
    expenseListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1e293b',
      padding: 14,
      marginBottom: 10,
      borderRadius: 14,
    },
    expenseListIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#2a1c12',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    expenseListCenter: {
      flex: 1,
      marginRight: 12,
    },
    expenseListCategory: {
      color: '#ffb68b',
      fontSize: 13,
      fontFamily: FONTS.bodySemiBold,
    },
    expenseListNote: {
      color: '#e5e2e1',
      fontSize: 14,
      marginTop: 2,
    },
    expenseListTime: {
      color: '#a78b7c',
      fontSize: 11,
      marginTop: 2,
    },
    expenseListAmount: {
      color: '#ffffff',
      fontSize: 16,
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
    },
    dailyTaskSheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dailyTaskSheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    dailyTaskSheet: {
      backgroundColor: '#1F1F33',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Math.round(screenWidth * 0.05),
      paddingTop: 10,
      paddingBottom: screenHeight * 0.035,
      borderTopWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      minHeight: screenHeight * 0.3,
    },
    dailyTaskSheetHandle: {
      width: Math.round(screenWidth * 0.14),
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.28)',
      alignSelf: 'center',
      marginBottom: 12,
    },
    dailyTaskSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    dailyTaskSheetTitle: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.3,
    },
    dailyTaskSheetSubtitle: {
      color: '#BFC3D6',
      fontSize: Math.round(screenWidth * 0.032),
      marginBottom: 8,
    },
    dailyTaskSheetProgress: {
      marginTop: 10,
      color: '#4CAF50',
      fontSize: Math.round(screenWidth * 0.032),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
    },
    dailyTaskSheetEmpty: {
      color: '#B0B0B0',
      fontSize: Math.round(screenWidth * 0.032),
      marginTop: 4,
    },
    dailyTaskPanel: {
      marginTop: 10,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: Math.round(screenWidth * 0.022),
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    dailyTaskHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    dailyTaskHeaderText: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.bodyBold,
    },
    dailyTaskProgressText: {
      color: '#4CAF50',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
    },
    dailyTaskDialogue: {
      color: '#D4C4A8',
      fontSize: Math.round(screenWidth * 0.028),
      marginBottom: 6,
      lineHeight: Math.round(screenWidth * 0.038),
    },
    dailyTaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    dailyTaskText: {
      flex: 1,
      color: '#E6E6E6',
      fontSize: Math.round(screenWidth * 0.028),
      lineHeight: Math.round(screenWidth * 0.037),
    },
    dailyTaskTextDone: {
      color: '#7DDA80',
      textDecorationLine: 'line-through',
    },
    // Legacy budget bar styles (kept for other uses)
    budgetBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetBarLabel: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.025),
      width: Math.round(screenWidth * 0.21),
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
      fontSize: Math.round(screenWidth * 0.023),
      width: Math.round(screenWidth * 0.075),
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
      fontSize: Math.round(screenWidth * 0.04),
    },
    goalProgressName: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.028),
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
      fontSize: Math.round(screenWidth * 0.025),
      minWidth: Math.round(screenWidth * 0.175),
      textAlign: 'right',
    },
    allocateButton: {
      backgroundColor: '#3498DB',
      paddingVertical: screenHeight * 0.01,
      paddingHorizontal: screenWidth * 0.04,
      borderRadius: 8,
      alignSelf: 'center',
      marginTop: 8,
    },
    allocateButtonText: {
      color: '#FFF',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.bodySemiBold,
    },
    // Goal Allocation Modal Styles
    goalAllocationItem: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: Math.round(screenWidth * 0.03),
      padding: Math.round(screenWidth * 0.03),
    },
    quickAllocateBtn: {
      backgroundColor: '#3498DB',
      paddingVertical: 6,
      paddingHorizontal: Math.round(screenWidth * 0.025),
      borderRadius: 6,
    },
    quickAllocateBtnText: {
      color: '#FFF',
      fontSize: Math.round(screenWidth * 0.028),
      fontFamily: FONTS.bodySemiBold,
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
      fontSize: Math.round(screenWidth * 0.06),
    },
    // Closet Modal - Character Selection Styles
    characterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: Math.round(screenWidth * 0.04),
      padding: Math.round(screenWidth * 0.03),
      borderWidth: 3,
      gap: Math.round(screenWidth * 0.03),
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
      width: Math.round(screenWidth * 0.16),
      height: Math.round(screenWidth * 0.20),
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
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      marginBottom: 4,
    },
    characterOptionDesc: {
      fontSize: Math.round(screenWidth * 0.033),
    },
    characterSelectedBadge: {
      width: Math.round(screenWidth * 0.07),
      height: Math.round(screenWidth * 0.07),
      borderRadius: Math.round(screenWidth * 0.035),
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingButton: {
      position: 'absolute',
      bottom: screenHeight * 0.12,
      right: screenWidth * 0.05,
      backgroundColor: '#FF9800',
      width: Math.round(screenWidth * 0.15),
      height: Math.round(screenWidth * 0.15),
      borderRadius: Math.round(screenWidth * 0.075),
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
      bottom: screenHeight * 0.04,
      left: screenWidth * 0.05,
      backgroundColor: '#E74C3C',
      paddingHorizontal: screenWidth * 0.04,
      paddingVertical: screenHeight * 0.015,
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
      fontSize: Math.round(screenWidth * 0.035),
      fontFamily: FONTS.bodyBold,
    },
    endWeekButtonInline: {
      marginTop: screenHeight * 0.015,
      backgroundColor: '#E74C3C',
      paddingHorizontal: screenWidth * 0.04,
      paddingVertical: screenHeight * 0.012,
      borderRadius: Math.round(screenWidth * 0.05),
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
      fontSize: Math.round(screenWidth * 0.033),
      fontFamily: FONTS.bodySemiBold,
    },
    instructionBanner: {
      position: 'absolute',
      bottom: screenHeight * 0.035,
      left: screenWidth * 0.05,
      right: screenWidth * 0.05,
      backgroundColor: 'rgba(0,0,0,0.85)',
      paddingHorizontal: screenWidth * 0.05,
      paddingVertical: screenHeight * 0.017,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: screenWidth * 0.03,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    instructionText: {
      flex: 1,
      color: '#fff',
      fontSize: Math.round(screenWidth * 0.033),
      lineHeight: Math.round(screenWidth * 0.045),
    },
    instructionHighlight: {
      color: '#FF9800',
      fontFamily: FONTS.bodyBold,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: screenWidth * 0.05,
    },
    modalContent: {
      width: '100%',
      maxWidth: screenWidth * 0.95,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: screenWidth * 0.06,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: screenHeight * 0.025,
      gap: Math.round(screenWidth * 0.03),
    },
    modalIcon: {
      width: Math.round(screenWidth * 0.14),
      height: Math.round(screenWidth * 0.14),
      borderRadius: Math.round(screenWidth * 0.07),
      backgroundColor: '#FF9800',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderText: {
      flex: 1,
    },
    modalTitle: {
      fontSize: Math.round(screenWidth * 0.055),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.4,
      color: colors.text,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: Math.round(screenWidth * 0.035),
      color: colors.textSecondary,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: Math.round(screenWidth * 0.03),
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 8,
    },
    quickAmountsContainer: {
      marginBottom: screenHeight * 0.02,
    },
    quickAmountsLabel: {
      fontSize: Math.round(screenWidth * 0.033),
      color: colors.textSecondary,
      marginBottom: screenHeight * 0.012,
    },
    quickAmountsRow: {
      flexDirection: 'row',
      gap: Math.round(screenWidth * 0.025),
    },
    quickAmountButton: {
      flex: 1,
      backgroundColor: colors.background,
      paddingVertical: screenHeight * 0.015,
      borderRadius: Math.round(screenWidth * 0.025),
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
      fontFamily: FONTS.numberSemiBold,
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    quickAmountTextActive: {
      color: '#fff',
    },
    inputContainer: {
      marginBottom: screenHeight * 0.02,
    },
    inputLabel: {
      fontSize: Math.round(screenWidth * 0.035),
      fontFamily: FONTS.bodySemiBold,
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Math.round(screenWidth * 0.03),
      padding: Math.round(screenWidth * 0.035),
      fontSize: Math.round(screenWidth * 0.04),
      color: colors.text,
      backgroundColor: colors.background,
    },
    textArea: {
      height: screenHeight * 0.1,
      textAlignVertical: 'top',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: Math.round(screenWidth * 0.03),
      marginTop: 8,
    },
    button: {
      flex: 1,
      padding: Math.round(screenWidth * 0.04),
      borderRadius: Math.round(screenWidth * 0.03),
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
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodyBold,
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
      maxWidth: screenWidth * 0.9,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: screenWidth * 0.05,
      alignItems: 'center',
    },
    travelTitle: {
      fontSize: Math.round(screenWidth * 0.06),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.4,
      color: colors.text,
      marginBottom: screenHeight * 0.01,
    },
    travelSubtitle: {
      fontSize: Math.round(screenWidth * 0.035),
      color: colors.textSecondary,
      marginBottom: screenHeight * 0.025,
    },
    destinationButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: Math.round(screenWidth * 0.04),
      borderRadius: Math.round(screenWidth * 0.04),
      marginBottom: Math.round(screenHeight * 0.015),
      borderWidth: 2,
      borderColor: colors.border,
    },
    destinationIcon: {
      fontSize: Math.round(screenWidth * 0.08),
      marginRight: Math.round(screenWidth * 0.04),
    },
    destinationInfo: {
      flex: 1,
    },
    destinationName: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      color: colors.text,
    },
    destinationDesc: {
      fontSize: Math.round(screenWidth * 0.03),
      color: colors.textSecondary,
      marginTop: 2,
    },
    travelCancelButton: {
      marginTop: 8,
      padding: Math.round(screenWidth * 0.03),
    },
    travelCancelText: {
      color: colors.textSecondary,
      fontSize: Math.round(screenWidth * 0.04),
    },
    // Achievement Modal styles
    achievementModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: screenWidth * 0.05,
    },
    achievementModalContent: {
      width: '85%',
      maxWidth: screenWidth * 0.85,
      backgroundColor: '#1a1a2e',
      borderRadius: 24,
      padding: screenWidth * 0.08,
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#FFD700',
      shadowColor: '#FFD700',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 15,
    },
    iconContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    achievementGlow: {
      position: 'absolute',
      width: Math.round(screenWidth * 0.25),
      height: Math.round(screenWidth * 0.25),
      backgroundColor: '#FFD700',
      borderRadius: Math.round(screenWidth * 0.25),
      opacity: 0.1,
      zIndex: 0,
      elevation: 0,
    },
    achievementUnlockedText: {
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodyBold,
      color: '#FFD700',
      marginBottom: screenHeight * 0.02,
      letterSpacing: 2,
    },
    achievementIcon: {
      fontSize: Math.round(screenWidth * 0.16),
      marginBottom: screenHeight * 0.02,
    },
    achievementTitle: {
      fontSize: Math.round(screenWidth * 0.06),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.4,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    achievementDescription: {
      fontSize: Math.round(screenWidth * 0.035),
      color: '#B0B0B0',
      textAlign: 'center',
      marginBottom: screenHeight * 0.025,
      lineHeight: Math.round(screenWidth * 0.05),
    },
    achievementPoints: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
      paddingHorizontal: screenWidth * 0.04,
      paddingVertical: screenHeight * 0.01,
      borderRadius: Math.round(screenWidth * 0.05),
      marginBottom: screenHeight * 0.025,
      gap: 8,
    },
    achievementPointsText: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
      color: '#FFD700',
    },
    achievementCloseButton: {
      backgroundColor: '#FFD700',
      paddingHorizontal: screenWidth * 0.1,
      paddingVertical: screenHeight * 0.017,
      borderRadius: 25,
    },
    achievementCloseText: {
      color: '#1a1a2e',
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodyBold,
    },
    // Map indicator styles
    mapIndicatorContainer: {
      position: 'absolute',
      top: screenHeight * 0.012,
      left: screenWidth * 0.025,
      right: screenWidth * 0.025,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      zIndex: 50,
    },
    locationMarker: {
      backgroundColor: 'rgba(255, 152, 0, 0.9)',
      paddingHorizontal: Math.round(screenWidth * 0.03),
      paddingVertical: screenHeight * 0.01,
      borderRadius: Math.round(screenWidth * 0.03),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 2,
      borderColor: '#FFF',
    },
    locationMarkerText: {
      color: '#FFF',
      fontSize: Math.round(screenWidth * 0.03),
      fontFamily: FONTS.bodyBold,
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
      fontSize: Math.round(screenWidth * 0.16),
      marginBottom: screenHeight * 0.02,
    },
    placeholderMapTitle: {
      fontSize: Math.round(screenWidth * 0.06),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.4,
      color: '#FFF',
      marginBottom: 8,
    },
    placeholderMapHint: {
      fontSize: Math.round(screenWidth * 0.035),
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

  // Render location collision overlays (invisible — events trigger on bounds only)
  const renderLocationOverlays = useMemo(() => null, []);

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
  const renderWallOverlays = useMemo(() => {
    if (!collisionSystem.initialized || !currentMap.image) return null;

    const dims = getMapDisplayDimensions();
    if (!dims || dims.tileDisplaySize <= 0) return null;

    const charPosition = characterPositionRef.current;
    if (!charPosition) return null;

    // Get character's current tile position
    const charTile = collisionSystem.pixelsToTiles(
      charPosition.x, charPosition.y,
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
  }, [currentMapId, currentMap.image, contentSize.width, contentSize.height, getMapDisplayDimensions]);

  // ─── Render NPCs (static workers) on the current map ──────────────
  const renderNPCs = useMemo(() => {
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

    const charPosition = characterPositionRef.current;
    const charTile = charPosition ? collisionSystem.pixelsToTiles(
      charPosition.x, charPosition.y,
      contentSize.width, contentSize.height
    ) : { x: 0, y: 0 };

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
      const npcTop = pixelPos.y - halfChar;

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
  }, [currentMapId, contentSize.width, contentSize.height, getCharSize, getMapDisplayDimensions]);

  const renderCharacter = useMemo(() => {
    const directionOffset = SPRITE_CONFIG.directions[characterDirection] ?? SPRITE_CONFIG.directions.down;
    const characterSprite = CHARACTER_SPRITES[selectedCharacter];
    const charSize = getCharSize();
    const CHAR_VISUAL_SCALE = 0.9; // Visual scale: <1 = smaller, 1 = full tile size
    const FRAME_W = 48;  // Sprite frame width in source image
    const FRAME_H = 90;  // Sprite frame height in source image
    const TOTAL_FRAMES = 24;
    const spriteScale = (charSize * CHAR_VISUAL_SCALE) / FRAME_W;
    const scaledFrameW = FRAME_W * spriteScale;
    const scaledFrameH = FRAME_H * spriteScale;
    const spriteTranslateX = Animated.multiply(
      Animated.add(spriteFrameAnim, directionOffset),
      -FRAME_W * spriteScale
    );

    return (
      <Animated.View
        style={[
          styles.characterContainer,
          {
            width: charSize,
            height: charSize,
            transform: [
              { translateX: animatedX },
              { translateY: animatedY },
              { scale: walkingPulse },
            ],
          },
        ]}
      >
        <View style={{
          width: scaledFrameW,
          height: scaledFrameH,
          overflow: 'hidden',
        }}>
          <Animated.Image
            source={characterSprite.sprite}
            style={{
              width: FRAME_W * TOTAL_FRAMES * spriteScale,
              height: FRAME_H * spriteScale,
              transform: [{ translateX: spriteTranslateX }],
            }}
            resizeMode="cover"
          />
        </View>
      </Animated.View>
    );
  }, [animatedX, animatedY, walkingPulse, spriteFrameAnim, characterDirection, selectedCharacter, getCharSize]);

  // Render map content based on current map
  const renderMapContent = () => {
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
              {renderLocationOverlays}

              {/* NPC Workers */}
              {renderNPCs}

              {/* Character with Sprite Animation */}
              {renderCharacter}

              {/* Wall tile overlays - rendered above character to prevent wall overlap */}
              {renderWallOverlays}
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
              {renderLocationOverlays}

              {/* Map placeholder info */}
              <View style={{ position: 'absolute', top: contentSize.height * 0.15, alignSelf: 'center', alignItems: 'center' }}>
                <Text style={styles.placeholderMapText}>{currentMap.icon}</Text>
                <Text style={styles.placeholderMapTitle}>{currentMap.name}</Text>
                <Text style={styles.placeholderMapHint}>Tap to move around</Text>
              </View>

              {/* Character with Sprite Animation */}
              {renderCharacter}
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
        needs: { budget: session.needs_budget || 0, spent: session.needs_spent || 0 },
        wants: { budget: session.wants_budget || 0, spent: session.wants_spent || 0 },
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
    dailyTaskAnnouncedDayRef.current = null;
    hydrateDailyTaskState(session.id, session.level);

    // Restore the in-game day boundary so "Today's Spending" stays scoped after a
    // reload/resume. Fall back to the session start if nothing was persisted yet.
    (async () => {
      try {
        const stored = user?.id
          ? await AsyncStorage.getItem(`currentInGameDayStart_${user.id}`)
          : null;
        await applyInGameDayStart(stored || new Date(session.start_date).toISOString());
      } catch (e) {
        await applyInGameDayStart(new Date(session.start_date).toISOString());
      }
    })();

    console.log(`🔄 Resumed active story session ${session.id} (Level ${session.level})`);
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
      cancelTutorial();
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
        try {
          await AsyncStorage.removeItem(getDailyTaskStorageKey(activeSessionId));
        } catch (error) {
          console.warn('⚠️ Failed to clear daily task cache:', error?.message || error);
        }
        gameDatabaseService.logActivity({
          activityType: 'session_abandoned',
          sessionId: activeSessionId,
          details: { level: storyLevel, mode: 'story' },
        });
      }
    }

    // Clear cached active sessions
    if (gameMode === 'story') cachedActiveStoryRef.current = null;

    // Reset game state and return to main menu
    setActiveSessionId(null);
    setWeeklyBudget(0);
    setWeeklySpending(0);
    setStoryStartDate(null);
    setStoryEndDate(null);
    setLevelResults(null);
    setDailyTaskCompletion({});
    setDailyTaskRuntimeByDay({});
    dailyTaskRuntimeByDayRef.current = {};
    setActiveStoryDay(1);
    dailyTaskAnnouncedDayRef.current = null;
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

  // Transport Modal Styles
  const transportStyles = StyleSheet.create({
    transportModalContent: {
      width: '95%',
      maxWidth: screenWidth * 0.95,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: screenWidth * 0.05,
      maxHeight: '85%',
    },
    transportHeader: {
      alignItems: 'center',
      marginBottom: screenHeight * 0.025,
      paddingBottom: screenHeight * 0.02,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    transportTitle: {
      fontSize: Math.round(screenWidth * 0.06),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.4,
      color: colors.text,
      marginBottom: screenHeight * 0.01,
    },
    transportSubtitle: {
      fontSize: Math.round(screenWidth * 0.035),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    modeSelection: {
      gap: Math.round(screenHeight * 0.015),
    },
    modeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: Math.round(screenWidth * 0.04),
      borderRadius: Math.round(screenWidth * 0.04),
      borderWidth: 2,
      borderColor: colors.border,
      gap: Math.round(screenWidth * 0.03),
    },
    modeIconContainer: {
      width: Math.round(screenWidth * 0.14),
      height: Math.round(screenWidth * 0.14),
      borderRadius: Math.round(screenWidth * 0.07),
      justifyContent: 'center',
      alignItems: 'center',
    },
    modeInfo: {
      flex: 1,
    },
    modeName: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      color: colors.text,
    },
    modeDesc: {
      fontSize: Math.round(screenWidth * 0.03),
      color: colors.textSecondary,
      marginTop: 2,
    },
    inputSection: {
      gap: Math.round(screenHeight * 0.02),
    },
    backToModes: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    backToModesText: {
      fontSize: Math.round(screenWidth * 0.035),
      color: '#3498DB',
    },
    selectedModeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    modeIconSmall: {
      width: Math.round(screenWidth * 0.1),
      height: Math.round(screenWidth * 0.1),
      borderRadius: Math.round(screenWidth * 0.05),
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedModeName: {
      fontSize: Math.round(screenWidth * 0.05),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.3,
      color: colors.text,
    },
    inputLabel: {
      fontSize: Math.round(screenWidth * 0.035),
      color: colors.textSecondary,
      marginBottom: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: Math.round(screenWidth * 0.04),
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: Math.round(screenWidth * 0.04),
      paddingVertical: 4,
    },
    currencySymbol: {
      fontSize: Math.round(screenWidth * 0.07),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
      color: '#FF9800',
      marginRight: screenWidth * 0.02,
    },
    amountInput: {
      flex: 1,
      fontSize: Math.round(screenWidth * 0.08),
      fontFamily: FONTS.numberBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.5,
      color: colors.text,
      paddingVertical: screenHeight * 0.015,
    },
    quickAmounts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    quickAmountBtn: {
      paddingVertical: screenHeight * 0.012,
      paddingHorizontal: Math.round(screenWidth * 0.04),
      borderRadius: Math.round(screenWidth * 0.05),
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
      fontFamily: FONTS.numberSemiBold,
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    quickAmountTextActive: {
      color: '#FFF',
    },
    confirmButton: {
      backgroundColor: '#3498DB',
      paddingVertical: screenHeight * 0.02,
      borderRadius: Math.round(screenWidth * 0.04),
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
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.bodyBold,
      color: '#FFF',
    },
    fuelQuestion: {
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodySemiBold,
      color: colors.text,
      textAlign: 'center',
      marginVertical: 8,
    },
    fuelOptions: {
      gap: Math.round(screenHeight * 0.015),
    },
    fuelOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: Math.round(screenWidth * 0.04),
      borderRadius: Math.round(screenWidth * 0.03),
      borderWidth: 2,
      borderColor: colors.border,
      gap: Math.round(screenWidth * 0.03),
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
      fontSize: Math.round(screenWidth * 0.04),
      color: colors.text,
    },
    fuelOptionTextActive: {
      color: '#FFF',
      fontFamily: FONTS.bodySemiBold,
    },
    fuelAmountSection: {
      marginTop: screenHeight * 0.02,
      paddingTop: screenHeight * 0.02,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    cancelButton: {
      marginTop: screenHeight * 0.02,
      paddingVertical: screenHeight * 0.015,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: Math.round(screenWidth * 0.04),
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
      paddingHorizontal: screenWidth * 0.05,
      paddingTop: screenHeight * 0.07,
    },
    backButton: {
      position: 'absolute',
      top: screenHeight * 0.06,
      left: screenWidth * 0.05,
      width: Math.round(screenWidth * 0.11),
      height: Math.round(screenWidth * 0.11),
      borderRadius: Math.round(screenWidth * 0.055),
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#5A5A7A',
      zIndex: 10,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: screenHeight * 0.035,
    },
    title: {
      fontSize: Math.round(screenWidth * 0.08),
      fontFamily: FONTS.headingBold,
      letterSpacing: -0.5,
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 0,
    },
    subtitle: {
      fontSize: Math.round(screenWidth * 0.04),
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
      padding: Math.round(screenWidth * 0.04),
      borderWidth: 4,
      gap: Math.round(screenWidth * 0.03),
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
      width: Math.round(screenWidth * 0.125),
      height: Math.round(screenWidth * 0.125),
      borderRadius: Math.round(screenWidth * 0.0625),
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    levelIcon: {
      fontSize: Math.round(screenWidth * 0.07),
    },
    levelInfo: {
      flex: 1,
    },
    levelName: {
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
    },
    levelDesc: {
      fontSize: Math.round(screenWidth * 0.03),
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
      fontSize: Math.round(screenWidth * 0.028),
      color: '#4CAF50',
      fontFamily: FONTS.bodySemiBold,
    },
    lockedText: {
      color: '#666',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      padding: Math.round(screenWidth * 0.04),
      marginTop: screenHeight * 0.03,
      borderWidth: 2,
      borderColor: '#5A5A7A',
      gap: Math.round(screenWidth * 0.03),
    },
    infoText: {
      flex: 1,
      fontSize: Math.round(screenWidth * 0.033),
      color: '#D4C4A8',
      lineHeight: Math.round(screenWidth * 0.045),
    },
  });

  const renderStoryIntro = () => (
    <ImageBackground
      source={require('../../../assets/Game_Graphics/menu/main_menu_bg.jpg')}
      style={storyStyles.background}
      resizeMode="cover"
    >
      <View style={storyStyles.overlay}>
        <TouchableOpacity
          style={storyStyles.backButton}
          onPress={() => {
            setShowStoryIntro(false);
            setGameMode(null);
            setShowMainMenu(true);
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#F5DEB3" />
        </TouchableOpacity>

        <View style={storyStyles.titleContainer}>
          <Text style={storyStyles.title}>📖 Story Mode</Text>
          <Text style={storyStyles.subtitle}>Master your finances!</Text>
        </View>

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

        <View style={storyStyles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#F5DEB3" />
          <Text style={storyStyles.infoText}>
            Daily progression: Level 1 = {STORY_DAY_COUNTS[1]} days, Level 2 = {STORY_DAY_COUNTS[2]} days, Level 3 = {STORY_DAY_COUNTS[3]} days. Complete all tasks each day to advance.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );

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
      paddingBottom: screenHeight * 0.05,
    },
    closeButton: {
      position: 'absolute',
      top: screenHeight * 0.02,
      left: screenWidth * 0.04,
      width: Math.round(screenWidth * 0.11),
      height: Math.round(screenWidth * 0.11),
      borderRadius: Math.round(screenWidth * 0.055),
      backgroundColor: 'rgba(45, 45, 68, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#5A5A7A',
      zIndex: 10,
    },
    levelBadge: {
      position: 'absolute',
      top: screenHeight * 0.028,
      alignSelf: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.95)',
      paddingHorizontal: screenWidth * 0.05,
      paddingVertical: screenHeight * 0.01,
      borderRadius: Math.round(screenWidth * 0.05),
      borderWidth: 2,
      borderColor: '#5A5A7A',
    },
    levelBadgeText: {
      fontSize: Math.round(screenWidth * 0.035),
      fontFamily: FONTS.bodyBold,
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
      width: Math.round(screenWidth * 0.5),
      height: Math.round(screenWidth * 0.5),
    },
    dialogueContainer: {
      paddingHorizontal: screenWidth * 0.04,
      alignItems: 'center',
      marginBottom: screenHeight * 0.22,
    },
    dialogueBox: {
      width: '100%',
      backgroundColor: '#2D2D44',
      borderWidth: 4,
      borderTopColor: '#5A5A7A',
      borderLeftColor: '#5A5A7A',
      borderBottomColor: '#1A1A2E',
      borderRightColor: '#1A1A2E',
      paddingHorizontal: screenWidth * 0.05,
      paddingTop: screenHeight * 0.025,
      paddingBottom: screenHeight * 0.015,
      minHeight: screenHeight * 0.16,
    },
    dialogueText: {
      fontSize: Math.round(screenWidth * 0.043),
      color: '#F5DEB3',
      lineHeight: Math.round(screenWidth * 0.065),
      fontFamily: FONTS.bodyMedium,
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      minHeight: screenHeight * 0.075,
    },
    cursor: {
      color: '#F5DEB3',
      fontSize: Math.round(screenWidth * 0.043),
    },
    dialogueFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: screenHeight * 0.015,
    },
    navButton: {
      width: Math.round(screenWidth * 0.09),
      height: Math.round(screenWidth * 0.09),
      borderRadius: Math.round(screenWidth * 0.045),
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.round(screenWidth * 0.015),
    },
    dot: {
      width: Math.round(screenWidth * 0.02),
      height: Math.round(screenWidth * 0.02),
      borderRadius: Math.round(screenWidth * 0.01),
      backgroundColor: '#555',
    },
    dotActive: {
      backgroundColor: '#F5DEB3',
      width: Math.round(screenWidth * 0.025),
      height: Math.round(screenWidth * 0.025),
      borderRadius: Math.round(screenWidth * 0.0125),
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
      fontSize: Math.round(screenWidth * 0.03),
      color: '#F5DEB3',
      fontFamily: FONTS.bodySemiBold,
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5DEB3',
      paddingVertical: screenHeight * 0.017,
      paddingHorizontal: screenWidth * 0.08,
      borderRadius: 8,
      marginTop: screenHeight * 0.02,
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
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.bodyBold,
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
      paddingBottom: screenHeight * 0.05,
    },
    celebrationBadge: {
      position: 'absolute',
      top: screenHeight * 0.035,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(45, 45, 68, 0.95)',
      paddingHorizontal: screenWidth * 0.06,
      paddingVertical: screenHeight * 0.012,
      borderRadius: Math.round(screenWidth * 0.06),
      borderWidth: 2,
      borderColor: '#FFD700',
      gap: Math.round(screenWidth * 0.025),
    },
    celebrationEmoji: {
      fontSize: Math.round(screenWidth * 0.055),
    },
    celebrationText: {
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodyBold,
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
      width: Math.round(screenWidth * 0.55),
      height: Math.round(screenWidth * 0.55),
    },
    dialogueContainer: {
      paddingHorizontal: screenWidth * 0.04,
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
      paddingHorizontal: screenWidth * 0.05,
      paddingTop: screenHeight * 0.025,
      paddingBottom: screenHeight * 0.015,
      minHeight: screenHeight * 0.16,
    },
    dialogueText: {
      fontSize: Math.round(screenWidth * 0.043),
      color: '#FFD700',
      lineHeight: Math.round(screenWidth * 0.065),
      fontFamily: FONTS.bodyMedium,
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      minHeight: screenHeight * 0.075,
    },
    cursor: {
      color: '#FFD700',
      fontSize: Math.round(screenWidth * 0.043),
    },
    dialogueFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: screenHeight * 0.015,
    },
    navButton: {
      width: Math.round(screenWidth * 0.09),
      height: Math.round(screenWidth * 0.09),
      borderRadius: Math.round(screenWidth * 0.045),
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.round(screenWidth * 0.015),
    },
    dot: {
      width: Math.round(screenWidth * 0.02),
      height: Math.round(screenWidth * 0.02),
      borderRadius: Math.round(screenWidth * 0.01),
      backgroundColor: '#555',
    },
    dotActive: {
      backgroundColor: '#FFD700',
      width: Math.round(screenWidth * 0.025),
      height: Math.round(screenWidth * 0.025),
      borderRadius: Math.round(screenWidth * 0.0125),
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
      fontSize: Math.round(screenWidth * 0.03),
      color: '#FFD700',
      fontFamily: FONTS.bodySemiBold,
    },
    finishButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFD700',
      paddingVertical: screenHeight * 0.017,
      paddingHorizontal: screenWidth * 0.08,
      borderRadius: 8,
      marginTop: screenHeight * 0.02,
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
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.bodyBold,
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
                navigation.navigate('CustomModeDashboard');
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
      paddingHorizontal: screenWidth * 0.05,
      gap: Math.round(screenHeight * 0.015),
      width: '85%',
      maxWidth: screenWidth * 0.82,
    },
    menuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: screenHeight * 0.017,
      paddingHorizontal: screenWidth * 0.05,
      gap: Math.round(screenWidth * 0.03),
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
      width: Math.round(screenWidth * 0.08),
      height: Math.round(screenWidth * 0.08),
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuButtonText: {
      flex: 1,
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.bodyBold,
      color: '#F5DEB3',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 0,
      letterSpacing: 1,
    },
    menuButtonSubtext: {
      fontSize: Math.round(screenWidth * 0.025),
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
      padding: Math.round(screenWidth * 0.04),
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: Math.round(screenWidth * 0.045),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      marginBottom: 8,
    },
    sectionText: {
      fontSize: Math.round(screenWidth * 0.035),
      lineHeight: Math.round(screenWidth * 0.05),
    },
  });

  // Koin Tutorial Styles - In-Game Interactive Tutorial
  const tutorialStyles = StyleSheet.create({
    // ===== Tutorial header (replaces normal header in tutorial mode) =====
    // Unified, semi-transparent container with rounded bottom corners.
    // Sits inside SafeAreaView (edges top), so the notch is already respected.
    tutorialHeader: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: screenWidth * 0.04,
      paddingTop: screenHeight * 0.012,
      paddingBottom: screenHeight * 0.014,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 152, 0, 0.35)',
    },
    // Top row: text left, icons right.
    tutorialRow1: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    koinMini: {
      width: Math.round(screenWidth * 0.095),
      height: Math.round(screenWidth * 0.095),
    },
    tutorialTextArea: {
      flex: 1,
    },
    tutorialTitle: {
      fontSize: Math.round(screenWidth * 0.036),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.2,
      color: '#FF9800',
    },
    tutorialMessage: {
      fontSize: Math.round(screenWidth * 0.028),
      color: '#CCC',
      lineHeight: Math.round(screenWidth * 0.035),
      marginTop: 2,
    },
    tutorialRightIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tutorialIconBadge: {
      width: Math.round(screenWidth * 0.085),
      height: Math.round(screenWidth * 0.085),
      borderRadius: Math.round(screenWidth * 0.085) / 2,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Middle row: centered status badge with breathing room.
    tutorialBadgeRow: {
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 8,
    },
    tutorialBadge: {
      backgroundColor: 'rgba(255, 152, 0, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255, 152, 0, 0.5)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tutorialBadgeText: {
      fontSize: Math.round(screenWidth * 0.027),
      fontFamily: FONTS.bodySemiBold,
      color: '#FFB74D',
    },
    // Bottom row: centered instruction text that wraps cleanly.
    tutorialRow2: {
      alignItems: 'center',
    },
    tutorialHint: {
      fontSize: Math.round(screenWidth * 0.03),
      lineHeight: Math.round(screenWidth * 0.042),
      color: '#FFD54F',
      fontStyle: 'italic',
      textAlign: 'center',
    },
    tutorialDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    dotActive: {
      backgroundColor: '#FF9800',
      width: 12,
    },
    dotDone: {
      backgroundColor: '#4CAF50',
    },
    tutorialNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    btnBack: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    btnNext: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF9800',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 3,
    },
    btnNextText: {
      fontSize: Math.round(screenWidth * 0.028),
      fontFamily: FONTS.bodyBold,
      color: '#FFF',
    },
    // Legacy styles (kept for reference)
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: screenWidth * 0.05,
    },
    koinContainer: {
      marginBottom: -screenHeight * 0.025,
      zIndex: 10,
    },
    koinImage: {
      width: Math.round(screenWidth * 0.45),
      height: Math.round(screenWidth * 0.45),
    },
    speechBubble: {
      backgroundColor: '#FFFDE7',
      borderRadius: Math.round(screenWidth * 0.06),
      padding: Math.round(screenWidth * 0.06),
      paddingTop: Math.round(screenWidth * 0.08),
      width: '100%',
      maxWidth: screenWidth * 0.85,
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
      fontSize: Math.round(screenWidth * 0.05),
      fontFamily: FONTS.headingSemiBold,
      letterSpacing: -0.3,
      color: '#2C3E50',
      textAlign: 'center',
      marginBottom: screenHeight * 0.015,
    },
    speechMessage: {
      fontSize: Math.round(screenWidth * 0.038),
      color: '#5D6D7E',
      textAlign: 'center',
      lineHeight: Math.round(screenWidth * 0.055),
      marginBottom: screenHeight * 0.025,
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
      paddingVertical: screenHeight * 0.017,
      paddingHorizontal: screenWidth * 0.05,
      borderRadius: 12,
      backgroundColor: '#F5F5F5',
      gap: 6,
    },
    backButtonText: {
      fontSize: Math.round(screenWidth * 0.038),
      fontFamily: FONTS.bodySemiBold,
      color: '#666',
    },
    nextButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: screenHeight * 0.017,
      paddingHorizontal: screenWidth * 0.06,
      borderRadius: 12,
      backgroundColor: '#FF9800',
      gap: 8,
    },
    nextButtonText: {
      fontSize: Math.round(screenWidth * 0.04),
      fontFamily: FONTS.bodyBold,
      color: '#FFF',
    },
    skipButton: {
      marginTop: screenHeight * 0.02,
      paddingVertical: screenHeight * 0.01,
    },
    skipButtonText: {
      fontSize: Math.round(screenWidth * 0.033),
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



  // Show main menu if active
  if (showMainMenu) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderMainMenu()}
      </SafeAreaView>
    );
  }

  const activeStoryDayForUi = gameMode === 'story' ? getActiveStoryDay() : 1;
  const activeStoryLevelConfigForUi = gameMode === 'story' ? STORY_DAILY_TASKS[storyLevel] : null;
  const activeStoryDayConfigForUi = gameMode === 'story'
    ? getStoryDayTasks(storyLevel, activeStoryDayForUi)
    : null;
  const activeStoryDisplayDayForUi = gameMode === 'story'
    ? getStoryDayDisplayNumber(storyLevel, activeStoryDayForUi)
    : 1;
  const activeStoryDisplayTotalDaysForUi = gameMode === 'story'
    ? getStoryLevelDisplayTotalDays(storyLevel)
    : 0;
  const activeStoryDayTotalCount = activeStoryDayConfigForUi?.tasks?.length || 0;
  const activeStoryDayCompletedCount = activeStoryDayConfigForUi
    ? activeStoryDayConfigForUi.tasks.filter((task) => !!dailyTaskCompletion[task.conditionKey]).length
    : 0;
  const isDailyTaskDone = activeStoryDayTotalCount > 0 && activeStoryDayCompletedCount === activeStoryDayTotalCount;
  const isDailyTaskPartial = activeStoryDayCompletedCount > 0 && activeStoryDayCompletedCount < activeStoryDayTotalCount;
  const dailyTaskButtonColor = isDailyTaskDone
    ? '#2E7D32'
    : isDailyTaskPartial
      ? '#FBC02D'
      : '#616161';
  const dailyTaskButtonTextColor = isDailyTaskPartial ? '#1A1A2E' : '#FFFFFF';
  const storyUserType = profileUserType;
  const activeStoryDayDialogue = activeStoryDayConfigForUi?.koinDialogue?.[storyUserType] || '';
  const visibleTravelDestinations = filterStoryModeDestinations(travelDestinations);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — tutorial mode shows simplified bar (Koin dialogue handled by KoinTutorialOverlay) */}
      {tutorialActive && gameMode === 'tutorial' ? (
        <View style={tutorialStyles.tutorialHeader}>
          {/* Top row: title + location on the left, status icons pushed right */}
          <View style={tutorialStyles.tutorialRow1}>
            <View style={tutorialStyles.tutorialTextArea}>
              <Text style={tutorialStyles.tutorialTitle} numberOfLines={1}>
                🎓 Tutorial Mode
              </Text>
              <Text style={tutorialStyles.tutorialMessage} numberOfLines={1}>
                {currentMap.icon} {currentMap.name}
              </Text>
            </View>
            <View style={tutorialStyles.tutorialRightIcons}>
              <View style={tutorialStyles.tutorialIconBadge}>
                <Ionicons name="hourglass-outline" size={16} color="#FF9800" />
              </View>
              <TouchableOpacity
                style={tutorialStyles.tutorialIconBadge}
                onPress={() => {
                  setTutorialActive(false);
                  cancelTutorial();
                  setTutorialStep(0);
                  setGameMode(null);
                  setShowMainMenu(true);
                }}
              >
                <Ionicons name="home" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Middle row: centered status badge */}
          <View style={tutorialStyles.tutorialBadgeRow}>
            <View style={tutorialStyles.tutorialBadge}>
              <Text style={tutorialStyles.tutorialBadgeText}>
                Complete the action to continue
              </Text>
            </View>
          </View>

          {/* Bottom row: centered, readable instruction text that wraps cleanly */}
          <View style={tutorialStyles.tutorialRow2}>
            <Text style={tutorialStyles.tutorialHint} numberOfLines={3}>
              💡 {TUTORIAL_STEPS[tutorialStep]?.message || 'Follow Koin\'s instructions!'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeftControls}>
            <TouchableOpacity
              style={styles.backToMenuButton}
              onPress={() => {
                if (tutorialActive) {
                  setTutorialActive(false);
                  cancelTutorial();
                  setTutorialStep(0);
                }
                setGameMode(null);
                setShowMainMenu(true);
              }}
            >
              <Ionicons name="home" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.historyButton, showDayReportNotification && styles.historyButtonAlert]}
              onPress={() => {
                if (showDayReportNotification) {
                  handleEndDay();
                } else {
                  openDayReportHistory();
                }
              }}
            >
              <Ionicons name="calendar" size={18} color={showDayReportNotification ? '#1c1c1c' : '#FFF'} />
              {hasUnreadReport && !showDayReportNotification && (
                <View style={styles.historyBadge} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setIsExpenseListModalVisible(true)}
            >
              <Ionicons name="receipt-outline" size={18} color="#FFF" />
            </TouchableOpacity>
            {gameMode === 'story' && (
              isDailyTaskDone ? (
                <TouchableOpacity
                  style={[styles.dailyTasksButton, styles.dailyTasksButtonSleep]}
                  onPress={handleEndDay}
                >
                  <Ionicons name="moon" size={19} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.dailyTasksButton, { backgroundColor: dailyTaskButtonColor }]}
                  onPress={() => setShowDailyTasksModal(true)}
                >
                  <Ionicons name="list" size={19} color={dailyTaskButtonTextColor} />
                </TouchableOpacity>
              )
            )}
          </View>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{currentMap.icon} {currentMap.name}</Text>
            <Text style={styles.headerSubtitle}>
              {gameMode === 'story' ? `Story Mode - Level ${storyLevel}` : 'Tutorial'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.spendingLabel}>Today's Spending</Text>
            <Text style={styles.spendingAmount}>₱{todaySpending.toFixed(2)}</Text>
            {gameMode === 'story' && (
              <>
                <Text style={[styles.spendingLabel, styles.spendingLabelStacked]}>Weekly Budget</Text>
                <View style={styles.weeklyBudgetRow}>
                  <Text style={[styles.spendingAmount, {
                    color: getRemainingWeeklyBudget() < weeklyBudget * 0.2 ? '#FF4444' : '#4CAF50'
                  }]}>
                    ₱{getRemainingWeeklyBudget().toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Story Mode Progress - Level-specific UI */}
      {gameMode === 'story' && (
        <View style={styles.storyProgressContainer}>
          {/* Level 1: Budget Tracking - Compact Card Layout */}
          {STORY_LEVELS[storyLevel]?.type === 'budgeting' && (() => {
            const percentages = getBudgetCategoryPercentages();
            const needsLimit = 50;
            const wantsLimit = 30;
            const savingsMin = 20;
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
            const savingsGoalPercent = STORY_LEVELS[storyLevel].savingsGoal * 100;
            const currentSavings = getSavingsPercentage();
            const savingsOk = currentSavings >= savingsGoalPercent;

            return (
              <View style={styles.budgetCompactRow}>
                <Text style={styles.budgetCompactLabel}>💰 Save {savingsGoalPercent}%</Text>
                <View style={styles.savingsCompactProgress}>
                  <AnimatedBar
                    percent={(currentSavings / savingsGoalPercent) * 100}
                    color={savingsOk ? '#4CAF50' : '#FF9800'}
                    trackStyle={styles.savingsCompactBar}
                    fillStyle={styles.savingsCompactFill}
                  />
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

      {/* Tutorial overlay removed — tutorial now renders inside the header */}

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
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>Done</Text>
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
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontFamily: FONTS.bodySemiBold }}>
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
                        onPress={() => {
                          setNotebookCategory(cat.id);
                          setNotebookSubCategory(null);
                          setShowNotebookSubCategoryDropdown(false);
                        }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 6 }}>{cat.icon}</Text>
                        <Text style={{
                          fontSize: 13,
                          fontFamily: isSelected ? FONTS.bodyBold : FONTS.bodyRegular,
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

              {/* Sub-Category Dropdown or Description */}
              {(SUBCATEGORIES[notebookCategory] || []).length > 0 ? (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Sub-Category</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surface,
                      borderWidth: 2,
                      borderColor: showNotebookSubCategoryDropdown ? (EXPENSE_CATEGORIES.find(c => c.id === notebookCategory)?.color || '#4CAF50') : colors.border,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      marginTop: 4,
                    }}
                    onPress={() => setShowNotebookSubCategoryDropdown(!showNotebookSubCategoryDropdown)}
                  >
                    <Text style={{ fontSize: 14, color: notebookSubCategory ? colors.text : colors.textSecondary + '80' }}>
                      {notebookSubCategory || 'Select a sub-category'}
                    </Text>
                    <Ionicons name={showNotebookSubCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showNotebookSubCategoryDropdown && (
                    <View style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}>
                      {SUBCATEGORIES[notebookCategory].map((sub, idx) => (
                        <TouchableOpacity
                          key={sub}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: notebookSubCategory === sub ? (EXPENSE_CATEGORIES.find(c => c.id === notebookCategory)?.color || '#4CAF50') + '20' : 'transparent',
                            borderBottomWidth: idx < SUBCATEGORIES[notebookCategory].length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                          }}
                          onPress={() => {
                            setNotebookSubCategory(sub);
                            setShowNotebookSubCategoryDropdown(false);
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            color: notebookSubCategory === sub ? (EXPENSE_CATEGORIES.find(c => c.id === notebookCategory)?.color || '#4CAF50') : colors.text,
                            fontFamily: notebookSubCategory === sub ? FONTS.bodyBold : FONTS.bodyRegular,
                          }}>
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
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
              )}

              {/* Budget Info (if in Story Mode) */}
              {gameMode === 'story' && (
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
                    Remaining: <Text style={{ fontFamily: FONTS.numberBold, fontVariant: ['tabular-nums'], color: '#4CAF50' }}>
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
                        appMode: 'story',
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
                  <Text style={{ color: '#4CAF50', fontSize: 15, fontFamily: FONTS.bodySemiBold }}>
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
                    setNotebookSubCategory(null);
                    setShowNotebookSubCategoryDropdown(false);
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
                    const savedSubCategory = notebookSubCategory;
                    const currentDate = new Date();

                    // Optimistic UI — close modal immediately
                    setShowNotebookModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                    setNotebookCategory('Food & Dining');
                    setNotebookSubCategory(null);
                    setShowNotebookSubCategoryDropdown(false);

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

                    if (gameMode === 'story') {
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

                    // ── Optimistic: update daily task runtime & evaluate INSTANTLY (before DB save) ──
                    if (gameMode === 'story') {
                      const normalizedCategory = normalizeCategory(savedCategory);
                      updateDailyTaskRuntimeForActiveDay((dayState) => {
                        dayState.expenseCount = (dayState.expenseCount || 0) + 1;
                        dayState.expenseTotal = (dayState.expenseTotal || 0) + savedAmount;
                        dayState.categoryCounts[normalizedCategory] = (dayState.categoryCounts[normalizedCategory] || 0) + 1;
                        dayState.categoryTotals[normalizedCategory] = (dayState.categoryTotals[normalizedCategory] || 0) + savedAmount;
                        dayState.expenseEntries.push({
                          category: normalizedCategory,
                          amount: savedAmount,
                          note: savedNote || savedSubCategory || savedCategory,
                          source: 'notebook',
                          timestamp: new Date().toISOString(),
                        });
                        if ((dayState.travelCount || 0) > 0 && CATEGORY_BUDGET_MAP[normalizedCategory] === 'needs') {
                          dayState.needsAfterTravelCount = (dayState.needsAfterTravelCount || 0) + 1;
                        }
                      });
                      // Evaluate tasks instantly against the freshest runtime (ref)
                      evaluateActiveStoryDayTasks();
                    }

                    // Save in background — non-blocking
                    try {
                      const expenseData = {
                        amount: savedAmount,
                        category: savedCategory,
                        sub_category: savedSubCategory || null,
                        note: savedNote || `${savedCategory} expense`,
                        date: currentDate.toISOString(),
                        appMode: 'story',
                      };

                      console.log('💾 Notebook: Saving expense via DataContext:', JSON.stringify(expenseData));
                      const success = await addExpense(expenseData);

                      if (!success) {
                        console.error('❌ Notebook: Failed to save expense');
                        Alert.alert('Sync Error', 'Your expense may not have been saved. Please check your expenses list.');
                      } else {
                        console.log('✅ Notebook: Expense saved successfully');

                        if (gameMode === 'story' && Math.abs(savedAmount - 1) < 0.0001) {
                          const testAchievement = AchievementService.getAchievementDefinitions().test_hello_world;
                          if (testAchievement) {
                            showAchievementPopup(testAchievement);
                          }
                        }

                        if (gameMode === 'story') {
                          fetchTodaySpending();
                        }

                        // Persist session spending to Supabase (fire-and-forget)
                        if (activeSessionId && gameMode === 'story') {
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
                          gameDatabaseService.updateStorySessionSpending(activeSessionId, sessionUpdate);
                        }

                        if (gameMode === 'story') {
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
                        }

                        // Achievements — fire-and-forget (no await blocking)
                        checkAchievements('expense_logged', {
                          expenseCount: expenseStats.total + 1,
                          category: savedCategory,
                        }).catch(() => { });
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
                        <Text style={{ color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 14 }}>{goal.name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          ₱{allocated.toFixed(0)} / ₱{goal.target} ({progress.toFixed(0)}%)
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <AnimatedBar
                      percent={progress}
                      color={progress >= 100 ? '#4CAF50' : '#3498DB'}
                      trackStyle={{ height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}
                      fillStyle={{ height: '100%', borderRadius: 4 }}
                    />

                    {/* Quick allocation buttons */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                      {allocated >= 50 && (
                        <TouchableOpacity
                          style={[styles.quickAllocateBtn, { backgroundColor: '#E67E22' }]}
                          onPress={() => deallocateFromGoal(goal.id, 50)}
                        >
                          <Text style={styles.quickAllocateBtnText}>−₱50</Text>
                        </TouchableOpacity>
                      )}
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
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Day Report History Modal */}
      <Modal
        visible={isHistoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end" style={styles.historyOverlay}>
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setIsHistoryModalVisible(false)}
            style={styles.historyBackdrop}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6" style={styles.historySheet}>
            <View className="flex-row justify-between items-center mb-4" style={styles.historyHeaderRow}>
              <Text className="text-[#ffb68b] text-lg font-semibold" style={styles.historyTitle}>
                Day Report History
              </Text>
              <TouchableOpacity
                onPress={() => setIsHistoryModalVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
                style={styles.historyCloseButton}
              >
                <Ionicons name="close" size={20} color="#F5DEB3" />
              </TouchableOpacity>
            </View>

            <SectionList
              sections={dayReportSections}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderHistoryItem}
              renderSectionHeader={renderHistorySectionHeader}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              // flexShrink keeps the list scrolling inside the capped sheet so
              // the fixed header above it stays pinned and on-screen.
              style={{ flexShrink: 1 }}
              ListEmptyComponent={(
                <View className="items-center py-8" style={styles.historyEmptyState}>
                  <Text className="text-[#a78b7c] text-sm" style={styles.historyEmptyText}>
                    {isHistoryLoading ? 'Loading reports...' : 'No completed days yet.'}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Current Day Expense List Modal */}
      <Modal
        visible={isExpenseListModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsExpenseListModalVisible(false)}
      >
        <View style={styles.historyOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setIsExpenseListModalVisible(false)}
            style={styles.historyBackdrop}
          />
          <View style={styles.historySheet}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historyTitle}>
                Today's Expenses
              </Text>
              <TouchableOpacity
                onPress={() => setIsExpenseListModalVisible(false)}
                style={styles.historyCloseButton}
              >
                <Ionicons name="close" size={20} color="#F5DEB3" />
              </TouchableOpacity>
            </View>

            {gameMode === 'story' && (
              <Text style={{ color: '#a78b7c', fontSize: 12, marginBottom: 12 }}>
                Level {storyLevel} — Day {getStoryDayDisplayNumber(storyLevel, activeStoryDay)}
              </Text>
            )}

            {currentDayExpenseEntries.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 420 }}>
                {currentDayExpenseEntries.map((entry, index) => {
                  const iconName = getCategoryIcon(entry.category);
                  const timeStr = entry.timestamp
                    ? new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '';
                  return (
                    <View key={index} style={styles.expenseListRow}>
                      <View style={styles.expenseListIconWrap}>
                        <Ionicons name={iconName} size={20} color="#ffb68b" />
                      </View>
                      <View style={styles.expenseListCenter}>
                        <Text style={styles.expenseListCategory} numberOfLines={1}>
                          {entry.category}
                        </Text>
                        <Text style={styles.expenseListNote} numberOfLines={1}>
                          {entry.note || entry.category}
                        </Text>
                        {timeStr ? (
                          <Text style={styles.expenseListTime}>{timeStr}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.expenseListAmount}>
                        ₱{(Number(entry.amount) || 0).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="receipt-outline" size={40} color="#a78b7c" style={{ marginBottom: 12 }} />
                <Text style={{ color: '#a78b7c', fontSize: 14, fontStyle: 'italic' }}>
                  No expenses logged yet today
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <EndOfDayReportModal
        isVisible={showHistoryReportModal}
        historicalData={historyReportData}
        viewOnly
        onClose={closeHistoryReport}
      />

      <EndOfDayReportModal
        isVisible={showDayReportModal}
        {...liveDayReportData}
        // Override with the header's exact source (weeklyBudget - weeklySpending)
        // so the modal's "Weekly Budget Remaining" never desyncs from the header.
        weeklyBudgetRemaining={getRemainingWeeklyBudget()}
        onClose={handleCloseDayReport}
        onStartNextDay={handleStartNextDay}
      />

      <DailyTaskPopup
        visible={showDailyTaskPopup}
        title={dailyTaskPopupPayload?.title || 'Daily Tasks'}
        subtitle={dailyTaskPopupPayload?.subtitle}
        dialogueText={dailyTaskPopupPayload?.dialogue}
        onDismiss={() => setShowDailyTaskPopup(false)}
      />

      {/* Daily Tasks Bottom Sheet */}
      <Modal
        visible={showDailyTasksModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDailyTasksModal(false)}
      >
        <View style={styles.dailyTaskSheetOverlay}>
          <TouchableOpacity
            style={styles.dailyTaskSheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowDailyTasksModal(false)}
          />
          <View style={styles.dailyTaskSheet}>
            <View style={styles.dailyTaskSheetHandle} />
            <View style={styles.dailyTaskSheetHeader}>
              <Text style={styles.dailyTaskSheetTitle}>Daily Tasks</Text>
              <TouchableOpacity onPress={() => setShowDailyTasksModal(false)}>
                <Ionicons name="close" size={24} color="#F5DEB3" />
              </TouchableOpacity>
            </View>

            {activeStoryDayConfigForUi && activeStoryLevelConfigForUi ? (
              <>
                <Text style={styles.dailyTaskSheetSubtitle}>
                  Day {activeStoryDisplayDayForUi}/{activeStoryDisplayTotalDaysForUi || activeStoryLevelConfigForUi.totalDays}
                </Text>
                <Text style={styles.dailyTaskDialogue}>💬 {activeStoryDayDialogue}</Text>

                {activeStoryDayConfigForUi.tasks.map((task, index) => {
                  const done = !!dailyTaskCompletion[task.conditionKey];
                  return (
                    <View key={task.id} style={styles.dailyTaskRow}>
                      <Ionicons
                        name={done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={done ? '#4CAF50' : '#B0B0B0'}
                      />
                      <Text style={[styles.dailyTaskText, done && styles.dailyTaskTextDone]}>
                        Task {index + 1}: {task.requiredAppAction}
                      </Text>
                    </View>
                  );
                })}

                <Text style={styles.dailyTaskSheetProgress}>
                  Progress: {activeStoryDayCompletedCount}/{activeStoryDayTotalCount}
                </Text>
              </>
            ) : (
              <Text style={styles.dailyTaskSheetEmpty}>No daily tasks available right now.</Text>
            )}
          </View>
        </View>
      </Modal>


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
              {levelPassed ? 'Level Complete!' : 'Week Ended'}
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
                    <Text style={{ color: parseFloat(levelResults.goalProgress) >= (levelResults.minProgress || 80) ? '#4CAF50' : '#FF4444', fontSize: 14, textAlign: 'center', fontFamily: FONTS.bodyBold }}>
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
                    <Text style={{ color: parseFloat(levelResults.savingsPercent) >= levelResults.savingsGoal ? '#4CAF50' : '#FF4444', fontSize: 16, textAlign: 'center', fontFamily: FONTS.bodyBold }}>
                      {levelResults.savingsPercent}% saved (Goal: {levelResults.savingsGoal}%)
                    </Text>
                  </View>
                )}

                {gameMode === 'story' && levelResults.dailyTasks && (
                  <View style={{ marginTop: 14, alignItems: 'center' }}>
                    <Text style={[styles.modalSubtitle, { textAlign: 'center' }]}>
                      Daily Tasks: {levelResults.dailyTasks.completed}/{levelResults.dailyTasks.total}
                    </Text>
                    <Text style={{
                      color: levelResults.dailyTasks.allComplete ? '#4CAF50' : '#FF4444',
                      fontSize: 14,
                      fontFamily: FONTS.bodySemiBold,
                      textAlign: 'center',
                    }}>
                      {levelResults.dailyTasks.allComplete ? '✓ All daily tasks complete' : '✗ Finish all daily tasks to pass'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ width: '100%', gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#4CAF50',
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  setShowLevelComplete(false);
                  openDayReportHistory();
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>
                  Day Report History
                </Text>
              </TouchableOpacity>

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
                    setActiveStoryDay(1); // Reset local day state
                    openLevelIntro(storyLevel + 1);
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>
                    Next Level →
                  </Text>
                </TouchableOpacity>
              )}

              {/* Story Complete button — Level 3 passed → triggers completion dialogue */}
              {gameMode === 'story' && levelPassed && storyLevel === 3 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#ffd700',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    setShowLevelComplete(false);
                    setActiveStoryDay(1); // Reset local day state
                    setCompletionPage(0);
                    setCompletionDisplayedText('');
                    setCompletionTypingDone(false);
                    setShowCompletionDialogue(true);
                  }}
                >
                  <Text style={{ color: '#f8f8fa', fontSize: 16, fontFamily: FONTS.bodyBold }}>
                    Continue
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
                  setActiveStoryDay(1); // Reset local day state
                  startStoryLevel(storyLevel);
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>
                  {levelPassed ? 'Replay Level' : 'Try Again'}
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
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bodyBold }}>
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
            <Text style={{ fontSize: 20, fontFamily: FONTS.headingSemiBold, letterSpacing: -0.3, color: '#FFF', marginBottom: 8, textAlign: 'center' }}>
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
                <Text style={{ color: '#FFF', fontSize: 15, fontFamily: FONTS.bodySemiBold }}>Cancel</Text>
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
                <Text style={{ color: '#FFF', fontSize: 15, fontFamily: FONTS.bodyBold }}>Give Up</Text>
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
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontFamily: FONTS.bodySemiBold }}>
                  {TUTORIAL_STEPS[tutorialStep]?.id === 'exit_door'
                    ? '🎓 Choose School to continue the tutorial!'
                    : TUTORIAL_STEPS[tutorialStep]?.id === 'go_to_mall'
                      ? '🎓 Choose the Mall to continue!'
                      : '🎓 Pick a destination!'}
                </Text>
              </View>
            )}

            {visibleTravelDestinations.map((destId) => {
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
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontFamily: FONTS.bodySemiBold }}>
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
                <Text style={{ fontSize: 13, color: '#E65100', textAlign: 'center', fontFamily: FONTS.bodySemiBold }}>
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

              {/* Sub-Category Dropdown or Description */}
              {(SUBCATEGORIES[expenseCategory] || []).length > 0 ? (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Sub-Category</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surface,
                      borderWidth: 2,
                      borderColor: showSubCategoryDropdown ? (EXPENSE_CATEGORIES.find(c => c.id === expenseCategory)?.color || '#4CAF50') : colors.border,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      marginTop: 4,
                    }}
                    onPress={() => setShowSubCategoryDropdown(!showSubCategoryDropdown)}
                  >
                    <Text style={{ fontSize: 14, color: expenseSubCategory ? colors.text : colors.textSecondary + '80' }}>
                      {expenseSubCategory || 'Select a sub-category'}
                    </Text>
                    <Ionicons name={showSubCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showSubCategoryDropdown && (
                    <View style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}>
                      {SUBCATEGORIES[expenseCategory].map((sub, idx) => (
                        <TouchableOpacity
                          key={sub}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: expenseSubCategory === sub ? (EXPENSE_CATEGORIES.find(c => c.id === expenseCategory)?.color || '#4CAF50') + '20' : 'transparent',
                            borderBottomWidth: idx < SUBCATEGORIES[expenseCategory].length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                          }}
                          onPress={() => {
                            setExpenseSubCategory(sub);
                            setShowSubCategoryDropdown(false);
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            color: expenseSubCategory === sub ? (EXPENSE_CATEGORIES.find(c => c.id === expenseCategory)?.color || '#4CAF50') : colors.text,
                            fontFamily: expenseSubCategory === sub ? FONTS.bodyBold : FONTS.bodyRegular,
                          }}>
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
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
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowExpenseModal(false);
                    setExpenseAmount('');
                    setExpenseNote('');
                    setExpenseSubCategory(null);
                    setShowSubCategoryDropdown(false);
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
            <View style={{ zIndex: 1, alignItems: 'center', width: '100%' }}>
              <Text style={styles.achievementUnlockedText}>🏆 ACHIEVEMENT UNLOCKED!</Text>
              {newAchievement && (
                <>
                  <View style={styles.iconContainer}>
                    <View style={styles.achievementGlow} />
                    <Text style={styles.achievementIcon}>{newAchievement.icon}</Text>
                  </View>
                  <Text style={styles.achievementTitle}>{newAchievement.title || newAchievement.name}</Text>
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
        </View>
      </Modal>
    </SafeAreaView>
  );
}
