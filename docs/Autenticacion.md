# Sistema de Autenticación

## Overview

El sistema de autenticación usa **Supabase Auth** con **Email OTP** (también conocido como "magic link"). El usuario ingresa su email, recibe un enlace por correo, y al hacer clic queda automáticamente autenticado.

---

## Archivos Involucrados

```
src/
├── lib/
│   └── supabaseClient.ts        ← Cliente de Supabase (se comparte con reservas)
├── components/
│   ├── auth/
│   │   └── LoginPanel.tsx       ← Componente de login (React)
│   └── ui/
│       └── Navbar.astro         ← Muestra Login/Logout según estado
├── scripts/
│   └── auth-nav.ts              ← Sincroniza estado de auth en el navbar
└── pages/
    ├── login.astro              ← Página de login
    └── appointments.astro        ← Página protegida
```

---

## Cómo Funciona

### 1. Usuario visita /login

```
login.astro
    ↓
<LoginPanel /> (React)
    ↓
Usuario ingresa email
    ↓
submit → signInWithOtp()
    ↓
Supabase envía magic link al email
    ↓
Usuario hace clic en el enlace
    ↓
Supabase redirige a /appointments (según emailRedirectTo)
```

### 2. Código de LoginPanel.tsx

```tsx
// src/components/auth/LoginPanel.tsx

const handleSubmit = async (event: FormEvent) => {
  event.preventDefault();
  
  // 1. Enviar magic link
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo,  // → /appointments
    },
  });
  
  // 2. Mostrar mensaje de éxito
  setSuccessMessage("Magic link sent. Check your email...");
};
```

### 3. El usuario hace clic en el magic link

Cuando el usuario hace clic en el enlace del email:
1. Supabase valida el token
2. Crea una sesión
3. Redirige a `/appointments`

---

## Sincronización del Navbar

El navbar necesita mostrar **Login** o **Logout** según el estado del usuario.

### Cómo funciona:

```typescript
// src/scripts/auth-nav.ts

// 1. Obtener elementos del DOM
const loginDesktop = document.getElementById("auth-login-link-desktop");
const logoutDesktop = document.getElementById("auth-logout-btn-desktop");

// 2. Función que muestra/oculta según estado
const setAuthUi = (isAuthenticated: boolean) => {
  loginDesktop.classList.toggle("hidden", isAuthenticated);   // Ocultar login si auth
  logoutDesktop.classList.toggle("hidden", !isAuthenticated); // Mostrar logout si auth
};

// 3. Verificar sesión al cargar
const { data } = await supabaseClient.auth.getSession();
setAuthUi(Boolean(data.session));

// 4. Escuchar cambios de auth en tiempo real
supabaseClient.auth.onAuthStateChange((_event, session) => {
  setAuthUi(Boolean(session));
});
```

### En el HTML del Navbar:

```astro
<!-- src/components/ui/Navbar.astro -->

<!-- Si NO está autenticado: muestra Login -->
<a id="auth-login-link-desktop" href="/login">Login</a>

<!-- Si ESTÁ autenticado: muestra Logout -->
<button id="auth-logout-btn-desktop" class="hidden">Logout</button>
```

---

## Protección de Rutas

La página de citas `/appointments` verifica que el usuario esté autenticado:

```tsx
// src/components/appointments/AppointmentsPanel.tsx

const [authState, setAuthState] = useState<AuthState>("checking");

useEffect(() => {
  const initializeSession = async () => {
    const session = await getCurrentSession();
    
    if (session?.user) {
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  };
  
  initializeSession();
}, []);

// Si no está autenticado, mostrar mensaje:
if (authState === "unauthenticated") {
  return <p>You must sign in before booking.</p>;
}
```

---

## Funciones de Auth en appointmentsApi.ts

```typescript
// src/lib/appointmentsApi.ts

// Obtener la sesión actual del usuario
export const getCurrentSession = async (): Promise<Session | null> => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
};
```

---

## Diagrama de Flujo

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Usuario     │    │  LoginPanel  │    │  Supabase    │
│  visita      │───▶│  ingresa     │───▶│  Auth        │
│  /login      │    │  email       │    │  (OTP)       │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  Envía       │
                                        │  email con   │
                                        │  magic link  │
                                        └──────────────┘
                                               │
                    ┌──────────────┐            │
                    │  Navbar      │◀───────────┘
                    │  actualiza   │
                    │  estado      │
                    └──────────────┘
```

---

## Ejemplo de Uso

### Caso: Usuario quiere reservar una cita

1. Usuario hace clic en "Book Online" o "Login"
2. Navegador va a `/login`
3. Usuario ingresa `juan@email.com`
4. Sistema muestra: "Magic link sent. Check your email..."
5. Usuario revisa su email y hace clic en el enlace
6. Supabase redirige a `/appointments`
7. El `AppointmentsPanel` detecta sesión activa
8. Usuario puede crear su cita

### Caso: Usuario hace logout

1. Usuario hace clic en "Logout" en el navbar
2. `auth-nav.ts` ejecuta `supabaseClient.auth.signOut()`
3. Navbar actualiza: muestra "Login" en vez de "Logout"
4. Si estaba en `/appointments`, redirige a `/login`

---

## Configuración en Supabase

El sistema usa las políticas RLS de Supabase para proteger datos:

```sql
-- Tabla de citas: usuario solo ve sus propias citas
create policy "appointments_select_own"
on public.appointments
for select
to authenticated
using (auth.uid() = user_id);
```

---

## Siguiente Paso

Ver cómo funciona el sistema de reservas:
- [Reservas de Citas](./Reservas.md)
