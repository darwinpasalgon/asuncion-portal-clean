-- Updated official Grade 11 SF9 (SY 2026–27): corrected Filipino core label,
-- five 6-unit core areas (communication counts once) and three 3-unit electives.
-- Preserve existing custom credit units and all assignments, grades, and enrollments.
update public.subjects
set name='Pag-Aaral ng Kasaysayan at Lipunang Pilipino'
where grade_level=11 and name='Pag-Aaral ng Kasanayan at Lipunang Pilipino';

update public.shs_subject_offerings o set units=6
from public.subjects s
where o.subject_id=s.id and o.grade_level=11 and o.category='core'
 and o.is_active=true and o.units is null
 and s.name in (
   'Effective Communication',
   'General Mathematics',
   'General Science',
   'Life and Career Skills',
   'Pag-Aaral ng Kasaysayan at Lipunang Pilipino'
 );
-- The two communication languages are components of one 6-unit area.
-- Do not add another 6-unit value for Mabisang Komunikasyon.
update public.shs_subject_offerings o set units=3
where o.grade_level=11 and o.category='elective' and o.is_active=true and o.units is null;