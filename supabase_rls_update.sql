-- 1) Enable RLS (if not already enabled)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 2) Remove old public policies
-- Note: Replace "Enable read access for all users" with the actual name if different
DROP POLICY IF EXISTS "Enable read access for all users" ON public.questions;

-- 3) Allow only logged-in users to read
CREATE POLICY "Authenticated can read questions"
ON public.questions
FOR SELECT
TO authenticated
USING (true);
