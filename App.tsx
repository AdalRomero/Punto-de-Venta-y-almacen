import { AuthProvider, useAuth } from './src/context/AuthContext';
import Login from './app/layout/auth/login';
import AppLayout from './app/layout/AppLayout';

/* Separado del provider porque useAuth() necesita estar DENTRO
   de <AuthProvider>, no puede leerse en el mismo componente que
   lo declara. */
function Root() {
  const { isAuthenticated, isLoading } = useAuth();

  // Mientras se revisa si ya había sesión guardada (sessionStorage),
  // evita el parpadeo de mostrar el login un instante de más.
  if (isLoading) return null;

  if (!isAuthenticated) {
    // onSuccess ya no necesita hacer nada: login.tsx llama a
    // iniciarSesion() del contexto, que actualiza isAuthenticated
    // y esto solo se re-renderiza hacia AppLayout automáticamente.
    return <Login />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}