![Sin título-1](https://github.com/user-attachments/assets/54219999-cc8c-4301-86db-52d5f5418719)

# BeardCut Barbershop

Website para una barbería moderna construido con Astro, React y Tailwind CSS. Incluye sistema de reservas en línea, listado de servicios, información del equipo y contacto.

## Secciones del Sitio

| Sección | Descripción | Componente |
|---------|-------------|------------|
| **Home** | Hero con logo, botones de reserva y enlaces a redes sociales (Instagram, Facebook, WhatsApp) | `Hero.astro` |
| **About** | Historia y filosofía de la barbería con imagen | `About.astro` |
| **Team** | Presentación de los 3 barberos (John Doe, Michael Shawn, Marco Silva) con foto, nombre y especialización | `Team.astro` + `TeamCard.astro` |
| **Services** | Catálogo de servicios con precios y duración, galería de trabajos en carrusel | `Services.astro` + `ServicesList.astro` |
| **Contact** | Dirección, teléfono, email, horario y mapa de Google Maps integrado | `Contact.astro` + `ContactInfoItem.astro` |

### Páginas

| Ruta | Descripción | Autenticación |
|------|-------------|---------------|
| `/` | Landing page principal con todas las secciones | No |
| `/appointments` | Panel de reservas con selección de fecha, hora y servicio | **Requiere** |
| `/login` | Login con magic link (usuario) o email/password (admin) | No |
| `/dashboard` | Panel de administración para gestionar citas, servicios y turnos | **Requiere admin** |

## Características

- **Reservas en línea**: Sistema de citas con validación de disponibilidad en tiempo real
- **Servicios**: Catálogo de servicios con precios y duración (cargados desde Supabase)
- **Equipo**: Presentación del equipo de barberos
- **Contacto**: Formulario de contacto e información de ubicación
- **Autenticación**: 
  - Usuario: Login con Email OTP (magic link) via Supabase Auth
  - Admin: Login con email + password
- **Panel de Admin**: Gestión de citas, servicios, turnos e ingresos
- **Diseño responsive**: Optimizado para móviles y escritorio
- **Modo oscuro**: Interfaz con tema oscuro elegante

## Tech Stack

| Tecnología | Propósito | Uso en el proyecto |
|------------|-----------|---------------------|
| **Astro 5.x** | Framework principal (SSG/SSR) | Páginas, layouts, componentes estáticos |
| **React 19** | Componentes interactivos | AppointmentsPanel, LoginPanel, DashboardPanel |
| **Tailwind CSS 4.x** | Estilos y diseño | Todo el CSS del proyecto |
| **tailwindcss-animate** | Animaciones | Efectos fade, slide, jump |
| **Supabase** | Base de datos y autenticación | Tablas: services, business_shifts, appointments, income |
| **lucide-astro** | Iconos | MapPin, Phone, Mail, Menu, X, ChevronsRight/Left, etc. |

### Bibliotecas adicionales

- `@supabase/supabase-js` - Cliente de Supabase
- `date-fns` - Manipulación de fechas (opcional, no detectada en código)

## Requisitos Previos

- Node.js 18+ 
- npm o pnpm
- Cuenta de Supabase

## Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/GuilleBouix/BeardCut-Barbershop.git
cd BeardCut-Barbershop
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
PUBLIC_SUPABASE_URL=your_supabase_url
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
├── assets/images/           # Imágenes (logo, barberos, galería)
├── components/
│   ├── ui/                 # Componentes reutilizables
│   │   ├── Navbar.astro   # Navegación con menú responsive
│   │   ├── Footer.astro   # Pie de página
│   │   ├── TeamCard.astro # Tarjeta de барберо
│   │   └── ServicesTable.astro
│   ├── appointments/       # Componentes de reservas
│   │   └── AppointmentsPanel.tsx # Panel de reservas (React)
│   ├── auth/              # Autenticación
│   │   └── LoginPanel.tsx # Login con magic link / admin (React)
│   ├── admin/             # Panel de administración
│   │   └── DashboardPanel.tsx # Dashboard admin (React)
│   ├── Hero.astro        # Sección hero
│   ├── About.astro       # Sobre nosotros
│   ├── Team.astro        # Equipo
│   ├── Services.astro    # Servicios y galería
│   └── Contact.astro     # Contacto y mapa
├── data/                  # Datos estáticos
│   └── appointments.ts  # Servicios por defecto
├── layouts/               # Layouts de página
│   └── Layout.astro       # Layout principal con SEO
├── lib/                   # Utilidades
│   ├── supabaseClient.ts # Cliente de Supabase
│   ├── appointmentsApi.ts # API de citas
│   ├── adminApi.ts       # API del admin
│   ├── sessionManager.ts # Gestión de sesiones
│   ├── rateLimiter.ts    # Limitador de reservas
│   └── servicesLanding.ts
├── pages/                 # Páginas Astro
│   ├── index.astro       # Landing page
│   ├── appointments.astro
│   ├── login.astro
│   └── dashboard.astro
├── scripts/               # Scripts del cliente
│   ├── navbar.ts         # Toggle menú mobile
│   ├── auth-nav.ts       # Estado de auth en navbar
│   └── services-carousel.ts
├── types/                # Definiciones TypeScript
│   ├── appointments.ts
│   └── admin.ts
└── global.css            # Estilos globales (Tailwind)
```

## Base de Datos (Supabase)

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `services` | Catálogo de servicios (id, name, duration_min, price, active) |
| `business_shifts` | Horarios de apertura (weekday, open_time, close_time, is_active) |
| `appointments` | Citas reservadas (service_id, date_iso, slot_time, customer_name, etc.) |
| `income` | Registro de ingresos |

### Políticas RLS

- `services`: Lectura pública, escritura solo admin
- `business_shifts`: Lectura pública, escritura solo admin
- `appointments`: 
  - Lectura: usuario autenticado (sus propias citas), admin (todas)
  - Escritura: usuario autenticado para crear, admin para modificar/eliminar
- `income`: Solo lectura/escritura admin

## Autenticación

### Flujo de Usuario
1. Usuario ingresa su email en `/login`
2. Supabase envía magic link por email
3. Usuario hace click en el link
4. Redirecciona a `/appointments` con sesión activa
5. Puede reservar citas y ver sus reservas

### Flujo de Admin
1. Admin ingresa email y password en `/login` (pestaña Admin)
2. Sistema verifica credenciales y rol de admin
3. Redirecciona a `/dashboard` con acceso completo

### Seguridad adicional
- **Rate Limiting**: Máximo de intentos de reserva para prevenir abusos
- **Session Manager**: Control de expiración de sesión
- **Sanitización**: Validación de inputs contra XSS

## Documentación

Consulta la carpeta `docs/` para información detallada:

| Documento | Descripción |
|-----------|-------------|
| [Arquitectura General](./Docs/Arquitectura-General.md) | Visión completa del proyecto |
| [Autenticación](./Docs/Autenticacion.md) | Sistema de login con magic link |
| [Reservas](./Docs/Reservas.md) | Sistema de citas |
| [Servicios](./Docs/Servicios.md) | Sección de servicios |
| [Navegación](./Docs/Navegacion.md) | Navbar y menú |
| [Estilos](./Docs/Estilos.md) | Tailwind CSS |
| [SEO](./Docs/SEO.md) | Meta tags y SEO |
| [Base de Datos](./Docs/Base-De-Datos.md) | Esquema de Supabase |

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
