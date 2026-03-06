# Documentación del Proyecto BeardCut Barbershop

Bienvenido a la documentación técnica del proyecto. Aquí encontrarás explicaciones detalladas de cada parte del sistema.

---

## Índice de Documentos

### 1. Visión General
- **[Arquitectura General](./Arquitectura-General.md)** - Overview del proyecto, estructura de carpetas, y cómo funcionan juntos Astro, React, Tailwind y Supabase.

### 2. Funcionalidades Principales

| Documento | Descripción |
|-----------|-------------|
| **[Autenticacion](./Autenticacion.md)** | Sistema de login con magic link (Email OTP) de Supabase |
| **[Reservas](./Reservas.md)** | Sistema completo de citas: servicios, horarios, crear/cancelar |
| **[Servicios](./Servicios.md)** | Sección de servicios en la landing page (SSR) |
| **[Navegacion](./Navegacion.md)** | Navbar, menú móvil, efectos de scroll, estado de auth |

### 3. Configuración

| Documento | Descripción |
|-----------|-------------|
| **[Estilos](./Estilos.md)** | Tailwind CSS, theme oscuro, componentes UI, animaciones |
| **[SEO](./SEO.md)** | Meta tags, Open Graph, Twitter Cards, Schema.org |
| **[Base de Datos](./Base-De-Datos.md)** | Esquema de Supabase: tablas, RLS, funciones RPC |

---

## Guía Rápida de Lectura

### Si eres nuevo en el proyecto

1. Empieza con **[Arquitectura General](./Arquitectura-General.md)**
2. Lee cómo funciona **[Autenticacion](./Autenticacion.md)**
3. Ve el **[Reservas](./Reservas.md)** para entender el core del negocio

### Si necesitas modificar...

- **Estilos/Layout**: Lee **[Estilos](./Estilos.md)** y **[Navegacion](./Navegacion.md)**
- **Reservas**: Lee **[Reservas](./Reservas.md)** y los tipos en `src/types/appointments.ts`
- **SEO**: Lee **[SEO](./SEO.md)**

### Si necesitas agregar algo nuevo

1. Revisa la estructura en **[Arquitectura General](./Arquitectura-General.md)**
2. Busca ejemplos similares en los otros documentos

---

## Mapa de Archivos Clave

```
src/
├── lib/
│   ├── supabaseClient.ts        ← Conexión con Supabase
│   ├── appointmentsApi.ts       ← Funciones de reservas
│   └── servicesLanding.ts       ← Carga de servicios (SSR)
│
├── components/
│   ├── appointments/
│   │   └── AppointmentsPanel.tsx ← Panel de reservas (React)
│   ├── auth/
│   │   └── LoginPanel.tsx        ← Login con magic link
│   └── ui/
│       └── Navbar.astro          ← Navegación
│
├── layouts/
│   └── Layout.astro              ← Layout base con SEO
│
├── pages/
│   ├── index.astro               ← Landing page
│   ├── login.astro               ← Login
│   └── appointments.astro       ← Reservas
│
├── scripts/
│   ├── navbar.ts                 ← Lógica del menú
│   └── auth-nav.ts              ← Estado de auth
│
└── types/
    └── appointments.ts           ← Tipos de TypeScript
```

---

## Conceptos Importantes

| Concepto | Descripción |
|----------|-------------|
| **SSR** | Server-Side Rendering - datos cargados en el servidor |
| **Client-side** | Datos cargados en el navegador |
| **Magic Link** | Autenticación por email sin contraseña |
| **RLS** | Row Level Security - seguridad a nivel de fila en Supabase |
| **RPC** | Remote Procedure Call - funciones del servidor |

---

## Siguiente Paso

Te recomiendo leer **[Arquitectura General](./Arquitectura-General.md)** para entender la visión completa del proyecto.
