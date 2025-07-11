import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const NoteScreen = ({ navigation }) => {
  const { notes, deleteNote } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);

  const handleDelete = (noteId) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNote(noteId)
        }
      ]
    );
  };

  const renderNoteItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={[styles.noteItem, { backgroundColor: theme.colors.card }]}
        onPress={() => navigation.navigate('AddNote', { note: item })}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.noteContent}>
          <Text style={[styles.noteTitle, { color: theme.colors.text }]}>
            {item.title}
          </Text>
          <Text 
            style={[styles.notePreview, { color: theme.colors.text, opacity: 0.6 }]}
            numberOfLines={2}
          >
            {item.content}
          </Text>
          <Text style={[styles.noteDate, { color: theme.colors.text, opacity: 0.4 }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={theme.colors.text}
          style={{ opacity: 0.6 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Notes</Text>
      </View>

      {notes.length > 0 ? (
        <FlatList
          data={notes.slice().reverse()}
          renderItem={renderNoteItem}
          keyExtractor={(item) => item.id}
          style={styles.notesList}
          contentContainerStyle={styles.notesListContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons 
            name="document-text-outline" 
            size={50} 
            color={theme.colors.text}
            style={{ opacity: 0.3 }}
          />
          <Text style={[styles.emptyStateText, { color: theme.colors.text, opacity: 0.6 }]}>
            No notes added yet
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddNote')}
      >
        <Ionicons name="add" size={24} color="#FFF" />
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  notesList: {
    flex: 1,
  },
  notesListContent: {
    padding: 20,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  notePreview: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 8,
  },
  noteDate: {
    color: '#666',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#808080',
    fontSize: 16,
    marginTop: 10,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default NoteScreen;
