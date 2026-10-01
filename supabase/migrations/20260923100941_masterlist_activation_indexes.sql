create index if not exists account_activation_roster_created_by_idx
  on public.account_activation_roster(created_by);
create index if not exists account_activation_roster_grade_level_idx
  on public.account_activation_roster(grade_level);
create index if not exists account_activation_roster_section_grade_idx
  on public.account_activation_roster(section_id,grade_level);
create index if not exists masterlist_import_batches_created_by_idx
  on public.masterlist_import_batches(created_by);
