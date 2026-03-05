# BeardCut Barbershop

Website para una barbería moderna construido con Astro, React y Tailwind CSS. Incluye sistema de reservas en línea, listado de servicios, información del equipo y contacto.

## Características

- **Reservas en línea**: Sistema de citas con validación de disponibilidad en tiempo real
- **Servicios**: Catálogo de servicios con precios y duración
- **Equipo**: Presentación del equipo de barberos
- **Contacto**: Formulario de contacto e información de ubicación
- **Autenticación**: Login con Email OTP via Supabase Auth
- **Diseño responsive**: Optimizado para móviles y escritorio
- **Modo oscuro**: Interfaz con tema oscuro elegante

## Tech Stack

| Tecnología | Propósito |
|------------|-----------|
| Astro 5.x | Framework principal |
| React 19 | Componentes interactivos |
| Tailwind CSS 4.x | Estilos y diseño |
| Supabase | Base de datos y autenticación |
| lucide-astro | Iconos |

## Requisitos Previos

- Node.js 18+ 
- npm o pnpm
- Cuenta de Supabase

## Instalación

1. **Clonar el repositorio**

```bash
git clone <repo-url>
cd BeardCut-Barbershop
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
# URL de tu proyecto Supabase
PUBLIC_SUPABASE_URL=your_supabase_url

# Clave pública anónima de Supabase
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Iniciar servidor de desarrollo**

```bash
npm run dev
```

El sitio estará disponible en `http://localhost:4321`

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npx astro check` | Verificación de tipos |

## Estructura del Proyecto

```
src/
├── components/
│   ├── ui/              # Componentes reutilizables
│   ├── appointments/    # Componentes de reservas
│   └── services/        # Componentes de servicios
├── data/                # Datos estáticos
├── layouts/             # Layouts de página
├── lib/                 # Utilidades (Supabase client)
├── pages/               # Páginas Astro
├── scripts/             # Scripts del cliente
├── types/               # Definiciones TypeScript
└── global.css           # Estilos globales
```

## Configuración de Supabase

### Tablas Requeridas

El proyecto requiere las siguientes tablas en Supabase:

```sql
-- Servicios de barbería
create table if not exists public.services (
  id text primary key,
  name text not null,
  duration_min int not null,
  price numeric not null,
  active boolean default true
);

-- Horarios de operación
create table if not exists public.business_shifts (
  id uuid primary key default gen_random_uuid(),
  weekday int not null,  -- 0=Domingo, 1=Lunes, etc.
  open_time time not null,
  close_time time not null,
  is_active boolean default true
);
```

### SQL Completo para Reservas

A continuación se incluye el script SQL completo con comentarios para configurar el sistema de reservas:

---

## 1) Configuración Base (ejecutar una vez)

Usa esta sección si tu proyecto **no** tiene la tabla appointments, RLS y RPCs.

```sql
-- Extensión requerida para generación de UUIDs.
create extension if not exists pgcrypto;

-- Tabla principal para citas de clientes.
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

-- Índices para búsquedas rápidas por usuario/estado/fecha.
create index if not exists idx_appointments_user_status_date
  on public.appointments (user_id, status, date_iso, slot_time);

-- Previene dos reservas activas en el mismo horario.
create unique index if not exists uq_appointments_booked_slot
  on public.appointments (date_iso, slot_time)
  where status = 'booked';

-- Auto-actualiza updated_at en cada fila.
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

-- Habilitar RLS y permitir acceso solo a propias citas.
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

-- RPC: crear cita con reglas de negocio enforced atómicamente.
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

  -- Solo reservas futuras.
  if v_appointment_timestamp <= v_now_local then
    raise exception 'You can only reserve future slots';
  end if;

  -- Una cita activa futura por usuario.
  if exists (
    select 1
    from public.appointments a
    where a.user_id = v_user_id
      and a.status = 'booked'
      and (a.date_iso::timestamp + a.slot_time) > v_now_local
  ) then
    raise exception 'You already have an active appointment';
  end if;

  -- Prevenir colisión de horarios.
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

-- RPC: cancelar cita propia antes del horario.
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

## 2) Políticas de Lectura para Servicios y Horarios

Ej que usuariosecuta esto para autenticados puedan cargar servicios activos y horarios.

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

## 3) Patch: Visibilidad Compartida de Horarios Reservados

Ejecuta esto si ya tienes la configuración base pero necesitas que usuarios vean horarios reservados por otros como `RESERVADO`.

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

## Checklist de Verificación

Después de ejecutar el SQL:
1. Inicia sesión con Usuario A, reserva un horario.
2. Inicia sesión con Usuario B, abre la misma fecha.
3. Ese horario debe aparecer como `RESERVADO` (sin botón).
4. Usuario A debe seguir viendo su cita activa con opción de cancelar.

## Datos de Ejemplo (Servicios)

Inserta servicios de ejemplo en la tabla `services`:

```sql
insert into public.services (id, name, duration_min, price, active) values
('corte', 'Corte de cabello', 30, 2500, true),
('barba', 'Arreglo de barba', 20, 1500, true),
('corte-barba', 'Corte + Barba', 45, 3500, true),
('afeitado', 'Afeitado clásico', 25, 1800, true),
('tratamiento', 'Tratamiento capilar', 40, 2200, true);
```

## Datos de Ejemplo (Horarios)

Inserta horarios de ejemplo en `business_shifts` (1=Lunes a 6=Sábado):

```sql
insert into public.business_shifts (weekday, open_time, close_time, is_active) values
(1, '09:00:00', '20:00:00', true),  -- Lunes
(2, '09:00:00', '20:00:00', true),  -- Martes
(3, '09:00:00', '20:00:00', true),  -- Miércoles
(4, '09:00:00', '20:00:00', true),  -- Jueves
(5, '09:00:00', '20:00:00', true),  -- Viernes
(6, '09:00:00', '20:00:00', true);  -- Sábado
```

## Despliegue

### Build de Producción

```bash
npm run build
```

### Preview Local

```bash
npm run preview
```

### Despliegue Recomendado

- **Vercel**: Configuración automática con Astro
- **Netlify**: Compatible con Astro
- **Cloudflare Pages**: Compatible con Astro

## Contribución

1. Fork del repositorio
2. Crear branch (`git checkout -b feature/nueva-caracteristica`)
3. Commit cambios (`git commit -m 'Agregar nueva característica'`)
4. Push al branch (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## Licencia

MIT License - feel free to use this project for your own barbershop.
