-- MoneyTrack School-Wide User Roles Migration
-- Date: 2025-10-28
-- Purpose: Expand user system for school-wide implementation with RBAC

-- =====================================================
-- 1. USER PROFILES TABLE (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Information
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE, -- School ID for students
  employee_id TEXT UNIQUE, -- Employee ID for staff/faculty
  
  -- Role & Department
  user_role TEXT NOT NULL CHECK (user_role IN (
    'student_shs',
    'student_college', 
    'staff_non_teaching',
    'faculty',
    'admin',
    'super_admin'
  )),
  department TEXT, -- Department/Course/Strand
  year_level TEXT, -- For students: 'Grade 11', 'Grade 12', '1st Year', etc.
  
  -- School-Specific Fields
  school_email TEXT UNIQUE, -- Official school email
  contact_number TEXT,
  emergency_contact TEXT,
  
  -- Financial Information
  monthly_allowance DECIMAL(10,2), -- For students
  monthly_salary DECIMAL(10,2), -- For employees
  
  -- Account Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended', 'graduated', 'resigned')),
  
  -- Verification
  verification_code TEXT,
  verification_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  profile_image_url TEXT,
  bio TEXT,
  privacy_settings JSONB DEFAULT '{"show_in_leaderboard": true, "allow_friend_requests": true}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_role ON public.user_profiles(user_role);
CREATE INDEX idx_user_profiles_department ON public.user_profiles(department);
CREATE INDEX idx_user_profiles_student_id ON public.user_profiles(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_user_profiles_employee_id ON public.user_profiles(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_user_profiles_status ON public.user_profiles(account_status);

-- =====================================================
-- 2. USER PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ, -- Optional expiration
  
  UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_key ON public.user_permissions(permission_key);

-- =====================================================
-- 3. ROLE PERMISSIONS MAPPING (Default Permissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default role permissions
INSERT INTO public.role_permissions (role_name, permissions, description) VALUES
  ('student_shs', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_allowance',
    'savings_goals',
    'friend_leaderboard'
  ], 'Senior High School student permissions'),
  
  ('student_college', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_allowance',
    'savings_goals',
    'friend_leaderboard',
    'expense_reports'
  ], 'College student permissions'),
  
  ('staff_non_teaching', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_salary',
    'expense_reports',
    'department_analytics'
  ], 'Non-teaching staff permissions'),
  
  ('faculty', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_salary',
    'expense_reports',
    'department_analytics'
  ], 'Faculty member permissions'),
  
  ('admin', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_salary',
    'expense_reports',
    'department_analytics',
    'view_all_users',
    'manage_users',
    'view_school_analytics'
  ], 'Administrator permissions'),
  
  ('super_admin', ARRAY[
    'track_expenses',
    'view_budget',
    'use_ai_assistant',
    'view_salary',
    'expense_reports',
    'department_analytics',
    'view_all_users',
    'manage_users',
    'system_settings',
    'view_school_analytics'
  ], 'Super administrator with full access');

-- =====================================================
-- 4. SCHOOL ID VALIDATION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.school_id_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id TEXT NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('student_shs', 'student_college', 'staff', 'faculty')),
  department TEXT,
  year_level TEXT,
  full_name TEXT NOT NULL,
  school_email TEXT,
  
  -- Registration Status
  is_registered BOOLEAN DEFAULT FALSE,
  registered_user_id UUID REFERENCES auth.users(id),
  registered_at TIMESTAMPTZ,
  
  -- Metadata
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_school_id_registry_id ON public.school_id_registry(school_id);
CREATE INDEX idx_school_id_registry_registered ON public.school_id_registry(is_registered);

-- =====================================================
-- 5. AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_id_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage all profiles"
  ON public.user_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );

-- User Permissions Policies
CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage permissions"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );

-- School ID Registry Policies
CREATE POLICY "Users can view their own registry entry"
  ON public.school_id_registry FOR SELECT
  USING (auth.uid() = registered_user_id);

CREATE POLICY "Only admins can manage registry"
  ON public.school_id_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );

-- Audit Logs Policies
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND user_role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_id_param UUID,
  permission_key_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  -- Check custom permissions
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = user_id_param
    AND permission_key = permission_key_param
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_perm;
  
  IF has_perm THEN
    RETURN TRUE;
  END IF;
  
  -- Check role-based permissions
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.role_permissions rp ON up.user_role = rp.role_name
    WHERE up.id = user_id_param
    AND permission_key_param = ANY(rp.permissions)
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id_param UUID)
RETURNS TEXT[] AS $$
DECLARE
  perms TEXT[];
BEGIN
  -- Get role-based permissions
  SELECT rp.permissions INTO perms
  FROM public.user_profiles up
  JOIN public.role_permissions rp ON up.user_role = rp.role_name
  WHERE up.id = user_id_param;
  
  -- Add custom permissions
  SELECT ARRAY_AGG(DISTINCT permission_key) 
  FROM (
    SELECT UNNEST(perms) AS permission_key
    UNION
    SELECT permission_key FROM public.user_permissions
    WHERE user_id = user_id_param
    AND (expires_at IS NULL OR expires_at > NOW())
  ) AS all_perms
  INTO perms;
  
  RETURN perms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate school ID
CREATE OR REPLACE FUNCTION public.validate_school_id(school_id_param TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'is_valid', EXISTS(SELECT 1 FROM public.school_id_registry WHERE school_id = school_id_param),
    'is_registered', COALESCE((SELECT is_registered FROM public.school_id_registry WHERE school_id = school_id_param), FALSE),
    'user_type', (SELECT user_type FROM public.school_id_registry WHERE school_id = school_id_param),
    'department', (SELECT department FROM public.school_id_registry WHERE school_id = school_id_param),
    'full_name', (SELECT full_name FROM public.school_id_registry WHERE school_id = school_id_param)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  user_id_param UUID,
  action_param TEXT,
  resource_type_param TEXT DEFAULT NULL,
  resource_id_param TEXT DEFAULT NULL,
  details_param JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    user_id_param,
    action_param,
    resource_type_param,
    resource_id_param,
    details_param
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-grant role permissions on profile creation
CREATE OR REPLACE FUNCTION grant_role_permissions()
RETURNS TRIGGER AS $$
DECLARE
  perm TEXT;
  perms TEXT[];
BEGIN
  -- Get permissions for the user's role
  SELECT permissions INTO perms
  FROM public.role_permissions
  WHERE role_name = NEW.user_role;
  
  -- Grant each permission
  FOREACH perm IN ARRAY perms
  LOOP
    INSERT INTO public.user_permissions (user_id, permission_key)
    VALUES (NEW.id, perm)
    ON CONFLICT (user_id, permission_key) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_grant_role_permissions
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION grant_role_permissions();

-- =====================================================
-- COMPLETED: School-Wide User Roles Migration
-- =====================================================
