# Navegación y Navbar

## Overview

El navbar es la barra de navegación principal del sitio. Tiene dos funciones principales:
1. **Navegación**: Links a las secciones de la página (Home, About, Team, Services, Contact)
2. **Autenticación**: Muestra Login o Logout según el estado del usuario

---

## Archivos Involucrados

```
src/
├── components/
│   └── ui/
│       └── Navbar.astro           ← Componente del navbar (HTML)
├── scripts/
│   ├── navbar.ts                  ← Lógica del menú móvil y scroll
│   └── auth-nav.ts                ← Estado de autenticación
└── pages/
    └── index.astro                ← Importa Navbar
```

---

## Estructura del Navbar

### Versión Desktop (md y superior)

```astro
<nav class="flex items-center space-x-12">
  <a href="/#home">Home</a>
  <a href="/#about">About</a>
  <a href="/#team">Team</a>
  <a href="/#services">Services</a>
  <a href="/#contact">Contact</a>
  <a href="/login">Login</a>        <!-- O: <button>Logout</button> -->
</nav>
```

### Versión Móvil (below md)

```
☰ (hamburger)
  ↓
[Mobile Menu Dropdown]
  - Home
  - About
  - Team
  - Services
  - Contact
  - Login/Logout
```

---

## Lógica del Navbar (navbar.ts)

El script `navbar.ts` maneja:

1. **Menú móvil**: Abrir/cerrar al hacer clic en el hamburger
2. **Efecto scroll**: Cambiar estilo cuando se hace scroll
3. **Cerrar con Escape**: Cerrar menú al presionar Escape
4. **Responsive**: Cerrar menú al agrandar la pantalla

### Código Principal

```typescript
// src/scripts/navbar.ts

const menuButton = document.getElementById('menu-button');
const mobileMenu = document.getElementById('mobile-menu');
const navbar = document.getElementById('site-navbar');

// 1. Toggle del menú
menuButton.addEventListener('click', () => {
  setMenuState(!isMenuOpen);
});

// 2. Scroll: agregar clase "is-scrolled"
window.addEventListener('scroll', () => {
  setNavbarState(window.scrollY > 24);
}, { passive: true });

// 3. Cerrar con Escape
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenuState(false);
  }
});

// 4. Cerrar al cambiar a desktop
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    setMenuState(false);
  }
});
```

### Efecto Visual al Hacer Scroll

```css
/* Navbar.astro - estilos */

.site-navbar {
  background: transparent;
}

.site-navbar.is-scrolled {
  background: rgba(12, 12, 12, 0.72);
  backdrop-filter: blur(12px);
  border-bottom-color: rgba(255, 255, 255, 0.14);
}
```

---

## Autenticación en el Navbar (auth-nav.ts)

El navbar debe mostrar **Login** si el usuario NO está autenticado, o **Logout** si SÍ lo está.

### Flujo

```
┌─────────────────────────────────────────────┐
│ 1. initAuthNav() se ejecuta                  │
│    ↓                                        │
│ 2. getSession() → verificar si hay sesión  │
│    ↓                                        │
│ 3. setAuthUi(isAuthenticated)              │
│    ├─ isAuthenticated = true  → mostrarLogout()
│    └─ isAuthenticated = false → mostrarLogin()
│    ↓                                        │
│ 4. onAuthStateChange() → escuchar cambios   │
└─────────────────────────────────────────────┘
```

### Código

```typescript
// src/scripts/auth-nav.ts

// Elementos del DOM
const loginDesktop = document.getElementById("auth-login-link-desktop");
const logoutDesktop = document.getElementById("auth-logout-btn-desktop");

// Mostrar/ocultar según estado
const setAuthUi = (isAuthenticated: boolean) => {
  loginDesktop.classList.toggle("hidden", isAuthenticated);
  logoutDesktop.classList.toggle("hidden", !isAuthenticated);
};

// Verificar sesión actual
const syncState = async () => {
  const { data } = await supabaseClient.auth.getSession();
  setAuthUi(Boolean(data.session));
};

// Escuchar cambios en tiempo real
supabaseClient.auth.onAuthStateChange((_event, session) => {
  setAuthUi(Boolean(session));
});

// Logout
const handleLogout = async () => {
  await supabaseClient.auth.signOut();
  setAuthUi(false);
  
  // Si está en /appointments, redirigir a /login
  if (window.location.pathname === "/appointments") {
    window.location.assign("/login");
  }
};

logoutDesktop.addEventListener("click", handleLogout);
```

---

## HTML del Navbar

```astro
<!-- src/components/ui/Navbar.astro -->

<!-- Desktop Navigation -->
<nav class="max-md:hidden">
  <a href="/#home">Home</a>
  <a href="/#about">About</a>
  <a href="/#team">Team</a>
  <a href="/#services">Services</a>
  <a href="/#contact">Contact</a>
  
  <!-- Links de auth -->
  <a id="auth-login-link-desktop" href="/login">Login</a>
  <button id="auth-logout-btn-desktop" class="hidden">Logout</button>
</nav>

<!-- Mobile Hamburger -->
<button id="menu-button">
  <span id="icon-menu"><Menu /></span>
  <span id="icon-close" class="hidden"><X /></span>
</button>

<!-- Mobile Menu -->
<div id="mobile-menu">
  <a href="/#home">Home</a>
  <a href="/#about">About</a>
  <!-- ... -->
  <a id="auth-login-link-mobile" href="/login">Login</a>
  <button id="auth-logout-btn-mobile" class="hidden">Logout</button>
</div>
```

---

## Estilos CSS del Navbar

```css
/* Transiciones suaves */
.site-navbar {
  transition: all 0.3s ease;
}

/* Estado scrolled */
.site-navbar.is-scrolled {
  background: rgba(12, 12, 12, 0.72);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

/* Menú móvil oculto por defecto */
#mobile-menu {
  max-height: 0;
  opacity: 0;
  transform: translateY(-0.5rem);
  pointer-events: none;
}

/* Menú móvil visible */
#mobile-menu {
  max-height: 80vh;
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

---

## Cómo Agregar Nuevos Links

Para agregar un nuevo link al navbar:

### 1. Agregar en Navbar.astro

```astro
<!-- Desktop -->
<a href="/#new-section">New Section</a>

<!-- Mobile -->
<a href="/#new-section">New Section</a>
```

### 2. Agregar la sección en index.astro

```astro
---
import NewSection from '../components/NewSection.astro';
---

<Layout>
  <Navbar />
  <Hero />
  <About />
  <!-- ... -->
  <section id="new-section">
    <NewSection />
  </section>
</Layout>
```

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVBAR (Navbar.astro)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │  Desktop Nav        │    │  Mobile Menu            │    │
│  │  (nav.hidden md)    │    │  (#mobile-menu)         │    │
│  │                     │    │                         │    │
│  │  - Home             │    │  - Home                 │    │
│  │  - About            │    │  - About                │    │
│  │  - Team             │    │  - Team                 │    │
│  │  - Services         │    │  - Services             │    │
│  │  - Contact          │    │  - Contact              │    │
│  │  - Login/Logout    │    │  - Login/Logout         │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Scripts                                                     │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ navbar.ts    │  │ auth-nav.ts  │                         │
│  │              │  │              │                         │
│  │ - toggle     │  │ - session    │                         │
│  │ - scroll     │  │ - logout     │                         │
│  │ - responsive │  │ - UI update  │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Notas Importantes

1. **El navbar está en todas las páginas**: Se incluye en el Layout o en cada página directamente
2. **onAuthStateChange**: Permite que el navbar responda a cambios de sesión sin recargar
3. **Links con hash (#)**: Los links usan `/#section` para navegación suave a secciones de la misma página

---

## Siguiente Paso

Ver cómo se manejan los estilos:
- [Estilos y Tailwind](./Estilos.md)
