-- Allow authenticated requests to reach profile UPDATE RLS policies.
-- The "Admins can approve profiles" RLS policy remains the authorization boundary,
-- so non-administrator users still cannot update profile rows.
grant update on table public.profiles to authenticated;
