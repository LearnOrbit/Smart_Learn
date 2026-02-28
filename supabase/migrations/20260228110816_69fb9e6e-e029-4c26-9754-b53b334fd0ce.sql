
-- Fix all RLS policies: change from RESTRICTIVE to PERMISSIVE

-- user_roles
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

-- assignments
DROP POLICY IF EXISTS "Everyone can view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can delete own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can update own assignments" ON public.assignments;
CREATE POLICY "Everyone can view assignments" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can create assignments" ON public.assignments FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own assignments" ON public.assignments FOR DELETE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own assignments" ON public.assignments FOR UPDATE USING (auth.uid() = teacher_id);

-- submissions
DROP POLICY IF EXISTS "Students can submit" ON public.submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers can grade submissions" ON public.submissions;
DROP POLICY IF EXISTS "Teachers can view all submissions" ON public.submissions;
CREATE POLICY "Students can submit" ON public.submissions FOR INSERT WITH CHECK (has_role(auth.uid(), 'student'::app_role) AND auth.uid() = student_id);
CREATE POLICY "Students can update own submissions" ON public.submissions FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can grade submissions" ON public.submissions FOR UPDATE USING (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can view all submissions" ON public.submissions FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role));

-- program_outcomes
DROP POLICY IF EXISTS "Authenticated can view POs" ON public.program_outcomes;
DROP POLICY IF EXISTS "Teachers can create POs" ON public.program_outcomes;
DROP POLICY IF EXISTS "Teachers can delete own POs" ON public.program_outcomes;
DROP POLICY IF EXISTS "Teachers can update own POs" ON public.program_outcomes;
CREATE POLICY "Authenticated can view POs" ON public.program_outcomes FOR SELECT USING (true);
CREATE POLICY "Teachers can create POs" ON public.program_outcomes FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND auth.uid() = created_by);
CREATE POLICY "Teachers can delete own POs" ON public.program_outcomes FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Teachers can update own POs" ON public.program_outcomes FOR UPDATE USING (auth.uid() = created_by);

-- course_outcomes
DROP POLICY IF EXISTS "Authenticated can view COs" ON public.course_outcomes;
DROP POLICY IF EXISTS "Teachers can create COs" ON public.course_outcomes;
DROP POLICY IF EXISTS "Teachers can delete own COs" ON public.course_outcomes;
DROP POLICY IF EXISTS "Teachers can update own COs" ON public.course_outcomes;
CREATE POLICY "Authenticated can view COs" ON public.course_outcomes FOR SELECT USING (true);
CREATE POLICY "Teachers can create COs" ON public.course_outcomes FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND auth.uid() = created_by);
CREATE POLICY "Teachers can delete own COs" ON public.course_outcomes FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Teachers can update own COs" ON public.course_outcomes FOR UPDATE USING (auth.uid() = created_by);

-- learning_outcomes
DROP POLICY IF EXISTS "Authenticated can view LOs" ON public.learning_outcomes;
DROP POLICY IF EXISTS "Teachers can create LOs" ON public.learning_outcomes;
DROP POLICY IF EXISTS "Teachers can delete own LOs" ON public.learning_outcomes;
DROP POLICY IF EXISTS "Teachers can update own LOs" ON public.learning_outcomes;
CREATE POLICY "Authenticated can view LOs" ON public.learning_outcomes FOR SELECT USING (true);
CREATE POLICY "Teachers can create LOs" ON public.learning_outcomes FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND auth.uid() = created_by);
CREATE POLICY "Teachers can delete own LOs" ON public.learning_outcomes FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Teachers can update own LOs" ON public.learning_outcomes FOR UPDATE USING (auth.uid() = created_by);

-- assignment_lo_mapping
DROP POLICY IF EXISTS "Authenticated can view mappings" ON public.assignment_lo_mapping;
DROP POLICY IF EXISTS "Teachers can create mappings" ON public.assignment_lo_mapping;
DROP POLICY IF EXISTS "Teachers can delete mappings" ON public.assignment_lo_mapping;
CREATE POLICY "Authenticated can view mappings" ON public.assignment_lo_mapping FOR SELECT USING (true);
CREATE POLICY "Teachers can create mappings" ON public.assignment_lo_mapping FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Teachers can delete mappings" ON public.assignment_lo_mapping FOR DELETE USING (has_role(auth.uid(), 'teacher'::app_role));

-- Ensure handle_new_user trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add marks column to submissions for numeric grading
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS marks numeric;

-- Add max_marks to assignments
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS max_marks numeric DEFAULT 100;
