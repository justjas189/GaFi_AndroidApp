-- Test script to verify data access isolation between users
-- Run this in Supabase SQL Editor after applying the migration

-- Create two test users (this would normally be done via auth.signUp)
-- Note: In production, users are created via Supabase Auth API

-- Test 1: Check if RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'budgets', 'budget_categories', 'expenses', 'notes');

-- Test 2: List all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'budgets', 'budget_categories', 'expenses', 'notes')
ORDER BY tablename, policyname;

-- Test 3: Verify user data isolation
-- (This test assumes you have created two users via the app)
-- Check that each user can only see their own data

-- Count profiles (should only show current user's profile when authenticated)
SELECT COUNT(*) as profile_count FROM profiles;

-- Count budgets (should only show current user's budgets when authenticated)
SELECT COUNT(*) as budget_count FROM budgets;

-- Count expenses (should only show current user's expenses when authenticated)
SELECT COUNT(*) as expense_count FROM expenses;

-- Count notes (should only show current user's notes when authenticated)
SELECT COUNT(*) as note_count FROM notes;

-- Test 4: Check table structure and foreign key constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' 
    AND tc.table_name IN ('profiles', 'budgets', 'budget_categories', 'expenses', 'notes')
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- Test 5: Check indexes for performance
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'budgets', 'budget_categories', 'expenses', 'notes')
ORDER BY tablename, indexname;
