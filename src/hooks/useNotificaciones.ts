import { useState, useCallback, useEffect } from 'react';
import type { Notificacion } from '../helpers/vite-env.d';
import { 
    listarNotificaciones, 
    marcarLeida as marcarLeidaService, 
    marcarCompletada as marcarCompletadaService, 
    marcarTodasLeidas as marcarTodasLeidasService, 
    eliminarNotificacion as eliminarNotificacionService 
} from '../services/notificaciones.service';

export function useNotificaciones(userId?: string) {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNotificaciones = useCallback(async () => {
        if (!userId) return; // Si no hay usuario cargado aún, no hacemos fetch
        setIsLoading(true);
        try {
            const data = await listarNotificaciones(userId);
            setNotificaciones(data);
        } catch (error) {
            console.error("Error al cargar notificaciones:", error);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Escuchar el canal de cambios en tiempo real (window.api.onChange emite
    // para cualquier entidad; filtramos solo 'notificaciones').
    useEffect(() => {
        if (!userId) return;
        fetchNotificaciones();

        const unsubscribe = window.api.onChange((entity: string) => {
            if (entity === 'notificaciones') fetchNotificaciones();
        });
        return () => unsubscribe();
    }, [fetchNotificaciones, userId]);

    const unreadCount = notificaciones.filter(n => !n.is_read).length;

    const marcarLeida = useCallback(async (id: string) => {
        try {
            await marcarLeidaService(id);
            setNotificaciones(prev => prev.map(n => n.id_notificacion === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error("Error al marcar como leída:", error);
        }
    }, []);

    const marcarCompletada = useCallback(async (id: string) => {
        try {
            await marcarCompletadaService(id);
            setNotificaciones(prev => prev.map(n => n.id_notificacion === id ? { ...n, is_completed: true, is_read: true } : n));
        } catch (error) {
            console.error("Error al marcar completada:", error);
        }
    }, []);

    const marcarTodasComoLeidas = useCallback(async () => {
        try {
            await marcarTodasLeidasService(userId);
            setNotificaciones(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error("Error al marcar todas leídas:", error);
        }
    }, [userId]);

    const eliminar = useCallback(async (id: string) => {
        try {
            await eliminarNotificacionService(id);
            setNotificaciones(prev => prev.filter(n => n.id_notificacion !== id));
        } catch (error) {
            console.error("Error al eliminar notificación:", error);
        }
    }, []);

    return {
        notificaciones,
        isLoading,
        unreadCount,
        marcarLeida,
        marcarCompletada,
        marcarTodasComoLeidas,
        eliminar,
    };
}
