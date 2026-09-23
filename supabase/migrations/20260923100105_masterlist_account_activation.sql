alter table public.profiles
  add column if not exists position text;

create table if not exists public.masterlist_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  person_type text not null check (person_type in ('student','teacher')),
  file_name text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_activation_roster (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete restrict,
  person_type text not null check (person_type in ('student','teacher')),
  full_name text not null,
  lrn text,
  email text,
  position text,
  grade_level smallint references public.grade_levels(grade_level) on update cascade on delete restrict,
  section_id uuid,
  activation_code_hash text not null,
  activation_code_last4 text not null,
  status text not null default 'unclaimed'
    check (status in ('unclaimed','activated','disabled')),
  claimed_user_id uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  import_batch_id uuid references public.masterlist_import_batches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_activation_roster_student_shape check (
    person_type <> 'student'
    or (
      lrn ~ '^[0-9]{12}$'
      and grade_level between 7 and 12
      and section_id is not null
    )
  ),
  constraint account_activation_roster_teacher_shape check (
    person_type <> 'teacher'
    or (
      email is not null
      and btrim(email) <> ''
      and lrn is null
      and grade_level is null
      and section_id is null
    )
  ),
  constraint account_activation_roster_hash_shape check (
    activation_code_hash ~ '^[0-9a-f]{64}$'
    and char_length(activation_code_last4)=4
  ),
  constraint account_activation_roster_section_grade_fk
    foreign key (section_id, grade_level)
    references public.sections(id, grade_level)
    on update cascade on delete restrict
);

create unique index if not exists account_activation_student_lrn_unique
  on public.account_activation_roster(lrn)
  where person_type='student' and status <> 'disabled';

create unique index if not exists account_activation_teacher_email_unique
  on public.account_activation_roster(lower(email))
  where person_type='teacher' and status <> 'disabled';

create index if not exists account_activation_roster_batch_idx
  on public.account_activation_roster(import_batch_id);

create index if not exists account_activation_roster_school_year_idx
  on public.account_activation_roster(school_year_id,person_type,status);

create index if not exists masterlist_import_batches_school_year_idx
  on public.masterlist_import_batches(school_year_id,person_type,created_at desc);

alter table public.masterlist_import_batches enable row level security;
alter table public.account_activation_roster enable row level security;

revoke all on public.masterlist_import_batches, public.account_activation_roster from anon;
revoke all on public.masterlist_import_batches, public.account_activation_roster from authenticated;
grant select,insert,update,delete on public.masterlist_import_batches, public.account_activation_roster to authenticated;

drop policy if exists "Admins manage masterlist batches" on public.masterlist_import_batches;
create policy "Admins manage masterlist batches"
on public.masterlist_import_batches for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

drop policy if exists "Admins manage activation roster" on public.account_activation_roster;
create policy "Admins manage activation roster"
on public.account_activation_roster for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  requested text;
  new_lrn text;
  phone text;
  display_name text;
  new_grade smallint;
  new_section text;
  new_position text;
  activation_code text;
  activation_hash text;
  roster_record public.account_activation_roster%rowtype;
begin
  activation_code := trim(coalesce(new.raw_user_meta_data ->> 'activation_code', ''));

  if activation_code <> '' then
    requested := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
    if requested not in ('student','teacher') then
      raise exception 'Invalid activation role';
    end if;

    activation_hash := encode(
      extensions.digest(
        upper(regexp_replace(activation_code, '[^A-Za-z0-9]', '', 'g')),
        'sha256'
      ),
      'hex'
    );

    if requested='student' then
      new_lrn := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lrn', '')), '');

      select r.* into roster_record
      from public.account_activation_roster r
      join public.school_years sy on sy.id=r.school_year_id
      where r.person_type='student'
        and r.lrn=new_lrn
        and r.status='unclaimed'
        and r.activation_code_hash=activation_hash
        and sy.is_active=true
      limit 1;
    else
      select r.* into roster_record
      from public.account_activation_roster r
      join public.school_years sy on sy.id=r.school_year_id
      where r.person_type='teacher'
        and lower(r.email)=lower(coalesce(new.email,''))
        and r.status='unclaimed'
        and r.activation_code_hash=activation_hash
        and sy.is_active=true
      limit 1;
    end if;

    if roster_record.id is null then
      raise exception 'Invalid or already used activation code';
    end if;

    phone := trim(coalesce(new.raw_user_meta_data ->> 'recovery_phone', ''));
    if phone='' then
      raise exception 'Mobile number is required';
    end if;

    display_name := roster_record.full_name;
    new_position := roster_record.position;

    if requested='student' then
      new_lrn := roster_record.lrn;
      new_grade := roster_record.grade_level;
      select s.name into new_section
      from public.sections s
      where s.id=roster_record.section_id
        and s.grade_level=roster_record.grade_level
        and s.is_active=true
      limit 1;

      if new_section is null then
        raise exception 'Student section is no longer active';
      end if;
    else
      new_lrn := null;
      new_grade := null;
      new_section := null;
    end if;

    insert into public.profiles (
      id, full_name, email, recovery_phone, lrn, requested_role, role,
      account_status, grade_level, section, position
    )
    values (
      new.id,
      display_name,
      lower(coalesce(new.email,'')),
      phone,
      new_lrn,
      requested,
      requested,
      'active',
      new_grade,
      new_section,
      new_position
    );

    update public.account_activation_roster
    set status='activated',
        claimed_user_id=new.id,
        claimed_at=now(),
        updated_at=now()
    where id=roster_record.id
      and status='unclaimed';

    if not found then
      raise exception 'Activation code has already been used';
    end if;

    return new;
  end if;

  requested := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  if requested not in ('student','teacher') then requested := 'student'; end if;

  new_lrn := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lrn', '')), '');
  phone := trim(coalesce(new.raw_user_meta_data ->> 'recovery_phone', ''));
  display_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if requested = 'student' then
    begin
      new_grade := nullif(trim(coalesce(new.raw_user_meta_data ->> 'grade_level', '')), '')::smallint;
    exception when others then new_grade := null;
    end;
    if new_grade not between 7 and 12 then new_grade := null; end if;

    new_section := nullif(trim(coalesce(new.raw_user_meta_data ->> 'section', '')), '');
    if new_section is not null and not exists (
      select 1 from public.sections
      where grade_level=new_grade and name=new_section and is_active=true
    ) then new_section := null;
    end if;
  else
    new_lrn := null;
    new_grade := null;
    new_section := null;
  end if;

  insert into public.profiles (
    id, full_name, email, recovery_phone, lrn, requested_role, grade_level, section
  )
  values (
    new.id, display_name, lower(coalesce(new.email,'')), phone,
    new_lrn, requested, new_grade, new_section
  );

  return new;
end;
$function$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
