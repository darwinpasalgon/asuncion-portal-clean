create or replace function private.teacher_can_manage_resource_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.teacher_assignments ta
        on ta.id = p_assignment_id
      join public.school_years sy
        on sy.id = ta.school_year_id
      where p.id = (select auth.uid())
        and p.role = 'teacher'
        and p.account_status = 'active'
        and ta.is_active = true
        and sy.is_active = true
        and (
          ta.teacher_id = p.id
          or p.id = any(coalesce(ta.co_teacher_ids, '{}'::uuid[]))
        )
    );
$function$;

create or replace function private.can_read_learning_resource(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and (
      private.is_active_admin()
      or exists (
        select 1
        from public.learning_resources r
        join public.profiles viewer on viewer.id = (select auth.uid())
        left join public.teacher_assignments ta on ta.id = r.teacher_assignment_id
        where r.id = p_id
          and viewer.account_status = 'active'
          and (
            r.created_by = (select auth.uid())
            or (
              r.status = 'published'
              and (
                (
                  r.resource_scope = 'school'
                  and viewer.role in ('student','teacher')
                )
                or (
                  r.resource_scope = 'class'
                  and ta.id is not null
                  and ta.school_year_id = r.school_year_id
                  and (
                    (
                      viewer.role = 'student'
                      and exists (
                        select 1
                        from public.student_enrollments e
                        where e.student_id = viewer.id
                          and e.school_year_id = ta.school_year_id
                          and e.section_id = ta.section_id
                          and e.enrollment_status = 'active'
                          and (
                            ta.major is null
                            or e.tve_major = ta.major
                          )
                      )
                    )
                    or (
                      viewer.role = 'teacher'
                      and ta.is_active = true
                      and (
                        ta.teacher_id = viewer.id
                        or viewer.id = any(coalesce(ta.co_teacher_ids, '{}'::uuid[]))
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
