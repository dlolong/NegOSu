-- Repair shared appointment integrity dispatch without dereferencing fields that
-- exist only on another trigger's row type. Keep deferred validation and locking
-- inside assert_pet_appointment; no business checks or tenant guards are skipped.
create or replace function public.check_pet_appointment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  key_name text;
  old_appointment_id uuid;
  new_appointment_id uuid;
begin
  if tg_table_schema <> 'public' then
    raise exception 'Unexpected appointment integrity trigger target' using errcode='23514';
  end if;
  if tg_table_name = 'appointments' then
    key_name := 'id';
  elsif tg_table_name in ('pet_appointment_details', 'appointment_staff_assignments', 'appointment_resource_assignments') then
    key_name := 'appointment_id';
  else
    raise exception 'Unexpected appointment integrity trigger target' using errcode='23514';
  end if;

  if tg_op <> 'DELETE' then
    new_appointment_id := (to_jsonb(new)->>key_name)::uuid;
    if new_appointment_id is null then
      raise exception 'Appointment identity is required' using errcode='23514';
    end if;
    perform public.assert_pet_appointment(new_appointment_id);
  end if;
  if tg_op <> 'INSERT' then
    old_appointment_id := (to_jsonb(old)->>key_name)::uuid;
    if old_appointment_id is null then
      raise exception 'Appointment identity is required' using errcode='23514';
    end if;
    if old_appointment_id is distinct from new_appointment_id then
      perform public.assert_pet_appointment(old_appointment_id);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.check_pet_appointment_integrity() from public, anon, authenticated;

comment on function public.check_pet_appointment_integrity() is
  'Deferred Pet appointment validation resolves parent id versus child appointment_id from the actual trigger row; validates both parents when an assignment moves.';
