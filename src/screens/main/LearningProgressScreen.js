import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  Dimensions,
  FlatList,
  ProgressBarAndroid
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';

const { width } = Dimensions.get('window');

const LearningProgressScreen = () => {
  const { theme } = useTheme();
  const [modules, setModules] = useState([]);
  const [userProgress, setUserProgress] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLearningData();
  }, []);

  const loadLearningData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Handle missing tables gracefully - these features may not be implemented yet
      const [modulesData, progressData, quizzesData] = await Promise.allSettled([
        supabase.from('learning_modules').select('*').order('order_index'),
        supabase.from('learning_progress').select('*').eq('user_id', user.id),
        supabase.from('learning_quizzes').select('*')
      ]);

      // Only set data if the request was successful (not 404)
      if (modulesData.status === 'fulfilled' && modulesData.value?.data) {
        setModules(modulesData.value.data);
      } else {
        console.log('[LEARNING] Learning modules table not yet implemented');
        setModules([]);
      }

      if (progressData.status === 'fulfilled' && progressData.value?.data) {
        setUserProgress(progressData.value.data);
      } else {
        console.log('[LEARNING] Learning progress table not yet implemented');
        setUserProgress([]);
      }

      if (quizzesData.status === 'fulfilled' && quizzesData.value?.data) {
        setQuizzes(quizzesData.value.data);
      } else {
        console.log('[LEARNING] Learning quizzes table not yet implemented');
        setQuizzes([]);
      }
    } catch (error) {
      console.error('Error loading learning data:', error);
      // Don't show error alert for missing features
      console.log('[LEARNING] Learning features not yet available');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLearningData();
    setRefreshing(false);
  };

  const getModuleProgress = (moduleId) => {
    const progress = (userProgress || []).find(p => p.module_id === moduleId);
    return progress || { completion_percentage: 0, status: 'not_started' };
  };

  const startModule = async (module) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if progress exists
      const existingProgress = userProgress.find(p => p.module_id === module.id);
      
      if (!existingProgress) {
        // Try to create new progress entry - handle missing table gracefully
        try {
          const { error } = await supabase
            .from('learning_progress')
            .insert({
              user_id: user.id,
              module_id: module.id,
              status: 'in_progress',
              completion_percentage: 0,
              started_at: new Date().toISOString()
            });

          if (error && error.code !== 'PGRST116') { // Not a missing table error
            throw error;
          }
          await loadLearningData();
        } catch (progressError) {
          console.log('[LEARNING] Progress tracking not yet available');
        }
      }

      setSelectedModule(module);
      setShowModuleModal(true);
    } catch (error) {
      console.error('Error starting module:', error);
      Alert.alert('Note', 'Learning progress tracking is not yet available, but you can still view the module content.');
      setSelectedModule(module);
      setShowModuleModal(true);
    }
  };

  const completeModule = async (moduleId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Try to update progress - handle missing table gracefully
      try {
        const { error } = await supabase
          .from('learning_progress')
          .update({
            status: 'completed',
            completion_percentage: 100,
            completed_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('module_id', moduleId);

        if (error && error.code !== 'PGRST116') { // Not a missing table error
          throw error;
        }
      } catch (progressError) {
        console.log('[LEARNING] Progress tracking not yet available');
      }

      // Check if there are quizzes for this module
      const moduleQuizzes = quizzes.filter(q => q.module_id === moduleId);
      if (moduleQuizzes.length > 0) {
        Alert.alert(
          'Module Completed!',
          'Great job! Would you like to take the quiz to test your knowledge?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Take Quiz', onPress: () => startQuiz(moduleQuizzes[0]) }
          ]
        );
      } else {
        Alert.alert('Module Completed!', 'Congratulations on completing this module!');
      }

      await loadLearningData();
      setShowModuleModal(false);
    } catch (error) {
      console.error('Error completing module:', error);
      Alert.alert('Module Completed!', 'Congratulations on completing this module! (Progress tracking not yet available)');
      setShowModuleModal(false);
    }
  };

  const startQuiz = async (quiz) => {
    try {
      // Try to get quiz questions - handle missing table gracefully
      const { data: questions, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('order_index');

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist
        Alert.alert('Quiz Not Available', 'Quiz functionality is not yet implemented.');
        return;
      }

      if (error) throw error;

      setCurrentQuiz(quiz);
      setQuizQuestions(questions || []);
      setCurrentQuestionIndex(0);
      setQuizAnswers([]);
      setSelectedAnswer(null);
      setShowQuizModal(true);
    } catch (error) {
      console.error('Error loading quiz:', error);
      Alert.alert('Quiz Not Available', 'Quiz functionality is not yet implemented.');
    }
  };

  const answerQuestion = () => {
    if (selectedAnswer === null) {
      Alert.alert('Please select an answer');
      return;
    }

    const currentQuestion = quizQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;
    
    const newAnswers = [...quizAnswers, {
      question_id: currentQuestion.id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect
    }];
    
    setQuizAnswers(newAnswers);

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    } else {
      // Quiz completed
      completeQuiz(newAnswers);
    }
  };

  const completeQuiz = async (answers) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const correctAnswers = answers.filter(a => a.is_correct).length;
      const score = (correctAnswers / answers.length) * 100;

      // Try to save quiz attempt - handle missing table gracefully
      try {
        const { error } = await supabase
          .from('quiz_attempts')
          .insert({
            user_id: user.id,
            quiz_id: currentQuiz.id,
            score: score,
            completed_at: new Date().toISOString()
          });

        if (error && error.code !== 'PGRST116') { // Not a missing table error
          throw error;
        }
      } catch (attemptError) {
        console.log('[LEARNING] Quiz attempt tracking not yet available');
      }

      setShowQuizModal(false);
      
      Alert.alert(
        'Quiz Completed!',
        `You scored ${score.toFixed(1)}%\n${correctAnswers} out of ${answers.length} correct`,
        [{ text: 'OK' }]
      );

      await loadLearningData();
    } catch (error) {
      console.error('Error completing quiz:', error);
      setShowQuizModal(false);
      Alert.alert('Quiz Completed!', 'Quiz results could not be saved, but great job completing it!');
    }
  };

  const renderLearningStats = () => {
    const completedModules = (userProgress || []).filter(p => p.status === 'completed').length;
    const inProgressModules = (userProgress || []).filter(p => p.status === 'in_progress').length;
    const totalModules = (modules || []).length;
    const averageProgress = userProgress && userProgress.length > 0 
      ? userProgress.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / userProgress.length 
      : 0;

    return (
      <View style={[styles.statsCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Learning Progress
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {completedModules}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              Completed
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF9800' }]}>
              {inProgressModules}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              In Progress
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {totalModules}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>
              Total
            </Text>
          </View>
        </View>

        <View style={styles.overallProgress}>
          <Text style={[styles.progressLabel, { color: theme.colors.text }]}>
            Overall Progress
          </Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  width: `${averageProgress || 0}%`,
                  backgroundColor: theme.colors.primary
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {(averageProgress || 0).toFixed(1)}% Complete
          </Text>
        </View>
      </View>
    );
  };

  const renderModuleCard = ({ item: module }) => {
    const progress = getModuleProgress(module.id);
    const moduleQuizzes = (quizzes || []).filter(q => q.module_id === module.id);

    return (
      <TouchableOpacity
        style={[styles.moduleCard, { backgroundColor: theme.colors.card }]}
        onPress={() => startModule(module)}
      >
        <View style={styles.moduleHeader}>
          <View style={[
            styles.moduleIcon,
            { 
              backgroundColor: progress.status === 'completed' 
                ? '#4CAF50' 
                : progress.status === 'in_progress' 
                ? '#FF9800' 
                : theme.colors.border
            }
          ]}>
            <Ionicons 
              name={
                progress.status === 'completed' 
                  ? 'checkmark' 
                  : progress.status === 'in_progress' 
                  ? 'time' 
                  : 'book'
              } 
              size={24} 
              color="white" 
            />
          </View>
          
          <View style={styles.moduleInfo}>
            <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>
              {module.title}
            </Text>
            <Text style={[styles.moduleDescription, { color: theme.colors.text + '80' }]}>
              {module.description}
            </Text>
          </View>
          
          <View style={styles.moduleMeta}>
            <Text style={[styles.moduleDifficulty, { color: theme.colors.primary }]}>
              {module.difficulty_level}
            </Text>
            <Text style={[styles.modulePoints, { color: theme.colors.text }]}>
              +{module.points} pts
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  width: `${progress.completion_percentage || 0}%`,
                  backgroundColor: theme.colors.primary
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {progress.completion_percentage || 0}% Complete
          </Text>
        </View>

        <View style={styles.moduleFooter}>
          <View style={styles.moduleFeatures}>
            <View style={styles.feature}>
              <Ionicons name="time" size={16} color={theme.colors.text + '60'} />
              <Text style={[styles.featureText, { color: theme.colors.text + '60' }]}>
                {module.estimated_duration} min
              </Text>
            </View>
            
            {moduleQuizzes.length > 0 && (
              <View style={styles.feature}>
                <Ionicons name="help-circle" size={16} color={theme.colors.text + '60'} />
                <Text style={[styles.featureText, { color: theme.colors.text + '60' }]}>
                  Quiz Available
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[
            styles.moduleStatus,
            { 
              color: progress.status === 'completed' 
                ? '#4CAF50' 
                : progress.status === 'in_progress' 
                ? '#FF9800' 
                : theme.colors.text + '60'
            }
          ]}>
            {progress.status === 'completed' 
              ? 'Completed' 
              : progress.status === 'in_progress' 
              ? 'In Progress' 
              : 'Not Started'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModuleModal = () => {
    if (!selectedModule) return null;
    
    const progress = getModuleProgress(selectedModule.id);
    
    return (
      <Modal
        visible={showModuleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModuleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedModule.title}
              </Text>
              
              <Text style={[styles.modalDescription, { color: theme.colors.text + '80' }]}>
                {selectedModule.description}
              </Text>
              
              <View style={styles.modalMeta}>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: theme.colors.text }]}>
                    Difficulty
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.colors.primary }]}>
                    {selectedModule.difficulty_level}
                  </Text>
                </View>
                
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: theme.colors.text }]}>
                    Duration
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                    {selectedModule.estimated_duration} min
                  </Text>
                </View>
                
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: theme.colors.text }]}>
                    Points
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                    +{selectedModule.points}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.contentTitle, { color: theme.colors.text }]}>
                Module Content
              </Text>
              <Text style={[styles.moduleContent, { color: theme.colors.text + '80' }]}>
                {selectedModule.content}
              </Text>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              {progress.status !== 'completed' && (
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => completeModule(selectedModule.id)}
                >
                  <Text style={styles.modalButtonText}>
                    {progress.status === 'in_progress' ? 'Complete Module' : 'Start Module'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowModuleModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderQuizModal = () => {
    if (!currentQuiz || quizQuestions.length === 0) return null;
    
    const currentQuestion = quizQuestions[currentQuestionIndex];
    const options = [
      currentQuestion.option_a,
      currentQuestion.option_b,
      currentQuestion.option_c,
      currentQuestion.option_d
    ].filter(option => option); // Filter out null/empty options
    
    return (
      <Modal
        visible={showQuizModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuizModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.quizModalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.quizHeader}>
              <Text style={[styles.quizTitle, { color: theme.colors.text }]}>
                {currentQuiz.title}
              </Text>
              <Text style={[styles.questionCounter, { color: theme.colors.text + '80' }]}>
                Question {currentQuestionIndex + 1} of {quizQuestions.length}
              </Text>
            </View>
            
            <Text style={[styles.questionText, { color: theme.colors.text }]}>
              {currentQuestion.question_text}
            </Text>
            
            <View style={styles.optionsContainer}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    { 
                      backgroundColor: selectedAnswer === index 
                        ? theme.colors.primary 
                        : theme.colors.background,
                      borderColor: theme.colors.border
                    }
                  ]}
                  onPress={() => setSelectedAnswer(index)}
                >
                  <Text style={[
                    styles.optionText,
                    { 
                      color: selectedAnswer === index 
                        ? 'white' 
                        : theme.colors.text
                    }
                  ]}>
                    {String.fromCharCode(65 + index)}. {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.quizButtons}>
              <TouchableOpacity
                style={[styles.quizButton, { backgroundColor: theme.colors.primary }]}
                onPress={answerQuestion}
              >
                <Text style={styles.quizButtonText}>
                  {currentQuestionIndex < quizQuestions.length - 1 ? 'Next' : 'Finish Quiz'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quizButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowQuizModal(false)}
              >
                <Text style={[styles.quizButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading learning modules...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Learning Center</Text>
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: theme.colors.primary }]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderLearningStats()}

        {modules && modules.length > 0 ? (
          <FlatList
            data={modules}
            renderItem={renderModuleCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          />
        ) : (
          <View style={[styles.noModulesCard, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="school" size={48} color={theme.colors.primary} />
            <Text style={[styles.noModulesTitle, { color: theme.colors.text }]}>
              Learning Center Coming Soon
            </Text>
            <Text style={[styles.noModulesSubtitle, { color: theme.colors.text + '80' }]}>
              Learning modules and quizzes will be available in a future update
            </Text>
          </View>
        )}
      </ScrollView>

      {renderModuleModal()}
      {renderQuizModal()}
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  overallProgress: {
    marginTop: 16,
  },
  progressLabel: {
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
  moduleCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  moduleMeta: {
    alignItems: 'flex-end',
  },
  moduleDifficulty: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modulePoints: {
    fontSize: 10,
  },
  progressSection: {
    marginBottom: 12,
  },
  moduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleFeatures: {
    flexDirection: 'row',
    gap: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 10,
  },
  moduleStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  noModulesCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  noModulesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noModulesSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  quizModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  moduleContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
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
  quizHeader: {
    marginBottom: 20,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  questionCounter: {
    fontSize: 12,
    marginTop: 4,
  },
  questionText: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 18,
  },
  quizButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quizButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quizButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LearningProgressScreen;
