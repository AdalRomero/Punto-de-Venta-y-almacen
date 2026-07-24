import { useCallback, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import "../css/components/Toast.css";

/* ═══════════════════════════════════════════════════════════
   Toast reutilizable — App La Cuchilla
   Úsalo en cualquier pantalla junto con el hook `useToast`:

     const { toast, showToast } = useToast();
     ...
     showToast("success", "Familia creada.");
     ...
     <Toast toast={toast} />

   El hook maneja el timer de auto-cierre (3s) y cancela el
   anterior si se dispara un toast nuevo antes de que expire.
   ═══════════════════════════════════════════════════════════ */

export type ToastTone = "success" | "error";
export type ToastState = { type: ToastTone; message: string } | null;

const DEFAULT_DURATION_MS = 3000;

/** Maneja el estado + el timer de un toast. Devuelve `toast` para
 *  renderizar con <Toast /> y `showToast` para dispararlo. */
export function useToast(durationMs: number = DEFAULT_DURATION_MS) {
    const [toast, setToast] = useState<ToastState>(null);
    const timerRef = useRef<number | null>(null);

    const showToast = useCallback(
        (type: ToastTone, message: string) => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
            setToast({ type, message });
            timerRef.current = window.setTimeout(() => {
                setToast(null);
                timerRef.current = null;
            }, durationMs);
        },
        [durationMs]
    );

    const hideToast = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setToast(null);
    }, []);

    return { toast, showToast, hideToast };
}

/** Toast visual. No hace nada si `toast` es null — se puede dejar
 *  montado siempre al final de la pantalla. */
export default function Toast({ toast }: { toast: ToastState }) {
    if (!toast) return null;

    return (
        <div className={`ui-toast tone-${toast.type}`} role="status" aria-live="polite">
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
        </div>
    );
}