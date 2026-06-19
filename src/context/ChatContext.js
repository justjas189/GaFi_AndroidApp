// ChatContext — GLOBAL memory for Koin (the AI finance buddy).
//
// Why this exists:
//   The chat used to keep `messages`/`conversationHistory` in ChatModal's own
//   useState. That state died every time the modal unmounted or was re-seeded
//   on open, so closing the sheet or navigating to another screen wiped the
//   conversation. Lifting it here makes Koin a true "Global Buddy": one
//   conversation that survives modal close + navigation for the whole session.
//
// Lifetime / scoping:
//   The provider is mounted in MainNavigator (the authenticated surface), so
//   the conversation lives as long as the user is signed in and resets cleanly
//   on logout (MainNavigator unmounts → provider unmounts → state gone).
//
// What is NOT stored here:
//   The `system` prompt is intentionally kept OUT of the persisted history. It
//   is rebuilt fresh on every request with the user's CURRENT screen (the
//   hybrid "dynamic context" fix in ChatModal), so a screen the user has since
//   left can never get baked permanently into the conversation.

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  // UI-facing message list (what the FlatList renders).
  const [messages, setMessages] = useState([]);

  // LLM-facing turn list ({ role, content }) — only user/assistant turns.
  const [conversationHistory, setConversationHistory] = useState([]);

  // Request-in-flight flag (drives the "Koin is thinking…" indicator).
  const [isTyping, setIsTyping] = useState(false);

  // True once the first contextual welcome has been seeded. Gates re-seeding so
  // reopening the modal keeps the existing conversation instead of resetting.
  const [isInitialized, setIsInitialized] = useState(false);

  // Ref mirror of conversationHistory so async sendMessage reads the LATEST
  // turns without being trapped by a stale closure. Kept in sync here so every
  // consumer shares one source of truth.
  const conversationHistoryRef = useRef([]);
  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  // Wipe the conversation back to empty (e.g. the "new chat" button). Callers
  // re-seed a fresh welcome afterwards.
  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    conversationHistoryRef.current = [];
    setIsInitialized(false);
    setIsTyping(false);
  }, []);

  const value = useMemo(() => ({
    messages,
    setMessages,
    conversationHistory,
    setConversationHistory,
    conversationHistoryRef,
    isTyping,
    setIsTyping,
    isInitialized,
    setIsInitialized,
    resetChat,
  }), [messages, conversationHistory, isTyping, isInitialized, resetChat]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
};

export default ChatContext;
