# Estilos y Tailwind CSS

## Overview

El proyecto usa **Tailwind CSS 4.x** como framework de estilos. Todo el diseño es "dark mode" por defecto, con colores neutros y acentos blancos.

---

## Archivos Involucrados

```
src/
├── global.css                 ← Estilos globales
├── layouts/
│   └── Layout.astro           ← Layout base
├── components/                ← Todos los componentes
└── pages/                     ← Páginas
```

---

## Configuración de Tailwind

### tailwind.config.mjs (si existe) o entrada en CSS

El proyecto usa Tailwind 4.x con el plugin `@tailwindcss/vite`:

```javascript
// astro.config.mjs (simplificado)
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [tailwindcss()],
});
```

### Plugins

```json
{
  "dependencies": {
    "tailwindcss": "^4.2.1",
    "tailwindcss-animated": "^2.0.0"
  }
}
```

---

## Colores del Tema

El sitio usa un tema oscuro con estos colores principales:

| Color | Valor | Uso |
|-------|-------|-----|
| `bg-black/30` | Negro con transparencia | Fondos de secciones |
| `bg-[#101010]` | Negro muy oscuro | Tarjetas, formularios |
| `bg-[#1a1a1a]` | Gris muy oscuro | Inputs, elementos secundarios |
| `border-[#3d3d3d]` | Gris medio | Bordes de tarjetas |
| `text-white` | Blanco | Texto principal |
| `text-[#9d9d9d]` | Gris claro | Texto secundario |
| `text-[#8f8f8f]` | Gris | Labels, hints |

---

## Global CSS

```css
/* src/global.css */

/* Variables CSS personalizadas */
:root {
  --color-bg: #0a0a0a;
  --color-card: #101010;
  --color-border: #2f2f2f;
}

/* Reset básico */
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-bg);
  color: white;
  font-family: system-ui, sans-serif;
}

/* Scrollbar personalizada */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #3d3d3d;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
```

---

## Clases de Estilo Comunes

### Contenedores

```astro
<section class="min-h-screen px-6 py-24 lg:px-20">
  <div class="mx-auto w-full max-w-7xl">
    <!-- Contenido -->
  </div>
</section>
```

### Tarjetas

```astro
<div class="border border-[#3d3d3d] bg-[#101010] p-6">
  <!-- Contenido -->
</div>
```

### Inputs de Formulario

```astro
<input 
  type="text"
  class="w-full bg-[#1a1a1a] border border-[#3d3d3d] 
         text-white text-sm p-2.5 
         focus:outline-none focus:border-white 
         transition-all"
/>
```

### Botones

```astro
<!-- Botón primario (blanco) -->
<button class="bg-white text-black px-4 py-2.5 
               hover:bg-gray-200 transition-colors 
               border border-white font-bold uppercase">
  Confirm
</button>

<!-- Botón secundario (outline) -->
<button class="text-white border border-white px-4 py-2 
               hover:bg-white hover:text-black 
               transition-all">
  Reserve
</button>

<!-- Botón danger -->
<button class="border border-red-400 text-red-300 px-4 py-2 
               hover:bg-red-500 hover:text-white">
  Cancel
</button>
```

---

## Animaciones

El proyecto usa `tailwindcss-animated` para animaciones:

```astro
<!-- Animación de entrada -->
<div class="animate-fade animate-duration-500">
  Contenido
</div>

<!-- Animación de slide -->
<div class="animate-fade-down animate-duration-700 animate-delay-200">
  Contenido
</div>
```

### Animaciones Disponibles

| Clase | Efecto |
|-------|--------|
| `animate-fade` | Desvanecimiento |
| `animate-fade-down` | Fade desde arriba |
| `animate-fade-up` | Fade desde abajo |
| `animate-slide-down` | Slide desde arriba |

---

## Responsive Design

### Breakpoints de Tailwind

| Breakpoint | Ancho mínimo |
|------------|--------------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### Ejemplo: Grid responsivo

```astro
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- 1 columna en móvil, 2 en tablet, 3 en desktop -->
</div>
```

### Ejemplo: Padding responsivo

```astro
<div class="px-4 py-8 sm:px-6 lg:px-8">
  <!-- Padding pequeño en móvil, grande en desktop -->
</div>
```

---

## Fuentes

El proyecto usa **Playfair Display** para títulos (definido en CSS o importado):

```astro
<h1 class="font-playfair text-3xl">BeardCut</h1>
```

---

## Mejores Prácticas

### 1. Usar clases utilitarias

```astro
<!-- Bien -->
<div class="flex items-center justify-between p-4">

<!-- Evitar -->
<div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem;">
```

### 2. Agrupar clases relacionadas

```astro
<!-- Bien -->
<div class="
  flex items-center justify-between  <!-- Layout -->
  p-4                                <!-- Espaciado -->
  bg-[#101010]                       <!-- Fondo -->
  border border-[#3d3d3d]             <!-- Borde -->
">
```

### 3. Usar valores arbitrarios cuando sea necesario

```astro
<!-- Color específico -->
<div class="bg-[#2f2f2f]">

<!-- Altura específica -->
<div class="h-[500px]">
```

### 4. Alternativas a arbitrary values

```astro
<!-- En lugar de arbitrary values, usar @theme de Tailwind 4 -->
```

---

## Iconos con Lucide

El proyecto usa `lucide-astro` para iconos:

```astro
---
import { Menu, X, MapPin, Phone, Mail } from '@lucide/astro';
---

<!-- Icono -->
<MapPin class="w-5 h-5" />

<!-- Icono con clases Tailwind -->
<Phone class="w-4 h-4 text-white" />
```

---

## Diagrama: Flujo de Estilos

```
┌─────────────────────────────────────────────────────────────┐
│                     ESTILOS DEL PROYECTO                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Tailwind CSS   │    │  Global CSS                     │ │
│  │  4.x            │    │  (global.css)                   │ │
│  │                 │    │                                 │ │
│  │  - Utilities    │    │  - Variables CSS                │ │
│  │  - Animations   │    │  - Reset                       │ │
│  │  - Dark theme   │    │  - Scrollbar                   │ │
│  └─────────────────┘    │  - Fuentes                     │ │
│                          └─────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  En los componentes (.astro)                            ││
│  │                                                          ││
│  │  <div class="flex bg-[#101010] border border-[#3d3d3d]">││
│  │    <h1 class="font-playfair text-3xl text-white">      ││
│  │  </div>                                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Siguiente Paso

Ver cómo se maneja el SEO:
- [SEO y Metadatos](./SEO.md)
