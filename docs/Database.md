# Base de Datos - Supabase

## Overview

Este documento describe la estructura de la base de datos de Supabase, las tablas, políticas RLS, y funciones RPC usadas por el proyecto.

---

## Tablas

### 1. `services` - Servicios de la Barbería

Tabla que contiene los servicios disponibles para reservar.

```sql
create table if not exists public.services (
  id text primary key,
  name text not null,
  duration_min int not null,
  price numeric not null,
  active boolean default true
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | text | Identificador único (ej: "classic-cut") |
| `name` | text | Nombre del servicio |
| `duration_min` | int | Duración en minutos |
| `price` | numeric | Precio del servicio |
| `active` | boolean | Si está disponible para reservas |

**Índices:**
```sql
-- Búsqueda por estado activo
create index if not exists idx_services_active on public.services (active);
```

**Datos de ejemplo:**
```sql
insert into public.services (id, name, duration_min, price, active) values
('classic-cut', 'Classic Cut', 30, 2500, true),
('fade-cut', 'Fade and Blend', 30, 3000, true),
('beard-trim', 'Beard Trim', 20, 1500, true),
('corte-barba', 'Corte + Barba', 45, 3500, true),
('afeitado', 'Afeitado Clásico', 25, 1800, true);
```

---

### 2. `business_shifts` - Horarios de Operación

Define los horarios de atención de la barbería por día de la semana.

```sql
create table if not exists public.business_shifts (
  id uuid primary key default gen_random_uuid(),
  weekday int not null,
  open_time time not null,
  close_time time not null,
  is_active boolean default true
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | ID único |
| `weekday` | int | Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado) |
| `open_time` | time | Hora de apertura |
| `close_time` | time | Hora de cierre |
| `is_active` | boolean | Si el turno está activo |

**Datos de ejemplo:**
```sql
insert into public.business_shifts (weekday, open_time, close_time, is_active) values
(1, '09:00:00', '20:00:00', true),  -- Lunes
(2, '09:00:00', '20:00:00', true),  -- Martes
(3, '09:00:00', '20:00:00', true),  -- Miércoles
(4, '09:00:00', '20:00:00', true),  -- Jueves
(5, '09:00:00', '20:00:00', true),  -- Viernes
(6, '09:00:00', '18:00:00', true);  -- Sábado
```

---

### 3. `appointments` - Citas de Clientes

Tabla principal para almacenar las reservas de los usuarios.

```sql
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
  status text not null default 'booked' check (status in ('booked', 'canceled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | ID único de la cita |
| `user_id` | uuid | Referencia al usuario en auth.users |
| `service_id` | text | ID del servicio reservado |
| `date_iso` | date | Fecha de la cita |
| `slot_time` | time | Hora de la cita |
| `customer_name` | text | Nombre del cliente |
| `customer_email` | text | Email del cliente |
| `customer_phone` | text | Teléfono del cliente |
| `notes` | text | Notas adicionales (opcional) |
| `status` | text | Estado: 'booked', 'canceled' o 'completed' |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última actualización |

**Índices:**
```sql
-- Búsqueda por usuario, estado y fecha
create index if not exists idx_appointments_user_status_date
  on public.appointments (user_id, status, date_iso, slot_time);

-- Previene dos reservas en el mismo horario
create unique index if not exists uq_appointments_booked_slot
  on public.appointments (date_iso, slot_time)
  where status = 'booked';
```

---

### 4. `admin_users` - Usuarios Administradores

Tabla que define qué usuarios tienen acceso de administración.

```sql
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | ID único |
| `user_id` | uuid | Referencia al usuario en auth.users |
| `created_at` | timestamptz | Fecha de creación |

---

### 5. `business_income` - Ingresos del Negocio

Registra ingresos generados por turnos completados.

```sql
create table if not exists public.business_income (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id text not null,
  amount numeric not null,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (appointment_id)
);
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `appointment_id` | uuid | Cita completada |
| `service_id` | text | Servicio asociado |
| `amount` | numeric | Monto ingresado |
| `recorded_by` | uuid | Admin que registró |
| `created_at` | timestamptz | Fecha de registro |

---

## Row Level Security (RLS)

### Tabla `services`

```sql
alter table if exists public.services enable row level security;

-- Cualquier usuario puede ver servicios activos
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

-- Admin puede gestionar servicios
drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all"
on public.services
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
```

### Tabla `business_shifts`

```sql
alter table if exists public.business_shifts enable row level security;

-- Cualquier usuario puede ver turnos activos
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

-- Admin puede gestionar horarios
drop policy if exists "business_shifts_admin_all" on public.business_shifts;
create policy "business_shifts_admin_all"
on public.business_shifts
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
```

### Tabla `appointments`

```sql
alter table public.appointments enable row level security;

-- Usuario solo ve sus propias citas
drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own"
on public.appointments
for select
to authenticated
using (auth.uid() = user_id);

-- Usuario solo puede crear sus propias citas
drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own"
on public.appointments
for insert
to authenticated
with check (auth.uid() = user_id);

-- Usuario solo puede actualizar sus propias citas
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own"
on public.appointments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admin puede ver y actualizar todas las citas
drop policy if exists "appointments_admin_all" on public.appointments;
create policy "appointments_admin_all"
on public.appointments
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

### Tabla `admin_users`

```sql
alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "admin_users_admin_select" on public.admin_users;
create policy "admin_users_admin_select"
on public.admin_users
for select
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin_users_admin_insert" on public.admin_users;
create policy "admin_users_admin_insert"
on public.admin_users
for insert
to authenticated
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
```

### Tabla `business_income`

```sql
alter table public.business_income enable row level security;

drop policy if exists "business_income_admin_all" on public.business_income;
create policy "business_income_admin_all"
on public.business_income
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
```
```

---

## Funciones RPC (Stored Procedures)

### 1. `set_updated_at()` - Auto-actualizar timestamp

```sql
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
```

---

### 2. `create_appointment()` - Crear cita con validaciones

Esta función crea una cita aplicando todas las reglas de negocio.

```sql
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
  -- Validar que hay sesión
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Validar servicio
  if p_service_id is null or trim(p_service_id) = '' then
    raise exception 'Service is required';
  end if;

  -- Validar nombre
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'Customer name is required';
  end if;

  -- Validar email
  if p_customer_email is null or trim(p_customer_email) = '' then
    raise exception 'Customer email is required';
  end if;

  -- Validar teléfono
  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'Customer phone is required';
  end if;

  -- Solo reservas futuras
  if v_appointment_timestamp <= v_now_local then
    raise exception 'You can only reserve future slots';
  end if;

  -- Una cita activa futura por usuario
  if exists (
    select 1
    from public.appointments a
    where a.user_id = v_user_id
      and a.status = 'booked'
      and (a.date_iso::timestamp + a.slot_time) > v_now_local
  ) then
    raise exception 'You already have an active appointment';
  end if;

  -- Prevenir colisión de horarios
  if exists (
    select 1
    from public.appointments a
    where a.date_iso = p_date_iso
      and a.slot_time = p_slot_time
      and a.status = 'booked'
  ) then
    raise exception 'Selected slot is no longer available';
  end if;

  -- Crear la cita
  insert into public.appointments (
    user_id, service_id, date_iso, slot_time,
    customer_name, customer_email, customer_phone,
    notes, status
  )
  values (
    v_user_id, p_service_id, p_date_iso, p_slot_time,
    trim(p_customer_name), trim(lower(p_customer_email)),
    trim(p_customer_phone), nullif(trim(p_notes), ''),
    'booked'
  )
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke all on function public.create_appointment(text, date, time, text, text, text, text) from public;
grant execute on function public.create_appointment(text, date, time, text, text, text, text) to authenticated;
```

**Validaciones que aplica:**
1. ✅ Usuario autenticado
2. ✅ Servicio requerido
3. ✅ Nombre requerido
4. ✅ Email requerido
5. ✅ Teléfono requerido
6. ✅ Solo fechas futuras
7. ✅ Solo una cita activa por usuario
8. ✅ Horario no ocupado

---

### 3. `cancel_my_appointment()` - Cancelar cita

```sql
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

  select * into v_appointment
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

### 4. `get_booked_slots_by_date()` - Ver horarios ocupados

Retorna los horarios ocupados para una fecha específica (sin exponer datos personales).

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

## Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DATOS SUPABASE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐       ┌─────────────────────┐                     │
│  │      services       │       │   business_shifts   │                     │
│  ├─────────────────────┤       ├─────────────────────┤                     │
│  │ id (PK)        text │       │ id (PK)        uuid │                     │
│  │ name           text │       │ weekday        int  │                     │
│  │ duration_min   int  │       │ open_time     time  │                     │
│  │ price         numeric│       │ close_time    time  │                     │
│  │ active        bool   │       │ is_active    bool   │                     │
│  └─────────────────────┘       └─────────────────────┘                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        appointments                                  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ id (PK)              uuid                                           │   │
│  │ user_id (FK)         uuid ──────────► auth.users(id)               │   │
│  │ service_id (FK)      text  ──────────► services(id)               │   │
│  │ date_iso             date                                           │   │
│  │ slot_time            time                                           │   │
│  │ customer_name        text                                           │   │
│  │ customer_email       text                                           │   │
│  │ customer_phone       text                                           │   │
│  │ notes               text                                            │   │
│  │ status              text  (booked/canceled)                        │   │
│  │ created_at          timestamptz                                      │   │
│  │ updated_at          timestamptz                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FUNCIONES RPC                                │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • create_appointment()    → Crear cita con validaciones           │   │
│  │  • cancel_my_appointment() → Cancelar cita propia                  │   │
│  │  • get_booked_slots_by_date() → Ver horarios ocupados             │   │
│  │  • set_updated_at()        → Auto-actualizar timestamp             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuración Inicial (SQL Completo)

### Paso 1: Habilitar extensión y crear tablas

```sql
-- Extensión para UUIDs
create extension if not exists pgcrypto;

-- Tabla de servicios
create table if not exists public.services (
  id text primary key,
  name text not null,
  duration_min int not null,
  price numeric not null,
  active boolean default true
);

-- Tabla de horarios
create table if not exists public.business_shifts (
  id uuid primary key default gen_random_uuid(),
  weekday int not null,
  open_time time not null,
  close_time time not null,
  is_active boolean default true
);

-- Tabla de citas
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
  status text not null default 'booked' check (status in ('booked', 'canceled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de admins
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Tabla de ingresos
create table if not exists public.business_income (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id text not null,
  amount numeric not null,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

-- Índices
create index if not exists idx_appointments_user_status_date
  on public.appointments (user_id, status, date_iso, slot_time);

create unique index if not exists uq_appointments_booked_slot
  on public.appointments (date_iso, slot_time)
  where status = 'booked';
```

### Paso 2: RLS

```sql
-- Services
alter table public.services enable row level security;
create policy "services_select_anon" on public.services for select to anon using (active = true);
create policy "services_select_authenticated" on public.services for select to authenticated using (active = true);

-- Business Shifts
alter table public.business_shifts enable row level security;
create policy "business_shifts_select_anon" on public.business_shifts for select to anon using (is_active = true);
create policy "business_shifts_select_authenticated" on public.business_shifts for select to authenticated using (is_active = true);

-- Appointments
alter table public.appointments enable row level security;
create policy "appointments_select_own" on public.appointments for select to authenticated using (auth.uid() = user_id);
create policy "appointments_insert_own" on public.appointments for insert to authenticated with check (auth.uid() = user_id);
create policy "appointments_update_own" on public.appointments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin users
alter table public.admin_users enable row level security;
create policy "admin_users_select_self" on public.admin_users for select to authenticated using (auth.uid() = user_id);
create policy "admin_users_admin_select" on public.admin_users for select to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
create policy "admin_users_admin_insert" on public.admin_users for insert to authenticated with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Business income
alter table public.business_income enable row level security;
create policy "business_income_admin_all" on public.business_income for all to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid())) with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Admin overrides
create policy "services_admin_all" on public.services for all to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid())) with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
create policy "business_shifts_admin_all" on public.business_shifts for all to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid())) with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
create policy "appointments_admin_all" on public.appointments for all to authenticated using (exists (select 1 from public.admin_users au where au.user_id = auth.uid())) with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
```

### Paso 3: Funciones RPC

Ejecutar las funciones descritas en las secciones anteriores (`create_appointment`, `cancel_my_appointment`, `get_booked_slots_by_date`, `set_updated_at`).

### Paso 4: Datos de ejemplo

```sql
-- Servicios
insert into public.services (id, name, duration_min, price, active) values
('classic-cut', 'Classic Cut', 30, 2500, true),
('fade-cut', 'Fade and Blend', 30, 3000, true),
('beard-trim', 'Beard Trim', 20, 1500, true),
('corte-barba', 'Corte + Barba', 45, 3500, true),
('afeitado', 'Afeitado Clásico', 25, 1800, true);

-- Horarios (Lunes a Sábado)
insert into public.business_shifts (weekday, open_time, close_time, is_active) values
(1, '09:00:00', '20:00:00', true),
(2, '09:00:00', '20:00:00', true),
(3, '09:00:00', '20:00:00', true),
(4, '09:00:00', '20:00:00', true),
(5, '09:00:00', '20:00:00', true),
(6, '09:00:00', '18:00:00', true);
```

---

## Variables de Entorno

El proyecto necesita estas variables en `.env`:

```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Verificación

Después de configurar, verifica que:
1. ✅ Usuario puede ver servicios activos
2. ✅ Usuario puede ver horarios de la barbería
3. ✅ Usuario puede crear una cita
4. ✅ Usuario no puede crear dos citas activas
5. ✅ Usuario no puede reservar horarios ocupados
6. ✅ Usuario puede cancelar su cita
7. ✅ Otro usuario ve los horarios ocupados como "RESERVED"
