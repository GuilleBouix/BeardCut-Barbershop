# Sistema de Reservas de Citas

## Overview

El sistema de reservas permite a usuarios autenticados:
- Ver servicios disponibles
- Seleccionar fecha y horario
- Crear una cita (solo una activa a la vez)
- Cancelar su cita activa
- Ver los horarios ya ocupados (RESERVED)

---

## Archivos Involucrados

```
src/
├── lib/
│   ├── supabaseClient.ts        ← Cliente de Supabase
│   └── appointmentsApi.ts       ← Funciones para reservas (API del cliente)
├── components/
│   └── appointments/
│       └── AppointmentsPanel.tsx ← Panel completo de reservas (React)
├── data/
│   └── appointments.ts          ← Servicios de fallback (ejemplo local)
├── types/
│   └── appointments.ts          ← Tipos TypeScript
└── pages/
    └── appointments.astro      ← Página de reservas
```

---

## Estructura de Datos

### Tipo: AppointmentService (servicio disponible)

```typescript
interface AppointmentService {
  id: string;        // Ej: "classic-cut"
  name: string;      // Ej: "Classic Cut"
  durationMin: number; // Ej: 30
  price: number;     // Ej: 800
}
```

### Tipo: UserAppointment (cita del usuario)

```typescript
interface UserAppointment {
  id: string;
  user_id: string;       // UUID del usuario en Supabase
  service_id: string;   // ID del servicio reservado
  date_iso: string;     // Fecha en formato ISO: "2026-03-15"
  slot_time: string;    // Hora: "14:30:00"
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  status: "booked" | "canceled";
  created_at: string;
  updated_at: string;
}
```

### Tipo: BusinessShift (horario de la barbería)

```typescript
interface BusinessShift {
  id: number;
  weekday: number;      // 0=Domingo, 1=Lunes, ..., 6=Sábado
  open_time: string;    // "09:00:00"
  close_time: string;   // "20:00:00"
  is_active: boolean;
}
```

---

## Cómo Funciona el Sistema

### 1. Carga Inicial

```
appointments.astro
    ↓
<AppointmentsPanel /> (React)
    ↓
useEffect() → getCurrentSession()
    ↓
¿Está autenticado?
    ├─ SÍ: Cargar datos
    └─ NO: Mostrar "Login Required"
```

### 2. Cargar Servicios y Horarios

```tsx
// AppointmentsPanel.tsx - useEffect para cargar datos

useEffect(() => {
  if (authState !== "authenticated") return;

  const loadData = async () => {
    // Cargar servicios y horarios EN PARALELO
    const [servicios, turnos] = await Promise.all([
      supabase.from("services").select("*").eq("active", true),
      supabase.from("business_shifts").select("*").eq("is_active", true),
    ]);
    
    setServices(normalizedServices);
    setDays(buildDaysFromShifts(normalizedShifts));
  };
  
  loadData();
}, [authState]);
```

### 3. Generar Días y Horarios Disponibles

El sistema convierte los `business_shifts` (horarios de la barbería) en una lista de días con slots de 30 minutos:

```typescript
// AppointmentsPanel.tsx - buildDaysFromShifts()

// Ejemplo: Si business_shifts tiene:
// { weekday: 1, open_time: "09:00", close_time: "12:00" }

// Genera:
// [
//   { dateISO: "2026-03-02", label: "Mon 02/03", slots: [
//     { id: "09:00", time: "09:00", available: true },
//     { id: "09:30", time: "09:30", available: true },
//     { id: "10:00", time: "10:00", available: true },
//     ...
//   ]}
// ]
```

### 4. Cargar Horarios Ocupados

Cuando el usuario selecciona un día, se cargan los horarios ya reservados:

```typescript
// AppointmentsPanel.tsx - useEffect para cargar slots ocupados

useEffect(() => {
  if (!selectedDayISO) return;
  
  const loadBookedSlots = async () => {
    const bookedSlots = await getBookedSlotsByDate(selectedDayISO);
    setBookedSlotIds(bookedSlots);
  };
  
  loadBookedSlots();
}, [selectedDayISO]);
```

---

## Funciones de la API

### getBookedSlotsByDate(dateISO: string): string[]

```typescript
// src/lib/appointmentsApi.ts

export const getBookedSlotsByDate = async (dateISO: string): Promise<string[]> => {
  // Llama a la función de Supabase
  const { data, error } = await supabaseClient.rpc(
    "get_booked_slots_by_date",
    { p_date_iso: dateISO }
  );
  
  // Retorna array de horas: ["09:00", "09:30", "14:00"]
  return data.map.slot_time).(row => String(rowslice(0, User 5));
};
(input):```

### createAppointmentAppointment

```typescript
// src/lib/appointmentsApi.ts

export const createAppointment = async (input: CreateAppointmentInput) } = await sup => {
  const { data, errorabaseClient.rpc("create_appointment", {
    p_service_id: input.serviceId,
    p_date_iso: input.dateISO,
    p_slot_time: input.slotTime,
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail,
    p_customer_phone: input.customerPhone,
    p_notes: input.notes || null,
  });
  
  return data;
};
```

### cancelAppointment(appointmentId): UserAppointment

```typescript
// src/lib/appointmentsApi.ts

export const cancelAppointment = async (appointmentId: string) => {
  const { data, error } = await supabaseClient.rpc("cancel_my_appointment", {
    p_appointment_id: appointmentId,
  });
  
  return data;
};
```

---

## Reglas de Negocio (En el Backend - SQL)

El sistema enforce estas reglas desde el servidor:

### Solo una cita activa por usuario

```sql
-- En create_appointment() RPC
if exists (
  select 1 from public.appointments a
  where a.user_id = v_user_id
    and a.status = 'booked'
    and (a.date_iso::timestamp + a.slot_time) > v_now_local
) then
  raise exception 'You already have an active appointment';
end if;
```

### No reservar en el pasado

```sql
if v_appointment_timestamp <= v_now_local then
  raise exception 'You can only reserve future slots';
end if;
```

### No reservar horarios ya ocupados

```sql
if exists (
  select 1 from public.appointments a
  where a.date_iso = p_date_iso
    and a.slot_time = p_slot_time
    and a.status = 'booked'
) then
  raise exception 'Selected slot is no longer available';
end if;
```

---

## Flujo Completo de una Reserva

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario selecciona día                                   │
│    → useEffect dispara getBookedSlotsByDate()               │
│    → Carga horarios ocupados desde Supabase                 │
│    → slots se marcan como "RESERVED"                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Usuario selecciona horario disponible                   │
│    → Click en botón "Reserve"                               │
│    → selectedSlotId = "14:30"                               │
│    → selectedSummary se actualiza                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Usuario completa formulario (nombre, email, teléfono)    │
│    → Click en "Confirm Appointment"                        │
│    → handleSubmit() llama createAppointment()              │
│    → Supabase RPC valida y crea la cita                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Éxito                                                    │
│    → activeAppointment = nueva cita                         │
│    → Muestra tarjeta de la cita                             │
│    → Botón para cancelar disponible                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Interfaz de Usuario

### Si NO está autenticado

```
┌─────────────────────────────────┐
│         Login Required          │
│                                 │
│  You must sign in before        │
│  booking an appointment.       │
│                                 │
│  [ Go to Login ]               │
└─────────────────────────────────┘
```

### Si está autenticado Y tiene cita activa

```
┌─────────────────────────────────┐
│     Your Current Appointment    │
│                                 │
│  Service: Classic Cut           │
│  Date: Monday, March 15, 2026   │
│  Time: 14:30                    │
│  Name: Juan Pérez               │
│  Phone: +1 555 123 4567         │
│                                 │
│  [ Cancel Appointment ]        │
└─────────────────────────────────┘
```

### Si está autenticado Y NO tiene cita

```
┌────────────────┐  ┌────────────────┐
│ 1) Choose date │  │ 3) Confirm     │
│                │  │                │
│ [Mon 02/03]   │  │ Name: [_____]  │
│ [Tue 03/03]   │  │ Email: [_____] │
│ [Wed 04/03]   │  │ Phone: [_____] │
│ ...           │  │ Service: [▼]   │
│                │  │                │
│ 2) Available  │  │ [Confirm]     │
│                │  │                │
│ 09:00 [Reserve]│  │                │
│ 09:30 [RESERVD]│  │                │
│ 10:00 [Reserve]│  │                │
└────────────────┘  └────────────────┘
```

---

## Datos de Ejemplo

### Services (en Supabase)

```sql
insert into public.services (id, name, duration_min, price, active) values
('classic-cut', 'Classic Cut', 30, 2500, true),
('fade-cut', 'Fade and Blend', 30, 3000, true),
('beard-trim', 'Beard Trim', 20, 1500, true);
```

### Business Shifts (en Supabase)

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

## Fallback Local

Si Supabase no está disponible, el sistema usa datos locales:

```typescript
// src/data/appointments.ts

export const APPOINTMENT_SERVICES: AppointmentService[] = [
  { id: 'classic-cut', name: 'Classic Cut', durationMin: 30, price: 800 },
  { id: 'fade-cut', name: 'Fade and Blend', durationMin: 30, price: 900 },
  { id: 'beard-trim', name: 'Beard Trim', durationMin: 30, price: 700 }
];
```

---

## Siguiente Paso

Ver cómo se muestran los servicios en la página principal:
- [Servicios en Landing](./Servicios.md)
