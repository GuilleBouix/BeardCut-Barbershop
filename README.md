![Sin título-1](https://github.com/user-attachments/assets/54219999-cc8c-4301-86db-52d5f5418719)

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
