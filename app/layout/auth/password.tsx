import { useState } from 'react';
import { Lock, ArrowLeft } from 'lucide-react';

import PasswordInput from '../../components/Passwordinput';
import { ErrorIcon, SpinnerIcon } from '../../components/Icons';

import WarningModal from '../../components/modals/WarningModal';

import {
    type Usuario,
    cambiarPassword,
} from '../../../src/services/user.service.ts';

import '../../css/password.css';

/* ─────────────────────────────────────────────────────────────
   CambiarPassword
   Pantalla para forzar una nueva contraseña a un perfil que YA
   tiene credenciales activas. Mismo patrón que AsignarCredenciales
   / CambiarCorreo (props usuario/onBack/onSuccess, sin react-router,
   sin authUsuarioId por state) para poder montarse igual desde
   detailsuser.tsx.

   Reemplaza al window.prompt() que hoy usa
   detailsuser.tsx -> handleCambiarContrasena.
──────────────────────────────────────────────────────────────── */

interface CambiarPasswordProps {
    usuario: Usuario;
    onBack: () => void;
    onSuccess?: () => void;
    showError?: (title: string, message: string) => void;
}

export default function CambiarPassword({ usuario, onBack, onSuccess, showError }: CambiarPasswordProps) {
    // Estados del formulario
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Estados de control para los modales
    const [showWarning, setShowWarning] = useState(false);

    // Resguardo: este flujo solo aplica a perfiles que ya tienen
    // credenciales activas (mismo guard que detailsuser.tsx).
    if (!usuario.auth_usuario) return null;

    // 1. Validar datos locales antes de abrir el modal de confirmación
    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (password !== confirmPassword) {
            setFormError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 8) {
            setFormError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        setShowWarning(true);
    };

    // 2. Ejecutar el cambio de contraseña
    const handleActualReset = async () => {
        setShowWarning(false);
        setLoading(true);

        try {
            await cambiarPassword(usuario.id_perfil_info, password);
            onSuccess?.();
            onBack();
        } catch (err) {
            showError?.('Error', err instanceof Error ? err.message : 'Ocurrió un error al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cpw-page">
            <div className="cpw-card card animate-fade-in-up">

                {/* Botón para regresar si el admin se arrepiente */}
                <button onClick={onBack} className="btn btn-ghost cpw-back-btn" type="button">
                    <ArrowLeft size={18} />
                </button>

                <div className="cpw-header">
                    <div className="cpw-icon-circle">
                        <Lock size={32} />
                    </div>
                    <h2 className="cpw-title">Forzar Contraseña</h2>
                    <p className="cpw-subtitle">
                        Nueva contraseña de acceso para:<br />
                        <strong>{usuario.nombres} {usuario.apellido_paterno}</strong>
                    </p>
                </div>

                <form onSubmit={handlePreSubmit} className="cpw-form">
                    {formError && (
                        <div className="cpw-alert">
                            <ErrorIcon />
                            <span>{formError}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="cpw-password">Nueva Contraseña</label>
                        <PasswordInput
                            id="cpw-password"
                            placeholder="Mínimo 8 caracteres"
                            value={password}
                            onChange={setPassword}
                            className="form-input cpw-input"
                            wrapperClassName="cpw-input-wrap"
                            iconClassName="cpw-input-icon"
                            toggleClassName="cpw-toggle-btn"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="cpw-confirm-password">Confirmar Contraseña</label>
                        <PasswordInput
                            id="cpw-confirm-password"
                            placeholder="Repite la contraseña"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            className="form-input cpw-input"
                            wrapperClassName="cpw-input-wrap"
                            iconClassName="cpw-input-icon"
                            toggleClassName="cpw-toggle-btn"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary cpw-submit-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <SpinnerIcon />
                                Actualizando...
                            </>
                        ) : (
                            'Actualizar Contraseña'
                        )}
                    </button>
                </form>
            </div>

            {/* Renderizado de Modales */}
            <WarningModal
                isOpen={showWarning}
                onClose={() => setShowWarning(false)}
                onConfirm={handleActualReset}
                title="Confirmar Nueva Contraseña"
                message={
                    <>
                        ¿Estás seguro de forzar el cambio de contraseña? El usuario será desconectado y deberá iniciar sesión con la nueva contraseña que acabas de definir.
                    </>
                }
            />
        </div>
    );
}