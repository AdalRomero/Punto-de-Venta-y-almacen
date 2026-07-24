export function formatTiempoRelativo(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'hace un momento';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `hace ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
