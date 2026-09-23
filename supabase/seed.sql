-- School structure seed generated from the current portal configuration.
-- Contains no user accounts, grades, attendance, or private student data.

insert into public.grade_levels(grade_level,label,sort_order)
values (7,'Grade 7',7)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;
insert into public.grade_levels(grade_level,label,sort_order)
values (8,'Grade 8',8)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;
insert into public.grade_levels(grade_level,label,sort_order)
values (9,'Grade 9',9)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;
insert into public.grade_levels(grade_level,label,sort_order)
values (10,'Grade 10',10)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;
insert into public.grade_levels(grade_level,label,sort_order)
values (11,'Grade 11',11)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;
insert into public.grade_levels(grade_level,label,sort_order)
values (12,'Grade 12',12)
on conflict (grade_level) do update set label=excluded.label, sort_order=excluded.sort_order;

insert into public.school_years(id,name,start_year,end_year,is_active)
values ('697f70cb-d029-4b24-8aeb-7fca04651cb0','2026–2027',2026,2027,true)
on conflict (id) do update set name=excluded.name,start_year=excluded.start_year,end_year=excluded.end_year,is_active=excluded.is_active;

insert into public.sections(id,grade_level,name,is_active)
values ('b6470745-9f54-41d8-8aa1-bb9685e1202c',7,'Dahlia',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('dab1bfed-5340-4435-b6b3-659542cd6aa2',7,'Daisy',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('e84bd898-6753-4dfa-afe9-8ac8e1f092f1',7,'Gumamela',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('abbefd55-0800-4f53-aa09-da7cec809465',7,'Jasmine',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('c13e6f40-7795-4067-82b4-b6a97ba429d9',7,'Rosal',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('3ce8f51d-d1d2-48d5-be82-7d14c98d1167',7,'Rose',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('518253a5-3cd4-4368-be38-6cc0f7dea324',7,'Sampaguita',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('fcfbf9f1-5289-4f2d-9ff0-0a330e8137db',7,'Santan',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('b26dca94-5668-42fc-ae54-08d203cd575e',7,'Sunflower',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('cf686366-066b-439f-934c-fc05f02106bc',7,'Vanda',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('e498d5d9-79c1-4f3b-abf5-d4b0c1d44623',7,'Waterlily',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('0e06859e-ed17-489e-9448-617a0d11dab1',7,'Zinnia',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('9d989b6f-42f7-4b21-b76c-33a3cab8b503',8,'Acacia',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('aa1c371d-d071-448e-96f7-5afdbf940977',8,'Almasiga',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('7c38c7f7-5606-4c72-afb7-b2eeaa46f6bd',8,'Apitong',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('7556a6f3-a055-4377-b6b2-3ac6c75056ea',8,'Dao',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('7086c0d6-f8b0-4b03-a684-7d5971358b52',8,'Falcata',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('2ec92889-a6ea-49a6-8a8f-b348ca51020d',8,'Gemelina',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('baa73d05-ca0a-482f-b47b-5d94848f1684',8,'Lawaan',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('d33a7281-8c41-4c83-80f0-9759720f8614',8,'Mahogany',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('2c25bc73-d850-44f8-a623-bf20994f1fda',8,'Molave',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('ad6286cb-223d-4b27-9586-0a579028cdbc',8,'Narra',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('52de1848-a75e-46e6-8326-0d54e7b7319b',8,'Yakal',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('90df9e59-e594-4c8b-a3b6-080c9bde2616',9,'Aguinaldo',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('cb32926a-3340-4fe6-a473-13deafe917e5',9,'Aquino',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('6c1e63a5-3271-4d04-a0ad-ceee21a29254',9,'Arroyo',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('d23fd294-9a80-4c5b-aa2f-5158949d5c51',9,'Macapagal',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('117840e8-246d-49b2-990d-b2ed52528a3c',9,'Magsaysay',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('42e84c95-76d7-4fe9-ad1d-e06f0d9fc30e',9,'Marcos',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('43cfa60a-b921-46a2-b9d2-40ccc92d00d0',9,'Osmeña',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('f6b7a07d-bc38-49d3-9f6b-1bd7e9efa74d',9,'Quezon',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('010f59c1-4ed4-4095-af3c-5cb8ea9cbb6c',9,'Quirino',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('b2081321-1754-4bad-99c7-36bb4ec9383b',9,'Roxas',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('39b53659-82ba-4074-95cf-f4188dc60471',10,'Bonifacio',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('5bda09c4-d766-4d24-bbde-e82ccc81c418',10,'Burgos',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('7d2baf3d-d7d7-4f0b-83e8-523d50392db3',10,'Del Pilar',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('303a1fdf-7c0c-4e5f-a819-abb741593180',10,'Gomez',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('37600b13-c502-4354-9cb3-f5fa11c141b8',10,'Jacinto',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('e1b9758d-57c7-4c61-84ed-116ad0320a9d',10,'Lapu-Lapu',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('e82d2332-7cc0-4b59-b366-dcb3795568f7',10,'Luna',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('67a92273-95b2-48b5-941b-e2b57b11590b',10,'Rizal',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('49296501-4d2a-4e7f-81d1-4c41a3348476',10,'Zamora',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('93df0144-2346-4ab3-8fb3-e11e51f6dd30',11,'Amber',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('904bc89d-1d77-4a1f-9838-2f47c586d9c0',11,'Amethyst',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('45799041-842b-4b23-af94-db86816ded6e',11,'Canary',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('ef4a09ef-4ca5-44e3-bb2d-fe2adab03477',11,'Crimson',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('93999be6-daa4-4eaf-9ca5-80998e927057',11,'Misty Rose',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('c837c5a8-4c78-480f-8a05-be95e93aca04',11,'Tangerine',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
insert into public.sections(id,grade_level,name,is_active)
values ('2201053b-e13c-4245-a740-0ddf8a8e8338',11,'Turquoise',true)
on conflict (id) do update set grade_level=excluded.grade_level,name=excluded.name,is_active=excluded.is_active;
