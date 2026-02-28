
-- Allow teachers to view all user_roles (needed to list students in scores dashboard)
CREATE POLICY "Teachers can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role));
