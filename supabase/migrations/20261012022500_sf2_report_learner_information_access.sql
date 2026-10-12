drop policy if exists "Attendance and report administrators read learner information" on public.learner_information;

create policy "Attendance and report administrators read learner information"
on public.learner_information
for select
to authenticated
using (
  (select private.has_admin_permission('attendance.manage'))
  or (select private.has_admin_permission('reports.view'))
);