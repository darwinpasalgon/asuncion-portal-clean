-- One-time import of adviser-assigned Term 1 remarks for Grade 9 Quezon.
-- Source: School Form 9 ANHS TECH VOC (SY 26-27) FINALquezon.xlsx,
-- 'TERM 1 SUMMARY' column Y; column Z is the remark bank, NOT student assignment.
-- Match by verified LRN and school-year enrollment; retain transferred historical learner.
create table if not exists private.sf9_quezon_excel_remark_audit (
 school_year_id uuid not null references public.school_years(id),
 student_id uuid not null references public.profiles(id),
 lrn text not null,
 source_sheet text not null,
 source_cell text not null,
 original_remark text not null,
 imported_at timestamptz not null default now(),
 primary key (school_year_id,student_id)
);
revoke all on private.sf9_quezon_excel_remark_audit from public,anon,authenticated;
create temporary table sf9_quezon_term1_source(lrn text primary key,remark text not null,row_no int not null) on commit drop;
insert into sf9_quezon_term1_source(lrn,remark,row_no) values
('128570170053','Aktibo at masayahin sa klase, ngunit kailangang iwasan ang pakikipagkuwentuhan sa kaklase, at may magandang kakayahang matuto',15),
('128570170054','Mabait at madaling makisama sa kaklase, ngunit kailangang bawasan ang paglalaro habang may gawain',16),
('128572170002','Tahimik at maayos kumilos sa klase, ngunit kailangang magkaroon ng higit na tiwala sa sarili sa pagsagot, at may kakayahang umunlad pa',17),
('129724170267','Masipag at maaasahan sa mga gawain, kailangang maging mas consistent sa attendance, at may kakayahang makahabol at umunlad',18),
('128570170120','Mabilis matuto at mahusay sumagot, ngunit minsan ay hindi nakikinig sa panuto',19),
('128578170033','Matalino at malikhain sa paggawa ng proyekto, ngunit kailangang maging mas responsable sa deadline, at may kakayahang makagawa ng mahusay na awtput',20),
('128570170059','Matalino at mabilis makaunawa sa aralin, may malaking potensiyal na makamit ang mas mataas na pagganap',21),
('128570170060','Masipag at palaging handang tumulong, ngunit minsan ay napapabayaan ang sariling gawain, at may kakayahang maging mas responsable',22),
('128774170133','Tahimik sa klase, ngunit kailangang makilahok sa mga gawain sa bawat asignatura',23),
('128570170063','Magaling sa Mathematics at mabilis makasagot, ngunit kailangang maging mas maingat sa mga simpleng pagkakamali, at may potensiyal na maging mahusay pa',24),
('128575170063','May kakayahang makasunod sa aralin, kailangang maglaan ng dagdag na oras sa pagsasanay, at unti-unting nagpapakita ng magandang pag-unlad',66),
('464516170031','Mahiyain ngunit masipag sa mga gawain, kailangang magsimulang makilahok sa talakayan para maipakita ang kanyang kaalaman',67),
('204507170014','Mabait at tahimik na mag-aaral, ngunit kailangang dagdagan ang pakikilahok sa group activities, at may kakayahang makipagtulungan nang mas mahusay',68),
('128567170045','Matalino at malikhain sa paggawa ng proyekto, ngunit kailangang maging mas responsable sa deadline, at may kakayahang makagawa ng mahusay na awtput',69),
('128578170050','Aktibo at masayahin sa klase, ngunit kailangang iwasan ang pakikipagkuwentuhan sa kaklase, at may magandang kakayahang matuto',70),
('128570170051','Masipag at mahusay sa mga gawain, ngunit minsan ay madaling mawala ang pokus, at kayang pagbutihin pa ang kanyang pagganap',71),
('128567170015','Tahimik at maayos kumilos sa klase, ngunit kailangang magkaroon ng higit na tiwala sa sarili sa pagsagot, at may kakayahang umunlad pa',72),
('128583170009','Matalino at mabilis makaunawa sa aralin, may malaking potensiyal na makamit ang mas mataas na pagganap',73),
('128570170132','Mahiyain at magalang sa klase, ngunit kailangang mas maging aktibo sa pakikilahok, at may kakayahang maipakita ang kanyang galing',74),
('128771170193','Aktibo sa recitation at may kumpiyansa sa pagsagot, maaaring maging positibong lider sa klase',75),
('128583170035','Aktibo at masayahin sa klase, ngunit kailangang iwasan ang pakikipagkuwentuhan sa kaklase, at may magandang kakayahang matuto',76),
('128575170065','Mahusay sa group activities at madaling makipagtulungan, ngunit kailangang dagdagan ang pagsisikap sa individual activities, at may kakayahang umunlad',77),
('128570170093','Magaling makipag-ugnayan sa mga kaklase, kailangang gamitin ang kanyang leadership skills sa positibong paraan, at may magandang potensiyal na maging huwaran',78),
('128570170091','Tahimik at maayos kumilos sa klase, ngunit kailangang magkaroon ng higit na tiwala sa sarili sa pagsagot, at may kakayahang umunlad pa',79),
('128570170066','Matalino at may determinasyon sa pagpapaunlad ng sariling kakayahan sa lahat ng asignatura',80),
('128791170046','Mahiyain ngunit maayos gumawa ng mga aktibidad, kailangang dagdagan ang pakikilahok sa recitation, at may kakayahang maipakita ang kanyang tunay na kakayahan',81),
('128586170028','Masunuring estudyante, ngunit kailangan na dagdagan pa ang sipag sa pag-aaral para pumasa sa bawat asignatura',82),
('128583170059','Mahusay sa pagsagot kapag tinatawag, ngunit bihirang kusang makilahok, at may kakayahang maging mas aktibo sa talakayan',83),
('128769170198','Mahiyain at magalang sa klase, ngunit kailangang mas maging aktibo sa pakikilahok, at may kakayahang maipakita ang kanyang galing',84),
('128570170072','Mahiyain ngunit masipag sa mga gawain, kailangang magsimulang makilahok sa talakayan para maipakita ang kanyang kaalaman',85),
('128570170070','Aktibo at masayahin sa klase, ngunit kailangang iwasan ang pakikipagkuwentuhan sa kaklase, at may magandang kakayahang matuto',86),
('128570170018','Tahimik sa klase, ngunit kailangang makilahok sa mga gawain sa bawat asignatura',87),
('128575170049','Masipag na estudyante at maaasahan sa gawaing silid-aralan',88),
('128575170042','Tahimik at maayos kumilos sa klase, ngunit kailangang magkaroon ng higit na tiwala sa sarili sa pagsagot, at may kakayahang umunlad pa',89),
('128568170012','Magalang at masunurin sa guro, ngunit kailangang bawasan ang pakikipagkuwentuhan sa oras ng talakayan, at may magandang potensiyal sa pag-aaral',90),
('128570170050','Mahusay sa klase, may magandang ideya sa mga gawain, at malikhain sa mga proyekto',91),
('129441170032','Masunuring estudyante, ngunit kailangan na dagdagan pa ang sipag sa pag-aaral para pumasa sa bawat asignatura',92),
('129711170133','Mahusay sa group activities at madaling makipagtulungan, ngunit kailangang dagdagan ang pagsisikap sa individual activities, at may kakayahang umunlad',93),
('128570170073','Masipag sa gawaing silid-aralan at mabait na estudyante, ngunit kailangang magkaroon ng pokus sa bawat aralin',94),
('128575170072','Tahimik at maayos kumilos sa klase, ngunit kailangang magkaroon ng higit na tiwala sa sarili sa pagsagot, at may kakayahang umunlad pa',95),
('128578170067','Mahiyain ngunit masipag sa mga gawain, kailangang magsimulang makilahok sa talakayan para maipakita ang kanyang kaalaman',96),
('128570170075','Tahimik sa klase, ngunit kailangang makilahok sa mga gawain sa bawat asignatura',97);
do $$
declare matched int; preexisting int; valid_adviser uuid; current_year uuid;
begin
 select id into current_year from public.school_years where is_active=true and start_year=2026 and end_year=2027;
 if current_year is null then raise exception 'School year 2026–2027 not active'; end if;
 select count(*) into matched
 from sf9_quezon_term1_source src
 join public.profiles p on p.lrn=src.lrn and p.role='student'
 join public.student_enrollments se on se.student_id=p.id and se.school_year_id=current_year
 join public.sections s on s.id=se.section_id and s.name='Quezon' and s.grade_level=9;
 if matched<>42 then raise exception 'Matched only % / 42 Quezon learner LRNs. Aborting without writing.',matched;end if;
 select count(*) into preexisting from sf9_quezon_term1_source src
 join public.profiles p on p.lrn=src.lrn
 join public.sf9_teacher_remarks r on r.student_id=p.id and r.school_year_id=current_year and r.term_no=1;
 if preexisting<>0 then raise exception 'Existing adviser-edited Quezon Term 1 remarks (%). Preserve them; abort import.',preexisting;end if;
 select id into valid_adviser from public.profiles where role='administrator' and admin_role='super_administrator' and account_status='active' order by id limit 1;
 if valid_adviser is null then raise exception 'No active Super Administrator to attribute import'; end if;
 insert into public.sf9_teacher_remarks(school_year_id,student_id,term_no,remark,source,updated_by,updated_at)
 select current_year,p.id,1,src.remark,'manual',valid_adviser,now()
 from sf9_quezon_term1_source src
 join public.profiles p on p.lrn=src.lrn and p.role='student';
 insert into private.sf9_quezon_excel_remark_audit
 (school_year_id,student_id,lrn,source_sheet,source_cell,original_remark)
 select current_year,p.id,src.lrn,'TERM 1 SUMMARY','Y'||src.row_no,src.remark
 from sf9_quezon_term1_source src join public.profiles p on p.lrn=src.lrn and p.role='student';
end $$;