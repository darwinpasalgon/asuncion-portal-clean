-- The production baseline already contains the equivalent partial unique index.
-- Remove the duplicate created by the adviser-only grading migration.
drop index if exists public.section_advisers_one_active_per_section_idx;
