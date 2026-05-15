import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { getChatCompletion } from '../config/nvidia';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const EndOfDayReportModal = ({
  isVisible,
  weeklyBudgetRemaining,
  spentToday,
  dailyTasks,
  xpEarned,
  currentXP,
  xpForNextLevel,
  unlockedAchievement,
  koinInsight,
  expensesToday = [],
  onStartNextDay,
  viewOnly = false,
  onClose,
  title = 'Day Complete!',
  actionLabel,
  historicalData,
}) => {
  const isHistoryMode = !!historicalData;
  const resolvedWeeklyBudgetRemaining = historicalData?.weeklyBudgetRemaining ?? weeklyBudgetRemaining;
  const resolvedSpentToday = historicalData?.spentToday ?? spentToday;
  const resolvedDailyTasks = Array.isArray(historicalData?.dailyTasks) ? historicalData.dailyTasks : dailyTasks;
  const resolvedXpEarned = historicalData?.xpEarned ?? xpEarned;
  const resolvedCurrentXP = historicalData?.currentXP ?? currentXP;
  const resolvedXpForNextLevel = historicalData?.xpForNextLevel ?? xpForNextLevel;
  const resolvedUnlockedAchievement = historicalData?.unlockedAchievement ?? unlockedAchievement;
  const resolvedKoinInsight = historicalData?.koinInsight ?? koinInsight;
  const resolvedExpensesToday = Array.isArray(historicalData?.expensesToday) ? historicalData.expensesToday : expensesToday;
  const resolvedTitle = historicalData?.title ?? title;
  const resolvedActionLabel = actionLabel ?? historicalData?.actionLabel;
  const safeTasks = Array.isArray(resolvedDailyTasks) ? resolvedDailyTasks : [];
  const isViewOnly = viewOnly || isHistoryMode;
  
  const [isKoinThinking, setIsKoinThinking] = useState(false);
  const [liveInsight, setLiveInsight] = useState('');

  useEffect(() => {
    if (!isVisible) {
      setLiveInsight('');
      setIsKoinThinking(false);
      return;
    }

    if (isHistoryMode) {
      setLiveInsight('');
      setIsKoinThinking(false);
      return;
    }

    const fetchInsight = async () => {
      setIsKoinThinking(true);
      try {
        const completedTasksCount = safeTasks.filter(t => t.completed).length;
        const messages = [
          {
            role: 'system',
            content: 'You are Koin, a financial AI assistant for the GaFi app. Keep responses to 1 short sentence. Be encouraging. Tone: friendly Filipino student.'
          },
          {
            role: 'user',
            content: `Day summary: Spent ₱${resolvedSpentToday}, Remaining weekly budget: ₱${resolvedWeeklyBudgetRemaining}. Tasks completed: ${completedTasksCount}/${safeTasks.length}. Give me a quick insight or tip.`
          }
        ];
        const response = await getChatCompletion(messages, { max_tokens: 150, temperature: 0.7 });
        setLiveInsight(response.replace(/^"|"$/g, '').trim());
      } catch (error) {
        setLiveInsight(resolvedKoinInsight || "I'm having trouble calculating your insight, but keep up the great work!");
      } finally {
        setIsKoinThinking(false);
      }
    };
    fetchInsight();
  }, [isVisible, isHistoryMode, resolvedSpentToday, resolvedWeeklyBudgetRemaining, resolvedKoinInsight, safeTasks.length]);

  const insightText = isHistoryMode
    ? (resolvedKoinInsight || 'Koin saved this insight for you.')
    : (isKoinThinking
      ? 'Koin is analyzing your day...'
      : (liveInsight || resolvedKoinInsight || 'Koin is calculating your daily insight...'));

  const primaryLabel = resolvedActionLabel || (isViewOnly ? 'Close' : 'Start Next Day');
  const handlePrimaryPress = isViewOnly ? onClose : onStartNextDay;

  const progressPercent = useMemo(() => {
    const current = Number(resolvedCurrentXP) || 0;
    const next = Number(resolvedXpForNextLevel) || 0;
    if (next <= 0) {
      const earned = Number(resolvedXpEarned) || 0;
      return clampPercent(earned);
    }
    return clampPercent((current / next) * 100);
  }, [resolvedCurrentXP, resolvedXpForNextLevel, resolvedXpEarned]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={isViewOnly ? (onClose || (() => { })) : () => { }}
    >
      <View style={styles.overlay}>
        <View style={styles.overlayInner}>
          <View style={styles.sheet}>
            {/* Drag Handle */}
            <View style={styles.handleWrapper}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header Icon & Title */}
              <View style={styles.headerSection}>
                <View style={styles.headerIcon}>
                  <Ionicons name="checkmark-circle" size={48} color="#ffb68b" />
                </View>
                <Text style={styles.headerTitle}>{resolvedTitle}</Text>
              </View>

              {/* Budget Card */}
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>
                    WEEKLY BUDGET{"\n"}REMAINING
                  </Text>
                  <Text style={styles.budgetValue}>
                    {formatCurrency(resolvedWeeklyBudgetRemaining)}
                  </Text>
                </View>
                <View style={[styles.cardRow, { marginTop: 12 }]}>
                  <Text style={styles.cardLabel}>
                    SPENT TODAY
                  </Text>
                  <Text style={styles.spentValue}>
                    {formatCurrency(resolvedSpentToday)}
                  </Text>
                </View>

                <View className="mt-5 pt-4 border-t border-white/10" style={styles.expenseSection}>
                  <Text style={[styles.cardLabel, styles.expenseHeader]} className="mb-3">EXPENSE BREAKDOWN</Text>
                  {resolvedExpensesToday?.length > 0 ? (
                    <View className="max-h-40" style={styles.expenseListContainer}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                        {resolvedExpensesToday.map((exp, index) => (
                          <View key={exp.id || index} className="flex-row justify-between items-center mb-3 pr-2" style={styles.expenseRow}>
                            <Text className="text-[#e5e2e1] text-sm flex-1 mr-4" style={styles.expenseName} numberOfLines={1}>
                              {exp.name || exp.category || 'Unnamed Expense'}
                            </Text>
                            <Text className="text-[#ffb68b] text-sm font-medium" style={styles.expenseAmount}>
                              {formatCurrency(exp.amount)}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text className="text-[#a78b7c] text-sm italic" style={styles.expenseEmpty}>
                      No expenses logged today
                    </Text>
                  )}
                </View>
              </View>

              {/* Daily Objectives Card */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>
                  DAILY OBJECTIVES
                </Text>
                <View style={{ marginTop: 16 }}>
                  {safeTasks.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No tasks found for today.
                    </Text>
                  ) : (
                    safeTasks.map((task, index) => {
                      const done = !!task.completed;
                      const isLast = index === safeTasks.length - 1;
                      return (
                        <View
                          key={task.id}
                          style={[styles.taskRow, !isLast && { marginBottom: 12 }]}
                        >
                          <Ionicons
                            name={done ? 'checkmark-circle' : 'close-circle'}
                            size={20}
                            color={done ? '#22c55e' : '#9ca3af'}
                          />
                          <Text
                            style={[
                              styles.taskText,
                              done ? styles.taskTextDone : styles.taskTextIncomplete,
                            ]}
                          >
                            {task.label}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              {/* XP Card */}
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>
                    DAILY XP
                  </Text>
                  <Text style={styles.xpValue}>
                    +{Number(resolvedXpEarned) || 0} XP
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>

                {resolvedUnlockedAchievement ? (
                  <View style={styles.achievementBadge}>
                    <Ionicons name="trophy" size={18} color="#ffb68b" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achievementLabel}>Achievement Unlocked:</Text>
                      <Text style={styles.achievementTitle}>
                        {resolvedUnlockedAchievement}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Koin Insight Card */}
              <View style={styles.insightCard}>
                <View style={styles.insightIcon}>
                  <Ionicons name="sparkles" size={20} color="#ffb68b" />
                </View>
                <Text style={styles.insightText}>
                  "{insightText}"
                </Text>
              </View>
            </ScrollView>

            {/* Bottom Action Button */}
            <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea}>
              {handlePrimaryPress && (
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    onPress={handlePrimaryPress}
                    style={styles.primaryButton}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={primaryLabel}
                  >
                    <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ─── Overlay & Layout ──────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayInner: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    maxHeight: '92%',
  },

  // ─── Drag Handle ───────────────────────────────────────────────────
  handleWrapper: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ─── ScrollView ────────────────────────────────────────────────────
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // ─── Header ────────────────────────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
  },
  headerIcon: {
    marginBottom: 12,
  },
  headerTitle: {
    color: '#ffb68b',
    fontSize: 24,
    fontWeight: '600',
  },

  // ─── Cards (shared) ────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    color: '#e0c0af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  expenseSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  expenseHeader: {
    marginBottom: 12,
  },
  expenseListContainer: {
    maxHeight: 160,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingRight: 8,
  },
  expenseName: {
    color: '#e5e2e1',
    fontSize: 14,
    flex: 1,
    marginRight: 16,
  },
  expenseAmount: {
    color: '#ffb68b',
    fontSize: 14,
    fontWeight: '500',
  },
  expenseEmpty: {
    color: '#a78b7c',
    fontSize: 14,
    fontStyle: 'italic',
  },

  // ─── Budget Card ───────────────────────────────────────────────────
  budgetValue: {
    color: '#06bb63',
    fontSize: 24,
    fontWeight: '700',
  },
  spentValue: {
    color: '#ffb68b',
    fontSize: 16,
  },

  // ─── Daily Objectives ──────────────────────────────────────────────
  emptyText: {
    color: '#a78b7c',
    fontSize: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskText: {
    fontSize: 16,
    flexShrink: 1,
  },
  taskTextDone: {
    color: '#e5e2e1',
  },
  taskTextIncomplete: {
    color: '#a78b7c',
    textDecorationLine: 'line-through',
  },

  // ─── XP Card ───────────────────────────────────────────────────────
  xpValue: {
    color: '#ffb68b',
    fontSize: 24,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 16,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff7a00',
    borderRadius: 999,
  },

  // ─── Achievement Badge ─────────────────────────────────────────────
  achievementBadge: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,122,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.3)',
    padding: 12,
    borderRadius: 12,
  },
  achievementLabel: {
    color: '#e5e2e1',
    fontSize: 14,
  },
  achievementTitle: {
    color: '#ffb68b',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Koin Insight Card ─────────────────────────────────────────────
  insightCard: {
    backgroundColor: '#1b1b1b',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#ff7a00',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,122,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    flex: 1,
    color: '#e0c0af',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // ─── Bottom Button ─────────────────────────────────────────────────
  bottomSafeArea: {
    backgroundColor: '#1c1c1c',
  },
  buttonWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: '#ff7a00',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
});

export default EndOfDayReportModal;
