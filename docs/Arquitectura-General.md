# Arquitectura General del Proyecto

## Overview

BeardCut es un sitio web para una barbería construido con **Astro** como framework principal, combinado con **React** para componentes interactivos. Utiliza **Tailwind CSS** para estilos y **Supabase** como backend (base de datos + autenticación).

---

## Tech Stack

| Tecnología | Propósito | Versión |
|------------|-----------|---------|
| Astro | Framework principal, routing, SSR | 5.x |
| React | Componentes interactivos (reservas, login) | 19 |
| Tailwind CSS | Estilos y diseño responsive | 4.x |
| Supabase | Base de datos y autenticación | - |
| lucide-astro | Iconos | - |

---

## Estructura de Carpetas

```
src/
├── components/           # Componentes reutilizables
│   ├── appointments/    # Panel de reservas (React)
│   ├── auth/            # Componentes de autenticación (LoginPanel)
│   ├── services/        # Componentes de servicios
│   ├── ui/              # Componentes UI (Navbar, Footer, etc.)
│   ├── Hero.astro       # Sección principal
│   ├── About.astro      # Sección nosotros
│   ├── Team.astro       # Sección equipo
│   ├── Services.astro   # Sección servicios + galería
│   └── Contact.astro    # Sección contacto
├── data/                # Datos estáticos locales
│   ├── appointments.ts  # Servicios de ejemplo (fallback)
│   └── services-fallback.ts
├── layouts/             # Layouts de página
│   └── Layout.astro     # Layout base con SEO
├── lib/                 # Utilidades y conexión con backend
│   ├── supabaseClient.ts    # Cliente de Supabase
│   ├── appointmentsApi.ts   # Funciones para reservas
│   └── servicesLanding.ts  # Carga de servicios para landing
├── pages/               # Páginas de Astro
│   ├── index.astro      # Página principal
│   ├── login.astro      # Página de login
│   └── appointments.astro
├── scripts/             # Scripts del cliente (TypeScript)
│   ├── navbar.ts        # Lógica del navbar
│   ├── auth-nav.ts     # Estado de auth en navbar
│   └── services-carousel.ts
├── types/               # Definiciones TypeScript
│   ├── appointments.ts
│   ├── layoutProps.ts
│   └── ...
└── global.css           # Estilos globales
```

---

## Cómo Funciona la Aplicación

### 1. Página Principal (Landing)

Cuando un usuario visita `/`:
1. `index.astro` carga el `Layout` base
2. El `Layout` incluye el `<head>` con SEO, meta tags, y Schema.org
3. `Navbar`, `Hero`, `About`, `Team`, `Services`, `Contact`, `Footer` se renderizan
4. Los servicios se cargan desde Supabase (o fallback local si falla)

### 2. Sistema de Autenticación

```
login.astro → LoginPanel.tsx (React)
                      ↓
              supabaseClient.ts
                      ↓
              Supabase Auth (Email OTP)
```

- El usuario ingresa su email
- Supabase envía un "magic link" por email
- Al hacer clic, el usuario queda autenticado
- El navegador redirige a `/appointments`

### 3. Reservas de Citas

```
appointments.astro → AppointmentsPanel.tsx (React)
                                   ↓
                           appointmentsApi.ts
                                   ↓
                           Supabase (RPCs)
                                   ↓
                           Base de datos
```

- El usuario debe estar autenticado
- Puede ver servicios, horarios disponibles
- Seleccionar fecha, hora, y confirmar datos
- Solo puede tener una cita activa futura
- Puede cancelar su cita

---

## Flujo de Datos General

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Navegador    │────▶│      Astro       │────▶│   Supabase      │
│   (Cliente)    │◀────│   (Servidor)     │◀────│   (Backend)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ React (SSR/     │     │  Componentes     │
│  Client)        │     │  Estáticos       │
└─────────────────┘     └──────────────────┘
```

---

## Conceptos Clave

### Componentes Astro vs React

| Tipo | Extensión | Cuándo usar |
|------|-----------|-------------|
| Estático | `.astro` | Header, footer, secciones que no cambian |
| Interactivo | `.tsx` | Formularios, estado, interacción del usuario |

### Fetch de Datos

- **Landing page**: `getLandingServices()` hace fetch directo a la API REST de Supabase (lado del servidor)
- **Reservas**: `appointmentsApi.ts` usa el cliente de Supabase desde el navegador

### Autenticación

- Solo Email OTP (magic link)
- Sesión almacenada en cookies de Supabase
- Estado de auth se sincroniza en tiempo real

---

## Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `supabaseClient.ts` | Inicializa la conexión con Supabase |
| `appointmentsApi.ts` | Funciones para crear/cancelar citas, obtener horarios |
| `Layout.astro` | HTML base, SEO, meta tags |
| `AppointmentsPanel.tsx` | Panel completo de reservas |
| `LoginPanel.tsx` | Formulario de login con magic link |

---

## Siguiente Paso

Consulta los documentos específicos de cada funcionalidad:
- [Autenticación](./Autenticacion.md)
- [Reservas de Citas](./Reservas.md)
- [Servicios en Landing](./Servicios.md)
- [Navegación](./Navegacion.md)
