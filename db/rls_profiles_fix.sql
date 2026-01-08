-- Fix RLS visibility for the profiles table
-- Ensure all authenticated users can see the list of profiles (needed for admins and for tagging/display throughout the app if necessary)

BEGIN;

-- 1. Drop existing select policy if it exists
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;

-- 2. Create clean, definitive policies for Profiles
-- SELECT: All authenticated users can see profiles
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- INSERT: Users can recreate their own profile if missing
CREATE POLICY "Enable insert for own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own info
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Enable update for own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 3. Verify Admin checking function (is_admin)
-- It should already be security definer, but let's ensure it's robust.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'Admin'
  );
END;
$$;

COMMIT;
