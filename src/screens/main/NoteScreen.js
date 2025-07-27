import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert
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
    // Ensure we have a valid date
    let noteDate;
    try {
      noteDate = new Date(item.date);
      // Check if the date is valid
      if (isNaN(noteDate.getTime())) {
        noteDate = new Date(); // Fallback to current date
      }
    } catch (error) {
      noteDate = new Date(); // Fallback to current date
    }
    
    const isRecent = (new Date() - noteDate) < 24 * 60 * 60 * 1000; // Less than 24 hours
    
    return (
      <TouchableOpacity 
        style={[styles.noteItem, { 
          backgroundColor: theme.colors.card,
          shadowColor: theme.colors.text,
        }]}
        onPress={() => navigation.navigate('AddNote', { note: item })}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.noteLeft}>
          <View style={[styles.noteIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons 
              name={item.title ? "document-text" : "document-outline"} 
              size={20} 
              color={theme.colors.primary} 
            />
          </View>
          <View style={styles.noteContent}>
            <View style={styles.noteTitleRow}>
              <Text style={[styles.noteTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {item.title || 'Untitled Note'}
              </Text>
              {isRecent && (
                <View style={[styles.newBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              )}
            </View>
            <Text 
              style={[styles.notePreview, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {item.content || 'No content'}
            </Text>
            <View style={styles.noteFooter}>
              <Text style={[styles.noteDate, { color: theme.colors.text }]}>
                {(() => {
                  try {
                    return noteDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: noteDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    });
                  } catch (error) {
                    return 'Today';
                  }
                })()}
              </Text>
              <Text style={[styles.wordCount, { color: theme.colors.text }]}>
                {item.content ? item.content.split(' ').filter(word => word.trim().length > 0).length : 0} words
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.noteRight}>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.colors.text}
            style={{ opacity: 0.4 }}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Notes</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>

      {notes.length > 0 ? (
        <View style={styles.notesContainer}>
          <FlatList
            data={notes.slice().reverse()}
            renderItem={renderNoteItem}
            keyExtractor={(item) => item.id}
            style={styles.notesList}
            contentContainerStyle={styles.notesListContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyStateIcon, { backgroundColor: theme.colors.background }]}>
            <Ionicons 
              name="document-text-outline" 
              size={40} 
              color={theme.colors.text}
              style={{ opacity: 0.3 }}
            />
          </View>
          <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
            No notes yet
          </Text>
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            Start capturing your thoughts and ideas
          </Text>
          <TouchableOpacity 
            style={[styles.createFirstNoteButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('AddNote')}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.createFirstNoteButtonText}>Create First Note</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.addButton, { 
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.text,
        }]}
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
  },
  header: {
    padding: 20,
    paddingBottom: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  notesContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  notesList: {
    flex: 1,
  },
  notesListContent: {
    paddingBottom: 100,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  noteLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  noteContent: {
    flex: 1,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notePreview: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 8,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  wordCount: {
    fontSize: 12,
    opacity: 0.5,
  },
  noteRight: {
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 30,
  },
  createFirstNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createFirstNoteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default NoteScreen;
