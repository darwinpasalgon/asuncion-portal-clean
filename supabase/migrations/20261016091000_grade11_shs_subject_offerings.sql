-- Strengthened SHS subject groups and elective offers by active school year and term.
-- No automatic teacher assignments or grade changes.
create table if not exists public.shs_subject_offerings (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  subject_id uuid not null,
  grade_level smallint not null,
  category text not null check (category in ('core','elective')),
  program_code text not null,
  term_no smallint not null,
  group_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shs_offering_subject_grade_fk
    foreign key (subject_id,grade_level) references public.subjects(id,grade_level) on delete restrict,
  constraint shs_offering_unique
    unique(school_year_id,subject_id,program_code,term_no),
  constraint shs_offering_scope_check check (
    grade_level in (11,12) and (
      (category='core' and program_code='ALL' and term_no=0)
      or
      (category='elective' and
        program_code in ('STEM_MEDICAL','STEM_ENGINEERING',
          'BUSINESS_ENTREPRENEURSHIP','ASSH','TVL_OAP','TVL_FOOD_PROCESSING')
        and term_no between 1 and case when grade_level=11 then 3 else 2 end)
    )
  )
);
create index if not exists shs_offering_selector_idx
  on public.shs_subject_offerings
  (school_year_id,grade_level,category,program_code,term_no,is_active);
alter table public.shs_subject_offerings enable row level security;

drop policy if exists "SHS subject managers read offerings" on public.shs_subject_offerings;
create policy "SHS subject managers read offerings"
  on public.shs_subject_offerings for select to authenticated
  using ((select private.has_admin_permission('teaching.manage'::text)));
drop policy if exists "SHS subject managers manage offerings" on public.shs_subject_offerings;
create policy "SHS subject managers manage offerings"
  on public.shs_subject_offerings for all to authenticated
  using ((select private.has_admin_permission('teaching.manage'::text)))
  with check ((select private.has_admin_permission('teaching.manage'::text)));
grant select,insert,update on public.shs_subject_offerings to authenticated;
revoke all on public.shs_subject_offerings from anon;

insert into public.subjects
  (grade_level,name,code,is_active,grading_scheme,is_graded,include_in_school_forms)
values
  (11,'Effective Communication',null,true,'shs_core_academic',true,true),
  (11,'Mabisang Komunikasyon',null,true,'shs_core_academic',true,true),
  (11,'General Mathematics',null,true,'shs_core_academic',true,true),
  (11,'General Science',null,true,'shs_core_academic',true,true),
  (11,'Life and Career Skills',null,true,'shs_core_academic',true,true),
  (11,'Pag-Aaral ng Kasanayan at Lipunang Pilipino',null,true,'shs_core_academic',true,true)
on conflict (grade_level,name) do update set is_active=true;

insert into public.shs_subject_offerings
  (school_year_id,subject_id,grade_level,category,program_code,term_no,group_label,is_active)
select yr.id,s.id,11,'core','ALL',0,
  case when s.name in ('Effective Communication','Mabisang Komunikasyon')
    then 'Effective Communication / Mabisang Komunikasyon' else null end,
  true
from public.school_years yr cross join public.subjects s
where yr.is_active=true and s.grade_level=11 and
  s.name in (
    'Effective Communication','Mabisang Komunikasyon',
    'General Mathematics','General Science','Life and Career Skills',
    'Pag-Aaral ng Kasanayan at Lipunang Pilipino'
  )
on conflict (school_year_id,subject_id,program_code,term_no)
  do update set is_active=true,group_label=excluded.group_label,updated_at=now();
