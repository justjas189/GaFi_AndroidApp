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
      date: new Date().toISOString()
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {existingNote ? 'Edit Note' : 'Add Note'}
        </Text>
      </View>

      <ScrollView style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Title</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.card, color: theme.colors.text }
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Note title"
            placeholderTextColor={theme.colors.text + '80'}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Content</Text>
          <TextInput
            style={[
              styles.input,
              styles.contentInput,
              { backgroundColor: theme.colors.card, color: theme.colors.text }
            ]}
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Write your note here..."
            placeholderTextColor={theme.colors.text + '80'}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Save Note</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 15,
    color: '#FFF',
    fontSize: 16,
  },
  contentInput: {
    height: 200,
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddNoteScreen;
