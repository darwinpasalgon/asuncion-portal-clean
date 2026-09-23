-- Asuncion NHS Academic Portal baseline
-- Generated from the live Supabase catalog on 20260923085402 UTC.
-- This migration is intentionally idempotent so it can be recorded safely
-- against the existing project while also defining a fresh Supabase database.

create schema if not exists private;
grant usage on schema public to anon, authenticated;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public."announcements" (
  "id" uuid default gen_random_uuid() not null,
  "school_year_id" uuid,
  "announcement_type" text default 'announcement'::text not null,
  "title" text not null,
  "body" text,
  "memo_number" text,
  "memo_date" date,
  "audience_scope" text not null,
  "target_grade" smallint,
  "target_section_id" uuid,
  "status" text default 'draft'::text not null,
  "published_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_by" uuid not null,
  "posted_by_name" text not null,
  "attachment_path" text,
  "attachment_name" text,
  "attachment_mime_type" text,
  "attachment_size" bigint,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."announcements" enable row level security;

create table if not exists public."class_schedules" (
  "id" uuid default gen_random_uuid() not null,
  "teacher_assignment_id" uuid not null,
  "day_of_week" smallint not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null,
  "room" text,
  "is_active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."class_schedules" enable row level security;

create table if not exists public."daily_attendance" (
  "id" uuid default gen_random_uuid() not null,
  "student_id" uuid not null,
  "school_year_id" uuid not null,
  "section_id" uuid not null,
  "attendance_date" date not null,
  "status" text not null,
  "note" text,
  "recorded_by" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."daily_attendance" enable row level security;

create table if not exists public."grade_levels" (
  "grade_level" smallint not null,
  "label" text not null,
  "sort_order" smallint not null
);
alter table public."grade_levels" enable row level security;

create table if not exists public."learning_resources" (
  "id" uuid default gen_random_uuid() not null,
  "school_year_id" uuid not null,
  "resource_scope" text not null,
  "teacher_assignment_id" uuid,
  "term_no" smallint,
  "category" text not null,
  "title" text not null,
  "description" text,
  "external_url" text,
  "status" text default 'draft'::text not null,
  "published_at" timestamp with time zone,
  "created_by" uuid not null,
  "posted_by_name" text not null,
  "attachment_path" text,
  "attachment_name" text,
  "attachment_mime_type" text,
  "attachment_size" bigint,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."learning_resources" enable row level security;

create table if not exists public."password_recovery_challenges" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "channel" text not null,
  "code_hash" text not null,
  "expires_at" timestamp with time zone not null,
  "attempts" integer default 0 not null,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
alter table public."password_recovery_challenges" enable row level security;

create table if not exists public."password_reset_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "status" text default 'pending'::text not null,
  "requested_at" timestamp with time zone default now() not null,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid
);
alter table public."password_reset_requests" enable row level security;

create table if not exists public."profiles" (
  "id" uuid not null,
  "full_name" text not null,
  "email" text not null,
  "recovery_phone" text not null,
  "lrn" text,
  "requested_role" text default 'student'::text not null,
  "role" text,
  "account_status" text default 'pending'::text not null,
  "phone_verified" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "must_change_password" boolean default false not null,
  "temp_password_expires_at" timestamp with time zone,
  "grade_level" smallint,
  "section" text
);
alter table public."profiles" enable row level security;

create table if not exists public."school_years" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "start_year" smallint not null,
  "end_year" smallint not null,
  "is_active" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."school_years" enable row level security;

create table if not exists public."section_advisers" (
  "id" uuid default gen_random_uuid() not null,
  "school_year_id" uuid not null,
  "section_id" uuid not null,
  "teacher_id" uuid not null,
  "is_active" boolean default true not null,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."section_advisers" enable row level security;

create table if not exists public."sections" (
  "id" uuid default gen_random_uuid() not null,
  "grade_level" smallint not null,
  "name" text not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."sections" enable row level security;

create table if not exists public."student_enrollments" (
  "id" uuid default gen_random_uuid() not null,
  "student_id" uuid not null,
  "school_year_id" uuid not null,
  "grade_level" smallint not null,
  "section_id" uuid,
  "enrollment_status" text default 'active'::text not null,
  "enrolled_at" timestamp with time zone default now() not null,
  "created_by" uuid,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."student_enrollments" enable row level security;

create table if not exists public."student_term_grades" (
  "id" uuid default gen_random_uuid() not null,
  "student_id" uuid not null,
  "teacher_assignment_id" uuid not null,
  "school_year_id" uuid not null,
  "term_no" smallint not null,
  "ww_ps" numeric(5,2),
  "pt_ps" numeric(5,2),
  "st1_ps" numeric(5,2),
  "st2_ps" numeric(5,2),
  "term_exam_ps" numeric(5,2),
  "initial_grade" numeric(5,2),
  "term_grade" smallint default 60 not null,
  "status" text default 'draft'::text not null,
  "published_at" timestamp with time zone,
  "encoded_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."student_term_grades" enable row level security;

create table if not exists public."subjects" (
  "id" uuid default gen_random_uuid() not null,
  "grade_level" smallint not null,
  "name" text not null,
  "code" text,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "grading_scheme" text default 'ks23_standard'::text not null
);
alter table public."subjects" enable row level security;

create table if not exists public."teacher_assignments" (
  "id" uuid default gen_random_uuid() not null,
  "school_year_id" uuid not null,
  "teacher_id" uuid not null,
  "grade_level" smallint not null,
  "section_id" uuid not null,
  "subject_id" uuid not null,
  "is_active" boolean default true not null,
  "assigned_at" timestamp with time zone default now() not null,
  "assigned_by" uuid,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."teacher_assignments" enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_pkey'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='class_schedules_pkey'
      and conrelid='public.class_schedules'::regclass
  ) then
    alter table public."class_schedules"
      add constraint "class_schedules_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_pkey'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='grade_levels_pkey'
      and conrelid='public.grade_levels'::regclass
  ) then
    alter table public."grade_levels"
      add constraint "grade_levels_pkey" PRIMARY KEY (grade_level);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_pkey'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_recovery_challenges_pkey'
      and conrelid='public.password_recovery_challenges'::regclass
  ) then
    alter table public."password_recovery_challenges"
      add constraint "password_recovery_challenges_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_reset_requests_pkey'
      and conrelid='public.password_reset_requests'::regclass
  ) then
    alter table public."password_reset_requests"
      add constraint "password_reset_requests_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_pkey'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='school_years_pkey'
      and conrelid='public.school_years'::regclass
  ) then
    alter table public."school_years"
      add constraint "school_years_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='section_advisers_pkey'
      and conrelid='public.section_advisers'::regclass
  ) then
    alter table public."section_advisers"
      add constraint "section_advisers_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='sections_pkey'
      and conrelid='public.sections'::regclass
  ) then
    alter table public."sections"
      add constraint "sections_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_pkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_pkey'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='subjects_pkey'
      and conrelid='public.subjects'::regclass
  ) then
    alter table public."subjects"
      add constraint "subjects_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_pkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_pkey" PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_student_id_school_year_id_attendance_date_key'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_student_id_school_year_id_attendance_date_key" UNIQUE (student_id, school_year_id, attendance_date);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='grade_levels_label_key'
      and conrelid='public.grade_levels'::regclass
  ) then
    alter table public."grade_levels"
      add constraint "grade_levels_label_key" UNIQUE (label);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='grade_levels_sort_order_key'
      and conrelid='public.grade_levels'::regclass
  ) then
    alter table public."grade_levels"
      add constraint "grade_levels_sort_order_key" UNIQUE (sort_order);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_email_key'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_email_key" UNIQUE (email);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_lrn_key'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_lrn_key" UNIQUE (lrn);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='school_years_name_key'
      and conrelid='public.school_years'::regclass
  ) then
    alter table public."school_years"
      add constraint "school_years_name_key" UNIQUE (name);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='sections_grade_level_name_key'
      and conrelid='public.sections'::regclass
  ) then
    alter table public."sections"
      add constraint "sections_grade_level_name_key" UNIQUE (grade_level, name);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='sections_id_grade_level_key'
      and conrelid='public.sections'::regclass
  ) then
    alter table public."sections"
      add constraint "sections_id_grade_level_key" UNIQUE (id, grade_level);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_student_id_school_year_id_key'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_student_id_school_year_id_key" UNIQUE (student_id, school_year_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_student_id_teacher_assignment_id_term_n_key'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_student_id_teacher_assignment_id_term_n_key" UNIQUE (student_id, teacher_assignment_id, term_no);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='subjects_grade_level_name_key'
      and conrelid='public.subjects'::regclass
  ) then
    alter table public."subjects"
      add constraint "subjects_grade_level_name_key" UNIQUE (grade_level, name);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='subjects_id_grade_level_key'
      and conrelid='public.subjects'::regclass
  ) then
    alter table public."subjects"
      add constraint "subjects_id_grade_level_key" UNIQUE (id, grade_level);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_school_year_id_section_id_subject_id_key'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_school_year_id_section_id_subject_id_key" UNIQUE (school_year_id, section_id, subject_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_announcement_type_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_announcement_type_check" CHECK (announcement_type = ANY (ARRAY['announcement'::text, 'memorandum'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_attachment_mime_type_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_attachment_mime_type_check" CHECK (attachment_mime_type IS NULL OR (attachment_mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text, 'image/webp'::text])));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_attachment_size_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_attachment_size_check" CHECK (attachment_size IS NULL OR attachment_size >= 1 AND attachment_size <= 4194304);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_audience_scope_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_audience_scope_check" CHECK (audience_scope = ANY (ARRAY['school'::text, 'grade'::text, 'section'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_body_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_body_check" CHECK (body IS NULL OR char_length(body) <= 10000);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_check" CHECK (audience_scope = 'school'::text AND target_grade IS NULL AND target_section_id IS NULL OR audience_scope = 'grade'::text AND target_grade IS NOT NULL AND target_section_id IS NULL OR audience_scope = 'section'::text AND target_section_id IS NOT NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_check1'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_check1" CHECK (attachment_path IS NULL AND attachment_name IS NULL AND attachment_mime_type IS NULL AND attachment_size IS NULL OR attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_mime_type IS NOT NULL AND attachment_size IS NOT NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_status_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_title_check'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_title_check" CHECK (char_length(title) >= 2 AND char_length(title) <= 180);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='class_schedules_check'
      and conrelid='public.class_schedules'::regclass
  ) then
    alter table public."class_schedules"
      add constraint "class_schedules_check" CHECK (start_time < end_time);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='class_schedules_day_of_week_check'
      and conrelid='public.class_schedules'::regclass
  ) then
    alter table public."class_schedules"
      add constraint "class_schedules_day_of_week_check" CHECK (day_of_week >= 1 AND day_of_week <= 7);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_note_check'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_note_check" CHECK (note IS NULL OR char_length(note) <= 300);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_status_check'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_status_check" CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='grade_levels_range'
      and conrelid='public.grade_levels'::regclass
  ) then
    alter table public."grade_levels"
      add constraint "grade_levels_range" CHECK (grade_level >= 7 AND grade_level <= 12);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_attachment_mime_type_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_attachment_mime_type_check" CHECK (attachment_mime_type IS NULL OR (attachment_mime_type = ANY (ARRAY['application/pdf'::text, 'application/msword'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text, 'application/vnd.ms-powerpoint'::text, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'::text, 'application/vnd.ms-excel'::text, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::text, 'image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'text/plain'::text])));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_attachment_size_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_attachment_size_check" CHECK (attachment_size IS NULL OR attachment_size >= 1 AND attachment_size <= 10485760);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_category_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_category_check" CHECK (category = ANY (ARRAY['lesson_material'::text, 'activity_sheet'::text, 'reviewer'::text, 'reference'::text, 'module'::text, 'video_link'::text, 'other'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_check" CHECK (resource_scope = 'school'::text AND teacher_assignment_id IS NULL OR resource_scope = 'class'::text AND teacher_assignment_id IS NOT NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_check1'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_check1" CHECK (external_url IS NOT NULL OR attachment_path IS NOT NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_check2'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_check2" CHECK (attachment_path IS NULL AND attachment_name IS NULL AND attachment_mime_type IS NULL AND attachment_size IS NULL OR attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_mime_type IS NOT NULL AND attachment_size IS NOT NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_description_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_description_check" CHECK (description IS NULL OR char_length(description) <= 10000);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_resource_scope_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_resource_scope_check" CHECK (resource_scope = ANY (ARRAY['school'::text, 'class'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_status_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_term_no_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_term_no_check" CHECK (term_no >= 1 AND term_no <= 3);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_title_check'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_title_check" CHECK (char_length(title) >= 2 AND char_length(title) <= 180);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_recovery_challenges_attempts_check'
      and conrelid='public.password_recovery_challenges'::regclass
  ) then
    alter table public."password_recovery_challenges"
      add constraint "password_recovery_challenges_attempts_check" CHECK (attempts >= 0 AND attempts <= 10);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_recovery_challenges_channel_check'
      and conrelid='public.password_recovery_challenges'::regclass
  ) then
    alter table public."password_recovery_challenges"
      add constraint "password_recovery_challenges_channel_check" CHECK (channel = ANY (ARRAY['email'::text, 'sms'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_reset_requests_status_check'
      and conrelid='public.password_reset_requests'::regclass
  ) then
    alter table public."password_reset_requests"
      add constraint "password_reset_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_account_status_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_account_status_check" CHECK (account_status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_grade_level_range'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_grade_level_range" CHECK (grade_level IS NULL OR grade_level >= 7 AND grade_level <= 12);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_requested_role_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_requested_role_check" CHECK (requested_role = ANY (ARRAY['student'::text, 'teacher'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_role_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_role_check" CHECK (role IS NULL OR (role = ANY (ARRAY['student'::text, 'teacher'::text, 'administrator'::text])));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_lrn_required'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "student_lrn_required" CHECK (requested_role = 'student'::text AND lrn IS NOT NULL AND lrn ~ '^[0-9]{12}$'::text OR requested_role = 'teacher'::text AND lrn IS NULL);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='school_years_year_order'
      and conrelid='public.school_years'::regclass
  ) then
    alter table public."school_years"
      add constraint "school_years_year_order" CHECK (end_year = (start_year + 1));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_enrollment_status_check'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_enrollment_status_check" CHECK (enrollment_status = ANY (ARRAY['active'::text, 'completed'::text, 'withdrawn'::text, 'transferred'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_initial_grade_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_initial_grade_check" CHECK (initial_grade >= 0::numeric AND initial_grade <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_pt_ps_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_pt_ps_check" CHECK (pt_ps IS NULL OR pt_ps >= 0::numeric AND pt_ps <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_st1_ps_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_st1_ps_check" CHECK (st1_ps IS NULL OR st1_ps >= 0::numeric AND st1_ps <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_st2_ps_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_st2_ps_check" CHECK (st2_ps IS NULL OR st2_ps >= 0::numeric AND st2_ps <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_status_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_term_exam_ps_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_term_exam_ps_check" CHECK (term_exam_ps IS NULL OR term_exam_ps >= 0::numeric AND term_exam_ps <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_term_grade_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_term_grade_check" CHECK (term_grade >= 0 AND term_grade <= 100);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_term_no_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_term_no_check" CHECK (term_no >= 1 AND term_no <= 3);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_ww_ps_check'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_ww_ps_check" CHECK (ww_ps IS NULL OR ww_ps >= 0::numeric AND ww_ps <= 100::numeric);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='subjects_grading_scheme_check'
      and conrelid='public.subjects'::regclass
  ) then
    alter table public."subjects"
      add constraint "subjects_grading_scheme_check" CHECK (grading_scheme = ANY (ARRAY['ks23_standard'::text, 'ks23_tle_mapeh'::text, 'shs_core_academic'::text, 'shs_field_arts_creative'::text, 'shs_research_design'::text, 'shs_work_immersion'::text]));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_created_by_fkey'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_school_year_id_fkey'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_target_grade_fkey'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_target_grade_fkey" FOREIGN KEY (target_grade) REFERENCES grade_levels(grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='announcements_target_section_id_fkey'
      and conrelid='public.announcements'::regclass
  ) then
    alter table public."announcements"
      add constraint "announcements_target_section_id_fkey" FOREIGN KEY (target_section_id) REFERENCES sections(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='class_schedules_created_by_fkey'
      and conrelid='public.class_schedules'::regclass
  ) then
    alter table public."class_schedules"
      add constraint "class_schedules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='class_schedules_teacher_assignment_id_fkey'
      and conrelid='public.class_schedules'::regclass
  ) then
    alter table public."class_schedules"
      add constraint "class_schedules_teacher_assignment_id_fkey" FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_recorded_by_fkey'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_school_year_id_fkey'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_section_id_fkey'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_section_id_fkey" FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_attendance_student_id_fkey'
      and conrelid='public.daily_attendance'::regclass
  ) then
    alter table public."daily_attendance"
      add constraint "daily_attendance_student_id_fkey" FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_created_by_fkey'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_school_year_id_fkey'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='learning_resources_teacher_assignment_id_fkey'
      and conrelid='public.learning_resources'::regclass
  ) then
    alter table public."learning_resources"
      add constraint "learning_resources_teacher_assignment_id_fkey" FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_recovery_challenges_user_id_fkey'
      and conrelid='public.password_recovery_challenges'::regclass
  ) then
    alter table public."password_recovery_challenges"
      add constraint "password_recovery_challenges_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_reset_requests_resolved_by_fkey'
      and conrelid='public.password_reset_requests'::regclass
  ) then
    alter table public."password_reset_requests"
      add constraint "password_reset_requests_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='password_reset_requests_user_id_fkey'
      and conrelid='public.password_reset_requests'::regclass
  ) then
    alter table public."password_reset_requests"
      add constraint "password_reset_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_id_fkey'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public."profiles"
      add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='section_advisers_assigned_by_fkey'
      and conrelid='public.section_advisers'::regclass
  ) then
    alter table public."section_advisers"
      add constraint "section_advisers_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='section_advisers_school_year_id_fkey'
      and conrelid='public.section_advisers'::regclass
  ) then
    alter table public."section_advisers"
      add constraint "section_advisers_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='section_advisers_section_id_fkey'
      and conrelid='public.section_advisers'::regclass
  ) then
    alter table public."section_advisers"
      add constraint "section_advisers_section_id_fkey" FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='section_advisers_teacher_id_fkey'
      and conrelid='public.section_advisers'::regclass
  ) then
    alter table public."section_advisers"
      add constraint "section_advisers_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='sections_grade_level_fkey'
      and conrelid='public.sections'::regclass
  ) then
    alter table public."sections"
      add constraint "sections_grade_level_fkey" FOREIGN KEY (grade_level) REFERENCES grade_levels(grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_created_by_fkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_grade_level_fkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_grade_level_fkey" FOREIGN KEY (grade_level) REFERENCES grade_levels(grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_school_year_id_fkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_section_id_grade_level_fkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_section_id_grade_level_fkey" FOREIGN KEY (section_id, grade_level) REFERENCES sections(id, grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_enrollments_student_id_fkey'
      and conrelid='public.student_enrollments'::regclass
  ) then
    alter table public."student_enrollments"
      add constraint "student_enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_encoded_by_fkey'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_encoded_by_fkey" FOREIGN KEY (encoded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_school_year_id_fkey'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_student_id_fkey'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_student_id_fkey" FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='student_term_grades_teacher_assignment_id_fkey'
      and conrelid='public.student_term_grades'::regclass
  ) then
    alter table public."student_term_grades"
      add constraint "student_term_grades_teacher_assignment_id_fkey" FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='subjects_grade_level_fkey'
      and conrelid='public.subjects'::regclass
  ) then
    alter table public."subjects"
      add constraint "subjects_grade_level_fkey" FOREIGN KEY (grade_level) REFERENCES grade_levels(grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_assigned_by_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_grade_level_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_grade_level_fkey" FOREIGN KEY (grade_level) REFERENCES grade_levels(grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_school_year_id_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_school_year_id_fkey" FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_section_id_grade_level_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_section_id_grade_level_fkey" FOREIGN KEY (section_id, grade_level) REFERENCES sections(id, grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_subject_id_grade_level_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_subject_id_grade_level_fkey" FOREIGN KEY (subject_id, grade_level) REFERENCES subjects(id, grade_level) ON UPDATE CASCADE ON DELETE RESTRICT;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='teacher_assignments_teacher_id_fkey'
      and conrelid='public.teacher_assignments'::regclass
  ) then
    alter table public."teacher_assignments"
      add constraint "teacher_assignments_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  end if;
end $$;

CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON public.announcements USING btree (created_by);
CREATE INDEX IF NOT EXISTS announcements_grade_idx ON public.announcements USING btree (target_grade) WHERE (target_grade IS NOT NULL);
CREATE INDEX IF NOT EXISTS announcements_school_year_id_idx ON public.announcements USING btree (school_year_id);
CREATE INDEX IF NOT EXISTS announcements_section_idx ON public.announcements USING btree (target_section_id) WHERE (target_section_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS announcements_status_published_idx ON public.announcements USING btree (status, published_at DESC);
CREATE INDEX IF NOT EXISTS class_schedules_assignment_idx ON public.class_schedules USING btree (teacher_assignment_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS class_schedules_created_by_idx ON public.class_schedules USING btree (created_by);
CREATE INDEX IF NOT EXISTS class_schedules_day_time_idx ON public.class_schedules USING btree (day_of_week, start_time, end_time) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS daily_attendance_recorded_by_idx ON public.daily_attendance USING btree (recorded_by);
CREATE INDEX IF NOT EXISTS daily_attendance_section_date_idx ON public.daily_attendance USING btree (school_year_id, section_id, attendance_date);
CREATE INDEX IF NOT EXISTS daily_attendance_section_id_idx ON public.daily_attendance USING btree (section_id);
CREATE INDEX IF NOT EXISTS daily_attendance_student_date_idx ON public.daily_attendance USING btree (student_id, school_year_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS learning_resources_assignment_idx ON public.learning_resources USING btree (teacher_assignment_id, term_no) WHERE (teacher_assignment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS learning_resources_creator_idx ON public.learning_resources USING btree (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_resources_school_year_id_idx ON public.learning_resources USING btree (school_year_id);
CREATE INDEX IF NOT EXISTS learning_resources_status_idx ON public.learning_resources USING btree (status, published_at DESC);
CREATE INDEX IF NOT EXISTS password_recovery_user_created_idx ON public.password_recovery_challenges USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_pending_per_user ON public.password_reset_requests USING btree (user_id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS password_reset_requests_resolved_by_idx ON public.password_reset_requests USING btree (resolved_by);
CREATE UNIQUE INDEX IF NOT EXISTS school_years_one_active ON public.school_years USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS section_advisers_assigned_by_idx ON public.section_advisers USING btree (assigned_by);
CREATE UNIQUE INDEX IF NOT EXISTS section_advisers_one_active ON public.section_advisers USING btree (school_year_id, section_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS section_advisers_section_id_idx ON public.section_advisers USING btree (section_id);
CREATE INDEX IF NOT EXISTS section_advisers_teacher_idx ON public.section_advisers USING btree (teacher_id, school_year_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS student_enrollments_created_by_idx ON public.student_enrollments USING btree (created_by);
CREATE INDEX IF NOT EXISTS student_enrollments_grade_level_idx ON public.student_enrollments USING btree (grade_level);
CREATE INDEX IF NOT EXISTS student_enrollments_school_year_id_idx ON public.student_enrollments USING btree (school_year_id);
CREATE INDEX IF NOT EXISTS student_enrollments_section_grade_idx ON public.student_enrollments USING btree (section_id, grade_level);
CREATE INDEX IF NOT EXISTS student_term_grades_assignment_term_idx ON public.student_term_grades USING btree (teacher_assignment_id, term_no);
CREATE INDEX IF NOT EXISTS student_term_grades_encoded_by_idx ON public.student_term_grades USING btree (encoded_by);
CREATE INDEX IF NOT EXISTS student_term_grades_school_year_id_idx ON public.student_term_grades USING btree (school_year_id);
CREATE INDEX IF NOT EXISTS student_term_grades_student_year_idx ON public.student_term_grades USING btree (student_id, school_year_id);
CREATE INDEX IF NOT EXISTS teacher_assignments_assigned_by_idx ON public.teacher_assignments USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS teacher_assignments_grade_level_idx ON public.teacher_assignments USING btree (grade_level);
CREATE INDEX IF NOT EXISTS teacher_assignments_section_grade_idx ON public.teacher_assignments USING btree (section_id, grade_level);
CREATE INDEX IF NOT EXISTS teacher_assignments_section_idx ON public.teacher_assignments USING btree (section_id, school_year_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS teacher_assignments_subject_grade_idx ON public.teacher_assignments USING btree (subject_id, grade_level);
CREATE INDEX IF NOT EXISTS teacher_assignments_teacher_idx ON public.teacher_assignments USING btree (teacher_id, school_year_id) WHERE (is_active = true);

CREATE OR REPLACE FUNCTION private.is_active_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'administrator'
      and account_status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_active_portal_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id=(select auth.uid())
        and p.account_status='active'
        and p.role is not null
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_is_section_adviser(p_school_year_id uuid, p_section_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.section_advisers sa on sa.teacher_id=p.id
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
        and sa.school_year_id=p_school_year_id
        and sa.section_id=p_section_id
        and sa.is_active=true
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_read_enrollment(target_school_year_id uuid, target_section_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta on ta.teacher_id=p.id
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
        and ta.school_year_id=target_school_year_id
        and ta.section_id=target_section_id
        and ta.is_active=true
    );
$function$;

CREATE OR REPLACE FUNCTION private.student_can_read_assignment(target_assignment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.student_enrollments e on e.student_id=p.id
      join public.teacher_assignments ta
        on ta.school_year_id=e.school_year_id
       and ta.section_id=e.section_id
      where p.id=(select auth.uid())
        and p.role='student'
        and p.account_status='active'
        and e.enrollment_status='active'
        and ta.id=target_assignment_id
        and ta.is_active=true
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_read_student_profile(p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles teacher
      join public.teacher_assignments ta on ta.teacher_id=teacher.id
      join public.student_enrollments e
        on e.school_year_id=ta.school_year_id
       and e.section_id=ta.section_id
      where teacher.id=(select auth.uid())
        and teacher.role='teacher'
        and teacher.account_status='active'
        and ta.is_active=true
        and e.enrollment_status='active'
        and e.student_id=p_student_id
    );
$function$;

CREATE OR REPLACE FUNCTION private.adviser_can_read_student_profile(p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles teacher
      join public.section_advisers sa on sa.teacher_id=teacher.id
      join public.student_enrollments e
        on e.school_year_id=sa.school_year_id
       and e.section_id=sa.section_id
      where teacher.id=(select auth.uid())
        and teacher.role='teacher'
        and teacher.account_status='active'
        and sa.is_active=true
        and e.enrollment_status='active'
        and e.student_id=p_student_id
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_manage_grade(p_assignment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta on ta.teacher_id=p.id
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
        and ta.id=p_assignment_id
        and ta.is_active=true
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_post_to_section(p_section_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
    )
    and (
      exists (
        select 1
        from public.teacher_assignments ta
        join public.school_years sy on sy.id=ta.school_year_id
        where ta.teacher_id=(select auth.uid())
          and ta.section_id=p_section_id
          and ta.is_active=true
          and sy.is_active=true
      )
      or exists (
        select 1
        from public.section_advisers sa
        join public.school_years sy on sy.id=sa.school_year_id
        where sa.teacher_id=(select auth.uid())
          and sa.section_id=p_section_id
          and sa.is_active=true
          and sy.is_active=true
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_manage_resource_assignment(p_assignment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta on ta.teacher_id=p.id
      join public.school_years sy on sy.id=ta.school_year_id
      where p.id=(select auth.uid())
        and p.role='teacher'
        and p.account_status='active'
        and ta.id=p_assignment_id
        and ta.is_active=true
        and sy.is_active=true
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_announcement(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and (
      private.is_active_admin()
      or exists (
        select 1
        from public.announcements a
        join public.profiles viewer on viewer.id=(select auth.uid())
        where a.id=p_id
          and viewer.account_status='active'
          and (
            a.created_by=(select auth.uid())
            or (
              a.status='published'
              and (a.expires_at is null or a.expires_at > now())
              and (
                a.audience_scope='school'
                or (
                  a.audience_scope='grade'
                  and (
                    (
                      viewer.role='student'
                      and exists (
                        select 1 from public.student_enrollments e
                        where e.student_id=viewer.id
                          and e.school_year_id=a.school_year_id
                          and e.grade_level=a.target_grade
                          and e.enrollment_status='active'
                      )
                    )
                    or (
                      viewer.role='teacher'
                      and exists (
                        select 1 from public.teacher_assignments ta
                        where ta.teacher_id=viewer.id
                          and ta.school_year_id=a.school_year_id
                          and ta.grade_level=a.target_grade
                          and ta.is_active=true
                      )
                    )
                  )
                )
                or (
                  a.audience_scope='section'
                  and (
                    (
                      viewer.role='student'
                      and exists (
                        select 1 from public.student_enrollments e
                        where e.student_id=viewer.id
                          and e.school_year_id=a.school_year_id
                          and e.section_id=a.target_section_id
                          and e.enrollment_status='active'
                      )
                    )
                    or (
                      viewer.role='teacher'
                      and (
                        exists (
                          select 1 from public.teacher_assignments ta
                          where ta.teacher_id=viewer.id
                            and ta.school_year_id=a.school_year_id
                            and ta.section_id=a.target_section_id
                            and ta.is_active=true
                        )
                        or exists (
                          select 1 from public.section_advisers sa
                          where sa.teacher_id=viewer.id
                            and sa.school_year_id=a.school_year_id
                            and sa.section_id=a.target_section_id
                            and sa.is_active=true
                        )
                      )
                    )
                  )
                )
              )
            )
          )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_announcement_file(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.announcements a
    where a.attachment_path=p_path
      and private.can_read_announcement(a.id)
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_learning_resource(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and (
      private.is_active_admin()
      or exists (
        select 1
        from public.learning_resources r
        join public.profiles viewer on viewer.id=(select auth.uid())
        left join public.teacher_assignments ta on ta.id=r.teacher_assignment_id
        where r.id=p_id
          and viewer.account_status='active'
          and (
            r.created_by=(select auth.uid())
            or (
              r.status='published'
              and (
                (
                  r.resource_scope='school'
                  and viewer.role in ('student','teacher')
                )
                or (
                  r.resource_scope='class'
                  and ta.id is not null
                  and ta.school_year_id=r.school_year_id
                  and (
                    (
                      viewer.role='student'
                      and exists (
                        select 1
                        from public.student_enrollments e
                        where e.student_id=viewer.id
                          and e.school_year_id=ta.school_year_id
                          and e.section_id=ta.section_id
                          and e.enrollment_status='active'
                      )
                    )
                    or (
                      viewer.role='teacher'
                      and ta.teacher_id=viewer.id
                      and ta.is_active=true
                    )
                  )
                )
              )
            )
          )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_learning_resource_file(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.learning_resources r
    where r.attachment_path=p_path
      and private.can_read_learning_resource(r.id)
  );
$function$;

CREATE OR REPLACE FUNCTION private.deactivate_assignments_for_section()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.is_active = true and new.is_active = false then
    update public.teacher_assignments
    set is_active = false, updated_at = now()
    where section_id = new.id and is_active = true;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.deactivate_assignments_for_subject()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.is_active = true and new.is_active = false then
    update public.teacher_assignments
    set is_active = false, updated_at = now()
    where subject_id = new.id and is_active = true;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.deactivate_schedules_for_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.is_active=true and new.is_active=false then
    update public.class_schedules
    set is_active=false,updated_at=now()
    where teacher_assignment_id=new.id and is_active=true;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enroll_student_on_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  active_year uuid;
  matched_section uuid;
begin
  if new.role = 'student'
     and new.account_status = 'active'
     and new.grade_level between 7 and 12
     and (
       tg_op = 'INSERT'
       or old.role is distinct from new.role
       or old.account_status is distinct from new.account_status
     ) then

    select id into active_year
    from public.school_years
    where is_active = true
    limit 1;

    if active_year is not null then
      select id into matched_section
      from public.sections
      where grade_level = new.grade_level
        and name = new.section
        and is_active = true
      limit 1;

      insert into public.student_enrollments (
        student_id, school_year_id, grade_level, section_id, created_by
      )
      values (
        new.id, active_year, new.grade_level, matched_section, (select auth.uid())
      )
      on conflict (student_id, school_year_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.grade_descriptor(p_grade smallint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_grade >= 90 then 'Advancing / Namumukod-tangi'
    when p_grade >= 80 then 'Benchmarking / Napamamalas'
    when p_grade >= 75 then 'Connecting / Natutungo'
    when p_grade >= 65 then 'Developing / Napauunlad'
    else 'Emerging / Nagsisimula'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  requested text;
  new_lrn text;
  phone text;
  display_name text;
  new_grade smallint;
  new_section text;
begin
  requested := coalesce(new.raw_user_meta_data ->> 'requested_role', 'student');
  if requested not in ('student','teacher') then
    requested := 'student';
  end if;

  new_lrn := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lrn', '')), '');
  phone := trim(coalesce(new.raw_user_meta_data ->> 'recovery_phone', ''));
  display_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if requested = 'student' then
    begin
      new_grade := nullif(trim(coalesce(new.raw_user_meta_data ->> 'grade_level', '')), '')::smallint;
    exception when others then
      new_grade := null;
    end;

    if new_grade not between 7 and 12 then
      new_grade := null;
    end if;

    new_section := nullif(trim(coalesce(new.raw_user_meta_data ->> 'section', '')), '');

    if new_section is not null and not exists (
      select 1
      from public.sections
      where grade_level = new_grade
        and name = new_section
        and is_active = true
    ) then
      new_section := null;
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
    new.id,
    display_name,
    lower(coalesce(new.email, '')),
    phone,
    new_lrn,
    requested,
    new_grade,
    new_section
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.transmute_term_grade(p_initial numeric, p_start_year smallint)
 RETURNS smallint
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  g numeric := round(greatest(0, least(100, p_initial)), 2);
begin
  if p_start_year = 2026 then
    return case
      when g >= 99.50 then 100
      when g >= 98.32 then 99
      when g >= 97.14 then 98
      when g >= 95.96 then 97
      when g >= 94.78 then 96
      when g >= 93.60 then 95
      when g >= 92.42 then 94
      when g >= 91.24 then 93
      when g >= 90.06 then 92
      when g >= 88.88 then 91
      when g >= 87.70 then 90
      when g >= 86.52 then 89
      when g >= 85.34 then 88
      when g >= 84.16 then 87
      when g >= 82.98 then 86
      when g >= 81.80 then 85
      when g >= 80.62 then 84
      when g >= 79.44 then 83
      when g >= 78.26 then 82
      when g >= 77.08 then 81
      when g >= 75.90 then 80
      when g >= 74.72 then 79
      when g >= 73.54 then 78
      when g >= 72.36 then 77
      when g >= 71.18 then 76
      when g >= 70.00 then 75
      when g >= 65.34 then 74
      when g >= 60.67 then 73
      when g >= 56.01 then 72
      when g >= 51.34 then 71
      when g >= 46.67 then 70
      when g >= 42.01 then 69
      when g >= 37.34 then 68
      when g >= 32.68 then 67
      when g >= 28.01 then 66
      when g >= 23.35 then 65
      when g >= 18.68 then 64
      when g >= 14.01 then 63
      when g >= 9.35 then 62
      when g >= 4.68 then 61
      else 60
    end;
  end if;

  return greatest(60, least(100, round(g)))::smallint;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_class_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  assignment_row public.teacher_assignments%rowtype;
  normalized_room text;
begin
  if new.start_time >= new.end_time then
    raise exception 'schedule end time must be later than start time';
  end if;

  select * into assignment_row
  from public.teacher_assignments
  where id=new.teacher_assignment_id;

  if assignment_row.id is null or assignment_row.is_active is not true then
    raise exception 'teacher assignment must be active';
  end if;

  normalized_room := nullif(lower(trim(coalesce(new.room,''))), '');

  if new.is_active and exists (
    select 1
    from public.class_schedules cs
    join public.teacher_assignments other_ta
      on other_ta.id=cs.teacher_assignment_id
    where cs.id is distinct from new.id
      and cs.is_active=true
      and other_ta.is_active=true
      and other_ta.school_year_id=assignment_row.school_year_id
      and cs.day_of_week=new.day_of_week
      and cs.start_time < new.end_time
      and cs.end_time > new.start_time
      and (
        other_ta.teacher_id=assignment_row.teacher_id
        or other_ta.section_id=assignment_row.section_id
      )
  ) then
    raise exception 'schedule conflicts with an existing teacher or section schedule';
  end if;

  if new.is_active
     and normalized_room is not null
     and exists (
       select 1
       from public.class_schedules cs
       join public.teacher_assignments other_ta
         on other_ta.id=cs.teacher_assignment_id
       where cs.id is distinct from new.id
         and cs.is_active=true
         and other_ta.is_active=true
         and other_ta.school_year_id=assignment_row.school_year_id
         and cs.day_of_week=new.day_of_week
         and cs.start_time < new.end_time
         and cs.end_time > new.start_time
         and nullif(lower(trim(coalesce(cs.room,''))), '')=normalized_room
     ) then
    raise exception 'schedule conflicts with an existing room schedule';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_daily_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.student_enrollments e
    where e.student_id=new.student_id
      and e.school_year_id=new.school_year_id
      and e.section_id=new.section_id
      and e.enrollment_status='active'
  ) then
    raise exception 'student is not actively enrolled in this section';
  end if;

  if new.recorded_by is null then
    new.recorded_by := (select auth.uid());
  end if;

  if new.note is not null then
    new.note := nullif(trim(new.note), '');
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_direct_term_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ta public.teacher_assignments%rowtype;
begin
  select * into ta
  from public.teacher_assignments
  where id=new.teacher_assignment_id;

  if ta.id is null or ta.is_active is not true then
    raise exception 'teacher assignment must be active';
  end if;

  if not exists (
    select 1
    from public.student_enrollments e
    where e.student_id=new.student_id
      and e.school_year_id=ta.school_year_id
      and e.section_id=ta.section_id
      and e.enrollment_status='active'
  ) then
    raise exception 'student is not actively enrolled in this assigned section';
  end if;

  if new.term_grade is null
     or new.term_grade < 0
     or new.term_grade > 100 then
    raise exception 'term grade must be between 0 and 100';
  end if;

  new.school_year_id := ta.school_year_id;
  new.initial_grade := null;
  new.ww_ps := null;
  new.pt_ps := null;
  new.st1_ps := null;
  new.st2_ps := null;
  new.term_exam_ps := null;

  if new.encoded_by is null then
    new.encoded_by := (select auth.uid());
  end if;

  if new.status='published' then
    if new.published_at is null then new.published_at := now(); end if;
  else
    new.published_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_section_adviser()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.profiles
    where id=new.teacher_id
      and role='teacher'
      and account_status='active'
  ) then
    raise exception 'adviser must be an active teacher account';
  end if;

  if new.is_active and not exists (
    select 1
    from public.sections
    where id=new.section_id
      and is_active=true
  ) then
    raise exception 'section must be active';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_teacher_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.teacher_id
      and role = 'teacher'
      and account_status = 'active'
  ) then
    raise exception 'teacher must be an active teacher account';
  end if;

  if new.is_active and not exists (
    select 1
    from public.sections
    where id = new.section_id
      and grade_level = new.grade_level
      and is_active = true
  ) then
    raise exception 'section must be active and match grade level';
  end if;

  if new.is_active and not exists (
    select 1
    from public.subjects
    where id = new.subject_id
      and grade_level = new.grade_level
      and is_active = true
  ) then
    raise exception 'subject must be active and match grade level';
  end if;

  return new;
end;
$function$;

revoke all on function private.is_active_admin() from public, anon, authenticated;
grant execute on function private.is_active_admin() to authenticated;
revoke all on function private.is_active_portal_user() from public, anon, authenticated;
grant execute on function private.is_active_portal_user() to authenticated;
revoke all on function private.teacher_is_section_adviser(uuid,uuid) from public, anon, authenticated;
grant execute on function private.teacher_is_section_adviser(uuid,uuid) to authenticated;
revoke all on function private.teacher_can_read_enrollment(uuid,uuid) from public, anon, authenticated;
grant execute on function private.teacher_can_read_enrollment(uuid,uuid) to authenticated;
revoke all on function private.student_can_read_assignment(uuid) from public, anon, authenticated;
grant execute on function private.student_can_read_assignment(uuid) to authenticated;
revoke all on function private.teacher_can_read_student_profile(uuid) from public, anon, authenticated;
grant execute on function private.teacher_can_read_student_profile(uuid) to authenticated;
revoke all on function private.adviser_can_read_student_profile(uuid) from public, anon, authenticated;
grant execute on function private.adviser_can_read_student_profile(uuid) to authenticated;
revoke all on function private.teacher_can_manage_grade(uuid) from public, anon, authenticated;
grant execute on function private.teacher_can_manage_grade(uuid) to authenticated;
revoke all on function private.teacher_can_post_to_section(uuid) from public, anon, authenticated;
grant execute on function private.teacher_can_post_to_section(uuid) to authenticated;
revoke all on function private.teacher_can_manage_resource_assignment(uuid) from public, anon, authenticated;
grant execute on function private.teacher_can_manage_resource_assignment(uuid) to authenticated;
revoke all on function private.can_read_announcement(uuid) from public, anon, authenticated;
grant execute on function private.can_read_announcement(uuid) to authenticated;
revoke all on function private.can_read_announcement_file(text) from public, anon, authenticated;
grant execute on function private.can_read_announcement_file(text) to authenticated;
revoke all on function private.can_read_learning_resource(uuid) from public, anon, authenticated;
grant execute on function private.can_read_learning_resource(uuid) to authenticated;
revoke all on function private.can_read_learning_resource_file(text) from public, anon, authenticated;
grant execute on function private.can_read_learning_resource_file(text) to authenticated;
revoke all on function private.deactivate_assignments_for_section() from public, anon, authenticated;
revoke all on function private.deactivate_assignments_for_subject() from public, anon, authenticated;
revoke all on function private.deactivate_schedules_for_assignment() from public, anon, authenticated;
revoke all on function private.enroll_student_on_activation() from public, anon, authenticated;
revoke all on function private.grade_descriptor(smallint) from public, anon, authenticated;
grant execute on function private.grade_descriptor(smallint) to anon;
grant execute on function private.grade_descriptor(smallint) to authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.transmute_term_grade(numeric,smallint) from public, anon, authenticated;
grant execute on function private.transmute_term_grade(numeric,smallint) to anon;
grant execute on function private.transmute_term_grade(numeric,smallint) to authenticated;
revoke all on function private.validate_class_schedule() from public, anon, authenticated;
revoke all on function private.validate_daily_attendance() from public, anon, authenticated;
revoke all on function private.validate_direct_term_grade() from public, anon, authenticated;
revoke all on function private.validate_section_adviser() from public, anon, authenticated;
revoke all on function private.validate_teacher_assignment() from public, anon, authenticated;

drop trigger if exists "on_auth_user_created_profile" on auth."users";
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

drop trigger if exists "validate_class_schedule" on public."class_schedules";
CREATE TRIGGER validate_class_schedule BEFORE INSERT OR UPDATE OF teacher_assignment_id, day_of_week, start_time, end_time, room, is_active ON class_schedules FOR EACH ROW EXECUTE FUNCTION private.validate_class_schedule();

drop trigger if exists "validate_daily_attendance" on public."daily_attendance";
CREATE TRIGGER validate_daily_attendance BEFORE INSERT OR UPDATE OF student_id, school_year_id, section_id, attendance_date, status, note, recorded_by ON daily_attendance FOR EACH ROW EXECUTE FUNCTION private.validate_daily_attendance();

drop trigger if exists "enroll_student_on_activation" on public."profiles";
CREATE TRIGGER enroll_student_on_activation AFTER INSERT OR UPDATE OF role, account_status ON profiles FOR EACH ROW EXECUTE FUNCTION private.enroll_student_on_activation();

drop trigger if exists "validate_section_adviser" on public."section_advisers";
CREATE TRIGGER validate_section_adviser BEFORE INSERT OR UPDATE OF teacher_id, section_id, is_active ON section_advisers FOR EACH ROW EXECUTE FUNCTION private.validate_section_adviser();

drop trigger if exists "deactivate_assignments_for_section" on public."sections";
CREATE TRIGGER deactivate_assignments_for_section AFTER UPDATE OF is_active ON sections FOR EACH ROW EXECUTE FUNCTION private.deactivate_assignments_for_section();

drop trigger if exists "validate_direct_term_grade" on public."student_term_grades";
CREATE TRIGGER validate_direct_term_grade BEFORE INSERT OR UPDATE OF student_id, teacher_assignment_id, term_no, term_grade, status ON student_term_grades FOR EACH ROW EXECUTE FUNCTION private.validate_direct_term_grade();

drop trigger if exists "deactivate_assignments_for_subject" on public."subjects";
CREATE TRIGGER deactivate_assignments_for_subject AFTER UPDATE OF is_active ON subjects FOR EACH ROW EXECUTE FUNCTION private.deactivate_assignments_for_subject();

drop trigger if exists "deactivate_schedules_for_assignment" on public."teacher_assignments";
CREATE TRIGGER deactivate_schedules_for_assignment AFTER UPDATE OF is_active ON teacher_assignments FOR EACH ROW EXECUTE FUNCTION private.deactivate_schedules_for_assignment();

drop trigger if exists "validate_teacher_assignment" on public."teacher_assignments";
CREATE TRIGGER validate_teacher_assignment BEFORE INSERT OR UPDATE OF teacher_id, grade_level, section_id, subject_id, is_active ON teacher_assignments FOR EACH ROW EXECUTE FUNCTION private.validate_teacher_assignment();

revoke all on table public."announcements" from anon, authenticated;
revoke all on table public."class_schedules" from anon, authenticated;
revoke all on table public."daily_attendance" from anon, authenticated;
revoke all on table public."grade_levels" from anon, authenticated;
revoke all on table public."learning_resources" from anon, authenticated;
revoke all on table public."password_recovery_challenges" from anon, authenticated;
revoke all on table public."password_reset_requests" from anon, authenticated;
revoke all on table public."profiles" from anon, authenticated;
revoke all on table public."school_years" from anon, authenticated;
revoke all on table public."section_advisers" from anon, authenticated;
revoke all on table public."sections" from anon, authenticated;
revoke all on table public."student_enrollments" from anon, authenticated;
revoke all on table public."student_term_grades" from anon, authenticated;
revoke all on table public."subjects" from anon, authenticated;
revoke all on table public."teacher_assignments" from anon, authenticated;
grant delete, insert, select, update on table public."announcements" to authenticated;
grant delete, insert, select, update on table public."class_schedules" to authenticated;
grant delete, insert, select, update on table public."daily_attendance" to authenticated;
grant select on table public."grade_levels" to anon;
grant delete, insert, select, update on table public."grade_levels" to authenticated;
grant delete, insert, select, update on table public."learning_resources" to authenticated;
grant select on table public."profiles" to authenticated;
grant delete, insert, select, update on table public."school_years" to authenticated;
grant delete, insert, select, update on table public."section_advisers" to authenticated;
grant select on table public."sections" to anon;
grant delete, insert, select, update on table public."sections" to authenticated;
grant delete, insert, select, update on table public."student_enrollments" to authenticated;
grant delete, insert, select, update on table public."student_term_grades" to authenticated;
grant delete, insert, select, update on table public."subjects" to authenticated;
grant delete, insert, select, update on table public."teacher_assignments" to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('announcement-files','announcement-files',false,4194304,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  name=excluded.name,
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('learning-resources','learning-resources',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp','text/plain'])
on conflict (id) do update set
  name=excluded.name,
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Admins manage announcements" on public."announcements";
create policy "Admins manage announcements" on public."announcements" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Teachers create section announcements" on public."announcements";
create policy "Teachers create section announcements" on public."announcements" as permissive for insert to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (announcement_type = 'announcement'::text) AND (audience_scope = 'section'::text) AND (target_section_id IS NOT NULL) AND ( SELECT private.teacher_can_post_to_section(announcements.target_section_id) AS teacher_can_post_to_section) AND (attachment_path IS NULL)));

drop policy if exists "Teachers update own section announcements" on public."announcements";
create policy "Teachers update own section announcements" on public."announcements" as permissive for update to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (announcement_type = 'announcement'::text) AND (audience_scope = 'section'::text) AND (target_section_id IS NOT NULL) AND ( SELECT private.teacher_can_post_to_section(announcements.target_section_id) AS teacher_can_post_to_section))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND (announcement_type = 'announcement'::text) AND (audience_scope = 'section'::text) AND (target_section_id IS NOT NULL) AND ( SELECT private.teacher_can_post_to_section(announcements.target_section_id) AS teacher_can_post_to_section) AND (attachment_path IS NULL)));

drop policy if exists "Users read relevant announcements" on public."announcements";
create policy "Users read relevant announcements" on public."announcements" as permissive for select to authenticated using (( SELECT private.can_read_announcement(announcements.id) AS can_read_announcement));

drop policy if exists "Admins manage class schedules" on public."class_schedules";
create policy "Admins manage class schedules" on public."class_schedules" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Students read own section schedules" on public."class_schedules";
create policy "Students read own section schedules" on public."class_schedules" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM (teacher_assignments ta
     JOIN student_enrollments e ON (((e.school_year_id = ta.school_year_id) AND (e.section_id = ta.section_id))))
  WHERE ((ta.id = class_schedules.teacher_assignment_id) AND (e.student_id = ( SELECT auth.uid() AS uid)) AND (e.enrollment_status = 'active'::text) AND (ta.is_active = true)))));

drop policy if exists "Teachers read own class schedules" on public."class_schedules";
create policy "Teachers read own class schedules" on public."class_schedules" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM teacher_assignments ta
  WHERE ((ta.id = class_schedules.teacher_assignment_id) AND (ta.teacher_id = ( SELECT auth.uid() AS uid)) AND (ta.is_active = true)))));

drop policy if exists "Admins manage attendance" on public."daily_attendance";
create policy "Admins manage attendance" on public."daily_attendance" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Advisers insert section attendance" on public."daily_attendance";
create policy "Advisers insert section attendance" on public."daily_attendance" as permissive for insert to authenticated with check ((( SELECT private.teacher_is_section_adviser(daily_attendance.school_year_id, daily_attendance.section_id) AS teacher_is_section_adviser) AND (recorded_by = ( SELECT auth.uid() AS uid))));

drop policy if exists "Advisers read section attendance" on public."daily_attendance";
create policy "Advisers read section attendance" on public."daily_attendance" as permissive for select to authenticated using ((( SELECT private.teacher_is_section_adviser(daily_attendance.school_year_id, daily_attendance.section_id) AS teacher_is_section_adviser) OR ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Advisers update section attendance" on public."daily_attendance";
create policy "Advisers update section attendance" on public."daily_attendance" as permissive for update to authenticated using (( SELECT private.teacher_is_section_adviser(daily_attendance.school_year_id, daily_attendance.section_id) AS teacher_is_section_adviser)) with check ((( SELECT private.teacher_is_section_adviser(daily_attendance.school_year_id, daily_attendance.section_id) AS teacher_is_section_adviser) AND (recorded_by = ( SELECT auth.uid() AS uid))));

drop policy if exists "Students read own attendance" on public."daily_attendance";
create policy "Students read own attendance" on public."daily_attendance" as permissive for select to authenticated using ((student_id = ( SELECT auth.uid() AS uid)));

drop policy if exists "Admins manage grade levels" on public."grade_levels";
create policy "Admins manage grade levels" on public."grade_levels" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Authenticated can read grade levels" on public."grade_levels";
create policy "Authenticated can read grade levels" on public."grade_levels" as permissive for select to authenticated using (true);

drop policy if exists "Public can read grade levels" on public."grade_levels";
create policy "Public can read grade levels" on public."grade_levels" as permissive for select to anon using (true);

drop policy if exists "Admins manage learning resources" on public."learning_resources";
create policy "Admins manage learning resources" on public."learning_resources" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Teachers create assigned class resources" on public."learning_resources";
create policy "Teachers create assigned class resources" on public."learning_resources" as permissive for insert to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (resource_scope = 'class'::text) AND (teacher_assignment_id IS NOT NULL) AND ( SELECT private.teacher_can_manage_resource_assignment(learning_resources.teacher_assignment_id) AS teacher_can_manage_resource_assignment)));

drop policy if exists "Teachers delete own assigned class resources" on public."learning_resources";
create policy "Teachers delete own assigned class resources" on public."learning_resources" as permissive for delete to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (resource_scope = 'class'::text) AND (teacher_assignment_id IS NOT NULL) AND ( SELECT private.teacher_can_manage_resource_assignment(learning_resources.teacher_assignment_id) AS teacher_can_manage_resource_assignment)));

drop policy if exists "Teachers update own assigned class resources" on public."learning_resources";
create policy "Teachers update own assigned class resources" on public."learning_resources" as permissive for update to authenticated using (((created_by = ( SELECT auth.uid() AS uid)) AND (resource_scope = 'class'::text) AND (teacher_assignment_id IS NOT NULL) AND ( SELECT private.teacher_can_manage_resource_assignment(learning_resources.teacher_assignment_id) AS teacher_can_manage_resource_assignment))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND (resource_scope = 'class'::text) AND (teacher_assignment_id IS NOT NULL) AND ( SELECT private.teacher_can_manage_resource_assignment(learning_resources.teacher_assignment_id) AS teacher_can_manage_resource_assignment)));

drop policy if exists "Users read relevant learning resources" on public."learning_resources";
create policy "Users read relevant learning resources" on public."learning_resources" as permissive for select to authenticated using (( SELECT private.can_read_learning_resource(learning_resources.id) AS can_read_learning_resource));

drop policy if exists "Admins can approve profiles" on public."profiles";
create policy "Admins can approve profiles" on public."profiles" as permissive for update to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Admins can read all profiles" on public."profiles";
create policy "Admins can read all profiles" on public."profiles" as permissive for select to authenticated using (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Advisers read section student profiles" on public."profiles";
create policy "Advisers read section student profiles" on public."profiles" as permissive for select to authenticated using (( SELECT private.adviser_can_read_student_profile(profiles.id) AS adviser_can_read_student_profile));

drop policy if exists "Teachers read assigned student profiles" on public."profiles";
create policy "Teachers read assigned student profiles" on public."profiles" as permissive for select to authenticated using (( SELECT private.teacher_can_read_student_profile(profiles.id) AS teacher_can_read_student_profile));

drop policy if exists "Users can read their own profile" on public."profiles";
create policy "Users can read their own profile" on public."profiles" as permissive for select to authenticated using ((( SELECT auth.uid() AS uid) = id));

drop policy if exists "Admins manage school years" on public."school_years";
create policy "Admins manage school years" on public."school_years" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Authenticated can read school years" on public."school_years";
create policy "Authenticated can read school years" on public."school_years" as permissive for select to authenticated using (true);

drop policy if exists "Admins manage section advisers" on public."section_advisers";
create policy "Admins manage section advisers" on public."section_advisers" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Teachers read own adviser assignments" on public."section_advisers";
create policy "Teachers read own adviser assignments" on public."section_advisers" as permissive for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Admins manage sections" on public."sections";
create policy "Admins manage sections" on public."sections" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Authenticated can read sections" on public."sections";
create policy "Authenticated can read sections" on public."sections" as permissive for select to authenticated using (true);

drop policy if exists "Public can read active sections" on public."sections";
create policy "Public can read active sections" on public."sections" as permissive for select to anon using ((is_active = true));

drop policy if exists "Admins manage enrollments" on public."student_enrollments";
create policy "Admins manage enrollments" on public."student_enrollments" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Advisers read section enrollments" on public."student_enrollments";
create policy "Advisers read section enrollments" on public."student_enrollments" as permissive for select to authenticated using (((section_id IS NOT NULL) AND ( SELECT private.teacher_is_section_adviser(student_enrollments.school_year_id, student_enrollments.section_id) AS teacher_is_section_adviser)));

drop policy if exists "Students read own enrollments" on public."student_enrollments";
create policy "Students read own enrollments" on public."student_enrollments" as permissive for select to authenticated using (((student_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Teachers read assigned student enrollments" on public."student_enrollments";
create policy "Teachers read assigned student enrollments" on public."student_enrollments" as permissive for select to authenticated using (( SELECT private.teacher_can_read_enrollment(student_enrollments.school_year_id, student_enrollments.section_id) AS teacher_can_read_enrollment));

drop policy if exists "Admins manage grades" on public."student_term_grades";
create policy "Admins manage grades" on public."student_term_grades" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Students read own published grades" on public."student_term_grades";
create policy "Students read own published grades" on public."student_term_grades" as permissive for select to authenticated using (((student_id = ( SELECT auth.uid() AS uid)) AND (status = 'published'::text)));

drop policy if exists "Teachers insert own grade records" on public."student_term_grades";
create policy "Teachers insert own grade records" on public."student_term_grades" as permissive for insert to authenticated with check ((( SELECT private.teacher_can_manage_grade(student_term_grades.teacher_assignment_id) AS teacher_can_manage_grade) AND (encoded_by = ( SELECT auth.uid() AS uid))));

drop policy if exists "Teachers read own grade records" on public."student_term_grades";
create policy "Teachers read own grade records" on public."student_term_grades" as permissive for select to authenticated using (( SELECT private.teacher_can_manage_grade(student_term_grades.teacher_assignment_id) AS teacher_can_manage_grade));

drop policy if exists "Teachers update own grade records" on public."student_term_grades";
create policy "Teachers update own grade records" on public."student_term_grades" as permissive for update to authenticated using (( SELECT private.teacher_can_manage_grade(student_term_grades.teacher_assignment_id) AS teacher_can_manage_grade)) with check ((( SELECT private.teacher_can_manage_grade(student_term_grades.teacher_assignment_id) AS teacher_can_manage_grade) AND (encoded_by = ( SELECT auth.uid() AS uid))));

drop policy if exists "Admins manage subjects" on public."subjects";
create policy "Admins manage subjects" on public."subjects" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Authenticated can read subjects" on public."subjects";
create policy "Authenticated can read subjects" on public."subjects" as permissive for select to authenticated using (true);

drop policy if exists "Admins manage teacher assignments" on public."teacher_assignments";
create policy "Admins manage teacher assignments" on public."teacher_assignments" as permissive for all to authenticated using (( SELECT private.is_active_admin() AS is_active_admin)) with check (( SELECT private.is_active_admin() AS is_active_admin));

drop policy if exists "Students read own section assignments" on public."teacher_assignments";
create policy "Students read own section assignments" on public."teacher_assignments" as permissive for select to authenticated using (( SELECT private.student_can_read_assignment(teacher_assignments.id) AS student_can_read_assignment));

drop policy if exists "Teachers read own assignments" on public."teacher_assignments";
create policy "Teachers read own assignments" on public."teacher_assignments" as permissive for select to authenticated using (((teacher_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Admins delete announcement files" on storage."objects";
create policy "Admins delete announcement files" on storage."objects" as permissive for delete to authenticated using (((bucket_id = 'announcement-files'::text) AND ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Admins update announcement files" on storage."objects";
create policy "Admins update announcement files" on storage."objects" as permissive for update to authenticated using (((bucket_id = 'announcement-files'::text) AND ( SELECT private.is_active_admin() AS is_active_admin))) with check (((bucket_id = 'announcement-files'::text) AND ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Admins upload announcement files" on storage."objects";
create policy "Admins upload announcement files" on storage."objects" as permissive for insert to authenticated with check (((bucket_id = 'announcement-files'::text) AND ( SELECT private.is_active_admin() AS is_active_admin)));

drop policy if exists "Authorized users delete learning resource files" on storage."objects";
create policy "Authorized users delete learning resource files" on storage."objects" as permissive for delete to authenticated using (((bucket_id = 'learning-resources'::text) AND (( SELECT private.is_active_admin() AS is_active_admin) OR (split_part(name, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text))));

drop policy if exists "Authorized users update learning resource files" on storage."objects";
create policy "Authorized users update learning resource files" on storage."objects" as permissive for update to authenticated using (((bucket_id = 'learning-resources'::text) AND (( SELECT private.is_active_admin() AS is_active_admin) OR (split_part(name, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text)))) with check (((bucket_id = 'learning-resources'::text) AND (( SELECT private.is_active_admin() AS is_active_admin) OR (split_part(name, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text))));

drop policy if exists "Authorized users upload learning resource files" on storage."objects";
create policy "Authorized users upload learning resource files" on storage."objects" as permissive for insert to authenticated with check (((bucket_id = 'learning-resources'::text) AND (( SELECT private.is_active_admin() AS is_active_admin) OR ((split_part(name, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'teacher'::text) AND (p.account_status = 'active'::text))))))));

drop policy if exists "Relevant users read announcement files" on storage."objects";
create policy "Relevant users read announcement files" on storage."objects" as permissive for select to authenticated using (((bucket_id = 'announcement-files'::text) AND ( SELECT private.can_read_announcement_file(objects.name) AS can_read_announcement_file)));

drop policy if exists "Relevant users read learning resource files" on storage."objects";
create policy "Relevant users read learning resource files" on storage."objects" as permissive for select to authenticated using (((bucket_id = 'learning-resources'::text) AND ( SELECT private.can_read_learning_resource_file(objects.name) AS can_read_learning_resource_file)));

