-- Step 1: Create helper function
CREATE OR REPLACE FUNCTION is_admin_of_library(library_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM library_users
    WHERE user_id = auth.uid()
      AND library_users.library_id = is_admin_of_library.library_id
      AND is_admin = TRUE
  );
$$;

-- Step 2: Policies

-- 1. Anyone can insert
CREATE POLICY "Anyone can create their own library user entry" 
ON library_users
FOR INSERT
WITH CHECK (true);

-- 2. Users can view their own entries, admins can view all for their libraries
CREATE POLICY "User can view own entry or admin can view all entries for their libraries" 
ON library_users
FOR SELECT
USING (
  auth.uid() = user_id
  OR is_admin_of_library(library_id)
);

-- 3. Users or Admins can update
CREATE POLICY "User can update own entry or admin can update entries for their libraries" 
ON library_users
FOR UPDATE
USING (
  auth.uid() = user_id
  OR is_admin_of_library(library_id)
);

-- 4. Only admins can delete
CREATE POLICY "Only admin can delete library users entries" 
ON library_users
FOR DELETE
USING (
  is_admin_of_library(library_id)
);