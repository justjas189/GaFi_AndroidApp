import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions
} from 'react-native';
import { MonTMascot } from './MascotSystem';
import { MASCOT_STATES } from '../constants/MascotStates';

const { width } = Dimensions.get('window');

// Test component to preview your piggy bank MonT in all emotional states
export const PiggyBankTest = ({ piggyBankImageUri }) => {
  const [currentState, setCurrentState] = useState(MASCOT_STATES.HAPPY);
  const [showCelebration, setShowCelebration] = useState(false);
  const [graphicsMode, setGraphicsMode] = useState('piggy');

  // Auto-cycle through states for demo
  const [autoCycle, setAutoCycle] = useState(false);
  
  useEffect(() => {
    if (autoCycle) {
      const states = Object.values(MASCOT_STATES);
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        setCurrentState(states[currentIndex]);
        currentIndex = (currentIndex + 1) % states.length;
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [autoCycle]);

  const testStates = [
    {
      state: MASCOT_STATES.HAPPY,
      name: 'Happy',
      description: 'Daily check-ins, positive updates',
      color: '#FFB6C1',
      emoji: '😊'
    },
    {
      state: MASCOT_STATES.EXCITED,
      name: 'Excited',
      description: 'Savings milestones, good progress',
      color: '#FFD700',
      emoji: '🤩'
    },
    {
      state: MASCOT_STATES.CELEBRATING,
      name: 'Celebrating',
      description: 'Goals achieved, major wins',
      color: '#FF69B4',
      emoji: '🥳'
    },
    {
      state: MASCOT_STATES.THINKING,
      name: 'Thinking',
      description: 'Budget analysis, planning',
      color: '#87CEEB',
      emoji: '🤔'
    },
    {
      state: MASCOT_STATES.FOCUSED,
      name: 'Focused',
      description: 'Deep analysis, AI processing',
      color: '#98FB98',
      emoji: '🧐'
    },
    {
      state: MASCOT_STATES.WORRIED,
      name: 'Worried',
      description: 'Budget concerns, overspending',
      color: '#FFA07A',
      emoji: '😰'
    },
    {
      state: MASCOT_STATES.BUDGET_ALERT,
      name: 'Budget Alert',
      description: 'Warning notifications',
      color: '#FFB347',
      emoji: '🚨'
    },
    {
      state: MASCOT_STATES.SLEEPING,
      name: 'Sleeping',
      description: 'Night mode, app idle',
      color: '#E6E6FA',
      emoji: '😴'
    },
    {
      state: MASCOT_STATES.GOAL_ACHIEVED,
      name: 'Goal Achieved',
      description: 'Ultimate celebration',
      color: '#FFD700',
      emoji: '🏆'
    }
  ];

  const graphicsModes = [
    { mode: 'piggy', name: 'Your Piggy Bank', description: 'Your custom image with emotional overlays' },
    { mode: 'piggy-emoji', name: 'Emoji Piggy', description: 'Emoji-based piggy bank version' },
    { mode: 'enhanced', name: 'Enhanced Vector', description: 'Professional vector graphics' },
    { mode: 'generated', name: 'Robot Avatar', description: 'AI-generated robot avatars' }
  ];

  const triggerCelebration = () => {
    setCurrentState(MASCOT_STATES.CELEBRATING);
    setShowCelebration(true);
    
    setTimeout(() => {
      setShowCelebration(false);
      setCurrentState(MASCOT_STATES.HAPPY);
    }, 4000);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🐷 MonT Piggy Bank Test 🐷</Text>
        <Text style={styles.subtitle}>Preview your custom piggy bank mascot</Text>
      </View>

      {/* Main Preview */}
      <View style={styles.previewContainer}>
        <MonTMascot
          graphicsMode={graphicsMode}
          piggyBankImageUri={piggyBankImageUri}
          currentState={currentState}
          size="xlarge"
          showCelebration={showCelebration}
          celebrationType="goal_achieved"
          celebrationMessage="Your piggy bank looks amazing! 🎉"
          onTap={() => {
            Alert.alert('MonT Says:', 'Hello! I love being a piggy bank! 🐷💰');
          }}
          onCelebrationComplete={() => {
            setShowCelebration(false);
          }}
        />
        
        <Text style={styles.currentState}>
          Current State: <Text style={styles.stateName}>{currentState}</Text>
        </Text>
      </View>

      {/* Graphics Mode Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Graphics Mode</Text>
        <View style={styles.modeGrid}>
          {graphicsModes.map((mode) => (
            <TouchableOpacity
              key={mode.mode}
              style={[
                styles.modeButton,
                graphicsMode === mode.mode && styles.selectedMode
              ]}
              onPress={() => setGraphicsMode(mode.mode)}
            >
              <Text style={[
                styles.modeButtonText,
                graphicsMode === mode.mode && styles.selectedModeText
              ]}>
                {mode.name}
              </Text>
              <Text style={styles.modeDescription}>{mode.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* State Testing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Emotional States</Text>
        
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => setAutoCycle(!autoCycle)}
          >
            <Text style={styles.controlButtonText}>
              {autoCycle ? 'Stop Auto-Cycle' : 'Auto-Cycle States'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#FF9800' }]}
            onPress={triggerCelebration}
          >
            <Text style={styles.controlButtonText}>Trigger Celebration</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stateGrid}>
          {testStates.map((stateInfo) => (
            <TouchableOpacity
              key={stateInfo.state}
              style={[
                styles.stateButton,
                { borderColor: stateInfo.color },
                currentState === stateInfo.state && { 
                  backgroundColor: stateInfo.color + '20',
                  borderWidth: 3
                }
              ]}
              onPress={() => setCurrentState(stateInfo.state)}
            >
              <Text style={styles.stateEmoji}>{stateInfo.emoji}</Text>
              <Text style={styles.stateName}>{stateInfo.name}</Text>
              <Text style={styles.stateDescription}>{stateInfo.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Implementation Code */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Implementation Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeTitle}>Current Configuration:</Text>
          <Text style={styles.code}>
{`<MonTMascot
  graphicsMode="${graphicsMode}"
  ${graphicsMode === 'piggy' ? `piggyBankImageUri="${piggyBankImageUri || 'your-image-path'}"` : ''}
  currentState={MASCOT_STATES.${currentState}}
  size="large"
  onTap={handleMascotTap}
/>`}
          </Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>To use your piggy bank image:</Text>
          <Text style={styles.instruction}>1. Save your image to assets/mont/mont-piggy-bank.png</Text>
          <Text style={styles.instruction}>2. Import it: import piggyImage from '../assets/mont/mont-piggy-bank.png'</Text>
          <Text style={styles.instruction}>3. Use: piggyBankImageUri={'{Image.resolveAssetSource(piggyImage).uri}'}</Text>
          <Text style={styles.instruction}>4. Set graphicsMode="piggy" for best results</Text>
        </View>
      </View>

      {/* Results Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>🎮 Perfect for Game-Quality Graphics!</Text>
        <Text style={styles.summaryText}>
          Your piggy bank image will transform MonT into a professional, engaging mascot with:
          • 9 different emotional states{'\n'}
          • Smooth animations and particle effects{'\n'}
          • Professional glow and shadow effects{'\n'}
          • Interactive celebrations and reactions{'\n'}
          • Perfect financial theme integration
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  previewContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 30,
    marginBottom: 10,
  },
  currentState: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  stateName: {
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeButton: {
    width: (width - 60) / 2,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  selectedMode: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  selectedModeText: {
    color: '#2196F3',
  },
  modeDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  controlButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stateButton: {
    width: (width - 80) / 3,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  stateEmoji: {
    fontSize: 20,
    marginBottom: 5,
  },
  stateDescription: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 3,
  },
  codeContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  codeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  instructions: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2e7d32',
  },
  instruction: {
    fontSize: 13,
    color: '#2e7d32',
    marginBottom: 5,
  },
  summary: {
    backgroundColor: '#fff3e0',
    padding: 20,
    marginBottom: 20,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#bf360c',
    lineHeight: 20,
  },
});

export default PiggyBankTest;
