import { NextRequest, NextResponse } from "next/server";
import { isSuperAdministrator } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { teachingPositions, nonTeachingPositions } from "@/lib/deped-positions";

type AccountKind = "student" | "teacher" | "non_teaching";
const roleChoices = ["registrar", "content_administrator", "school_administrator"] as const;
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const phoneValid = (phone: string) =>
  !phone || /^(?:09\d{9}|639\d{9}|\+639\d{9})$/.test(phone.replace(/[\s()-]/g, ""));
const makeTempEmail = (name: string) => {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"").slice(0,42) || "personnel";
  return `${slug}.${crypto.randomUUID().slice(0,8)}@temp.asuncion-nhs.invalid`;
};

export async function POST(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !await isSuperAdministrator(token))
    return NextResponse.json({error:"Only the Super Administrator can create individual accounts."},{status:403});

  const body = await request.json().catch(()=>null);
  const kind: AccountKind | "" = body?.personType === "student" || body?.personType === "teacher" || body?.personType === "non_teaching"
    ? body.personType : "";
  const name = String(body?.fullName??"").trim().replace(/\s+/g," ");
  const phone = String(body?.phone??"").trim();
  const emailInput = String(body?.email??"").trim().toLowerCase();
  const email = kind !== "student" ? (emailInput || makeTempEmail(name)) : "";
  if (!kind) return NextResponse.json({error:"Choose the account type."},{status:400});
  if (name.length < 3 || name.length > 180)
    return NextResponse.json({error:"Enter a full name between 3 and 180 characters."},{status:400});
  if (!phoneValid(phone))
    return NextResponse.json({error:"Use a valid Philippine mobile number or leave it blank."},{status:400});
  if (kind !== "student" && !validEmail(email))
    return NextResponse.json({error:"Enter a valid login email, or leave it blank for a temporary email."},{status:400});

  let action = "import";
  let payload: Record<string, unknown>;
  if (kind === "student") {
    const lrn = String(body?.lrn??"").replace(/\s/g,"");
    const gradeLevel = Number(body?.gradeLevel);
    const section = String(body?.section??"").trim();
    const firstName = String(body?.firstName??"").trim();
    const lastName = String(body?.lastName??"").trim();
    const shsTrack = String(body?.shsTrack??"").trim();
    const shsProgram = String(body?.shsProgram??"").trim();
    if (!/^\d{12}$/.test(lrn)) return NextResponse.json({error:"LRN must contain exactly 12 digits."},{status:400});
    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12 || !section)
      return NextResponse.json({error:"Select the student's Grade Level and Section."},{status:400});
    if (!firstName || !lastName)
      return NextResponse.json({error:"Enter both First Name and Last Name."},{status:400});
    if (gradeLevel === 12 && Boolean(shsTrack) !== Boolean(shsProgram))
      return NextResponse.json({error:"For Grade 12, select both Track and Strand/Program or leave both unset."},{status:400});
    payload = {
      action,person_type:"student",file_name:"Manual Account Creation",
      rows:[{
        row_number:1,full_name:name,lrn,grade_level:gradeLevel,section,
        first_name:firstName,last_name:lastName,
        middle_name:String(body?.middleName??"").trim(),name_extension:String(body?.suffix??"").trim(),
        sex:String(body?.sex??"").trim(),birth_date:String(body?.birthDate??"").trim(),
        recovery_phone:phone,shs_track:shsTrack,shs_strand_program:shsProgram,
        source_data:{sheet:"Manual Create Account"},
      }],
    };
  } else if (kind === "teacher") {
    const position = String(body?.position??"").trim().toUpperCase();
    if (!teachingPositions.some(choice=>choice===position))
      return NextResponse.json({error:"Select a valid Teaching Personnel position."},{status:400});
    payload = {
      action,person_type:"teacher",file_name:"Manual Account Creation",
      rows:[{
        row_number:1,full_name:name,email,position,recovery_phone:phone,
        source_data:{sheet:"Manual Create Account"},
      }],
    };
  } else {
    const position = String(body?.position??"").trim().toUpperCase();
    const accessRole = String(body?.adminRole??"").trim();
    if (!nonTeachingPositions.some(choice=>choice===position))
      return NextResponse.json({error:"Select a valid Non-Teaching Personnel designation."},{status:400});
    if (!roleChoices.some(choice=>choice===accessRole))
      return NextResponse.json({error:"Select an explicit staff access role before creating this account."},{status:400});
    action="create_non_teaching_account";
    payload = {action,full_name:name,email,position,admin_role:accessRole,recovery_phone:phone};
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-bulk-account-import`, {
    method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(payload),cache:"no-store",
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok) return NextResponse.json({error:result.error??"Could not create account."},{status:response.status});
  const created = kind==="non_teaching" ? result.account : result.accounts?.[0];
  if (!created?.temporary_password) {
    const failure = result.errors?.[0]?.error;
    return NextResponse.json({error:failure??"Account could not be created. No credentials were issued."},{status:409});
  }
  return NextResponse.json({
    ok:true,account:{
      full_name:created.full_name,identifier:created.identifier,
      person_type:kind,position:created.position??null,
      access_role:created.access_role??null,
      temporary_password:created.temporary_password,
      must_change_password:true,
    }
  },{headers:{"Cache-Control":"no-store, private","Pragma":"no-cache"}});
}
