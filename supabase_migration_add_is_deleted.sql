-- Migration: Add soft-delete support to goals_custom_mode
-- Run this in your Supabase SQL Editor before deploying the app changes.

ALTER TABLE public.goals_custom_mode
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
