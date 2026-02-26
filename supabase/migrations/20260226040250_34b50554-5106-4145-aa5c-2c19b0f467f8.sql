
-- Program Outcomes (PO)
CREATE TABLE public.program_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.program_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view POs" ON public.program_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create POs" ON public.program_outcomes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND auth.uid() = created_by);
CREATE POLICY "Teachers can update own POs" ON public.program_outcomes FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Teachers can delete own POs" ON public.program_outcomes FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Course Outcomes (CO)
CREATE TABLE public.course_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  program_outcome_id UUID REFERENCES public.program_outcomes(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.course_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view COs" ON public.course_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create COs" ON public.course_outcomes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND auth.uid() = created_by);
CREATE POLICY "Teachers can update own COs" ON public.course_outcomes FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Teachers can delete own COs" ON public.course_outcomes FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Learning Outcomes (LO)
CREATE TABLE public.learning_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  course_outcome_id UUID REFERENCES public.course_outcomes(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view LOs" ON public.learning_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create LOs" ON public.learning_outcomes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND auth.uid() = created_by);
CREATE POLICY "Teachers can update own LOs" ON public.learning_outcomes FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Teachers can delete own LOs" ON public.learning_outcomes FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Assignment to LO mapping
CREATE TABLE public.assignment_lo_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  learning_outcome_id UUID REFERENCES public.learning_outcomes(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (assignment_id, learning_outcome_id)
);

ALTER TABLE public.assignment_lo_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mappings" ON public.assignment_lo_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create mappings" ON public.assignment_lo_mapping FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers can delete mappings" ON public.assignment_lo_mapping FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
