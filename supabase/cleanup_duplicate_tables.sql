-- MoneyTrack Database Cleanup Script
-- This script removes duplicate and unused tables
-- 
-- IMPORTANT: Review this carefully before running!
-- Make a backup of your database first!
-- Run: pg_dump your_database > backup.sql

-- =========================================
-- TABLES TO DELETE (Duplicates/Unused)
-- =========================================

-- Disable RLS temporarily for cleanup
SET session_replication_role = 'replica';

-- =========================================
-- 1. CHAT SYSTEM DUPLICATES
-- =========================================
-- You have two chat systems:
-- A) chat_history (simple, from gamification)
-- B) chat_sessions + chat_messages + user_chat_preferences (complex, session-based)
-- 
-- RECOMMENDATION: Keep chat_sessions + chat_messages (more robust)
-- DELETE: chat_history (simpler but redundant)

DROP TABLE IF EXISTS public.chat_history CASCADE;

-- If you're NOT using the complex chat system, uncomment these instead:
-- DROP TABLE IF EXISTS public.chat_messages CASCADE;
-- DROP TABLE IF EXISTS public.chat_sessions CASCADE;
-- DROP TABLE IF EXISTS public.user_chat_preferences CASCADE;

-- =========================================
-- 2. TRANSACTION DUPLICATES
-- =========================================
-- You have two expense tracking tables:
-- A) expenses (main, used by DataContext.js)
-- B) chatbot_transactions (for chatbot-created expenses)
--
-- RECOMMENDATION: Use only 'expenses' table
-- The expenses table already has: created_via, natural_language_input, confidence_score, needs_review
-- So chatbot_transactions is redundant

DROP TABLE IF EXISTS public.chatbot_transactions CASCADE;

-- =========================================
-- 3. PROFILE DUPLICATES
-- =========================================
-- You have two profile tables:
-- A) profiles (original, used throughout the app)
-- B) user_profiles (from school-wide migration, more complex)
--
-- RECOMMENDATION: Keep ONE based on your needs
-- If using school features, keep user_profiles and migrate data
-- If not using school features, delete user_profiles

-- Option A: Delete user_profiles (keep simple profiles)
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Option B: If you want school features, run this instead (COMMENTED OUT):
-- First migrate data from profiles to user_profiles, then:
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- =========================================
-- 4. UNUSED INTERACTION LOGGING
-- =========================================
-- You have:
-- A) chatbot_interactions (NLP logging with intents)
-- B) user_interactions (gamification XP tracking)
--
-- These serve DIFFERENT purposes, so keep both UNLESS
-- you're not using one of them.
--
-- If you're NOT using chatbot_interactions for NLP debugging:
-- DROP TABLE IF EXISTS public.chatbot_interactions CASCADE;
--
-- If you're NOT using gamification/XP system:
-- DROP TABLE IF EXISTS public.user_interactions CASCADE;

-- =========================================
-- 5. PERMISSION TABLES (School-wide feature)
-- =========================================
-- If you're NOT implementing school-wide roles:

DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;

-- =========================================
-- 6. DROP ORPHANED/UNUSED FUNCTIONS
-- =========================================

-- Chat cleanup function (if deleting chat system)
DROP FUNCTION IF EXISTS cleanup_old_chat_sessions() CASCADE;

-- Friend system functions (if not using friends)
-- DROP FUNCTION IF EXISTS send_friend_request(TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS respond_to_friend_request(UUID, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_friend_requests() CASCADE;
-- DROP FUNCTION IF EXISTS get_friends_list() CASCADE;

-- =========================================
-- SUMMARY OF WHAT THIS SCRIPT DELETES:
-- =========================================
-- 1. chat_history         (duplicate of chat_sessions/messages)
-- 2. chatbot_transactions (duplicate of expenses)
-- 3. user_profiles        (duplicate of profiles)
-- 4. user_permissions     (school feature not in use)
-- 5. role_permissions     (school feature not in use)
-- =========================================

-- Re-enable RLS
SET session_replication_role = 'origin';

-- Verify remaining tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =========================================
-- TABLES THAT SHOULD REMAIN:
-- =========================================
-- profiles              - User basic info
-- budgets               - Budget settings  
-- budget_categories     - Budget allocations
-- expenses              - All expense tracking
-- notes                 - User notes
-- savings_goals         - Savings targets
-- savings_transactions  - Savings history
-- user_levels           - Gamification XP/levels
-- user_achievements     - Earned achievements
-- achievement_definitions - Achievement types
-- user_interactions     - XP earning history
-- chatbot_interactions  - NLP/AI logs (optional)
-- chat_sessions         - Chat conversation sessions
-- chat_messages         - Chat message history
-- user_chat_preferences - Chat settings
-- friends               - Friend relationships
-- budget_alerts         - Budget warnings
-- =========================================
