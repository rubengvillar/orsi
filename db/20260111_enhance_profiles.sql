
-- Add is_active and phone to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS phone text;

-- Update RLS policies to allow Admins to delete profiles (if needed for cleanup, though deactivate is preferred)
-- Actually, let's just ensure Admins can UPDATE any profile (already exists in rls_policies.sql policy "Admins can update any profile")
-- and potentially DELETE if we want that feature to work (the current UI has a delete button).
-- Adding delete policy for admins just in case.

CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin());

-- Also ensure 'phone' is updatable by owner
-- The existing policy "Users can update own profile" uses (id = auth.uid()) which covers the whole row, so new columns are covered.

