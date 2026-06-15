import React, { useState, useEffect } from 'react';

// Tipos de traducciones
interface Translations {
  title: string;
  welcome: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  or: string;
  googleLogin: string;
  loginBtn: string;
  loginLoading: string;
  noAccount: string;
  signUp: string;
  joinUs: string;
  selectedWorks: string;
  notificationSuccess: string;
  notificationErrorFields: string;
  notificationGoogle: string;
  notificationSignUp: string;
}

const translations: Record<'es' | 'en', Translations> = {
  es: {
    title: 'Hola Diseñador',
    welcome: 'Te damos la bienvenida a CUCHILLA',
    emailLabel: 'Correo Electrónico',
    emailPlaceholder: 'ejemplo@cuchilla.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Ingresa tu contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    or: 'o',
    googleLogin: 'Iniciar sesión con Google',
    loginBtn: 'Iniciar Sesión',
    loginLoading: 'Autenticando...',
    noAccount: '¿No tienes una cuenta?',
    signUp: 'Regístrate',
    joinUs: 'Únete',
    selectedWorks: 'Trabajos Selectos',
    notificationSuccess: '¡Inicio de sesión exitoso! Redirigiendo...',
    notificationErrorFields: 'Por favor, completa todos los campos obligatorios.',
    notificationGoogle: 'Iniciando autenticación de Google...',
    notificationSignUp: 'Redirigiendo al formulario de registro...',
  },
  en: {
    title: 'Hi Designer',
    welcome: 'Welcome to CUCHILLA',
    emailLabel: 'Email Address',
    emailPlaceholder: 'example@cuchilla.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    forgotPassword: 'Forgot password?',
    or: 'or',
    googleLogin: 'Login with Google',
    loginBtn: 'Login',
    loginLoading: 'Authenticating...',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    joinUs: 'Join Us',
    selectedWorks: 'Selected Works',
    notificationSuccess: 'Login successful! Redirecting...',
    notificationErrorFields: 'Please fill in all required fields.',
    notificationGoogle: 'Starting Google authentication...',
    notificationSignUp: 'Redirecting to register page...',
  },
};

const slides = [
  {
    image: '/login_illustration.png',
    subtitle: 'Canyons & Planets',
    author: 'Andrew.ui',
    role: 'UI & Illustration',
  },
  {
    image: '/login_illustration_2.png',
    subtitle: 'Golden Horizon',
    author: 'Elena.design',
    role: 'Visual Arts & Concept',
  },
];

export default function Login() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const t = translations[lang];

  // Alternar slides automáticamente cada 6 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

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
    }, 1500);
  };

  const handleGoogleLogin = () => {
    triggerToast('info', t.notificationGoogle);
  };

  const handleSignUpClick = () => {
    triggerToast('info', t.notificationSignUp);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-tr from-[#F4F0EB] via-[#FAF6F0] to-[#EAE3D9] selection:bg-[#E58E65] selection:text-white relative overflow-hidden font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border animate-fade-in-up transition-all duration-300 ${
          toast.type === 'success' 
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
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-[#4A7C8E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <div className="absolute inset-0 bg-[#3A322D]/35 z-10 pointer-events-none" />
            <img 
              src={slides[currentSlide].image} 
              alt="Background artwork" 
              className="w-full h-full object-cover transition-all duration-1000 ease-in-out transform scale-105 hover:scale-110"
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

          {/* Left Panel Content Header */}
          <div className="relative z-20 flex items-center justify-between animate-fade-in delay-100">
            <span className="text-xs uppercase tracking-widest font-bold text-white/90 glass-overlay px-3.5 py-1.5 rounded-full">
              {slides[currentSlide].subtitle}
            </span>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleSignUpClick} 
                className="text-sm font-semibold hover:text-[#E58E65] transition-colors cursor-pointer"
              >
                {t.signUp}
              </button>
              <button 
                onClick={handleSignUpClick} 
                className="text-sm font-semibold glass-overlay hover:bg-[#E58E65] hover:border-[#E58E65] px-4 py-1.5 rounded-full transition-all duration-300 cursor-pointer"
              >
                {t.joinUs}
              </button>
            </div>
          </div>

          {/* Left Panel Content Footer: Profile Card */}
          <div className="relative z-20 flex items-end justify-between mt-auto animate-fade-in delay-300">
            
            {/* Glassmorphism Profile */}
            <div className="glass-profile flex items-center gap-3 p-3 rounded-2xl animate-float">
              {/* Initials Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E58E65] to-[#D47A50] flex items-center justify-center font-bold text-sm text-white shadow-md">
                {slides[currentSlide].author.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none mb-1">
                  {slides[currentSlide].author}
                </p>
                <p className="text-[11px] text-white/75 font-medium leading-none">
                  {slides[currentSlide].role}
                </p>
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="flex gap-2">
              <button 
                onClick={handlePrevSlide}
                className="w-9 h-9 rounded-full glass-overlay flex items-center justify-center hover:bg-white hover:text-[#3A322D] transition-all duration-300 cursor-pointer group"
                aria-label="Previous work"
              >
                <svg className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                onClick={handleNextSlide}
                className="w-9 h-9 rounded-full glass-overlay flex items-center justify-center hover:bg-white hover:text-[#3A322D] transition-all duration-300 cursor-pointer group"
                aria-label="Next work"
              >
                <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Right Panel: Form (7 columns) */}
        <div className="lg:col-span-7 bg-white flex flex-col justify-between p-6 lg:p-8 relative">
          
          {/* Header Area: Brand Logo & Language Selector */}
          <div className="flex items-center justify-between animate-fade-in delay-100">
            {/* Logo Brand */}
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 rounded-lg bg-[#E58E65] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                C
              </div>
              <span className="text-xl font-extrabold text-[#3A322D] tracking-tight">
                CUCHILLA
              </span>
            </div>

            {/* Language Selector */}
            <div className="relative">
              <button 
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-300 text-xs font-semibold text-[#655D58] hover:bg-neutral-50 transition-all cursor-pointer"
              >
                {/* Flag Icon */}
                <span className="text-sm">
                  {lang === 'es' ? '🇪🇸' : '🇬🇧'}
                </span>
                <span>{lang.toUpperCase()}</span>
                <svg className={`w-3.5 h-3.5 text-[#8B827C] transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white border border-neutral-100 rounded-xl shadow-lg z-30 overflow-hidden animate-fade-in-up">
                  <button 
                    onClick={() => {
                      setLang('es');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-neutral-50 ${lang === 'es' ? 'text-[#E58E65] bg-[#FFF6F2]/40 font-semibold' : 'text-[#655D58]'}`}
                  >
                    <span>🇪🇸</span> Español (ES)
                  </button>
                  <button 
                    onClick={() => {
                      setLang('en');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-neutral-50 ${lang === 'en' ? 'text-[#E58E65] bg-[#FFF6F2]/40 font-semibold' : 'text-[#655D58]'}`}
                  >
                    <span>🇬🇧</span> English (EN)
                  </button>
                </div>
              )}
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
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-bold text-[#3A322D] uppercase tracking-wider block">
                    {t.passwordLabel}
                  </label>
                  <a href="#forgot" className="text-xs font-semibold text-[#9C432D] hover:underline transition-all">
                    {t.forgotPassword}
                  </a>
                </div>
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

            {/* Divider "or" */}
            <div className="relative flex py-3.5 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-[#8B827C] uppercase select-none">
                {t.or}
              </span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            {/* Google Login Button */}
            <button 
              type="button"
              onClick={handleGoogleLogin}
              className="google-login-btn w-full bg-white text-[#655D58] font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-3.5 cursor-pointer shadow-sm"
            >
              {/* Google SVG Logo */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.02c2.35-2.16 3.7-5.34 3.7-8.74z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.02-3.12c-1.12.75-2.54 1.19-3.91 1.19-3.02 0-5.58-2.04-6.49-4.78H1.38v3.22C3.36 21.67 7.42 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.51 14.38a7.12 7.12 0 0 1 0-4.52V6.64H1.38a11.94 11.94 0 0 0 0 10.96l4.13-3.22z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.42 0 3.36 2.33 1.38 6.64l4.13 3.22c.91-2.74 3.47-4.78 6.49-4.78z"
                />
              </svg>
              <span>{t.googleLogin}</span>
            </button>

            {/* Register redirection text */}
            <div className="mt-4 text-center text-sm">
              <span className="text-[#8B827C] font-medium mr-1.5">{t.noAccount}</span>
              <button 
                onClick={handleSignUpClick}
                className="font-bold text-[#E58E65] hover:text-[#D47A50] transition-colors cursor-pointer hover:underline"
              >
                {t.signUp}
              </button>
            </div>

          </div>

          {/* Social Media Footer Icons */}
          <div className="flex items-center justify-center gap-6 mt-auto pt-3 animate-fade-in delay-500">
            {/* Facebook Icon */}
            <a href="#facebook" className="text-[#8B827C] hover:text-[#E58E65] hover:scale-110 active:scale-95 transition-all duration-200" aria-label="Facebook">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.8z" />
              </svg>
            </a>
            {/* Twitter/X Icon */}
            <a href="#twitter" className="text-[#8B827C] hover:text-[#E58E65] hover:scale-110 active:scale-95 transition-all duration-200" aria-label="Twitter">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* LinkedIn Icon */}
            <a href="#linkedin" className="text-[#8B827C] hover:text-[#E58E65] hover:scale-110 active:scale-95 transition-all duration-200" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
            {/* Instagram Icon */}
            <a href="#instagram" className="text-[#8B827C] hover:text-[#E58E65] hover:scale-110 active:scale-95 transition-all duration-200" aria-label="Instagram">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}
