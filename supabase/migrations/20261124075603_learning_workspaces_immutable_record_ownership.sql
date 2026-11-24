revoke update on public.ilaw_lesson_plans,public.aral_support_plans,public.aral_support_sessions,public.aral_learner_responses from authenticated;
grant update(title,subject,grade_level,term_no,week_no,status,teacher_reviewed,content) on public.ilaw_lesson_plans to authenticated;
grant update(school_year_id,student_id,tutor_id,focus_area,target_skill,assessment_basis,learner_instructions,resource_url,status) on public.aral_support_plans to authenticated;
grant update(session_date,activity,attendance,assessment_name,score,max_score,feedback,next_steps,resource_url) on public.aral_support_sessions to authenticated;
grant update(message,completed,needs_help) on public.aral_learner_responses to authenticated;

