create index if not exists student_enrollments_source_enrollment_idx
  on public.student_enrollments (source_enrollment_id);

create index if not exists student_enrollments_status_changed_by_idx
  on public.student_enrollments (status_changed_by);

create index if not exists learner_enrollment_events_enrollment_idx
  on public.learner_enrollment_events (enrollment_id);

create index if not exists learner_enrollment_events_from_section_idx
  on public.learner_enrollment_events (from_section_id);

create index if not exists learner_enrollment_events_to_section_idx
  on public.learner_enrollment_events (to_section_id);

create index if not exists learner_enrollment_events_created_by_idx
  on public.learner_enrollment_events (created_by);
