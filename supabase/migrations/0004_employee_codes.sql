-- Switch to employee-code-based sign-in/up.
-- Adds public.users.employee_code (4-digit string, unique) so users can
-- log in with just their code instead of email + magic link.

alter table public.users
  add column if not exists employee_code text;

-- Enforce 4-digit format when set (still nullable for back-compat during rollout).
do $$ begin
  alter table public.users
    add constraint employee_code_format check (employee_code is null or employee_code ~ '^\d{4}$');
exception when duplicate_object then null; end $$;

create unique index if not exists users_employee_code_uniq
  on public.users(employee_code) where employee_code is not null;
