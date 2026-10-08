drop policy if exists "Users read relevant learning resources" on public.learning_resources;

create policy "Users read relevant learning resources"
on public.learning_resources
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.can_read_learning_resource(learning_resources.id))
);
