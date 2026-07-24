import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import FormInput from '../../components/FormInput';
import { MailIcon, ErrorIcon, SpinnerIcon } from '../../components/Icons';
import WarningModal from '../../components/modals/WarningModal';
import {
    type Usuario,
    correoAccesoDisponible,
    cambiarCorreoAcceso,
} from '../../../src/services/user.service.ts';
import '../../css/email.css';

/* ─────────────────────────────────────────────────────────────
   CambiarCorreo
   Pantalla para cambiar el correo de acceso de un perfil que YA
   tiene credenciales activas. Mismo patrón que AsignarCredenciales
   (props usuario/onBack/onSuccess, sin react-router) para poder
   montarse igual desde detailsuser.tsx.

   Reemplaza al window.prompt() que hoy usa
   detailsuser.tsx -> handleCambiarCorreo.

   A diferencia del original (que tenía "modo admin" vs "modo propio"
   usando dos Edge Functions distintas), aquí solo hay un modo: un
   administrador cambiando el correo de acceso de OTRO usuario, que
   es el único caso que existe en tu esquema (Credenciales.correo_acceso
   vía cambiarCorreoAcceso). Si más adelante agregas un flujo de
   "cambiar mi propio correo", se puede reintroducir esa distinción.
──────────────────────────────────────────────────────────────── */

interface CambiarCorreoProps {
    usuario: Usuario;
    onBack: () => void;
    // Se dispara al terminar con éxito, con el nuevo correo de acceso,
    // para reflejarlo de inmediato en el estado local del padre.
    onSuccess?: (nuevoCorreoAcceso: string) => void;
    showError?: (title: string, message: string) => void;
}

export default function CambiarCorreo({ usuario, onBack, onSuccess, showError }: CambiarCorreoProps) {
    // Estados del formulario
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Estados de los modales
    const [showWarning, setShowWarning] = useState(false);

    // Resguardo: este flujo solo aplica a perfiles que ya tienen
    // credenciales activas (mismo guard que detailsuser.tsx).
    if (!usuario.auth_usuario) return null;

    // 1. Validación local antes de confirmar
    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const correoLimpio = email.trim();
        if (!correoLimpio) {
            setFormError('El nuevo correo es obligatorio.');
            return;
        }
        if (email !== confirmEmail) {
            setFormError('Los correos electrónicos no coinciden.');
            return;
        }

        setShowWarning(true);
    };

    // 2. Envío final: valida duplicado y llama a cambiarCorreoAcceso
    //    (UPDATE Credenciales.correo_acceso por debajo).
    const handleUpdate = async () => {
        setShowWarning(false);
        setLoading(true);

        const correoLimpio = email.trim();

        try {
            const correoLibre = await correoAccesoDisponible(correoLimpio);
            if (!correoLibre) {
                showError?.('Error', 'Ese correo de acceso ya está en uso por otro usuario.');
                return;
            }

            await cambiarCorreoAcceso(usuario.id_perfil_info, correoLimpio);
            onSuccess?.(correoLimpio);
            onBack();
        } catch (err) {
            const esDuplicado =
                err instanceof Error &&
                (/ER_DUP_ENTRY/i.test(err.message) || /1062/.test(err.message) || /duplicate/i.test(err.message));

            showError?.('Error de Actualización', esDuplicado
                ? 'Ese correo de acceso ya fue tomado por otro registro.'
                : err instanceof Error
                    ? err.message
                    : 'Ocurrió un error al actualizar el correo.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cco-page">
            <div className="cco-card card animate-fade-in-up">

                <button onClick={onBack} className="btn btn-ghost cco-back-btn" type="button">
                    <ArrowLeft size={18} />
                </button>

                <div className="cco-header">
                    <div className="cco-icon-circle">
                        <Mail size={32} />
                    </div>
                    <h2 className="cco-title">Modificar Correo de Usuario</h2>
                    <p className="cco-subtitle">
                        Nuevo correo de acceso para:<br />
                        <strong>{usuario.nombres} {usuario.apellido_paterno}</strong>
                    </p>
                </div>

                <form onSubmit={handlePreSubmit} className="cco-form">
                    {formError && (
                        <div className="cco-alert">
                            <ErrorIcon />
                            <span>{formError}</span>
                        </div>
                    )}

                    <FormInput
                        id="cco-email"
                        label="Nuevo Correo Electrónico"
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={setEmail}
                        className="form-input cco-input"
                        wrapperClassName="cco-input-wrap"
                        iconLeft={<span className="cco-input-icon"><MailIcon /></span>}
                        required
                    />

                    <FormInput
                        id="cco-email-confirm"
                        label="Confirmar Nuevo Correo"
                        type="email"
                        placeholder="Repite el correo"
                        value={confirmEmail}
                        onChange={setConfirmEmail}
                        className="form-input cco-input"
                        wrapperClassName="cco-input-wrap"
                        iconLeft={<span className="cco-input-icon"><MailIcon /></span>}
                        required
                    />

                    <button type="submit" className="btn btn-primary cco-submit-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <SpinnerIcon />
                                Procesando...
                            </>
                        ) : (
                            'Forzar Cambio de Correo'
                        )}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline cco-cancel-btn"
                        onClick={onBack}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                </form>
            </div>

            <WarningModal
                isOpen={showWarning}
                onClose={() => setShowWarning(false)}
                onConfirm={handleUpdate}
                title="¿Actualizar correo de acceso?"
                message="El usuario usará este nuevo correo para iniciar sesión a partir de este momento."
            />
        </div>
    );
}