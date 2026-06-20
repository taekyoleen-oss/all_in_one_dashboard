-- 001 extensions + helper trigger function
-- 멱등: 재실행 안전

create extension if not exists pgcrypto;  -- gen_random_uuid()

create or replace function pb_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
