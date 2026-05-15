-- Migration: Add soft-delete support and timestamp tracking to goals_custom_mode
-- Run this in your Supabase SQL Editor before deploying the app changes.

-- Soft-delete flag (skip if already added)
ALTER TABLE public.goals_custom_mode
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Timestamps for when a goal was achieved or deleted
ALTER TABLE public.goals_custom_mode
  ADD COLUMN achieved_at timestamp with time zone NULL;

ALTER TABLE public.goals_custom_mode
  ADD COLUMN deleted_at timestamp with time zone NULL;
