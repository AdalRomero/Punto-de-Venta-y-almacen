import { useState, useEffect } from 'react';
import FormInput from '../../components/FormInput';
import FormSelect from '../../components/FormSelect';
import { UserPlus, ArrowLeft, AlertCircle } from 'lucide-react';
// Modals removidos a favor de Toast
import { usuarioDisponible, correoAccesoDisponible, crearUsuario } from '../../../src/services/user.service.ts';
import { useAuth } from '../../../src/context/AuthContext';
import { esDev } from '../../../src/utils/permisos';
import '../../css/newusers.css';

export default function NuevoUsuario({ onBack, showToast, showError }: { onBack?: () => void; showToast?: (type: 'success' | 'error', msg: string) => void; showError?: (title: string, msg: string) => void }) {
    const { usuario: miUsuario } = useAuth();
    // Solo un Dev puede dar de alta a otro Dev — para cualquier otro
    // rol la opción ni siquiera aparece en el selector.
    const soyDev = esDev(miUsuario?.rol);
    const [enviando, setEnviando] = useState(false);

    const [formData, setFormData] = useState({
        // Perfil_Info
        usuario: '',
        nombres: '',
        apellido_paterno: '',
        apellido_materno: '',
        rol: 'cajero', // ENUM: Dev | administrador | cajero | contador
        // Contacto
        lada: '',
        telefono: '',
        direccion: '',
        correo_personal: '',
        // Credenciales
        correo_acceso: '',
        password: '',
        confirmarPassword: '',
    });

    const [usuarioManual, setUsuarioManual] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);



    // Auto-generación de username a partir de nombres + apellido paterno
    useEffect(() => {
        if (usuarioManual || !formData.nombres || !formData.apellido_paterno) return;

        const generateUsername = async () => {
            const clean = (str: string) =>
                str.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();

            const n = clean(formData.nombres);
            const p = clean(formData.apellido_paterno);
            const m = clean(formData.apellido_materno);

            if (!n || !p) return;

            setIsCheckingUsername(true);

            const candidates: string[] = [];

            // 1. Progresión según letras del nombre + apellido paterno
            for (let i = 1; i <= n.length; i++) {
                candidates.push(`@${n.slice(0, i)}${p}`);
            }

            // 2. Si el paterno sigue ocupado, probamos con el materno
            if (m) {
                for (let i = 1; i <= n.length; i++) {
                    candidates.push(`@${n.slice(0, i)}${p}${m.charAt(0)}`);
                }
            }

            let finalUsername = '';
            for (const candidate of candidates) {
                if (await usuarioDisponible(candidate)) {
                    finalUsername = candidate;
                    break;
                }
            }

            // 3. Último recurso: números
            if (!finalUsername) {
                let counter = 1;
                const base = `@${n.charAt(0)}${p}`;
                while (true) {
                    const attempt = `${base}${counter}`;
                    if (await usuarioDisponible(attempt)) {
                        finalUsername = attempt;
                        break;
                    }
                    counter++;
                }
            }

            setFormData((prev) => ({ ...prev, usuario: finalUsername }));
            setUsernameError('');
            setIsCheckingUsername(false);
        };

        const timer = setTimeout(generateUsername, 500);
        return () => clearTimeout(timer);
    }, [formData.nombres, formData.apellido_paterno, formData.apellido_materno, usuarioManual]);

    // Validar username cuando se edita manualmente
    useEffect(() => {
        if (!usuarioManual || !formData.usuario) return;

        const validateUsername = async () => {
            setIsCheckingUsername(true);
            const disponible = await usuarioDisponible(formData.usuario);
            setUsernameError(disponible ? '' : 'Este nombre de usuario ya está en uso.');
            setIsCheckingUsername(false);
        };

        const timer = setTimeout(validateUsername, 500);
        return () => clearTimeout(timer);
    }, [formData.usuario, usuarioManual]);

    const handleChange = (field: string) => (value: string) => {
        if (field === 'usuario') {
            setUsuarioManual(true);
        }
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Guard anti doble-click: se marca "enviando" ANTES de cualquier
        // validación/await, así un segundo click (o un doble-click muy
        // rápido) que llegue mientras el primero sigue en curso se corta
        // aquí mismo, sin esperar a que React re-renderice el botón con
        // `disabled`. Todo lo que sigue vive en try/finally para que
        // `enviando` siempre se libere, pase lo que pase.
        if (enviando) return;
        setEnviando(true);

        try {
            const camposObligatorios = [
                { campo: formData.nombres, nombre: 'Nombres' },
                { campo: formData.apellido_paterno, nombre: 'Apellido Paterno' },
                { campo: formData.correo_acceso, nombre: 'Correo de Acceso' },
                { campo: formData.usuario, nombre: 'Nombre de Usuario' },
                { campo: formData.password, nombre: 'Contraseña' },
                { campo: formData.confirmarPassword, nombre: 'Confirmar Contraseña' },
            ];
            const campoVacio = camposObligatorios.find((c) => !c.campo || c.campo.trim() === '');

            if (campoVacio) {
                showError?.('Campos incompletos', `El campo "${campoVacio.nombre}" es obligatorio y no puede estar vacío.`);
                return;
            }

            // Resguardo: el selector ya oculta "Dev" para quien no es Dev,
            // pero se valida también aquí por si formData.rol llegó a
            // 'Dev' por cualquier otro camino.
            if (formData.rol === 'Dev' && !soyDev) {
                showError?.('Sin permiso', 'Solo un usuario Dev puede crear otro usuario Dev.');
                return;
            }

            // Límite de contraseña: mínimo 8 caracteres, sin exigir
            // combinación específica (letras, números y/o especiales
            // valen igual, lo único que importa es la longitud).
            if (formData.password.length < 8) {
                showError?.('Contraseña corta', 'La contraseña debe tener al menos 8 caracteres.');
                return;
            }

            if (formData.password !== formData.confirmarPassword) {
                showError?.('Error de validación', 'Las contraseñas no coinciden.');
                return;
            }
            if (usernameError) {
                showError?.('Error de validación', 'Corrija los errores antes de continuar.');
                return;
            }

            // Re-verificación final justo antes de crear: la disponibilidad
            // de usuario/correo pudo checarse hace rato (mientras el usuario
            // seguía escribiendo, o el username se autogeneró una sola vez).
            // Entre ese momento y el submit, alguien más pudo haber tomado
            // ese mismo usuario o correo, así que se valida contra la base
            // de datos una última vez antes de disparar la creación.
            const [usuarioLibre, correoLibre] = await Promise.all([
                usuarioDisponible(formData.usuario),
                correoAccesoDisponible(formData.correo_acceso),
            ]);

            if (!usuarioLibre) {
                showError?.('Usuario ocupado', 'Ese nombre de usuario ya está en uso por otro usuario.');
                return;
            }
            if (!correoLibre) {
                showError?.('Correo ocupado', 'Ese correo de acceso ya está en uso por otro usuario.');
                return;
            }

            await crearUsuario({
                usuario: formData.usuario,
                nombres: formData.nombres,
                apellido_paterno: formData.apellido_paterno,
                apellido_materno: formData.apellido_materno || null,
                rol: formData.rol,
                correo_acceso: formData.correo_acceso,
                password: formData.password,
                correo_personal: formData.correo_personal || null,
                lada: formData.lada || null,
                telefono: formData.telefono || null,
                direccion: formData.direccion || null,
            });

            showToast?.('success', 'Usuario creado exitosamente.');
            if (onBack) onBack();
        } catch (err) {
            // Última línea de defensa: si dos usuarios se registran en el
            // mismo instante, ambos pueden pasar la verificación de arriba
            // y llegar aquí. `usuario` y `correo_acceso` son UNIQUE en la
            // base de datos, así que MySQL rechaza el segundo INSERT con
            // ER_DUP_ENTRY (código 1062). Se traduce a un mensaje claro en
            // vez de mostrar el error crudo del driver.
            const esDuplicado =
                err instanceof Error &&
                (/ER_DUP_ENTRY/i.test(err.message) || /1062/.test(err.message) || /duplicate/i.test(err.message));

            showError?.(esDuplicado ? 'Registro duplicado' : 'Error al crear', esDuplicado
                ? 'El nombre de usuario o el correo de acceso ya fueron tomados por otro registro. Verifica los datos e intenta de nuevo.'
                : err instanceof Error
                    ? err.message
                    : 'Error al crear el usuario.');
        } finally {
            setEnviando(false);
        }
    };



    return (
        <>
            <div className="app-content">
                <div className="nu-page-heading">
                    <div>
                        <h1>Registro de Usuario</h1>
                        <p>Complete los detalles para generar una nueva cuenta de usuario.</p>
                    </div>
                    <div className="nu-action-bar">
                        <button className="btn btn-primary" onClick={() => onBack && onBack()}>
                            <ArrowLeft size={16} /> Regresar
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Perfil_Info */}
                    <div className="form-section nu-section nu-section-perfil">
                        <h3 className="form-section-title">
                            Información Personal
                            <span className="nu-section-tag">Perfil_Info</span>
                        </h3>
                        <div className="form-grid-2">
                            <FormInput
                                label="Nombres"
                                placeholder="Ej. Juan Carlos"
                                value={formData.nombres}
                                onChange={handleChange('nombres')}
                                required
                                id="nu-nombres"
                            />
                            <FormInput
                                label="Apellido Paterno"
                                placeholder="Ej. Delgado"
                                value={formData.apellido_paterno}
                                onChange={handleChange('apellido_paterno')}
                                required
                                id="nu-apellido-paterno"
                            />
                            <FormInput
                                label="Apellido Materno"
                                placeholder="Ej. Torres"
                                value={formData.apellido_materno}
                                onChange={handleChange('apellido_materno')}
                                id="nu-apellido-materno"
                            />
                            <FormSelect
                                label="Rol del Usuario"
                                value={formData.rol}
                                onChange={handleChange('rol')}
                                id="nu-rol"
                                options={[
                                    ...(soyDev ? [{ value: 'Dev', label: 'Dev — Acceso total al sistema' }] : []),
                                    { value: 'administrador', label: 'Administrador — Acceso total (CRUD)' },
                                    { value: 'cajero', label: 'Cajero — Punto de venta' },
                                    { value: 'contador', label: 'Contador — Reportes y finanzas' },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Contacto */}
                    <div className="form-section nu-section nu-section-contacto" style={{ animationDelay: '0.05s' }}>
                        <h3 className="form-section-title">
                            Información de Contacto
                            <span className="nu-section-tag">Contacto</span>
                        </h3>
                        <div className="form-grid-2">
                            <FormInput
                                label="Correo Personal"
                                placeholder="correo@ejemplo.com"
                                value={formData.correo_personal}
                                onChange={handleChange('correo_personal')}
                                type="email"
                                id="nu-correo-personal"
                            />
                            <div className="nu-phone-row">
                                <div className="nu-lada-field">
                                    <FormInput
                                        label="Lada"
                                        placeholder="52"
                                        value={formData.lada}
                                        onChange={handleChange('lada')}
                                        id="nu-lada"
                                    />
                                </div>
                                <div className="nu-phone-field">
                                    <FormInput
                                        label="Teléfono"
                                        placeholder="55 1234 5678"
                                        value={formData.telefono}
                                        onChange={handleChange('telefono')}
                                        id="nu-telefono"
                                    />
                                </div>
                            </div>
                        </div>
                        <FormInput
                            label="Dirección"
                            placeholder="Av. Insurgentes 123, Col. Roma, CDMX"
                            value={formData.direccion}
                            onChange={handleChange('direccion')}
                            id="nu-direccion"
                        />
                    </div>

                    {/* Credenciales */}
                    <div className="form-section nu-section nu-section-credenciales" style={{ animationDelay: '0.1s' }}>
                        <h3 className="form-section-title">
                            Credenciales de Acceso
                            <span className="nu-section-tag">Credenciales</span>
                        </h3>
                        <div className="form-grid-2">
                            <FormInput
                                label="Correo de Acceso"
                                id="input-u-mail"
                                type="email"
                                autoComplete="off"
                                // @ts-ignore
                                name="field_a_random"
                                value={formData.correo_acceso}
                                onChange={handleChange('correo_acceso')}
                                required
                            />
                            <div>
                                <FormInput
                                    label="Nombre de Usuario (único)"
                                    placeholder="Ej. jdelgado"
                                    value={formData.usuario}
                                    onChange={handleChange('usuario')}
                                    required
                                    id="input-u-username"
                                    autoComplete="off"
                                />
                                {isCheckingUsername && <span className="nu-username-hint">Verificando disponibilidad...</span>}
                                {usernameError && (
                                    <div className="nu-username-error">
                                        <AlertCircle size={12} /> {usernameError}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-grid-2" style={{ marginTop: 12 }}>
                            <FormInput
                                label="Contraseña"
                                id="input-u-pass"
                                type="password"
                                autoComplete="new-password"
                                // @ts-ignore
                                name="field_b_random"
                                value={formData.password}
                                onChange={handleChange('password')}
                                required
                            />
                            <FormInput
                                label="Confirmar Contraseña"
                                placeholder="Repite la contraseña"
                                value={formData.confirmarPassword}
                                onChange={handleChange('confirmarPassword')}
                                type="password"
                                required
                                id="nu-confirmar-password"
                                autoComplete="off"
                            />
                        </div>
                        <div className="card card-context context-info nu-info-note">
                            <p>
                                El correo de acceso y el nombre de usuario se usarán para crear la cuenta en el sistema.
                                La contraseña debe tener al menos 8 caracteres (letras, números y/o caracteres especiales).
                            </p>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="nu-action-bar is-footer">
                        <button type="button" className="btn btn-ghost" onClick={() => onBack && onBack()}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={enviando}>
                            <UserPlus size={16} />
                            {enviando ? 'Creando...' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}