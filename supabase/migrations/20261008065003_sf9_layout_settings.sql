create table if not exists public.sf9_layout_settings (
  id boolean primary key default true check (id = true),
  settings jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sf9_layout_settings enable row level security;

revoke all on table public.sf9_layout_settings from anon;
revoke all on table public.sf9_layout_settings from authenticated;
grant select, insert, update on table public.sf9_layout_settings to authenticated;
grant all on table public.sf9_layout_settings to service_role;

drop policy if exists "Active teachers and administrators read SF9 layout" on public.sf9_layout_settings;
create policy "Active teachers and administrators read SF9 layout"
on public.sf9_layout_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and p.role in ('teacher','administrator')
  )
);

drop policy if exists "Full administrators insert SF9 layout" on public.sf9_layout_settings;
create policy "Full administrators insert SF9 layout"
on public.sf9_layout_settings
for insert
to authenticated
with check (
  (select private.is_active_admin())
  and updated_by = (select auth.uid())
);

drop policy if exists "Full administrators update SF9 layout" on public.sf9_layout_settings;
create policy "Full administrators update SF9 layout"
on public.sf9_layout_settings
for update
to authenticated
using ((select private.is_active_admin()))
with check (
  (select private.is_active_admin())
  and updated_by = (select auth.uid())
);

insert into public.sf9_layout_settings (id, settings)
values (
  true,
  '{
    "paper":"A4",
    "orientation":"landscape",
    "pageHorizontalMarginMm":15.5,
    "topMm":5.5,
    "bottomMm":4.5,
    "leftCardOuterMm":5.25,
    "leftCardInnerMm":10.35,
    "rightCardInnerMm":5.25,
    "rightCardOuterMm":5.25,
    "centerLineMm":0.33,
    "headerHeightMm":25.4,
    "headerGapMm":3.8,
    "logoSizeMm":22.3,
    "frontFontPt":7.44,
    "backFontPt":6.84,
    "lineHeight":1.02
  }'::jsonb
)
on conflict (id) do nothing;
