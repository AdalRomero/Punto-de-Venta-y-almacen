import { useState } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import FormInput from '../../components/FormInput.tsx';
import PasswordInput from '../../components/Passwordinput.tsx';
import { MailIcon, ErrorIcon, SpinnerIcon } from '../../components/Icons.tsx';
import WarningModal from '../../components/modals/WarningModal.tsx';
import SuccessModal from '../../components/modals/SuccessModal.tsx';
import ErrorModal from '../../components/modals/ErrorModal.tsx';
import {
    type Usuario,
    correoAccesoDisponible,
    asignarCredenciales,
} from '../../../src/services/user.service.ts';
import '../../css/credentials.css';

/* ─────────────────────────────────────────────────────────────
   AsignarCredenciales
   Pantalla para dar de alta el correo + contraseña de acceso de
   un perfil que hoy está "Sin Acceso al Sistema". Sigue el mismo
   patrón que NuevoUsuario / DetalleUsuario (recibe el usuario y
   un onBack por props, no usa react-router) para poder montarse
   igual desde users.tsx o desde dentro de detailsuser.tsx.

   Reemplaza al window.prompt() que hoy usa
   detailsuser.tsx -> handleAgregarCredenciales.

   Reusa FormInput / PasswordInput / Icons en vez de <input> e
   íconos sueltos, para no repetir markup ya resuelto en otras
   pantallas (login, etc.).
──────────────────────────────────────────────────────────────── */

interface AsignarCredencialesProps {
    usuario: Usuario;
    onBack: () => void;
    // Se dispara al terminar con éxito, con el correo de acceso ya
    // asignado, para que quien monte este componente pueda
    // actualizar su estado local sin esperar al refresco de la lista.
    onSuccess?: (correoAcceso: string) => void;
}

export default function AsignarCredenciales({ usuario, onBack, onSuccess }: AsignarCredencialesProps) {
    // Estados del formulario
    const [correo, setCorreo] = useState(usuario.contacto?.correo_personal || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Estados para validaciones locales
    const [formError, setFormError] = useState('');
    const [loading, setLoading] = useState(false);

    // Estados de control para los modales
    const [showWarning, setShowWarning] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [apiErrorMsg, setApiErrorMsg] = useState('');

    // Resguardo: si por alguna razón se monta con un usuario que ya
    // tiene acceso, no tiene caso mostrar el formulario.
    if (usuario.auth_usuario) return null;

    // 1. Validaciones locales antes de detonar confirmación
    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const correoLimpio = correo.trim();
        if (!correoLimpio) {
            setFormError('El correo de acceso es obligatorio.');
            return;
        }
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

    // 2. Envío final: valida duplicado de correo y llama a
    //    asignarCredenciales (sp_asignar_credenciales por debajo).
    const handleActualSubmit = async () => {
        setShowWarning(false);
        setLoading(true);

        const correoLimpio = correo.trim();

        try {
            const correoLibre = await correoAccesoDisponible(correoLimpio);
            if (!correoLibre) {
                setApiErrorMsg('Ese correo de acceso ya está en uso por otro usuario.');
                setShowError(true);
                return;
            }

            await asignarCredenciales(usuario.id_perfil_info, correoLimpio, password);
            setShowSuccess(true);
        } catch (err) {
            const esDuplicado =
                err instanceof Error &&
                (/ER_DUP_ENTRY/i.test(err.message) || /1062/.test(err.message) || /duplicate/i.test(err.message));

            setApiErrorMsg(
                esDuplicado
                    ? 'Ese correo de acceso ya fue tomado por otro registro.'
                    : err instanceof Error
                        ? err.message
                        : 'Ocurrió un error al procesar las nuevas credenciales.'
            );
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="asc-page">
            <div className="asc-card card animate-fade-in-up">

                {/* Botón para regresar al listado / detalle sin hacer nada */}
                <button onClick={onBack} className="btn btn-ghost asc-back-btn" type="button">
                    <ArrowLeft size={18} />
                </button>

                <div className="asc-header">
                    <div className="asc-icon-circle">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="asc-title">Generar Acceso</h2>
                    <p className="asc-subtitle">
                        Creando credenciales de autenticación para:<br />
                        <strong>{usuario.nombres} {usuario.apellido_paterno}</strong>
                    </p>
                </div>

                <form onSubmit={handlePreSubmit} className="asc-form">
                    {formError && (
                        <div className="asc-alert">
                            <ErrorIcon />
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Correo de acceso */}
                    <FormInput
                        id="asc-correo"
                        label="Correo de Acceso"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={correo}
                        onChange={setCorreo}
                        className="form-input asc-input"
                        wrapperClassName="asc-input-wrap"
                        iconLeft={<span className="asc-input-icon"><MailIcon /></span>}
                        required
                    />

                    {/* Contraseña inicial */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="asc-password">Contraseña Inicial</label>
                        <PasswordInput
                            id="asc-password"
                            placeholder="Mínimo 8 caracteres"
                            value={password}
                            onChange={setPassword}
                            className="form-input asc-input asc-input-password"
                            wrapperClassName="asc-input-wrap"
                            iconClassName="asc-input-icon"
                            toggleClassName="asc-toggle-btn"
                            required
                        />
                    </div>

                    {/* Confirmar contraseña */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="asc-confirm-password">Confirmar Contraseña</label>
                        <PasswordInput
                            id="asc-confirm-password"
                            placeholder="Repite la contraseña"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            className="form-input asc-input asc-input-password"
                            wrapperClassName="asc-input-wrap"
                            iconClassName="asc-input-icon"
                            toggleClassName="asc-toggle-btn"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary asc-submit-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <SpinnerIcon />
                                Creando Acceso...
                            </>
                        ) : (
                            'Asignar Credenciales'
                        )}
                    </button>
                </form>
            </div>

            {/* Flujo de Modales Reactivos */}
            <WarningModal
                isOpen={showWarning}
                onClose={() => setShowWarning(false)}
                onConfirm={handleActualSubmit}
                title="¿Asignar credenciales de acceso?"
                message="Se dará de alta esta cuenta en el servidor de autenticación de inmediato y se activará el perfil del usuario."
            />

            <SuccessModal
                isOpen={showSuccess}
                onClose={() => {
                    setShowSuccess(false);
                    onSuccess?.(correo.trim());
                    onBack();
                }}
                title="¡Acceso Creado!"
                message="Las credenciales han sido generadas y vinculadas al perfil con éxito."
            />

            <ErrorModal
                isOpen={showError}
                onClose={() => setShowError(false)}
                title="Error de Creación"
                message={apiErrorMsg}
            />
        </div>
    );
}