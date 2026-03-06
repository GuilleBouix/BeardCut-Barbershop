# Servicios en la Landing Page

## Overview

La sección de servicios en la página principal muestra el catálogo de servicios de la barbería. A diferencia del sistema de reservas, esta sección es **pública** y **estática** (se carga desde el servidor durante el build/request).

---

## Archivos Involucrados

```
src/
├── lib/
│   └── servicesLanding.ts        ← Fetch de servicios (lado servidor)
├── data/
│   └── services-fallback.ts     ← Servicios de respaldo local
├── components/
│   ├── Services.astro            ← Componente principal de servicios
│   └── services/
│       └── ServicesList.astro     ← Lista de servicios
└── pages/
    └── index.astro               ← Página principal (importa Services)
```

---

## Cómo Funciona

### 1. SSR: getLandingServices()

Cuando se carga la página principal, Astro ejecuta `getLandingServices()` en el servidor:

```typescript
// src/lib/servicesLanding.ts

export const getLandingServices = async (): Promise<AppointmentService[]> => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  // 1. Si no hay variables, usar fallback
  if (!supabaseUrl || !supabaseAnonKey) {
    return getFallback('Missing env vars');
  }

  // 2. Construir URL de la API REST de Supabase
  const endpoint = new URL('/rest/v1/services', supabaseUrl);
  endpoint.searchParams.set('select', 'id,name,duration_min,price');
  endpoint.searchParams.set('active', 'eq.true');
  endpoint.searchParams.set('order', 'name.asc');

  // 3. Fetch con timeout de 3.5 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });

    const data = await response.json();
    return data.map(normalizeService);
  } catch (error) {
    return getFallback('Fetch failed');
  } finally {
    clearTimeout(timeoutId);
  }
};
```

### 2. El componente Services.astro

```astro
---
// src/components/Services.astro

import { getLandingServices } from '../lib/servicesLanding';

// Cargar servicios en el servidor
const services = await getLandingServices();
---

<!-- Renderizar lista de servicios -->
<ServicesList services={services} />

<!-- Galería de imágenes (carousel) -->
<div class="gallery">...</div>
```

### 3. ServicesList.astro

```astro
---
// src/components/services/ServicesList.astro

interface Props {
  services: AppointmentService[];
}

const { services } = Astro.props;
---

<ul>
  {services.map((service) => (
    <li>
      <span>{service.name}</span>
      <span>{service.durationMin} min</span>
      <span>${service.price}</span>
    </li>
  ))}
</ul>
```

---

## Por Qué Fetch Directo en Lugar de Cliente?

### Diferencia importante:

| Método | Dónde se ejecuta | Ejemplo |
|--------|------------------|---------|
| **SSR (esta implementación)** | Servidor de Astro | `getLandingServices()` en `.astro` |
| **Cliente (reservas)** | Navegador del usuario | `appointmentsApi.ts` en `useEffect` |

### Ventajas del SSR aquí:

1. **SEO**: Los servicios aparecen en el HTML inicial
2. **Rendimiento**: No hay "loading" visible
3. **Fallback integrado**: Si Supabase falla, se usa datos locales

---

## Fallback Local

Si Supabase no responde (timeout, error, o no hay datos), se usan servicios locales:

```typescript
// src/data/services-fallback.ts

export const SERVICES_FALLBACK: AppointmentService[] = [
  { id: 'fallback-haircut', name: 'Classic Haircut', durationMin: 40, price: 8000 },
  { id: 'fallback-modern', name: 'Modern Haircut', durationMin: 45, price: 10000 },
  { id: 'fallback-fade', name: 'Fade & Taper', durationMin: 45, price: 9000 },
  // ... más servicios
];
```

---

## Galería de Imágenes (Carousel)

La sección de servicios también incluye un carrusel de imágenes del trabajo de la barbería:

```astro
<!-- Services.astro -->

const galleryImages = [
  { src: '/images/gallery-1.webp', alt: 'Classic fade haircut' },
  { src: '/images/gallery-2.webp', alt: 'Beard sculpting' },
  // ...
];

// Generar slides de 3 imágenes cada uno
const gallerySlides = [];
for (let i = 0; i < galleryImages.length; i += 3) {
  gallerySlides.push(galleryImages.slice(i, i + 3));
}
```

### Script del carousel

```typescript
// src/scripts/services-carousel.ts

const track = document.getElementById('gallery-track');
const prevBtn = document.getElementById('gallery-prev');
const nextBtn = document.getElementById('gallery-next');

let currentSlide = 0;

nextBtn.addEventListener('click', () => {
  currentSlide++;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
});

prevBtn.addEventListener('click', () => {
  currentSlide--;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
});
```

---

## Diagrama de Flujo

```
┌──────────────────┐
│   Usuario visita │      ┌────────────────────────┐
│   / (landing)    │─────▶│  getLandingServices() │
└──────────────────┘      └────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │ ¿Supabase disponible?  │
                         └────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
           ┌─────────────────┐            ┌─────────────────┐
           │ SÍ: Fetch API   │            │ NO: Usar        │
           │ REST de         │            │ SERVICES_       │
           │ Supabase        │            │ FALLBACK        │
           └─────────────────┘            └─────────────────┘
                    │                               │
                    └───────────────┬─────────────────┘
                                    ▼
                         ┌────────────────────────┐
                         │ <ServicesList services │
                         │    = {services} />     │
                         └────────────────────────┘
                                    │
                                    ▼
                         ┌────────────────────────┐
                         │ HTML renderizado con   │
                         │ todos los servicios    │
                         └────────────────────────┘
```

---

## Comparación: Landing vs Reservas

| Aspecto | Landing (Servicios) | Reservas |
|---------|---------------------|----------|
| ¿Requiere auth? | No | Sí |
| ¿Dónde carga datos? | Servidor (SSR) | Cliente (React) |
| ¿Editable por usuario? | No | Sí |
| ¿Tiempo real? | No (build time) | Sí |

---

## Siguiente Paso

Ver cómo funciona la navegación:
- [Navegación](./Navegacion.md)
