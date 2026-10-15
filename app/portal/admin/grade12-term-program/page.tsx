import { redirect } from "next/navigation";

/** Grade 12 shares the standard Grades 7–10 Class Schedules interface. */
export default async function LegacyGrade12Program({searchParams}:{
  searchParams: Promise<{term?:string;section?:string}>;
}){
  const query=await searchParams;
  const params=new URLSearchParams({grade:"12"});
  if(query.term==="2")params.set("term","2");
  if(query.section)params.set("section",query.section);
  redirect("/portal/admin/schedules?"+params.toString());
}
