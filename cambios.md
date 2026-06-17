# Bitácora de Cambios - Cuchilla

## [2026-06-15] - Creación de Interfaz de Login Premium

### Agregado
- **Diseño del Login (`app/layout/auth/login.tsx`)**: Implementación del componente React de inicio de sesión utilizando Tailwind CSS v4, que incluye:
  - Diseño responsivo en dos paneles inspirado en la interfaz del mockup.
  - Soporte completo para dos idiomas (Español e Inglés) seleccionables desde un menú desplegable en la cabecera.
  - Carrusel/Presentación de diapositivas interactivo en el panel izquierdo que rota ilustraciones y perfiles de creadores.
  - Validación de formulario con simulación de estados de carga (loading) al iniciar sesión y notificaciones de éxito/error (toast banners).
  - Integración de inicio de sesión social simulado con Google.
  - Campo de contraseña con visibilidad alternable (ver/ocultar).
- **Estilos y Animaciones (`app/css/login.css`)**: Creación de estilos personalizados para dotar a la interfaz de una estética premium y dinámica:
  - Animaciones de entrada (`slideInLeft`, `slideInRight`, `fadeInUp`) con retrasos escalonados para los distintos elementos del formulario.
  - Efecto de flotación sutil (`float`) para la tarjeta de perfil del autor.
  - Configuración de una curva orgánica con `clip-path` asimétrico y soporte responsivo para el panel izquierdo.
  - Diseño con efectos de difuminado y cristal templado (Glassmorphism) mediante `backdrop-filter` para overlays y tarjetas de perfil.
  - Estilizado de inputs y botón de inicio de sesión con sombras dinámicas basadas en los colores principales de `index.css`.
- **Recursos Visuales**: Copiado de dos ilustraciones vectoriales premium generadas por IA a los directorios del proyecto (`public/login_illustration.png` y `public/login_illustration_2.png`) para alimentar el carrusel interactivo.

### Modificado
- **Diseño del Login (`app/layout/auth/login.tsx`)**:
  - Ajustado para reducir márgenes, espaciados y establecer una altura máxima de `580px` en escritorio, garantizando que todo el contenido quepa perfectamente en la pantalla sin scroll vertical.
  - Removidos el botón de autenticación con Google y el divisor.
  - Deshabilitado el flujo de auto-registro ("Sign Up" y "¿No tienes una cuenta? Regístrate").
  - Eliminados los overlays textuales del panel izquierdo (títulos de obras y perfiles de autores) para dejar las ilustraciones limpias.
  - Removido el selector de idiomas para forzar el idioma español de manera exclusiva en toda la interfaz.
  - Modificado el título de bienvenida a "Hola Usuario!" y el subtítulo a "Te damos la bienvenida a LA CUCHILLA".
  - Actualizado el enlace de recuperación a "¿Olvidaste tu correo o contraseña?" y reubicado a la derecha debajo de los inputs de formulario.
- **Entrada de la Aplicación (`main.tsx`)**: Se modificó para importar los estilos de `login.css` y renderizar el nuevo componente `Login` en el punto de entrada para facilitar la visualización inmediata del diseño.
- **Configuración de Vite (`vite.config.ts`)**: Se integró el plugin de `@tailwindcss/vite` para habilitar el procesamiento y compilación correcta de los estilos de Tailwind CSS v4.

---

## [2026-06-17] - Logo en Login, Tipos de Imagen y Dashboard con Sidebar

### Agregado
- **Logo en panel izquierdo del Login (`app/layout/auth/login.tsx`)**: Se añadió el logo de Abarrotes La Cuchilla (`assets/logo.png`) al panel izquierdo de la pantalla de inicio de sesión, dentro de un contenedor con efecto glassmorphism (fondo translúcido, blur y borde sutil) para que contraste correctamente sobre la imagen de fondo oscura.
- **Declaración de tipos para imágenes (`app/vite-env.d.ts`)**: Se creó un archivo `.d.ts` con declaraciones de módulo para `.png`, `.jpg`, `.svg` y `.webp`, resolviendo el error TS2307 que impedía importar archivos de imagen en TypeScript.
- **Sidebar de navegación (`app/components/Sidebar.tsx`)**: Componente de barra lateral fija con logo, secciones agrupadas (Principal / Gestión / Sistema), indicador de ítem activo, badge de pedidos pendientes, perfil de usuario y botón de cierre de sesión. Soporta apertura en mobile con overlay.
- **Página Home / Dashboard (`app/layout/home/Home.tsx`)**: Panel de control con banner de bienvenida, saludo dinámico según la hora del día, cuatro tarjetas de métricas (ventas del día, pedidos activos, bajo stock y clientes), tabla de actividad reciente y panel de acciones rápidas.
- **Layout principal (`app/layout/AppLayout.tsx`)**: Componente orquestador que integra Sidebar + header sticky + área de contenido. El header incluye migas de pan, botón de notificaciones y avatar. La navegación entre páginas se gestiona por estado; las secciones no implementadas muestran un placeholder.

### Estilos
- **`app/css/sidebar.css`**: Estilos exclusivos del Sidebar (brand, ítems de nav con indicador activo, badges, footer de usuario, responsive mobile).
- **`app/css/home.css`**: Estilos exclusivos del Dashboard (tarjetas de stats con borde de acento por variante, filas de actividad, botones de acción rápida, banner oscuro con círculos decorativos, grid responsive).

### Modificado
- **`tsconfig.app.json`**: Se añadió `"app"` al array `include` para que TypeScript procese los archivos dentro de esa carpeta (antes solo cubría `src/` y `main.tsx`).
- **`main.tsx`**: Actualizado para renderizar `AppLayout` (Dashboard) en lugar de `Login` como vista inicial de la aplicación.


