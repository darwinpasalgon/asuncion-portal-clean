create table if not exists public.sf9_teacher_remarks (
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_no smallint not null check (term_no between 1 and 3),
  remark text not null check (
    char_length(trim(remark)) between 1 and 500
  ),
  source text not null default 'manual'
    check (source in ('automatic','manual')),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (school_year_id, student_id, term_no)
);

create index if not exists sf9_teacher_remarks_student_idx
  on public.sf9_teacher_remarks(student_id, school_year_id);

alter table public.sf9_teacher_remarks enable row level security;

revoke all on public.sf9_teacher_remarks from anon;
revoke all on public.sf9_teacher_remarks from authenticated;
grant select, insert, update, delete on public.sf9_teacher_remarks to authenticated;

drop policy if exists "Advisers and administrators read SF9 remarks"
  on public.sf9_teacher_remarks;
drop policy if exists "Advisers and administrators insert SF9 remarks"
  on public.sf9_teacher_remarks;
drop policy if exists "Advisers and administrators update SF9 remarks"
  on public.sf9_teacher_remarks;
drop policy if exists "Advisers and administrators delete SF9 remarks"
  on public.sf9_teacher_remarks;

create policy "Advisers and administrators read SF9 remarks"
on public.sf9_teacher_remarks
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role = 'administrator'
        or (
          p.role = 'teacher'
          and exists (
            select 1
            from public.student_enrollments se
            join public.section_advisers sa
              on sa.school_year_id = se.school_year_id
             and sa.section_id = se.section_id
             and sa.teacher_id = (select auth.uid())
             and sa.is_active = true
            where se.student_id = sf9_teacher_remarks.student_id
              and se.school_year_id = sf9_teacher_remarks.school_year_id
              and se.enrollment_status = 'active'
          )
        )
      )
  )
);

create policy "Advisers and administrators insert SF9 remarks"
on public.sf9_teacher_remarks
for insert
to authenticated
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role = 'administrator'
        or (
          p.role = 'teacher'
          and exists (
            select 1
            from public.student_enrollments se
            join public.section_advisers sa
              on sa.school_year_id = se.school_year_id
             and sa.section_id = se.section_id
             and sa.teacher_id = (select auth.uid())
             and sa.is_active = true
            where se.student_id = sf9_teacher_remarks.student_id
              and se.school_year_id = sf9_teacher_remarks.school_year_id
              and se.enrollment_status = 'active'
          )
        )
      )
  )
);

create policy "Advisers and administrators update SF9 remarks"
on public.sf9_teacher_remarks
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role = 'administrator'
        or (
          p.role = 'teacher'
          and exists (
            select 1
            from public.student_enrollments se
            join public.section_advisers sa
              on sa.school_year_id = se.school_year_id
             and sa.section_id = se.section_id
             and sa.teacher_id = (select auth.uid())
             and sa.is_active = true
            where se.student_id = sf9_teacher_remarks.student_id
              and se.school_year_id = sf9_teacher_remarks.school_year_id
              and se.enrollment_status = 'active'
          )
        )
      )
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role = 'administrator'
        or (
          p.role = 'teacher'
          and exists (
            select 1
            from public.student_enrollments se
            join public.section_advisers sa
              on sa.school_year_id = se.school_year_id
             and sa.section_id = se.section_id
             and sa.teacher_id = (select auth.uid())
             and sa.is_active = true
            where se.student_id = sf9_teacher_remarks.student_id
              and se.school_year_id = sf9_teacher_remarks.school_year_id
              and se.enrollment_status = 'active'
          )
        )
      )
  )
);

create policy "Advisers and administrators delete SF9 remarks"
on public.sf9_teacher_remarks
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role = 'administrator'
        or (
          p.role = 'teacher'
          and exists (
            select 1
            from public.student_enrollments se
            join public.section_advisers sa
              on sa.school_year_id = se.school_year_id
             and sa.section_id = se.section_id
             and sa.teacher_id = (select auth.uid())
             and sa.is_active = true
            where se.student_id = sf9_teacher_remarks.student_id
              and se.school_year_id = sf9_teacher_remarks.school_year_id
              and se.enrollment_status = 'active'
          )
        )
      )
  )
);

comment on table public.sf9_teacher_remarks is
  'Adviser-reviewed SF9 comments per learner and term. Automatic suggestions remain editable before printing.';
