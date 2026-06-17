import React, { useState } from 'react';
import logo from '../../../assets/logo.png';

const t = {
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-tr from-[#F4F0EB] via-[#FAF6F0] to-[#EAE3D9] selection:bg-[#E58E65] selection:text-white relative overflow-hidden font-sans">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border animate-fade-in-up transition-all duration-300 ${toast.type === 'success'
          ? 'bg-[#F2F7EC] text-[#3C5E1C] border-[#5C8B2F]/20'
          : toast.type === 'error'
            ? 'bg-[#FAEBE8] text-[#6B2A1A] border-[#9C432D]/20'
            : 'bg-[#EDF4F6] text-[#2A4C58] border-[#4A7C8E]/20'
          }`}>
          <div className="flex-shrink-0">
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-[#5C8B2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-[#9C432D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Login Card Container */}
      <div className="login-card-container w-full max-w-5xl bg-white rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-auto lg:h-[580px] relative z-10 transition-all duration-300">

        {/* Left Panel: Visual Carousel (5 columns) */}
        <div className="login-left-panel lg:col-span-5 relative bg-[#3A322D] flex flex-col justify-between p-8 text-white min-h-[350px] lg:min-h-0 select-none">

          {/* Background Image with animation */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[#3A322D]/10 z-10 pointer-events-none" />
            <img
              src={logo}
              alt="Background artwork"
              className="w-full h-full object-container transition-all duration-1000 ease-in-out transform scale-105 hover:scale-110"
            />
          </div>

          {/* Organic Curve Overlay (White SVG eating into the image on the right) */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute top-0 right-0 h-full w-14 text-white fill-current translate-x-[1px] z-10 pointer-events-none hidden lg:block"
          >
            <path d="M100,0 C65,35 65,65 100,100 Z" />
          </svg>

          {/* Left Panel Content Footer: Navigation Arrows only */}
          <div className="relative z-20 flex items-end justify-end mt-auto animate-fade-in delay-300">
            <div className="flex gap-2">
            </div>
          </div>
        </div>

        {/* Right Panel: Form (7 columns) */}
        <div className="lg:col-span-7 bg-white flex flex-col justify-between p-6 lg:p-8 relative">

          {/* Header Area: Brand Logo only (Language selector removed) */}
          <div className="flex items-center justify-between animate-fade-in delay-100">
            {/* Logo Brand */}
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 rounded-lg bg-[#E58E65] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                C
              </div>
              <span className="text-xl font-extrabold text-[#3A322D] tracking-tight">
                LA CUCHILLA
              </span>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="my-auto py-2 max-w-md w-full mx-auto animate-slide-in-right">

            {/* Greeting Title */}
            <div className="mb-4">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-[#3A322D] tracking-tight mb-2">
                {t.title}
              </h2>
              <p className="text-[#8B827C] text-sm font-medium">
                {t.welcome}
              </p>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold text-[#3A322D] uppercase tracking-wider block">
                  {t.emailLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input w-full pl-11 pr-4 py-2.5 rounded-xl text-sm focus:outline-none placeholder-neutral-400"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold text-[#3A322D] uppercase tracking-wider block">
                  {t.passwordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input w-full pl-11 pr-11 py-2.5 rounded-xl text-sm focus:outline-none placeholder-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
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
                  <a href="#forgot" className="text-xs font-semibold text-[#9C432D] hover:underline transition-all">
                    {t.forgotPassword}
                  </a>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="login-btn-submit w-full py-2.5 rounded-xl text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed uppercase"
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
