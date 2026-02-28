
-- Function: Calculate LO score for a student (average marks across assignments mapped to that LO)
CREATE OR REPLACE FUNCTION public.calc_lo_score(_student_id uuid, _lo_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    AVG(
      CASE WHEN a.max_marks > 0 THEN (s.marks / a.max_marks) * 100 ELSE NULL END
    ), 0
  )
  FROM submissions s
  JOIN assignment_lo_mapping m ON m.assignment_id = s.assignment_id
  JOIN assignments a ON a.id = s.assignment_id
  WHERE s.student_id = _student_id
    AND m.learning_outcome_id = _lo_id
    AND s.marks IS NOT NULL;
$$;

-- Function: Calculate CO score (average of LO scores under that CO)
CREATE OR REPLACE FUNCTION public.calc_co_score(_student_id uuid, _co_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(AVG(public.calc_lo_score(_student_id, lo.id)), 0)
  FROM learning_outcomes lo
  WHERE lo.course_outcome_id = _co_id;
$$;

-- Function: Calculate PO score (average of CO scores under that PO)
CREATE OR REPLACE FUNCTION public.calc_po_score(_student_id uuid, _po_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(AVG(public.calc_co_score(_student_id, co.id)), 0)
  FROM course_outcomes co
  WHERE co.program_outcome_id = _po_id;
$$;

-- Function: Get all scores for a student
CREATE OR REPLACE FUNCTION public.get_student_scores(_student_id uuid)
RETURNS TABLE(
  po_id uuid, po_code text, po_score numeric,
  co_id uuid, co_code text, co_score numeric,
  lo_id uuid, lo_code text, lo_score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    po.id, po.code, public.calc_po_score(_student_id, po.id),
    co.id, co.code, public.calc_co_score(_student_id, co.id),
    lo.id, lo.code, public.calc_lo_score(_student_id, lo.id)
  FROM program_outcomes po
  JOIN course_outcomes co ON co.program_outcome_id = po.id
  JOIN learning_outcomes lo ON lo.course_outcome_id = co.id
  ORDER BY po.code, co.code, lo.code;
$$;
