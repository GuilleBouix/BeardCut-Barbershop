# SEO y Metadatos

## Overview

El proyecto incluye configuración completa de SEO para mejorar el posicionamiento en buscadores y compartir en redes sociales.

---

## Archivos Involucrados

```
src/
├── layouts/
│   └── Layout.astro        ← Define todos los meta tags y SEO
├── pages/
│   ├── index.astro         ← Página principal
│   ├── login.astro         ← Página de login
│   └── appointments.astro  ← Página de reservas
└── types/
    └── layoutProps.ts       ← Tipos para las props del layout
```

---

## Layout Base con SEO

El componente `Layout.astro` es la base de todas las páginas y define el `<head>` completo:

```astro
---
// src/layouts/Layout.astro

const {
  title = 'BeardCut | Barbershop',
  description = 'BeardCut Barbershop in Austin, Texas...',
  lang = 'en-US',
  canonicalURL,
  noIndex = false
} = Astro.props;
---

<!doctype html>
<html lang={lang}>
  <head>
    <!-- Meta tags básicos -->
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content={Astro.generator} />
    <meta name="description" content={description} />
    
    <!-- Canonical URL -->
    {noIndex ? (
      <meta name="robots" content="noindex, nofollow" />
    ) : (
      <link rel="canonical" href={resolvedCanonicalURL} />
    )}
    
    <!-- Open Graph -->
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={resolvedCanonicalURL} />
    <meta property="og:image" content="https://beardcut.vercel.app/images/og-image.jpg" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="BeardCut Barbershop" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content="https://beardcut.vercel.app/images/og-image.jpg" />
    
    <!-- Schema.org JSON-LD -->
    <script type="application/ld+json" set:html={JSON.stringify(schemaData)} />
    
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## Props del Layout

```typescript
// src/types/layoutProps.ts

export interface Props {
  title?: string;           // Título de la página (default: 'BeardCut | Barbershop')
  description?: string;    // Meta description
  lang?: string;           // Idioma (default: 'en-US')
  canonicalURL?: string;   // URL canónica explícita
  noIndex?: boolean;       // Si true, agrega robots: noindex, nofollow
}
```

---

## Schema.org JSON-LD

El layout incluye datos estructurados para Google:

```javascript
const schemaData = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  "name": "BeardCut Barbershop",
  "image": "https://beardcut.vercel.app/images/logo.webp",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "412 Congress Ave",
    "addressLocality": "Austin",
    "addressRegion": "TX",
    "postalCode": "78701",
    "addressCountry": "US"
  },
  "telephone": "+1-512-555-0148",
  "email": "contact@beardcut.com",
  "priceRange": "$$",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "20:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "09:00",
      "closes": "18:00"
    }
  ],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "30.2672",
    "longitude": "-97.7431"
  },
  "url": "https://beardcut.vercel.app"
};
```

---

## Open Graph y Twitter Cards

### Open Graph

Cuando compartes un link en Facebook, WhatsApp, LinkedIn, etc., se muestra:

```
┌─────────────────────────────────────┐
│  IMAGEN (og:image)                  │
│                                     │
│  BeardCut Barbershop                │  ← og:title
│  Classic cuts, fades, beard...      │  ← og:description
│                                     │
│  beardcut.vercel.app                │  ← og:url
└─────────────────────────────────────┘
```

### Twitter Card

```
┌─────────────────────────────────────┐
│  IMAGEN (twitter:image)              │
│                                     │
│  BeardCut Barbershop                │  ← twitter:title
│  Classic cuts, fades, beard...      │  ← twitter:description
└─────────────────────────────────────┘
```

---

## Cómo Usar en Cada Página

### Página Principal

```astro
---
// src/pages/index.astro

import Layout from '../layouts/Layout.astro';
---

<Layout>
  <!-- Contenido -->
</Layout>
```

**Resultado:**
- Title: `BeardCut | Barbershop`
- Description: valor por defecto
- Index: sí (robots pueden indexar)

### Página de Login

```astro
---
// src/pages/login.astro

import Layout from '../layouts/Layout.astro';
---

<Layout title="Login | BeardCut">
  <!-- Contenido -->
</Layout>
```

**Resultado:**
- Title: `Login | BeardCut`

### Página de Reservas (pública)

```astro
---
// src/pages/appointments.astro

import Layout from '../layouts/Layout.astro';
---

<Layout title="Book Appointment | BeardCut">
  <!-- Contenido -->
</Layout>
```

---

## Página Privada (no index)

Si tienes una página que NO debe ser indexada (ej: dashboard de admin), usa `noIndex`:

```astro
<Layout noIndex>
  <!-- Contenido secreto -->
</Layout>

<!-- Genera: -->
<meta name="robots" content="noindex, nofollow" />
```

---

## Imágenes para SEO

### Favicon

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" href="/images/favicon.ico" sizes="32x32" />
```

### Open Graph Image

```
og:image: https://beardcut.vercel.app/images/og-image.jpg
twitter:image: https://beardcut.vercel.app/images/og-image.jpg
```

**Recomendaciones para og-image.jpg:**
- Tamaño: 1200x630px (relación 1.91:1)
- Formato: JPG o PNG
- Incluir logo y texto descriptivo

---

## Meta Tags Importantes

| Meta Tag | Propósito |
|----------|-----------|
| `description` | Resumen para Google (150-160 caracteres) |
| `canonical` | URL principal (evita contenido duplicado) |
| `robots` | Control de indexación |
| `og:*` | Open Graph para redes sociales |
| `twitter:*` | Twitter Card |

---

## Buenas Prácticas

### 1. Title único por página

```astro
<Layout title="Servicios | BeardCut">
<Layout title="Equipo | BeardCut">
<Layout title="Contacto | BeardCut">
```

### 2. Description única

```astro
<Layout description="Cortes de cabello clásicos, fades y más...">
```

### 3. URLs amigables

```
/                    → Home
/login               → Login
/appointments        → Reservas
```

### 4. Imágenes optimizadas

```astro
<Image
  src={imagen}
  alt="Descripción clara"
  width={1200}
  height={630}
  loading="eager"  <!-- Solo para above-the-fold -->
/>
```

---

## Diagrama: SEO Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SEO DEL PROYECTO                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Layout.astro                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ <head>                                           │ │ │
│  │  │   - title                                        │ │ │
│  │  │   - meta description                             │ │ │
│  │  │   - canonical URL                               │ │ │
│  │  │   - Open Graph (og:*)                           │ │ │
│  │  │   - Twitter Card (twitter:*)                    │ │ │
│  │  │   - Schema.org JSON-LD                          │ │ │
│  │  │   - favicon                                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  index.astro              login.astro                  │ │
│  │  appointments.astro       (usan Layout)                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Recursos Útiles

- [Open Graph Protocol](https://ogp.me/)
- [Schema.org](https://schema.org/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)

---

## Resumen

El proyecto tiene SEO configurado de forma centralizada en `Layout.astro`. Cada página simplemente usa el Layout y puede sobrescribir title, description, y otras props según sea necesario.
