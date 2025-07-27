import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const AddNoteScreen = ({ navigation, route }) => {
  const { addNote, editNote } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingNote, setExistingNote] = useState(null);

  useEffect(() => {
    if (route.params?.note) {
      const note = route.params.note;
      setTitle(note.title);
      setContent(note.content);
      setExistingNote(note);
    }
  }, [route.params]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    const noteData = {
      id: existingNote ? existingNote.id : Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      created_at: existingNote ? existingNote.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingNote) {
      editNote(existingNote.id, noteData);
    } else {
      addNote(noteData);
    }
    
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Enhanced Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.colors.card,
        shadowColor: theme.colors.text,
      }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.colors.background }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {existingNote ? 'Edit Note' : 'Add Note'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text }]}>
            {existingNote ? 'Update your thoughts' : 'Capture your ideas'}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.form}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formContent}
      >
        {/* Title Input Section */}
        <View style={[styles.inputCard, { 
          backgroundColor: theme.colors.card,
          shadowColor: theme.colors.text,
        }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.label, { color: theme.colors.text }]}>Title</Text>
          </View>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter note title..."
            placeholderTextColor={theme.colors.text + '60'}
            maxLength={100}
          />
          <Text style={[styles.charCount, { color: theme.colors.text }]}>
            {title.length}/100
          </Text>
        </View>

        {/* Content Input Section */}
        <View style={[styles.inputCard, { 
          backgroundColor: theme.colors.card,
          shadowColor: theme.colors.text,
        }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.label, { color: theme.colors.text }]}>Content</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.contentInput,
              { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              }
            ]}
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Write your note here..."
            placeholderTextColor={theme.colors.text + '60'}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.colors.text }]}>
            {content.length} characters • {content.trim() ? content.trim().split(' ').filter(word => word.length > 0).length : 0} words
          </Text>
        </View>

        {/* Note Info Card */}
        {existingNote && (
          <View style={[styles.infoCard, { 
            backgroundColor: theme.colors.card,
            shadowColor: theme.colors.text,
          }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Note Information</Text>
            </View>
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              Created: {(() => {
                // Use created_at field from database instead of date
                const dateValue = existingNote.created_at || existingNote.date;
                
                if (!dateValue) {
                  return 'No creation date available';
                }
                
                try {
                  const date = new Date(dateValue);
                  
                  // Check if date is valid
                  if (isNaN(date.getTime())) {
                    // Try parsing as timestamp if it's a number string
                    if (typeof dateValue === 'string' && !isNaN(dateValue)) {
                      const timestampDate = new Date(parseInt(dateValue));
                      if (!isNaN(timestampDate.getTime())) {
                        return timestampDate.toLocaleString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      }
                    }
                    return 'Invalid date format';
                  }
                  
                  return date.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                } catch (error) {
                  console.log('Date formatting error:', error, 'Date value:', dateValue);
                  return 'Date formatting error';
                }
              })()}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Save Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            { 
              backgroundColor: theme.colors.primary,
              shadowColor: theme.colors.primary,
            },
            (!title.trim() || !content.trim()) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={!title.trim() || !content.trim()}
        >
          <Ionicons name="checkmark" size={20} color="#FFF" style={styles.saveButtonIcon} />
          <Text style={styles.saveButtonText}>
            {existingNote ? 'Update Note' : 'Save Note'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 100,
  },
  inputCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  contentInput: {
    height: 200,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'right',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddNoteScreen;
