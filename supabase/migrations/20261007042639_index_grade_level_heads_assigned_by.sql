create index if not exists grade_level_heads_assigned_by_idx
on public.grade_level_heads(assigned_by)
where assigned_by is not null;
