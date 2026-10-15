grant update (subject_label,instructor_ids,start_time,end_time,needs_review,review_reason) on public.grade12_term_periods to authenticated;
drop policy if exists "Authorized staff update Grade 12 term class programs" on public.grade12_term_periods;
create policy "Authorized staff update Grade 12 term class programs"
on public.grade12_term_periods for update to authenticated
using (
  (select private.has_admin_permission('schedules.manage'::text))
  or exists (select 1 from public.grade_level_heads h where h.profile_id=(select auth.uid()) and h.is_active=true and h.grade_level=12)
)
with check (
  (select private.has_admin_permission('schedules.manage'::text))
  or exists (select 1 from public.grade_level_heads h where h.profile_id=(select auth.uid()) and h.is_active=true and h.grade_level=12)
);
