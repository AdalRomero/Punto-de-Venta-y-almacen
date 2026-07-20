/* ============================================================
   AuthContext.tsx
   Guarda quién inició sesión (el `Usuario` que ya arma
   auth.service.ts) y lo pone disponible en TODA la app vía el
   hook useAuth(). Con esto:

     - AppLayout puede mostrar nombre/rol/correo reales en vez
       de los datos quemados ("AD", "Administrador").
     - Cualquier service (venta.service, entrada.service,
       ajuste.service, etc.) puede leer usuario.id_perfil_info
       para mandarlo como `registrado_por` y que esos campos
       dejen de quedar vacíos/null.

   La sesión se guarda en sessionStorage: sobrevive un refresh
   de la ventana pero se limpia si cierras la app (razonable
   para un punto de venta). Si prefieres que persista entre
   reinicios, cambia sessionStorage por localStorage abajo.
   ============================================================ */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { iniciarSesion as loginRequest } from '../services/auth.service';
import type { Usuario } from '../services/user.service';

// Exportado para que los *.service.ts (fuera de React, sin acceso a
// useAuth()) puedan leer quién está logueado directo de sessionStorage
// y mandarlo como `id_actor` en Bitacora sin duplicar esta constante.
export const SESSION_KEY = 'cuchilla_session';

interface AuthContextValue {
    usuario: Usuario | null;
    isAuthenticated: boolean;
    /** true mientras se revisa si ya había una sesión guardada (evita
     *  un parpadeo hacia el login al recargar). */
    isLoading: boolean;
    iniciarSesion: (identificador: string, password: string) => Promise<Usuario>;
    cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Al montar, recupera la sesión si ya existía (ej. tras F5).
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) setUsuario(JSON.parse(raw));
        } catch {
            // sesión corrupta o storage no disponible: se ignora y se pide login de nuevo
        } finally {
            setIsLoading(false);
        }
    }, []);

    const iniciarSesion = useCallback(async (identificador: string, password: string) => {
        const u = await loginRequest(identificador, password);
        setUsuario(u);
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
        } catch {
            // si falla el storage, la sesión sigue viva en memoria para esta ventana
        }
        return u;
    }, []);

    const cerrarSesion = useCallback(() => {
        setUsuario(null);
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch {
            // no-op
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{ usuario, isAuthenticated: !!usuario, isLoading, iniciarSesion, cerrarSesion }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/** Hook para leer quién inició sesión desde cualquier componente:
 *    const { usuario } = useAuth();
 *    ...registrado_por: usuario?.id_perfil_info ?? null
 */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    }
    return ctx;
}