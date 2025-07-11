-- First, disable RLS temporarily to clean up any existing policies
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update access for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete access for users based on id" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create bypass RLS policy for service_role
CREATE POLICY "Enable service role full access"
ON public.profiles
TO service_role
USING (true)
WITH CHECK (true);

-- Create policies for authenticated users
CREATE POLICY "Enable read access for own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Enable insert access for own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update access for own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete access for own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role; 