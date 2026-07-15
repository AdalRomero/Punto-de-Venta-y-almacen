import React, { useState } from 'react';
import logo from '../../../assets/logo.png';

const t = {
  brandTag: 'LA CUCHILLA',
  title: 'Hola Usuario!',
  welcome: 'Te damos la bienvenida a LA CUCHILLA',
  emailLabel: 'Correo Electrónico',
  emailPlaceholder: 'ejemplo@cuchilla.com',
  passwordLabel: 'Contraseña',
  passwordPlaceholder: 'Ingresa tu contraseña',
  forgotPassword: '¿Olvidaste tu correo o contraseña?',
  loginBtn: 'Iniciar Sesión',
  loginLoading: 'Autenticando...',
  notificationSuccess: '¡Inicio de sesión exitoso! Redirigiendo...',
  notificationErrorFields: 'Por favor, completa todos los campos obligatorios.',
};


interface LoginProps {
  onSuccess?: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const triggerToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      triggerToast('error', t.notificationErrorFields);
      return;
    }
    setIsLoading(true);
    // Simular llamada a API
    setTimeout(() => {
      setIsLoading(false);
      triggerToast('success', t.notificationSuccess);
      // Redirigir al home después de que el toast sea visible
      setTimeout(() => onSuccess?.(), 900);
    }, 1500);
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
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-[var(--cuh-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-[var(--cuh-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="login-shell w-full max-w-[1400px] mx-auto min-h-screen lg:min-h-0 lg:h-full grid grid-cols-1 lg:grid-cols-12 relative z-10">

        {/* Left Panel: Imagen del logo, sin marcos ni bordes */}
        <div className="login-image-panel lg:col-span-5 relative flex flex-col justify-center items-center min-h-[260px] lg:min-h-0 lg:h-full select-none animate-slide-in-left overflow-hidden">

          {/* Imagen del logo: cubre todo el panel sin deformarse */}
          <img
            src={logo}
            alt="Abarrotes La Cuchilla"
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
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
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-6 9 6M4 10v9a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1v-9" />
                </svg>
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

              {/* Campo de correo — pill */}
              <div className="relative">
                <span className="login-input-icon">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input-pill w-full pl-11 pr-5 py-3 text-sm focus:outline-none"
                />
              </div>

              {/* Campo de contraseña — pill */}
              <div className="relative">
                <span className="login-input-icon">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-12v3H8V7a4 4 0 118 0z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input-pill w-full pl-11 pr-11 py-3 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

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
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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