create index if not exists schedule_blocks_section_id_idx
  on public.schedule_blocks(section_id);

create index if not exists schedule_blocks_created_by_idx
  on public.schedule_blocks(created_by)
  where created_by is not null;
