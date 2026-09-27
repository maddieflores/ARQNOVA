import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import { ApiError } from '../services/http';

export function LoginPage() {
  const { status, sessionError, login, retry } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const submitting = useRef(false);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1130] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p role="status" className="text-sm font-medium tracking-wide text-indigo-200">Comprobando sesión…</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      setPassword('');
      navigate('/dashboard', { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'No se pudo iniciar sesión. Intenta nuevamente.');
      setPassword('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const handleGoogleLogin = () => {
    setInfoModal('El acceso mediante Google Workspace está habilitado para cuentas corporativas. Consulta al administrador para sincronizar tu dominio.');
  };

  const handleForgotPassword = () => {
    setInfoModal('Por motivos de seguridad institucional, el restablecimiento de contraseñas es gestionado por el Administrador del Sistema ARQNOVA.');
  };

  const handleAdminContact = () => {
    setInfoModal('Para solicitar acceso o nuevas credenciales en ARQNOVA, contacta al Administrador de TI de tu organización.');
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#0B1130] lg:bg-[#F6F8FC] dark:lg:bg-[#070B1E] overflow-x-hidden font-sans select-none">

      {/* Modal / Dialog for informational messages */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0E1535] p-6 shadow-2xl text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Información del Sistema</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{infoModal}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEFT COLUMN: ARQNOVA CASE SHOWCASE & HERO PANEL */}
      {/* ========================================================================= */}
      <div className="relative hidden lg:flex flex-1 lg:w-[55%] bg-gradient-to-br from-[#080D26] via-[#0D153A] to-[#181145] p-8 lg:p-14 flex-col justify-between overflow-hidden text-white border-r border-white/10">
        {/* Background ambient lighting effects & subtle grid */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"></div>
        <div className="pointer-events-none absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl"></div>

        {/* Subtle geometric hexagons / grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

        {/* Top Header: Logo and Brand Slogan */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            {/* 3D Layered Isometric Logo Icon */}
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[1.5px] shadow-lg shadow-indigo-500/30">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0A102E]">
                <svg className="h-7 w-7 text-indigo-300" viewBox="0 0 32 32" fill="none">
                  {/* Layer 1 (bottom) */}
                  <path d="M16 26L6 20.5L16 15L26 20.5L16 26Z" fill="url(#logo-grad-1)" opacity="0.6" />
                  {/* Layer 2 (middle) */}
                  <path d="M16 20L6 14.5L16 9L26 14.5L16 20Z" fill="url(#logo-grad-2)" opacity="0.85" />
                  {/* Layer 3 (top) */}
                  <path d="M16 14L6 8.5L16 3L26 8.5L16 14Z" fill="url(#logo-grad-3)" />
                  <defs>
                    <linearGradient id="logo-grad-1" x1="6" y1="20.5" x2="26" y2="20.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366F1" />
                      <stop offset="1" stopColor="#A855F7" />
                    </linearGradient>
                    <linearGradient id="logo-grad-2" x1="6" y1="14.5" x2="26" y2="14.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#818CF8" />
                      <stop offset="1" stopColor="#C084FC" />
                    </linearGradient>
                    <linearGradient id="logo-grad-3" x1="6" y1="8.5" x2="26" y2="8.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#A5B4FC" />
                      <stop offset="1" stopColor="#E879F9" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-wider text-white">ARQNOVA</span>
              <p className="text-[10px] font-bold tracking-[0.28em] text-indigo-300/80 uppercase">
                MODELA • COLABORA • GENERA
              </p>
            </div>
          </div>
        </div>

        {/* Center Content: Headline, Description, Features & Simulated CASE Canvas */}
        <div className="relative z-10 my-8 lg:my-10 space-y-8">
          {/* Main Headline */}
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.18]">
              De tus ideas <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                a soluciones reales
              </span>
            </h2>
            <p className="text-sm sm:text-base text-indigo-200/80 leading-relaxed font-normal">
              Plataforma CASE inteligente para el modelado UML, colaboración en tiempo real y generación automática de backends.
            </p>
          </div>

          {/* Grid with Features on Left & CASE Canvas Simulation on Right */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
            {/* Feature Badges List (4 Cards) */}
            <div className="xl:col-span-5 space-y-3.5">
              {/* Feature 1: UML */}
              <div className="group flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-3 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] hover:border-indigo-400/40 transition-all duration-300 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {/* Diagram Nodes Icon */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="6" height="6" rx="1.5" />
                    <rect x="15" y="15" width="6" height="6" rx="1.5" />
                    <circle cx="18" cy="6" r="3" />
                    <path d="M6 9v3a3 3 0 003 3h6" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition">Diagramas UML</h4>
                  <p className="text-xs text-indigo-200/70">Modela sistemas de forma visual</p>
                </div>
              </div>

              {/* Feature 2: Collaboration */}
              <div className="group flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-3 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] hover:border-purple-400/40 transition-all duration-300 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  {/* Team Users Icon */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-purple-200 transition">Colaboración en tiempo real</h4>
                  <p className="text-xs text-indigo-200/70">Trabaja con tu equipo</p>
                </div>
              </div>

              {/* Feature 3: XMI */}
              <div className="group flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-3 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] hover:border-blue-400/40 transition-all duration-300 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {/* Document / XMI Code Icon */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-blue-200 transition">Importación y exportación XMI</h4>
                  <p className="text-xs text-indigo-200/70">Interoperabilidad garantizada</p>
                </div>
              </div>

              {/* Feature 4: AI Backend Generator */}
              <div className="group flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-3 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] hover:border-pink-400/40 transition-all duration-300 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 border border-pink-400/30">
                  {/* AI Gear & Sparks Icon */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-pink-200 transition">Generación de backend con IA</h4>
                  <p className="text-xs text-indigo-200/70">De diagramas a código funcional</p>
                </div>
              </div>
            </div>

            {/* Simulated CASE Canvas Window (UML Modeling Workbench Preview) */}
            <div className="xl:col-span-7 relative">
              <div className="relative rounded-2xl bg-[#090F2C]/90 border border-indigo-500/25 shadow-2xl backdrop-blur-xl p-4 overflow-hidden">
                {/* Window Topbar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80"></span>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80"></span>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-300/60">diagrama_ecommerce.uml</span>
                  <div className="flex gap-1.5 opacity-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
                  </div>
                </div>

                {/* Canvas Area with Mini Sidebar & Floating UML Classes */}
                <div className="relative mt-3 flex min-h-[220px] rounded-xl bg-[#060A1F]/90 p-3 [background-image:radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:14px_14px]">
                  {/* Mini Toolbar */}
                  <div className="flex flex-col gap-2.5 border-r border-white/10 pr-2.5 text-indigo-400/60">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/30 text-indigo-300">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" strokeWidth="2" /></svg>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/5">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" /></svg>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/5">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" /></svg>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/5">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3" strokeWidth="2" /></svg>
                    </div>
                  </div>

                  {/* Interactive UML Class Diagrams */}
                  <div className="relative flex-1 p-2">
                    {/* SVG Connector Lines */}
                    <svg className="absolute inset-0 h-full w-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                      {/* Line from Cliente to Libro */}
                      <path d="M 80 75 L 80 120 L 130 120 L 130 145" fill="none" stroke="rgba(129, 140, 248, 0.45)" strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Line from Pedido to Libro */}
                      <path d="M 170 75 L 170 120 L 130 120" fill="none" stroke="rgba(192, 132, 252, 0.45)" strokeWidth="1.5" />
                    </svg>

                    {/* Class: Cliente */}
                    <div className="absolute top-1 left-2 w-28 rounded-lg bg-[#141C48]/95 border border-indigo-400/40 shadow-lg text-[10px] overflow-hidden">
                      <div className="bg-indigo-600/40 px-2 py-1 font-bold text-indigo-100 border-b border-indigo-400/30 flex items-center justify-between">
                        <span>Cliente</span>
                        <span className="text-[8px] opacity-60">class</span>
                      </div>
                      <div className="p-1.5 space-y-0.5 font-mono text-[9px] text-indigo-200/90">
                        <div>- id: Long</div>
                        <div>- nombre: String</div>
                        <div>- correo: String</div>
                      </div>
                    </div>

                    {/* Class: Pedido */}
                    <div className="absolute top-1 right-2 w-28 rounded-lg bg-[#19154C]/95 border border-purple-400/40 shadow-lg text-[10px] overflow-hidden">
                      <div className="bg-purple-600/40 px-2 py-1 font-bold text-purple-100 border-b border-purple-400/30 flex items-center justify-between">
                        <span>Pedido</span>
                        <span className="text-[8px] opacity-60">class</span>
                      </div>
                      <div className="p-1.5 space-y-0.5 font-mono text-[9px] text-purple-200/90">
                        <div>- id: Long</div>
                        <div>- fecha: Date</div>
                        <div>- total: Decimal</div>
                      </div>
                    </div>

                    {/* Class: Libro */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 rounded-lg bg-[#111F4E]/95 border border-blue-400/40 shadow-lg text-[10px] overflow-hidden">
                      <div className="bg-blue-600/40 px-2 py-1 font-bold text-blue-100 border-b border-blue-400/30 flex items-center justify-between">
                        <span>Libro</span>
                        <span className="text-[8px] opacity-60">class</span>
                      </div>
                      <div className="p-1.5 space-y-0.5 font-mono text-[9px] text-blue-200/90">
                        <div>- id: Long</div>
                        <div>- titulo: String</div>
                        <div>- autor: String</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Bottom Badge */}
                <div className="mt-3 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 px-3.5 py-1.5 border border-indigo-400/30 backdrop-blur-md text-[11px] font-medium text-indigo-200 shadow-md">
                    <span className="text-yellow-300">✨</span>
                    <span>Convierte tus diagramas en un backend funcional</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Left Footer Info */}
        <div className="relative z-10 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] tracking-wider text-indigo-300/60 uppercase">
          <div>
            <span className="font-bold text-indigo-200">ARQNOVA</span>
            <span className="mx-2">•</span>
            <span>INGENIERÍA DE SOFTWARE</span>
          </div>
          <div>2025</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: AUTHENTICATION CARD PANEL */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative z-20">
        {/* Top Navigation / Help */}
        <div className="flex justify-end text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          <span>¿Primera vez aquí?&nbsp;</span>
          <button
            type="button"
            onClick={handleAdminContact}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 transition cursor-pointer"
          >
            Contacta al administrador
          </button>
        </div>

        {/* Center Auth Card Container */}
        <div className="my-auto py-6 w-full max-w-[440px] mx-auto">
          <div className="rounded-3xl bg-white dark:bg-[#0E1535] p-7 sm:p-10 shadow-2xl shadow-indigo-950/10 dark:shadow-black/40 border border-slate-100/80 dark:border-slate-800">
            {/* Card Brand Header */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-400 p-[2px] shadow-lg shadow-indigo-500/25">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white dark:bg-[#0E1535]">
                  <svg className="h-8 w-8 text-indigo-600 dark:text-indigo-400" viewBox="0 0 32 32" fill="none">
                    <path d="M16 26L6 20.5L16 15L26 20.5L16 26Z" fill="#6366F1" opacity="0.4" />
                    <path d="M16 20L6 14.5L16 9L26 14.5L16 20Z" fill="#818CF8" opacity="0.8" />
                    <path d="M16 14L6 8.5L16 3L26 8.5L16 14Z" fill="#4F46E5" />
                  </svg>
                </div>
              </div>

              <span className="mt-3 text-xl font-extrabold tracking-wide text-slate-900 dark:text-white">ARQNOVA</span>
              <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400 dark:text-slate-400 uppercase">
                PLATAFORMA CASE INTELIGENTE
              </p>

              <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Iniciar sesión
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Inicia sesión para continuar
              </p>
            </div>

            {/* Error or Session Alert */}
            {(error || sessionError) && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 p-3.5 text-xs text-red-800 dark:text-red-300 animate-shake"
              >
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 font-medium">{error || sessionError}</div>
              </div>
            )}

            {/* Session check retry when backend temporarily unavailable */}
            {status === 'unavailable' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline cursor-pointer"
                  onClick={retry}
                >
                  Reintentar comprobación de sesión
                </button>
              </div>
            )}

            {/* Form */}
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate={false}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" id="email-label" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1.5">Email</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    disabled={busy}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@arqnova.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-3 pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" id="password-label" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1.5">Contraseña</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] py-3 pl-11 pr-11 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition cursor-pointer"
                  >
                    {showPassword ? (
                      /* Eye Off */
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      /* Eye */
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Checkbox and Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#131B3E] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  aria-label={busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
                  className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 hover:shadow-indigo-600/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Iniciando sesión…</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span>Iniciar sesión</span>
                    </>
                  )}
                </button>
              </div>

              {/* Validation Status Indicator for Accessibility */}
              {busy && (
                <p role="status" className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  Validando credenciales…
                </p>
              )}
            </form>

            {/* Register Link */}
            <div className="mt-5 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span>¿No tienes una cuenta?&nbsp;</span>
              <Link
                to="/register"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 transition cursor-pointer"
              >
                Regístrate
              </Link>
            </div>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <span className="relative bg-white dark:bg-[#0E1535] px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                o continúa con
              </span>
            </div>

            {/* Secondary Google Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50/80 dark:hover:bg-[#18224d] hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.99] cursor-pointer"
              >
                {/* Official Google 'G' Multi-color SVG */}
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>
            </div>

            {/* Card Footer Slogan */}
            <div className="mt-7 text-center">
              <p className="text-[11px] font-semibold text-slate-400">
                ARQNOVA <span className="text-slate-300 dark:text-slate-600">•</span> Modela. Colabora. Genera.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Right Quote */}
        <div className="flex items-center justify-end gap-2 text-xs text-slate-400 font-medium">
          <span className="italic">"La mejor arquitectura nace de una buena idea."</span>
          <span className="h-0.5 w-6 rounded-full bg-indigo-500"></span>
        </div>
      </div>
    </div>
  );
}
