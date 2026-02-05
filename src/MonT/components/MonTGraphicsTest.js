// MonT Graphics Test Screen - Test all graphics modes
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useTheme } from '../../../src/context/ThemeContext';
import { MonTMascot } from '../components/MascotSystem';
import { MASCOT_STATES } from '../constants/MascotStates';

const MonTGraphicsTest = () => {
  const { colors } = useTheme();
  const [currentState, setCurrentState] = useState(MASCOT_STATES.HAPPY);
  const [currentMode, setCurrentMode] = useState('enhanced');

  const graphicsModes = [
    { key: 'emoji', label: 'Emoji (Current)', description: 'Simple emoji characters' },
    { key: 'enhanced', label: 'Enhanced', description: 'Vector icons with glow effects' },
    { key: 'generated', label: 'Generated Robot', description: 'AI-generated robot avatars' },
    { key: 'game', label: 'Game Style', description: 'Game-like character design' },
    { key: 'web', label: 'Web Graphics', description: 'Free web-sourced graphics' }
  ];

  const mascotStates = [
    { key: MASCOT_STATES.IDLE, label: 'Idle' },
    { key: MASCOT_STATES.HAPPY, label: 'Happy' },
    { key: MASCOT_STATES.EXCITED, label: 'Excited' },
    { key: MASCOT_STATES.CELEBRATING, label: 'Celebrating' },
    { key: MASCOT_STATES.THINKING, label: 'Thinking' },
    { key: MASCOT_STATES.ENCOURAGING, label: 'Encouraging' },
    { key: MASCOT_STATES.WORRIED, label: 'Worried' },
    { key: MASCOT_STATES.SLEEPING, label: 'Sleeping' }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <Text style={[styles.title, { color: colors.text }]}>
          MonT Graphics Test Lab 🧪
        </Text>

        {/* Current MonT Display */}
        <View style={[styles.displaySection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Current Mode: {graphicsModes.find(m => m.key === currentMode)?.label}
          </Text>
          
          <View style={styles.mascotDisplay}>
            <MonTMascot
              graphicsMode={currentMode}
              currentState={currentState}
              size="large"
              showAccessories={currentState === MASCOT_STATES.CELEBRATING}
              showBubble={true}
              bubbleText={`I'm ${currentState.toLowerCase()}!`}
            />
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {graphicsModes.find(m => m.key === currentMode)?.description}
          </Text>
        </View>

        {/* Graphics Mode Selector */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Graphics Mode
          </Text>
          
          {graphicsModes.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              style={[
                styles.optionButton,
                {
                  backgroundColor: currentMode === mode.key ? colors.primary : colors.background,
                  borderColor: colors.border
                }
              ]}
              onPress={() => setCurrentMode(mode.key)}
            >
              <Text style={[
                styles.optionText,
                { color: currentMode === mode.key ? colors.onPrimary : colors.text }
              ]}>
                {mode.label}
              </Text>
              <Text style={[
                styles.optionDescription,
                { color: currentMode === mode.key ? colors.onPrimary : colors.textSecondary }
              ]}>
                {mode.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* State Selector */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            MonT's Mood
          </Text>
          
          <View style={styles.stateGrid}>
            {mascotStates.map((state) => (
              <TouchableOpacity
                key={state.key}
                style={[
                  styles.stateButton,
                  {
                    backgroundColor: currentState === state.key ? colors.primary : colors.background,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setCurrentState(state.key)}
              >
                <Text style={[
                  styles.stateText,
                  { color: currentState === state.key ? colors.onPrimary : colors.text }
                ]}>
                  {state.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Comparison Grid */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Comparison
          </Text>
          
          <View style={styles.comparisonGrid}>
            {graphicsModes.slice(0, 4).map((mode) => (
              <View key={mode.key} style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.text }]}>
                  {mode.label}
                </Text>
                <MonTMascot
                  graphicsMode={mode.key}
                  currentState={MASCOT_STATES.HAPPY}
                  size="medium"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Implementation Guide */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Implementation
          </Text>
          
          <View style={[styles.codeBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.codeText, { color: colors.textSecondary }]}>
{`<MonTMascot
  graphicsMode="${currentMode}"
  currentState="${currentState}"
  size="large"
  showAccessories={true}
/>`}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Choose your preferred graphics mode for MonT! 🎮
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  displaySection: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  mascotDisplay: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    fontSize: 14,
  },
  optionButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stateButton: {
    width: '48%',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
  },
  stateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  comparisonItem: {
    width: '45%',
    alignItems: 'center',
    marginBottom: 16,
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  codeBlock: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default MonTGraphicsTest;
