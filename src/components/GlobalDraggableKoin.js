// Global Draggable Koin Chat Bubble
// Like Facebook Messenger's chat heads - persistent across all screens

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Text,
  Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ChatModal from './ChatModal';
import MascotImage from './MascotImage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const BUBBLE_SIZE = 80; // Increased from 60 to 80 for larger mascot
const SNAP_MARGIN = 20;
const HIDE_TIMEOUT = 10000; // Hide bubble after 10 seconds of inactivity
const EDGE_SNAP_THRESHOLD = 100;

const GlobalDraggableKoin = () => {
  const { colors } = useTheme();
  
  // Animation values
  const pan = useRef(new Animated.ValueXY({ x: screenWidth - BUBBLE_SIZE - 20, y: screenHeight / 2 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState('');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  
  // Auto-hide timer
  const hideTimerRef = useRef(null);
  
  // Create pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Allow dragging if the gesture moves more than 10 pixels
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        setIsDragging(true);
        setLastActivity(Date.now());
        
        // Add slight scale animation when drag starts (use JS driver to match pan)
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: false,
        }).start();
        
        // Set the offset to the current value
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        
        // Reset scale (use JS driver to match pan)
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
        }).start();
        
        // Flatten the offset
        pan.flattenOffset();
        
        // Get current position
        const currentX = pan.x._value;
        const currentY = pan.y._value;
        
        // Determine which edge to snap to
        const leftDistance = currentX;
        const rightDistance = screenWidth - currentX - BUBBLE_SIZE;
        const snapToLeft = leftDistance < rightDistance;
        
        // Calculate snap position
        let snapX = snapToLeft ? SNAP_MARGIN : screenWidth - BUBBLE_SIZE - SNAP_MARGIN;
        let snapY = Math.max(50, Math.min(currentY, screenHeight - BUBBLE_SIZE - 100));
        
        // Animate to snap position
        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
        
        // If dragged to edge, minimize after a delay
        if (Math.abs(gestureState.dx) > EDGE_SNAP_THRESHOLD) {
          setTimeout(() => {
            if (!isDragging) {
              minimizeBubble();
            }
          }, 2000);
        }
      },
    })
  ).current;
  
  // Pulse animation for notifications
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
          useNativeDriver: false,
        }),
      ]),
      { iterations: 3 }
    ).start();
  };
  
  // Minimize bubble to edge
  const minimizeBubble = () => {
    setIsMinimized(true);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };
  
  // Restore bubble from minimized state
  const restoreBubble = () => {
    setIsMinimized(false);
    setLastActivity(Date.now());
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };
  
  // Handle bubble tap
  const handleBubbleTap = () => {
    if (isMinimized) {
      restoreBubble();
      return;
    }
    
    setLastActivity(Date.now());
    
    // Quick scale animation for feedback
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start();
    
    // Open chat modal
    setShowChatModal(true);
  };
  
  // Show notification bubble
  const showNotificationBubble = (message, duration = 3000) => {
    setBubbleText(message);
    setShowBubble(true);
    startPulseAnimation();
    
    setTimeout(() => {
      setShowBubble(false);
    }, duration);
  };
  
  // Auto-hide logic
  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    
    hideTimerRef.current = setTimeout(() => {
      if (!isDragging && Date.now() - lastActivity > HIDE_TIMEOUT) {
        minimizeBubble();
      }
    }, HIDE_TIMEOUT);
    
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [lastActivity, isDragging]);
  
  // Don't render if not visible
  if (!isVisible) {
    return null;
  }
  
  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: Animated.multiply(scale, pulseAnim) },
            ],
            opacity,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Notification Bubble 
        {showBubble && bubbleText && (
          <View style={[styles.notificationBubble, { backgroundColor: colors.card }]}>
            <Text style={[styles.bubbleText, { color: colors.text }]} numberOfLines={2}>
              {bubbleText}
            </Text>
            <View style={[styles.bubbleArrow, { borderTopColor: colors.card }]} />
          </View>
        )}*/}
        
        {/* Main Draggable Mascot - Just the transparent image */}
        <TouchableOpacity
          style={styles.mascotTouchable}
          onPress={handleBubbleTap}
          activeOpacity={0.8}
        >
          {/* Koin Mascot - Piggy Bank Image */}
          <MascotImage size={80} />
          
          {/* Online Indicator */}
          <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
        </TouchableOpacity>
        
        {/* Drag Handle (when minimized) */}
        {isMinimized && (
          <View style={[styles.dragHandle, { backgroundColor: colors.text }]} />
        )}
      </Animated.View>
      
      {/* Chat Modal - Context-aware overlay */}
      <ChatModal 
        visible={showChatModal} 
        onClose={() => setShowChatModal(false)} 
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
  },
  mascotTouchable: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBubble: {
    position: 'absolute',
    right: BUBBLE_SIZE + 15,
    top: -10,
    maxWidth: 200,
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  bubbleArrow: {
    position: 'absolute',
    right: -8,
    top: '50%',
    marginTop: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  dragHandle: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.3,
  },
});

export default GlobalDraggableKoin;
