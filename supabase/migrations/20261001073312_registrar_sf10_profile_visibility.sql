drop policy if exists "Registrar reads learner profiles for SF10" on public.profiles;
drop policy if exists "Registrar reads SF10 related profiles" on public.profiles;
create policy "Registrar reads SF10 related profiles"
on public.profiles
for select
to authenticated
using (
  role in ('student','teacher')
  and (select private.has_admin_permission('sf10.manage'))
);
