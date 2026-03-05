# BeardCut Barbershop

## Supabase SQL Guide

This project uses Supabase Auth (Email OTP) and booking logic with:
- one active future appointment per user,
- slot collision prevention,
- cancel flow,
- and shared slot visibility across users.

Below you have SQL scripts with clear comments.

---

## 1) Base setup (run once on a fresh project)

Use this section if your project does **not** have the appointments table, RLS, and RPCs yet.

```sql
-- Extension required for UUID generation.
create extension if not exists pgcrypto;

-- Main table for customer appointments.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id text not null,
  date_iso date not null,
  slot_time time not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  notes text null,
  status text not null default 'booked' check (status in ('booked', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Speeds up user/status/date lookups.
create index if not exists idx_appointments_user_status_date
  on public.appointments (user_id, status, date_iso, slot_time);

-- Prevents two active bookings on the same slot.
create unique index if not exists uq_appointments_booked_slot
  on public.appointments (date_iso, slot_time)
  where status = 'booked';

-- Auto-update updated_at on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appointments_set_updated_at on public.appointments;
create trigger trg_appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

-- Enable RLS and allow each user to access only their own appointments.
alter table public.appointments enable row level security;

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own"
on public.appointments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own"
on public.appointments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own"
on public.appointments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- RPC: create appointment with business rules enforced atomically.
create or replace function public.create_appointment(
  p_service_id text,
  p_date_iso date,
  p_slot_time time,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now_local timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_appointment_timestamp timestamp := p_date_iso::timestamp + p_slot_time;
  v_appointment public.appointments;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_service_id is null or trim(p_service_id) = '' then
    raise exception 'Service is required';
  end if;

  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'Customer name is required';
  end if;

  if p_customer_email is null or trim(p_customer_email) = '' then
    raise exception 'Customer email is required';
  end if;

  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'Customer phone is required';
  end if;

  -- Future-only booking rule.
  if v_appointment_timestamp <= v_now_local then
    raise exception 'You can only reserve future slots';
  end if;

  -- One active future appointment per user.
  if exists (
    select 1
    from public.appointments a
    where a.user_id = v_user_id
      and a.status = 'booked'
      and (a.date_iso::timestamp + a.slot_time) > v_now_local
  ) then
    raise exception 'You already have an active appointment';
  end if;

  -- Slot collision prevention.
  if exists (
    select 1
    from public.appointments a
    where a.date_iso = p_date_iso
      and a.slot_time = p_slot_time
      and a.status = 'booked'
  ) then
    raise exception 'Selected slot is no longer available';
  end if;

  insert into public.appointments (
    user_id,
    service_id,
    date_iso,
    slot_time,
    customer_name,
    customer_email,
    customer_phone,
    notes,
    status
  )
  values (
    v_user_id,
    p_service_id,
    p_date_iso,
    p_slot_time,
    trim(p_customer_name),
    trim(lower(p_customer_email)),
    trim(p_customer_phone),
    nullif(trim(p_notes), ''),
    'booked'
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.create_appointment(text, date, time, text, text, text, text) from public;
grant execute on function public.create_appointment(text, date, time, text, text, text, text) to authenticated;

-- RPC: cancel own appointment before the slot starts.
create or replace function public.cancel_my_appointment(
  p_appointment_id uuid
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now_local timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_appointment public.appointments;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.user_id = v_user_id
  limit 1;

  if v_appointment.id is null then
    raise exception 'Appointment not found';
  end if;

  if v_appointment.status <> 'booked' then
    raise exception 'Appointment is not active';
  end if;

  if (v_appointment.date_iso::timestamp + v_appointment.slot_time) <= v_now_local then
    raise exception 'This appointment can no longer be canceled';
  end if;

  update public.appointments
  set status = 'canceled'
  where id = v_appointment.id
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.cancel_my_appointment(uuid) from public;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;
```

---

## 2) Read policies for services and shifts (required for scheduler UI)

Use this section so authenticated users can load active services and business shifts.

```sql
alter table if exists public.services enable row level security;
alter table if exists public.business_shifts enable row level security;

drop policy if exists "services_select_authenticated" on public.services;
create policy "services_select_authenticated"
on public.services
for select
to authenticated
using (active = true);

drop policy if exists "services_select_anon" on public.services;
create policy "services_select_anon"
on public.services
for select
to anon
using (active = true);

drop policy if exists "business_shifts_select_authenticated" on public.business_shifts;
create policy "business_shifts_select_authenticated"
on public.business_shifts
for select
to authenticated
using (is_active = true);

drop policy if exists "business_shifts_select_anon" on public.business_shifts;
create policy "business_shifts_select_anon"
on public.business_shifts
for select
to anon
using (is_active = true);
```

---

## 3) Incremental patch: shared booked-slot visibility (NEW)

Run this if you already had the base setup, but need users to see slots reserved by others as `RESERVED`.

Why:
- Direct `select` on `appointments` is restricted by RLS (`auth.uid() = user_id`).
- This RPC returns only `slot_time` for a date, without exposing personal data.

```sql
create or replace function public.get_booked_slots_by_date(
  p_date_iso date
)
returns table (slot_time time)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select a.slot_time
  from public.appointments a
  where a.date_iso = p_date_iso
    and a.status = 'booked'
  order by a.slot_time asc;
end;
$$;

revoke all on function public.get_booked_slots_by_date(date) from public;
grant execute on function public.get_booked_slots_by_date(date) to authenticated;
```

---

## Quick verification checklist

After running SQL:
1. Login with User A, book a slot.
2. Login with User B, open same date.
3. That slot must appear as `RESERVED` (no button).
4. User A should still see their active booking card with cancel action.
