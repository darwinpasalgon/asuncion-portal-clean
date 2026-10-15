-- Reconcile previously unmatched SHS Wellness Leave records after
-- Super Admin confirmed the personnel identity/name changes.
--
-- Evidence:
-- Asuncion (1).xlsx / ARWITA, SA / row 35:
--  ARWITA, SARAH JANE ASOY = SARAH JANE A. BITUIN
--  Wellness leave 10/5/2026 (5-1=4).
-- Asuncion (1).xlsx / SANTOS , PM / row 37:
--  MANLIGUIS, PHOEBE R. = PHOEBE M. SANTOS
--  Wellness leave 10/1,5/2026 (5-2=3).
-- Asuncion (1).xlsx / SUSON, RO / row 13, confirmed also in
-- SERVICE CREDITS - SHS.xlsx / SUSON, RO / row 13:
--  Wellness leave 6/19/2026 (one consumed day, balance 5-1=4).
-- These are 2026 cumulative wellness reconciliations posted as of
-- 2026-10-15. Excel columns F/G represent SERVICE CREDITS in the
-- source workbook and must not be mistaken for Wellness Leave usage.

do $$
declare
  v_count integer;
  v_inserted integer;
begin
  with intended(personnel_id,full_name,days_used) as (values
    ('e4c612d6-337c-449d-b224-200e214f62dc'::uuid,'SARAH JANE A. BITUIN'::text,1::numeric),
    ('731e6439-df89-4bf7-8cf8-544c47b05688'::uuid,'PHOEBE M. SANTOS'::text,2::numeric),
    ('d0ccfcff-4949-42eb-8fee-cd68d7d0a25e'::uuid,'RICA O. SUSON'::text,1::numeric)
  )
  select count(*) into v_count
  from intended i join public.profiles p on p.id=i.personnel_id
    and upper(p.full_name)=i.full_name
    and p.role='teacher' and p.account_status='active';
  if v_count<>3 then
    raise exception '2026 SHS wellness reconciliation personnel identity check failed: % of 3 matched',v_count;
  end if;

  with intended(personnel_id) as (values
    ('e4c612d6-337c-449d-b224-200e214f62dc'::uuid),
    ('731e6439-df89-4bf7-8cf8-544c47b05688'::uuid),
    ('d0ccfcff-4949-42eb-8fee-cd68d7d0a25e'::uuid)
  )
  select count(*) into v_count
  from public.service_credit_transactions t
  join intended i on i.personnel_id=t.personnel_id
  where t.credit_type='wellness_leave'
    and t.posting_date>='2026-01-01'::date
    and t.posting_date<'2027-01-01'::date;
  if v_count<>0 then
    raise exception 'One or more personnel already have a 2026 Wellness Leave entry; manual reconciliation required. Found: %',v_count;
  end if;

  with intended(personnel_id,days_used,source_file,source_sheet,source_row,particulars,remarks) as (values
    (
      'e4c612d6-337c-449d-b224-200e214f62dc'::uuid,
      1::numeric,'Asuncion (1).xlsx'::text,'ARWITA, SA'::text,35,
      'SHS 2026 Wellness Leave balance reconciliation: Sarah Jane Arwita / Sarah Jane Bituin',
      'Verified person-name change; source entry: Wellness leave 10/5/2026 (5-1=4). This is a cumulative adjustment as of 2026-10-15, not an extra leave request.'
    ),
    (
      '731e6439-df89-4bf7-8cf8-544c47b05688'::uuid,
      2::numeric,'Asuncion (1).xlsx'::text,'SANTOS , PM'::text,37,
      'SHS 2026 Wellness Leave balance reconciliation: Phoebe Santos / Phoebe Manliguis',
      'User-confirmed identity match; source entry MANLIGUIS, PHOEBE R.: Wellness leave 10/1,5/2026 (5-2=3). This is a cumulative adjustment as of 2026-10-15.'
    ),
    (
      'd0ccfcff-4949-42eb-8fee-cd68d7d0a25e'::uuid,
      1::numeric,'Asuncion (1).xlsx'::text,'SUSON, RO'::text,13,
      'SHS 2026 Wellness Leave balance reconciliation: Rica O. Suson',
      'Source Wellness leave - 6/19/2026 appears in both SHS Excel workbooks. Deduct exactly 1 day; remaining Wellness Leave 4 of 5. Distinct from regular service-credit balance.'
    )
  )
  insert into public.service_credit_transactions
    (personnel_id,credit_type,posting_date,transaction_kind,
     previous_balance,service_credits_earned,particulars,absence_days,
     service_credits_used,balance_after,remarks,source,source_file,source_sheet,source_row)
  select personnel_id,'wellness_leave','2026-10-15'::date,'debit',
         5,0,particulars,0,days_used,5-days_used,
         remarks,'excel_import',source_file,source_sheet,source_row
  from intended;

  get diagnostics v_inserted=row_count;
  if v_inserted<>3 then
    raise exception 'Expected three wellness adjustments; inserted %',v_inserted;
  end if;
end $$;