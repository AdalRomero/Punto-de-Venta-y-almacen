import React, { useState } from 'react';
import FormInput from '../../components/FormInput';
import PasswordInput from '../../components/Passwordinput';
import { MailIcon, CheckIcon, ErrorIcon, SpinnerIcon, BrandMarkIcon } from '../../components/Icons';
import logo from '../../../assets/logo.png';
import { useAuth } from '../../../src/context/AuthContext.tsx';
import type { Usuario } from '../../../src/services/user.service.ts';

const t = {
  brandTag: 'LA CUCHILLA',
  title: 'Hola Usuario!',
  welcome: 'Te damos la bienvenida a LA CUCHILLA',
  emailLabel: 'Correo o Usuario',
  emailPlaceholder: 'ejemplo@cuchilla.com o tu usuario',
  passwordLabel: 'Contraseña',
  passwordPlaceholder: 'Ingresa tu contraseña',
  forgotPassword: '¿Olvidaste tu correo o contraseña?',
  loginBtn: 'Iniciar Sesión',
  loginLoading: 'Autenticando...',
  notificationSuccess: '¡Inicio de sesión exitoso! Redirigiendo...',
  notificationErrorFields: 'Por favor, completa todos los campos obligatorios.',
};

/* Clases compartidas por ambos campos: mismo pill redondeado, mismo
   padding izquierdo (para el icono), solo cambia el padding derecho
   porque la contraseña además necesita espacio para el botón del ojo. */
const inputPillBase = 'login-input-pill w-full pl-11 py-3 text-sm focus:outline-none';

interface LoginProps {
  onSuccess?: (usuario: Usuario) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  // Un solo campo para correo de acceso o username: el backend
  // (auth:login en main.ts) decide con cuál de los dos matchea.
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // iniciarSesion del contexto: hace la llamada IPC (igual que antes)
  // Y ADEMÁS guarda el usuario en el AuthContext, para que AppLayout
  // sepa quién entró y los demás services puedan leer su id.
  const { iniciarSesion } = useAuth();

  const triggerToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!identificador || !password) {
      triggerToast('error', t.notificationErrorFields);
      return;
    }

    setIsLoading(true);
    try {
      const usuario = await iniciarSesion(identificador, password);
      triggerToast('success', t.notificationSuccess);
      // Redirigir al home después de que el toast sea visible
      setTimeout(() => onSuccess?.(usuario), 900);
    } catch (err) {
      triggerToast('error', err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-bg min-h-screen lg:h-screen w-full lg:overflow-hidden flex items-center justify-center selection:bg-[var(--cuh-primary)] selection:text-white relative font-sans">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border animate-fade-in-up transition-all duration-300 ${toast.type === 'success'
          ? 'bg-[var(--cuh-success-bg)] text-[var(--cuh-success-text)] border-[var(--cuh-success)]/20'
          : toast.type === 'error'
            ? 'bg-[var(--cuh-danger-bg)] text-[var(--cuh-danger-text)] border-[var(--cuh-danger)]/20'
            : 'bg-[var(--cuh-info-bg)] text-[var(--cuh-info-text)] border-[var(--cuh-info)]/20'
          }`}>
          <div className="flex-shrink-0">
            {toast.type === 'success' && <CheckIcon />}
            {toast.type === 'error' && <ErrorIcon />}
          </div>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="login-shell w-full max-w-[1400px] mx-auto min-h-screen lg:min-h-0 lg:h-full grid grid-cols-1 lg:grid-cols-12 relative z-10">

        {/* Left Panel: Imagen del logo, sin marcos ni bordes */}
        <div className="login-image-panel lg:col-span-5 relative flex flex-col justify-center items-center min-h-[260px] lg:min-h-0 lg:h-full select-none animate-slide-in-left overflow-hidden">

          {/* Imagen del logo: se muestra completa sin recortes */}
          <img
            src={logo}
            alt="Abarrotes La Cuchilla"
            className="absolute inset-0 w-full h-full object-contain object-center z-0"
          />

          {/* Tiñe el gris plano de la ilustración con los colores de marca */}
          <div className="login-image-tint" />
          {/* Degradado suave arriba/abajo para profundidad y contraste del badge */}
          <div className="login-image-scrim" />
        </div>

        {/* Right Panel: Form (7 columns) */}
        <div className="login-form-panel lg:col-span-7 flex flex-col justify-center items-center p-6 lg:p-10 relative animate-slide-in-right delay-200 lg:h-full">

          <div className="login-form-card max-w-md w-full mx-auto">

            {/* Marca / Sello decorativo */}
            <div className="flex items-center gap-3 mb-5">
              <div className="login-form-mark shrink-0">
                <BrandMarkIcon />
              </div>
              <span className="text-sm font-bold tracking-wide text-[var(--cuh-text-dark)]">
                {t.brandTag}
              </span>
            </div>

            {/* Greeting Title */}
            <div className="mb-7">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-[var(--cuh-text-dark)] tracking-tight mb-2">
                {t.title}
              </h2>
              <p className="text-[var(--cuh-text-muted)] text-sm font-medium">
                {t.welcome}
              </p>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Campo de correo o usuario — pill */}
              <FormInput
                id="identificador"
                type="text"
                required
                placeholder={t.emailPlaceholder}
                value={identificador}
                onChange={setIdentificador}
                className={`${inputPillBase} pr-5`}
                wrapperClassName="relative"
                iconLeft={
                  <span className="login-input-icon">
                    <MailIcon />
                  </span>
                }
              />

              {/* Campo de contraseña — pill, con candado y ojo mostrar/ocultar */}
              <PasswordInput
                id="password"
                required
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={setPassword}
                className={`${inputPillBase} pr-11`}
              />

              <div className="text-right">
                <a href="#forgot" className="text-xs font-semibold text-[var(--cuh-primary-hover)] hover:underline transition-all">
                  {t.forgotPassword}
                </a>
              </div>

              {/* Submit Button — pill, ancho completo */}
              <button
                type="submit"
                disabled={isLoading}
                className="login-btn-submit w-full py-3.5 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon />
                    <span>{t.loginLoading}</span>
                  </>
                ) : (
                  <span>{t.loginBtn}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}